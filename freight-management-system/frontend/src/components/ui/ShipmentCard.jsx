import { ArrowRight } from 'lucide-react';

const ShipmentCard = ({ shipment, getStatusPill, formatStatus, formatDate, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="group grid cursor-pointer grid-cols-3 gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:border-blue-400 hover:shadow-lg"
    >
      <div className="col-span-2">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusPill(
              shipment.status,
            )}`}
          >
            {formatStatus(shipment.status)}
          </span>
          <p className="text-xs text-slate-400">
            ETA: {formatDate(shipment.estimatedDelivery)}
          </p>
        </div>
        <div className="mt-3">
          <p className="text-sm font-semibold text-blue-600 group-hover:text-blue-700">
            {shipment.trackingNumber || 'N/A'}
          </p>
          <p className="text-sm font-medium text-slate-800">{shipment.fromLocation || 'N/A'}</p>
          <p className="text-xs text-slate-500">to {shipment.toLocation || 'N/A'}</p>
        </div>
      </div>
      <div className="col-span-1 flex items-center justify-end">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-all group-hover:bg-blue-600 group-hover:text-white">
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
};

export default ShipmentCard;
