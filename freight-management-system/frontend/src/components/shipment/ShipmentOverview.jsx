import React, { useMemo } from 'react';
import {
    MapPin, Package, AlertCircle, Truck, Calendar, DollarSign,
    Clock, ShieldCheck, Phone, CheckCircle, Share2
} from 'lucide-react';
import { formatStatus, formatDateTime } from '../../utils/shipmentUtils';

const ShipmentOverview = ({ shipment, handleShareBooking, driverPosition }) => {
    const summaryItems = useMemo(
        () => [
            {
                label: 'Route',
                value: `${shipment?.fromLocation || 'N/A'} -> ${shipment?.toLocation || 'N/A'}`,
                icon: MapPin,
            },
            {
                label: 'Weight',
                value: typeof shipment?.weight === 'number' ? `${shipment.weight} kg` : 'N/A',
                icon: Package,
            },
            {
                label: 'Urgency',
                value: formatStatus(shipment?.urgency),
                icon: AlertCircle,
            },
            {
                label: 'Shipment type',
                value: formatStatus(shipment?.shipmentType),
                icon: Truck,
            },
            {
                label: 'Estimated delivery',
                value: formatDateTime(shipment?.estimatedDelivery),
                icon: Calendar,
            },
            {
                label: 'Cost',
                value:
                    typeof shipment?.cost === 'number'
                        ? `INR ${shipment.cost.toLocaleString('en-IN')}`
                        : 'N/A',
                icon: DollarSign,
            },
        ],
        [shipment],
    );

    const bookingReference = shipment?.trackingNumber || `SHP-${shipment?.id}`;
    const driverInfoComplete =
        Boolean(shipment?.assignedDriver) &&
        Boolean(shipment?.driverPhone) &&
        Boolean(shipment?.vehicleRegistration);

    const lastDriverUpdate = shipment?.driverLocationUpdatedAt
        ? formatDateTime(shipment.driverLocationUpdatedAt)
        : null;

    const driverEtaLabel = shipment?.driverEta
        ? formatDateTime(shipment.driverEta)
        : formatDateTime(shipment?.estimatedDelivery);

    const driverLocationLabel = driverPosition
        ? `${driverPosition[0].toFixed(3)}, ${driverPosition[1].toFixed(3)}`
        : null;

    return (
        <div className="space-y-6 lg:col-span-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-slate-800">Shipment summary</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    {summaryItems.map(({ label, value, icon: Icon }) => (
                        <div
                            key={label}
                            className="flex items-start gap-3 rounded-xl border border-slate-100 px-4 py-3"
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                <Icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
                                <p className="text-sm font-medium text-slate-800">{value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-slate-800">Operational details</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-start gap-3 rounded-xl border border-slate-100 px-4 py-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Pickup time</p>
                            <p className="text-sm font-medium text-slate-800">
                                {formatDateTime(shipment.pickupTime)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl border border-slate-100 px-4 py-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Insurance</p>
                            <p className="text-sm font-medium text-slate-800">
                                {shipment.insuranceStatus
                                    ? formatStatus(shipment.insuranceStatus)
                                    : 'Not provided'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl border border-slate-100 px-4 py-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                            <Phone className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Contact</p>
                            <p className="text-sm font-medium text-slate-800">
                                {shipment.contactName || 'N/A'}
                            </p>
                            <p className="text-xs text-slate-500">{shipment.contactPhone || 'N/A'}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl border border-slate-100 px-4 py-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                            <Truck className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Carrier</p>
                            <p className="text-sm font-medium text-slate-800">
                                {shipment.vendor?.name || shipment.vendorName || 'Unassigned'}
                            </p>
                            <p className="text-xs text-slate-500">
                                {shipment.vendor?.phone || shipment.vendorPhone || ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl border border-slate-100 px-4 py-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                            <CheckCircle className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Driver</p>
                            <p className="text-sm font-medium text-slate-800">
                                {shipment.assignedDriver || 'Awaiting assignment'}
                            </p>
                            <p className="text-xs text-slate-500">{shipment.driverPhone || ''}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-20 w-20 overflow-hidden rounded-2xl bg-slate-100 shadow-inner">
                            {shipment.driverPhotoUrl ? (
                                <img
                                    src={shipment.driverPhotoUrl}
                                    alt={shipment.assignedDriver || 'Driver photo'}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-slate-500">
                                    {(shipment.assignedDriver || 'Driver').charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Driver</p>
                            <p className="text-lg font-semibold text-slate-900">
                                {shipment.assignedDriver || 'Awaiting assignment'}
                            </p>
                            <p className="text-sm text-slate-500">
                                {shipment.driverPhone || 'Transporter will share contact soon.'}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={handleShareBooking}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-500 hover:text-blue-600"
                        >
                            <Share2 className="h-4 w-4" />
                            Share booking
                        </button>
                        {shipment.driverPhone ? (
                            <a
                                href={`tel:${shipment.driverPhone}`}
                                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-emerald-700"
                            >
                                <Phone className="h-4 w-4" />
                                Call driver
                            </a>
                        ) : (
                            <button
                                type="button"
                                disabled
                                className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-500"
                            >
                                <Phone className="h-4 w-4" />
                                Call driver
                            </button>
                        )}
                    </div>
                </div>

                {driverInfoComplete ? (
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Booking reference</p>
                            <p className="text-sm font-semibold text-slate-900">{bookingReference}</p>
                            <p className="text-xs text-slate-500">Share this CRN with operations &amp; security.</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Vehicle</p>
                            <p className="text-sm font-semibold text-slate-900">
                                {shipment.vehicleType || 'N/A'}{' '}
                                {shipment.vehicleModel ? `Â· ${shipment.vehicleModel}` : ''}
                            </p>
                            <p className="text-xs text-slate-500">
                                Registration: {shipment.vehicleRegistration || 'Pending'}
                            </p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Driver ETA</p>
                            <p className="text-sm font-semibold text-slate-900">{driverEtaLabel || 'N/A'}</p>
                            <p className="text-xs text-slate-500">
                                Updated whenever the transporter shares a live ping.
                            </p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Last known position</p>
                            <p className="text-sm font-semibold text-slate-900">
                                {driverLocationLabel || 'Awaiting GPS ping'}
                            </p>
                            <p className="text-xs text-slate-500">
                                {lastDriverUpdate ? `Updated ${lastDriverUpdate}` : 'No live update yet.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                        The transporter is preparing driver and vehicle details. You will see the call and tracking
                        controls once the assignment is published.
                    </div>
                )}
            </section>
        </div>
    );
};

export default ShipmentOverview;
