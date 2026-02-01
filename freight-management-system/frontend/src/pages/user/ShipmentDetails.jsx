import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { useShipmentDetails } from '../../hooks/useShipmentDetails';
import ShipmentHeader from '../../components/shipment/ShipmentHeader';
import ShipmentOverview from '../../components/shipment/ShipmentOverview';
import ShipmentCompliance from '../../components/shipment/ShipmentCompliance';
import MapShell from '../../components/map/MapShell';

const ShipmentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const {
    shipment,
    loading,
    error,
    mapMarkers,
    mapPolyline,
    driverPosition,
    isAdmin,
    // Compliance State
    complianceAction,
    complianceSuccess,
    complianceError,
    downloadingDocId,
    approvingDocId,
    // Actions
    downloadDocument,
    approveDocument,
    runComplianceAction,
  } = useShipmentDetails(id);

  // Re-implemented handleShareBooking locally as it drives UI
  const handleShareBooking = async () => {
    if (!shipment) return;

    const shareLines = [
      `Booking ${shipment.trackingNumber || `SHP-${id}`}`,
      `Route: ${shipment.fromLocation || 'N/A'} -> ${shipment.toLocation || 'N/A'}`,
    ];

    if (shipment.assignedDriver) {
      shareLines.push(
        `Driver: ${shipment.assignedDriver}${shipment.driverPhone ? ` (${shipment.driverPhone})` : ''
        }`
      );
    }

    // ... can expand this logic as per original file if needed, keeping it simple for now as it's UI interaction

    const sharePayload = shareLines.join('\n');

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: `Shipment ${shipment.trackingNumber}`,
          text: sharePayload,
        });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(sharePayload);
        alert('Booking details copied to clipboard.'); // Simple alert for now or use toast if available
      }
    } catch (err) {
      console.error('Share failed', err);
    }
  };

  // Calculate outstandingActions for Compliance Tab
  // This logic was in the component, moving it here or in the hook. 
  // Ideally in the hook, but for now let's calculate here to utilize useMemo.

  const complianceDocs = useMemo(
    () => shipment?.complianceDocs ?? [],
    [shipment?.complianceDocs],
  );

  const latestDocByType = useMemo(() => {
    const map = {};
    complianceDocs.forEach((doc) => {
      if (!map[doc.type]) {
        map[doc.type] = doc;
      }
    });
    return map;
  }, [complianceDocs]);

  const outstandingActions = useMemo(() => {
    const actions = [];
    const driverKyc = latestDocByType.DRIVER_KYC;
    const vehicleKyc = latestDocByType.VEHICLE_KYC;
    const rcmDoc = latestDocByType.SELF_INVOICE_RCM;
    const ewayDoc = latestDocByType.EWAY_BILL;

    if (!driverKyc || driverKyc.status !== 'APPROVED') {
      actions.push('Driver KYC must be approved before pickup.');
    }
    if (!vehicleKyc || vehicleKyc.status !== 'APPROVED') {
      actions.push('Vehicle KYC must be approved before pickup.');
    }
    if (!rcmDoc || rcmDoc.status === 'REJECTED') {
      actions.push('Generate and review RCM self-invoice.');
    }
    if (!ewayDoc || ewayDoc.status === 'REJECTED') {
      actions.push('Generate an active e-way bill for this shipment.');
    }

    return actions;
  }, [latestDocByType]);


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading shipment details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-600" />
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Error</h2>
          <p className="mb-6 text-gray-600">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="rounded-lg bg-blue-600 px-6 py-3 text-white transition hover:bg-blue-700"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!shipment) return null;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'compliance', label: 'Compliance' },
  ];

  const bookingReference = shipment.trackingNumber || `SHP-${id}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <ShipmentHeader
          shipment={shipment}
          navigate={navigate}
          bookingReference={bookingReference}
        />

        {complianceSuccess && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {complianceSuccess}
          </div>
        )}

        {complianceError && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {complianceError}
          </div>
        )}

        <div className="mb-8 inline-flex flex-wrap gap-2 rounded-full border border-slate-200 bg-white p-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${isActive
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <ShipmentOverview
              shipment={shipment}
              handleShareBooking={handleShareBooking}
              driverPosition={driverPosition}
            />

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-800">Live route</h2>
              <MapShell markers={mapMarkers} polyline={mapPolyline} driverPosition={driverPosition} />
              <div className="mt-4 space-y-2 text-sm text-slate-500">
                <p>E-way bill: {shipment.ewayBillNumber || 'Not generated'}</p>
                <p>GST document ID: {shipment.gstInvoiceId || 'Pending'}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'compliance' && (
          <ShipmentCompliance
            shipment={shipment}
            outstandingActions={outstandingActions}
            handleDownloadDocument={downloadDocument}
            handleApproveDocument={approveDocument}
            handleComplianceAction={runComplianceAction}
            isAdmin={isAdmin}
            complianceAction={complianceAction}
            downloadingDocId={downloadingDocId}
            approvingDocId={approvingDocId}
          />
        )}
      </div>
    </div>
  );
};

export default ShipmentDetails;
