import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapPin, Package, Clock, ArrowRight, Calculator, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import MapShell from '../../components/map/MapShell';
import BottomSheet from '../../components/ui/BottomSheet';
import FloatingActionButton from '../../components/ui/FloatingActionButton';

const FreightCalculationPage = () => {
  const navigate = useNavigate();
  const { api, user } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(true);
  const [mapMarkers, setMapMarkers] = useState([]);
  const [mapPolyline, setMapPolyline] = useState([]);

  const [formData, setFormData] = useState({
    fromLocation: '',
    toLocation: '',
    fromLat: '',
    fromLng: '',
    toLat: '',
    toLng: '',
    weight: '',
    shipmentType: 'STANDARD',
    urgency: 'MEDIUM',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role === 'AGENT') {
      navigate('/transporter/inbox', { replace: true });
    }
  }, [user, navigate]);

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const geocodeLocation = async (location) => {
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: location,
          format: 'json',
          limit: 1,
        },
      });

      if (response.data && response.data.length > 0) {
        return {
          lat: parseFloat(response.data[0].lat),
          lng: parseFloat(response.data[0].lon),
        };
      }
      return null;
    } catch (geocodeError) {
      console.error('Geocoding error:', geocodeError);
      return null;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMapMarkers([]);
    setMapPolyline([]);

    try {
      let fromCoords = { lat: formData.fromLat, lng: formData.fromLng };
      let toCoords = { lat: formData.toLat, lng: formData.toLng };

      if (!formData.fromLat || !formData.fromLng) {
        fromCoords = await geocodeLocation(formData.fromLocation);
        if (!fromCoords) {
          setError('Could not locate pickup address. Try a more precise location.');
          setLoading(false);
          return;
        }
      }

      if (!formData.toLat || !formData.toLng) {
        toCoords = await geocodeLocation(formData.toLocation);
        if (!toCoords) {
          setError('Could not locate drop-off address. Try a more precise location.');
          setLoading(false);
          return;
        }
      }

      try {
        const routeResponse = await axios.get(
          `https://router.project-osrm.org/route/v1/driving/${fromCoords.lng},${fromCoords.lat};${toCoords.lng},${toCoords.lat}`,
          {
            params: {
              overview: 'full',
              geometries: 'geojson',
            },
          },
        );

        const geometry = routeResponse.data?.routes?.[0]?.geometry?.coordinates || [];
        if (geometry.length > 0) {
          setMapPolyline(geometry.map(([lng, lat]) => [lat, lng]));
        } else {
          setMapPolyline([]);
        }
      } catch (routeError) {
        console.warn('Unable to draw route', routeError);
        setMapPolyline([]);
      }

      setMapMarkers([
        { label: 'origin', position: [fromCoords.lat, fromCoords.lng] },
        { label: 'destination', position: [toCoords.lat, toCoords.lng] },
      ]);

      const response = await api.post('/freight/calculate', {
        ...formData,
        fromLat: fromCoords.lat,
        fromLng: fromCoords.lng,
        toLat: toCoords.lat,
        toLng: toCoords.lng,
        weight: parseFloat(formData.weight),
      });

      navigate('/select-vendor', {
        state: {
          calculationData: response.data,
          quotes: response.data.quotes || [],
          distance: response.data.distance,
          needsQuote: response.data.needsQuote,
          unmatchedVendors: response.data.unmatchedVendors || [],
        },
      });
    } catch (submitError) {
      console.error('Freight calculation failed:', submitError);
      setError(submitError.response?.data?.error || 'Unable to calculate freight. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (user?.role === 'AGENT') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="rounded-3xl border border-blue-500/30 bg-blue-500/10 px-6 py-8 text-center text-sm text-blue-100 shadow-2xl">
          Redirecting to your transporter workspace…
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-white">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="group absolute left-6 top-6 z-20 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur transition hover:bg-white/20"
      >
        <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
        Back
      </button>
      <MapShell markers={mapMarkers} polyline={mapPolyline} />

      <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-blue-200">Plan a shipment</p>
              <h1 className="text-3xl font-semibold">Calculate freight instantly</h1>
              <p className="mt-2 text-sm text-slate-300">
                Enter pickup, drop-off, and load details to see transporter options tailored to your route.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGoBack}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-200 hover:bg-blue-600/20 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/20 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Pickup location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    name="fromLocation"
                    value={formData.fromLocation}
                    onChange={handleChange}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-900 shadow-inner transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder="Where should we pick up?"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Drop-off location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    name="toLocation"
                    value={formData.toLocation}
                    onChange={handleChange}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-900 shadow-inner transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder="Where should it arrive?"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Weight (kg)
              </label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  required
                  min="0.1"
                  step="0.1"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-900 shadow-inner transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  placeholder="500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Shipment type
              </label>
              <select
                name="shipmentType"
                value={formData.shipmentType}
                onChange={handleChange}
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 px-4 text-slate-900 shadow-inner transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="STANDARD">Standard</option>
                <option value="EXPRESS">Express</option>
                <option value="FRAGILE">Fragile</option>
                <option value="HAZARDOUS">Hazardous</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Urgency
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <select
                  name="urgency"
                  value={formData.urgency}
                  onChange={handleChange}
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-900 shadow-inner transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Urgency helps us prioritize speed when ranking transporter options.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <Calculator className="h-5 w-5 animate-spin" />
                Calculating routes...
              </>
            ) : (
              <>
                Show transporter options
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>

          <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-3">
            <div>
              <p className="font-semibold text-slate-900">Instant quotes</p>
              <p>Compare prices from multiple transporters in seconds.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Optimized routes</p>
              <p>Powered by open mapping for accurate distance and ETA.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Real-time tracking</p>
              <p>Stay informed from assignment to delivery confirmation.</p>
            </div>
          </div>
        </form>
      </BottomSheet>

      {!sheetOpen && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <FloatingActionButton
            icon={Calculator}
            label="Plan a shipment"
            className="pointer-events-auto shadow-xl"
            onClick={() => setSheetOpen(true)}
          />
        </div>
      )}
    </div>
  );
};

export default FreightCalculationPage;
