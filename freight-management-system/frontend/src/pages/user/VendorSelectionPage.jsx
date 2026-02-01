import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Check,
  MapPin,
  Calendar,
  DollarSign,
  Truck,
  ArrowLeft,
  Star,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const VendorSelectionPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { api } = useAuth();

  const {
    calculationData,
    quotes = [],
    distance,
    needsQuote = false,
    unmatchedVendors = [],
  } = location.state || {};

  // State for existing quotes
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTransporters, setSelectedTransporters] = useState(
    unmatchedVendors.map((vendor) => vendor.vendorId),
  );
  const [quoteNotes, setQuoteNotes] = useState('');
  // State for requesting new quotes
  const [quoteRequesting, setQuoteRequesting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quoteSuccess, setQuoteSuccess] = useState('');

  useEffect(() => {
    if (quotes.length === 0) {
      setSelectedVendor(null);
    }
  }, [quotes.length]);

  const toggleTransporter = (vendorId) => {
    setSelectedTransporters((prev) =>
      prev.includes(vendorId)
        ? prev.filter((id) => id !== vendorId)
        : [...prev, vendorId]
    );
    setQuoteError('');
  };

  const handleQuoteRequest = async () => {
    if (!calculationData) {
      setQuoteError('Shipment details missing. Recalculate freight to request a quotation.');
      return;
    }

    if (selectedTransporters.length === 0) {
      setQuoteError('Select at least one transporter to notify.');
      return;
    }

    setQuoteRequesting(true);
    setQuoteError('');
    setQuoteSuccess('');

    try {
      await api.post('/quotes', {
        fromLocation: calculationData.fromLocation,
        toLocation: calculationData.toLocation,
        fromLat: calculationData.fromLat,
        fromLng: calculationData.fromLng,
        toLat: calculationData.toLat,
        toLng: calculationData.toLng,
        weight: parseFloat(calculationData.weight),
        shipmentType: calculationData.shipmentType,
        urgency: calculationData.urgency,
        notes: quoteNotes,
        vendorIds: selectedTransporters,
      });

      setQuoteSuccess('Quotation request sent. We will notify you as soon as transporters respond.');
      setQuoteNotes('');
    } catch (err) {
      setQuoteError(err.response?.data?.error || 'Failed to submit quotation request.');
    } finally {
      setQuoteRequesting(false);
    }
  };

  const showQuotePanel = needsQuote || unmatchedVendors.length > 0;

  if (!calculationData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">No Calculation Data</h2>
          <p className="mb-6 text-gray-600">Please calculate freight first.</p>
          <button
            onClick={() => navigate('/calculate')}
            className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
          >
            Calculate Freight
          </button>
        </div>
      </div>
    );
  }

  const handleConfirmBooking = async () => {
    if (!selectedVendor) {
      setError('Please select a transporter');
      return;
    }

    if (
      !selectedVendor.agreementId &&
      Array.isArray(unmatchedVendors) &&
      unmatchedVendors.length
    ) {
      setError(
        'This transporter does not have an agreement for the selected corridor. Redirecting you to quote onboarding...',
      );
      setTimeout(() => {
        navigate('/quotes', {
          state: {
            calculationData,
            unmatchedVendors,
            needsQuote: true,
          },
        });
      }, 1500);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/shipments', {
        fromLocation: calculationData.fromLocation,
        toLocation: calculationData.toLocation,
        fromLat: calculationData.fromLat,
        fromLng: calculationData.fromLng,
        toLat: calculationData.toLat,
        toLng: calculationData.toLng,
        weight: parseFloat(calculationData.weight),
        shipmentType: calculationData.shipmentType,
        urgency: calculationData.urgency,
        selectedVendorId: selectedVendor.vendorId,
        agreementId: selectedVendor.agreementId,
        rateCardId: selectedVendor.rateCardId,
        cost: selectedVendor.cost,
        distance: selectedVendor.distance,
        estimatedDelivery: selectedVendor.estimatedDelivery,
      });

      navigate(`/shipments/${response.data.shipment.id}`, {
        state: { message: 'Shipment created successfully!' },
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create shipment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Calculate
          </button>

          <h1 className="mb-2 text-3xl font-bold text-gray-900">Select Transporter</h1>
          <p className="text-gray-600">Choose the best option for your shipment</p>
        </div>

        <div className="mb-6 rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Shipment Details</h2>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-500">From</p>
                <p className="font-medium text-gray-900">{calculationData.fromLocation}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 rotate-180 text-red-600" />
              <div>
                <p className="text-sm text-gray-500">To</p>
                <p className="font-medium text-gray-900">{calculationData.toLocation}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Truck className="mt-0.5 h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-500">Weight</p>
                <p className="font-medium text-gray-900">{calculationData.weight} kg</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-500">Distance</p>
                <p className="font-medium text-gray-900">{distance} km</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {quotes.length > 0 && (
          <>
            <div className="mb-6 space-y-4">
              {quotes.map((quote, index) => (
                <div
                  key={quote.vendorId}
                  onClick={() => {
                    setSelectedVendor(quote);
                    setError('');
                  }}
                  className={`cursor-pointer rounded-lg bg-white p-6 shadow-md transition ${
                    selectedVendor?.vendorId === quote.vendorId
                      ? 'border border-blue-500 ring-2 ring-blue-400'
                      : 'hover:shadow-lg'
                  }`}
                >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-3 flex items-center gap-3">
                    <h3 className="text-xl font-bold text-gray-900">{quote.vendorName}</h3>
                    {index === 0 && (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                        Best Value
                      </span>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Price</p>
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(quote.cost)}</p>
                        {quote.appliedRatePerKm && (
                          <p className="text-xs text-gray-500">
                            {formatCurrency(quote.appliedRatePerKm)} per km
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Delivery</p>
                        <p className="font-medium text-gray-900">{formatDate(quote.estimatedDelivery)}</p>
                        {quote.rateCardRoute && (
                          <p className="text-xs text-gray-500">Route: {quote.rateCardRoute}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-yellow-400" />
                        <div>
                          <p className="text-sm text-gray-500">Rating</p>
                          <p className="font-medium text-gray-900">{quote.rating.toFixed(1)} / 5.0</p>
                        </div>
                      </div>
                      {quote.vehicleType && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Truck className="h-4 w-4 text-gray-400" />
                          <span>{quote.vehicleType}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {selectedVendor?.vendorId === quote.vendorId && (
                  <div className="ml-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
                      <Check className="h-5 w-5 text-white" />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                {quote.agreementTitle
                  ? `Agreement in force: ${quote.agreementTitle}`
                  : 'No active agreement � shipment will be booked on standard transporter terms.'}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm text-gray-600">Selected Transporter</p>
              <p className="text-lg font-bold text-gray-900">
                {selectedVendor ? selectedVendor.vendorName : 'None selected'}
              </p>
              {selectedVendor && (
                <>
                  <p className="mt-2 text-2xl font-bold text-blue-600">{formatCurrency(selectedVendor.cost)}</p>
                  {selectedVendor.rateCardRoute && (
                    <p className="mt-1 text-xs text-gray-500">
                      Agreement route: {selectedVendor.rateCardRoute}
                      {selectedVendor.agreementTitle ? ` � ${selectedVendor.agreementTitle}` : ''}
                    </p>
                  )}
                  {!selectedVendor.agreementTitle && (
                    <p className="mt-1 text-xs font-medium text-amber-600">
                      This shipment will be created under standard transporter terms (no agreement).
                    </p>
                  )}
                </>
              )}
            </div>

            <button
              onClick={handleConfirmBooking}
              disabled={!selectedVendor || loading}
              className="rounded-lg bg-blue-600 px-8 py-3 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Confirming...' : 'Confirm Booking'}
            </button>
          </div>
            </div>
          </>
        )}

        {showQuotePanel && quotes.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 shadow-sm">
            <div className="text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
              <h3 className="mt-2 text-lg font-semibold text-slate-800">
                No instant quotes available for this route.
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                You can request a custom quotation from available transporters.
              </p>
            </div>

            <div className="mx-auto mt-6 max-w-2xl">
              {quoteSuccess ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-center text-green-700">
                  <CheckCircle className="h-6 w-6" />
                  <p className="font-semibold">{quoteSuccess}</p>
                </div>
              ) : (
                <>
                  <h4 className="text-sm font-semibold text-slate-700">
                    Select transporters to notify:
                  </h4>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {unmatchedVendors.map((vendor) => (
                      <label
                        key={vendor.vendorId}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition ${
                          selectedTransporters.includes(vendor.vendorId)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTransporters.includes(vendor.vendorId)}
                          onChange={() => toggleTransporter(vendor.vendorId)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-medium text-slate-800">{vendor.vendorName}</span>
                      </label>
                    ))}
                  </div>

                  <div className="mt-4">
                    <textarea
                      value={quoteNotes}
                      onChange={(e) => setQuoteNotes(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border-slate-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Add any special instructions or notes for the transporters (optional)..."
                    />
                  </div>

                  {quoteError && (
                    <p className="mt-2 text-sm text-red-600">{quoteError}</p>
                  )}

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleQuoteRequest}
                      disabled={quoteRequesting}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {quoteRequesting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {quoteRequesting ? 'Sending Request...' : 'Request Quotation'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/calculate')}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back to calculation
          </button>
        </div>
      </div>
    </div>
  );
};

export default VendorSelectionPage;
