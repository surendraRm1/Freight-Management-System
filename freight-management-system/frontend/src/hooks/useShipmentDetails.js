import { useState, useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export const useShipmentDetails = (id) => {
    const { api, user } = useAuth();
    const [shipment, setShipment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Compliance / Action states
    const [complianceAction, setComplianceAction] = useState('');
    const [complianceError, setComplianceError] = useState('');
    const [complianceSuccess, setComplianceSuccess] = useState('');
    const [downloadingDocId, setDownloadingDocId] = useState(null);
    const [approvingDocId, setApprovingDocId] = useState(null);

    // Map states
    const [mapMarkers, setMapMarkers] = useState([]);
    const [mapPolyline, setMapPolyline] = useState([]);

    const isAdmin = user?.role === 'ADMIN';
    const isShipmentOwner = shipment?.user?.id === user?.id;
    const canDownloadDocs = isAdmin || isShipmentOwner;

    const fetchShipmentDetails = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get(`/shipments/${id}`);
            setShipment(response.data.shipment || response.data); // Handle potential response variations
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to fetch shipment details.');
        } finally {
            setLoading(false);
        }
    }, [api, id]);

    // Initial fetch
    useEffect(() => {
        if (id) fetchShipmentDetails();
    }, [fetchShipmentDetails, id]);

    // Route / Map Logic
    useEffect(() => {
        if (!shipment) return;

        const loadRoute = async () => {
            const fromLat = Number(shipment?.fromLat);
            const fromLng = Number(shipment?.fromLng);
            const toLat = Number(shipment?.toLat);
            const toLng = Number(shipment?.toLng);
            const driverLatRaw = shipment?.driverLastKnownLat;
            const driverLngRaw = shipment?.driverLastKnownLng;
            const hasDriverCoords =
                typeof driverLatRaw === 'number' &&
                typeof driverLngRaw === 'number' &&
                !Number.isNaN(driverLatRaw) &&
                !Number.isNaN(driverLngRaw);

            if (
                Number.isNaN(fromLat) ||
                Number.isNaN(fromLng) ||
                Number.isNaN(toLat) ||
                Number.isNaN(toLng)
            ) {
                setMapMarkers([]);
                setMapPolyline([]);
                return;
            }

            const markers = [
                { label: 'origin', position: [fromLat, fromLng] },
                { label: 'destination', position: [toLat, toLng] },
            ];

            if (hasDriverCoords) {
                markers.push({
                    label: 'driver',
                    position: [driverLatRaw, driverLngRaw],
                });
            }

            setMapMarkers(markers);

            try {
                const routeResponse = await axios.get(
                    `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}`,
                    {
                        params: {
                            overview: 'full',
                            geometries: 'geojson',
                        },
                    }
                );
                const geometry =
                    routeResponse.data?.routes?.[0]?.geometry?.coordinates || [];
                setMapPolyline(geometry.map(([lng, lat]) => [lat, lng]));
            } catch (routeError) {
                console.warn('Unable to fetch shipment route', routeError);
                setMapPolyline([]);
            }
        };

        loadRoute();
    }, [shipment]);

    // Actions
    const downloadDocument = async (doc) => {
        if (!doc) return;
        if (!canDownloadDocs) {
            setComplianceError('You can only download documents for shipments linked to your account.');
            return;
        }

        try {
            setDownloadingDocId(doc.id);
            setComplianceError('');
            const response = await api.get(`/compliance/documents/${doc.id}/download`, {
                responseType: 'blob',
            });
            const blob = new Blob([response.data], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${doc.type?.toLowerCase() || 'document'}-${doc.id}.json`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setComplianceError(err.response?.data?.error || 'Failed to download document.');
        } finally {
            setDownloadingDocId(null);
        }
    };

    const approveDocument = async (doc) => {
        if (!doc) return;
        try {
            setApprovingDocId(doc.id);
            setComplianceError('');
            await api.post(`/compliance/documents/${doc.id}/approve`);
            setComplianceSuccess('KYC document approved.');
            await fetchShipmentDetails();
        } catch (err) {
            setComplianceError(err.response?.data?.error || 'Failed to approve document.');
        } finally {
            setApprovingDocId(null);
        }
    };

    const runComplianceAction = async (action) => {
        if (!shipment || !isAdmin) return;

        const actions = {
            gst: () => api.post('/compliance/gst', { shipmentId: shipment.id }),
            rcm: () => api.post('/compliance/rcm', { shipmentId: shipment.id }),
            eway: () => api.post('/compliance/eway/create', { shipmentId: shipment.id }),
        };

        const executor = actions[action];
        if (!executor) return;

        try {
            setComplianceAction(action);
            setComplianceError('');
            const response = await executor();
            if (response?.status === 204) {
                setComplianceSuccess('RCM self-invoice not required for this shipment.');
            } else {
                setComplianceSuccess('Compliance document generated successfully.');
            }
            await fetchShipmentDetails();
        } catch (err) {
            setComplianceError(err.response?.data?.error || 'Failed to process compliance request.');
        } finally {
            setComplianceAction('');
        }
    };

    const clearMessages = () => {
        setComplianceSuccess('');
        setComplianceError('');
    };

    // Helper calculation for driver position
    const driverPosition = useMemo(() => {
        if (
            typeof shipment?.driverLastKnownLat === 'number' &&
            typeof shipment?.driverLastKnownLng === 'number'
        ) {
            return [shipment.driverLastKnownLat, shipment.driverLastKnownLng];
        }
        return null;
    }, [shipment?.driverLastKnownLat, shipment?.driverLastKnownLng]);

    return {
        shipment,
        loading,
        error,
        mapMarkers,
        mapPolyline,
        driverPosition,
        user,
        isAdmin,

        // Compliance state
        complianceAction,
        complianceError,
        complianceSuccess,
        downloadingDocId,
        approvingDocId,

        // Actions
        downloadDocument,
        approveDocument,
        runComplianceAction,
        clearMessages,
        refresh: fetchShipmentDetails
    };
};
