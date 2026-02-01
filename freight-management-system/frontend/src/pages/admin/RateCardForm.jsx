import { useEffect, useMemo } from 'react';
import { PlusCircle } from 'lucide-react';

const uomOptions = ['Per Trip', 'Per KM', 'Per Hour', 'Per Day', 'Per Load'];

const RateCardForm = ({
  draft,
  onFieldChange,
  onSubmit,
  onCancelEdit,
  isEditing,
  agreementOptions,
  selectedAgreementLabel,
  resolveTransporterName,
}) => {
  const autoRouteName = useMemo(() => {
    const origin = draft.origin.trim();
    const destination = draft.destination.trim();
    if (!origin || !destination) {
      return '';
    }

    const transporterName = resolveTransporterName(draft.agreementId);
    const base = `${origin} -> ${destination}`;
    return transporterName ? `${base} | ${transporterName}` : base;
  }, [draft.origin, draft.destination, draft.agreementId, resolveTransporterName]);

  useEffect(() => {
    if (draft.routeName !== autoRouteName) {
      onFieldChange({ target: { name: 'routeName', value: autoRouteName } });
    }
  }, [autoRouteName, draft.routeName, onFieldChange]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Rate Cards</h2>
        {isEditing && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Cancel edit
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Define route-specific rates. These entries drive freight quote recommendations.
      </p>

      <div className="mt-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Route Name *</label>
            <input
              type="text"
              name="routeName"
              value={draft.routeName}
              readOnly
              className="block w-full rounded-lg border border-gray-300 bg-slate-100 py-2 px-3 text-slate-600 focus:outline-none"
              placeholder="Auto-generated"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Vehicle Type *</label>
            <input
              type="text"
              name="vehicleType"
              value={draft.vehicleType}
              onChange={onFieldChange}
              className="block w-full rounded-lg border border-gray-300 py-2 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="Trailer / 32FT SXL"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Origin *</label>
            <input
              type="text"
              name="origin"
              value={draft.origin}
              onChange={onFieldChange}
              className="block w-full rounded-lg border border-gray-300 py-2 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="Mumbai"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Destination *</label>
            <input
              type="text"
              name="destination"
              value={draft.destination}
              onChange={onFieldChange}
              className="block w-full rounded-lg border border-gray-300 py-2 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="Chennai"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Distance (KM)</label>
            <input
              type="number"
              name="distanceKm"
              value={draft.distanceKm}
              onChange={onFieldChange}
              min="0"
              className="block w-full rounded-lg border border-gray-300 py-2 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="1150"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Rate Amount *</label>
            <input
              type="number"
              name="ratePerKm"
              value={draft.ratePerKm}
              onChange={onFieldChange}
              min="0"
              step="0.01"
              className="block w-full rounded-lg border border-gray-300 py-2 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="14.5"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Effective From</label>
            <input
              type="date"
              name="effectiveFrom"
              value={draft.effectiveFrom}
              onChange={onFieldChange}
              className="block w-full rounded-lg border border-gray-300 py-2 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Unit of Measure *</label>
            <select
              name="uomSelection"
              value={draft.uomSelection}
              onChange={onFieldChange}
              className="block w-full rounded-lg border border-gray-300 py-2 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              {uomOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
              <option value="CUSTOM">Custom...</option>
            </select>
            {draft.uomSelection === 'CUSTOM' && (
              <input
                type="text"
                name="uom"
                value={draft.uom}
                onChange={onFieldChange}
                className="mt-2 block w-full rounded-lg border border-gray-300 py-2 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Per Container, Per Load"
              />
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Linked Agreement *</label>
            <select
              name="agreementId"
              value={draft.agreementId}
              onChange={onFieldChange}
              className="block w-full rounded-lg border border-gray-300 py-2 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              disabled={agreementOptions.length === 0}
            >
              <option value="">Select agreement</option>
              {agreementOptions}
            </select>
            <p className="mt-1 text-xs text-slate-500">{selectedAgreementLabel}</p>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Remarks</label>
          <textarea
            name="remarks"
            value={draft.remarks}
            onChange={onFieldChange}
            rows={2}
            className="block w-full rounded-lg border border-gray-300 py-2 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            placeholder="Weekend surcharge, toll conditions, etc."
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700"
          >
            <PlusCircle className="h-5 w-5" />
            {isEditing ? 'Update Rate Card' : 'Add Rate Card'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RateCardForm;
