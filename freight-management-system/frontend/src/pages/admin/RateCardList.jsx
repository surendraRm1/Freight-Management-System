import { Pencil, Copy, Trash2 } from 'lucide-react';

const RateCardList = ({
  rateCards,
  onEdit,
  onClone,
  onDelete,
  selectedAgreement,
}) => {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Rate Cards ({rateCards.length})
        </h2>
        {selectedAgreement && (
          <span className="text-xs text-slate-500">
            Editing: {selectedAgreement.title}
          </span>
        )}
      </div>

      {rateCards.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          Add rate cards to define route-specific pricing for this agreement.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Origin</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Rate</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Effective</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {rateCards.map((card, index) => {
                return (
                  <tr key={index}>
                    <td className="px-4 py-3 font-medium text-slate-900">{card.routeName}</td>
                    <td className="px-4 py-3">{card.origin}</td>
                    <td className="px-4 py-3">{card.destination}</td>
                    <td className="px-4 py-3">{card.ratePerKm} / {card.uom}</td>
                    <td className="px-4 py-3">{card.vehicleType}</td>
                    <td className="px-4 py-3">
                      {card.effectiveFrom ? new Date(card.effectiveFrom).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(index)}
                          className="rounded-lg border border-blue-200 p-1 text-blue-600 hover:bg-blue-50"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onClone(index)}
                          className="rounded-lg border border-amber-200 p-1 text-amber-600 hover:bg-amber-50"
                          title="Clone"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(index)}
                          className="rounded-lg border border-red-200 p-1 text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RateCardList;

