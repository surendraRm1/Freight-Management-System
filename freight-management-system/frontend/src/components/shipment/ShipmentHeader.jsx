import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { formatStatus, formatDateTime, getStatusPill, getCompliancePill } from '../../utils/shipmentUtils';

const ShipmentHeader = ({ shipment, navigate, bookingReference }) => {
    return (
        <>
            <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="mb-6 inline-flex items-center gap-2 text-gray-600 transition hover:text-gray-900"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
            </button>

            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">
                        Shipment #{shipment.trackingNumber || shipment.id}
                    </h1>
                    <p className="text-sm text-gray-500">
                        Created {formatDateTime(shipment.createdAt)}
                    </p>
                    <p className="text-xs text-gray-400">CRN: {bookingReference}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <span
                        className={`inline-flex items-center rounded-full border px-4 py-1 text-sm font-semibold ${getStatusPill(
                            shipment.status
                        )}`}
                    >
                        {formatStatus(shipment.status)}
                    </span>
                    <span
                        className={`inline-flex items-center rounded-full border px-4 py-1 text-xs font-semibold ${getCompliancePill(
                            shipment.complianceStatus
                        )}`}
                    >
                        Compliance: {formatStatus(shipment.complianceStatus)}
                    </span>
                </div>
            </div>
        </>
    );
};

export default ShipmentHeader;
