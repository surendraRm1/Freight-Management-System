export const formatStatus = (value) =>
    String(value || '')
        .replace(/_/g, ' ')
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

export const formatDateTime = (value) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const getStatusPill = (status) => {
    const colors = {
        PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        ASSIGNED: 'bg-blue-100 text-blue-800 border-blue-200',
        PICKED_UP: 'bg-purple-100 text-purple-800 border-purple-200',
        IN_TRANSIT: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        DELIVERED: 'bg-green-100 text-green-800 border-green-200',
        CANCELLED: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
};

export const getCompliancePill = (status) => {
    const colors = {
        PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
        SUBMITTED: 'bg-sky-100 text-sky-800 border-sky-200',
        APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        REJECTED: 'bg-rose-100 text-rose-800 border-rose-200',
        EXEMPT: 'bg-purple-100 text-purple-800 border-purple-200',
    };
    return colors[status] || 'bg-slate-100 text-slate-600 border-slate-200';
};
