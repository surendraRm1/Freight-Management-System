import React, { useMemo } from 'react';
import { Download, CheckCircle, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { formatStatus, formatDateTime } from '../../utils/shipmentUtils';

const ShipmentCompliance = ({
    shipment,
    outstandingActions,
    handleDownloadDocument,
    handleApproveDocument,
    handleComplianceAction,
    isAdmin,
    complianceAction,
    downloadingDocId,
    approvingDocId
}) => {

    const complianceDocs = useMemo(
        () => shipment?.complianceDocs ?? [],
        [shipment?.complianceDocs],
    );

    return (
        <div className="space-y-6">
            {outstandingActions.length > 0 && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                    <h2 className="text-lg font-semibold text-amber-800">Outstanding actions</h2>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-amber-800">
                        {outstandingActions.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">Compliance overview</h2>
                        <p className="text-sm text-slate-500">
                            Track statutory documents linked to this shipment.
                        </p>
                    </div>
                    {isAdmin && (
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => handleComplianceAction('gst')}
                                disabled={complianceAction === 'gst'}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                            >
                                {complianceAction === 'gst' ? (
                                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                                ) : null}
                                Generate GST
                            </button>
                            <button
                                type="button"
                                onClick={() => handleComplianceAction('rcm')}
                                disabled={complianceAction === 'rcm'}
                                className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
                            >
                                {complianceAction === 'rcm' ? (
                                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                                ) : null}
                                Generate RCM
                            </button>
                            <button
                                type="button"
                                onClick={() => handleComplianceAction('eway')}
                                disabled={complianceAction === 'eway'}
                                className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300"
                            >
                                {complianceAction === 'eway' ? (
                                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                                ) : null}
                                Generate E-way
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
                    <div className="grid grid-cols-12 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <div className="col-span-4">Document Type</div>
                        <div className="col-span-3">Status</div>
                        <div className="col-span-3">Issued Date</div>
                        <div className="col-span-2 text-right">Actions</div>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {complianceDocs.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-slate-500">
                                <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                                No compliance documents generated yet.
                            </div>
                        ) : (
                            complianceDocs.map((doc) => (
                                <div key={doc.id} className="grid grid-cols-12 items-center px-4 py-3 text-sm transition hover:bg-slate-50">
                                    <div className="col-span-4 font-medium text-slate-900">
                                        {formatStatus(doc.type)}
                                    </div>
                                    <div className="col-span-3">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${doc.status === 'APPROVED'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : doc.status === 'REJECTED'
                                                        ? 'bg-rose-100 text-rose-800'
                                                        : 'bg-amber-100 text-amber-800'
                                                }`}
                                        >
                                            {formatStatus(doc.status)}
                                        </span>
                                    </div>
                                    <div className="col-span-3 text-slate-500">
                                        {formatDateTime(doc.issuedAt || doc.createdAt)}
                                    </div>
                                    <div className="col-span-2 flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadDocument(doc)}
                                            disabled={downloadingDocId === doc.id}
                                            className="text-slate-400 transition hover:text-blue-600 disabled:opacity-50"
                                            title="Download"
                                        >
                                            {downloadingDocId === doc.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Download className="h-4 w-4" />
                                            )}
                                        </button>
                                        {isAdmin && doc.status === 'SUBMITTED' && (
                                            <button
                                                type="button"
                                                onClick={() => handleApproveDocument(doc)}
                                                disabled={approvingDocId === doc.id}
                                                className="text-slate-400 transition hover:text-emerald-600 disabled:opacity-50"
                                                title="Approve"
                                            >
                                                {approvingDocId === doc.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <CheckCircle className="h-4 w-4" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default ShipmentCompliance;
