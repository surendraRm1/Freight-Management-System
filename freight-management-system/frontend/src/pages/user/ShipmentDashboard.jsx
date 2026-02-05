import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  Package,
  ArrowRight,
  Loader2,
  Truck,
  Activity,
  AlertTriangle,
  CircleDollarSign,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/ui/StatCard';
import { ShipmentList } from '../../components/ShipmentList';
import { FinanceDashboard } from '../../components/FinanceDashboard';
import UserInsightsPanel from '../../components/user/UserInsightsPanel';

const formatStatus = (status) =>
  String(status || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (error) {
    return 'N/A';
  }
};

const formatCurrency = (amount, currency = 'INR') => {
  if (amount === null || amount === undefined) return `${currency} 0.00`;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    const coerced = Number(amount) || 0;
    return `${currency} ${coerced.toFixed(2)}`;
  }
};

const getStatusPill = (status) => {
  const colors = {
    PENDING: 'bg-amber-100 text-amber-800 border border-amber-200',
    PENDING_QUOTE: 'bg-purple-100 text-purple-800 border border-purple-200',
    QUOTE_SUBMITTED: 'bg-sky-100 text-sky-800 border border-sky-200',
    QUOTE_APPROVED: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    REQUESTED: 'bg-amber-100 text-amber-800 border border-amber-200',
    ASSIGNED: 'bg-blue-100 text-blue-800 border border-blue-200',
    ACCEPTED: 'bg-blue-100 text-blue-800 border border-blue-200',
    REJECTED: 'bg-rose-100 text-rose-800 border border-rose-200',
    IN_TRANSIT: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    DELIVERED: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    CANCELLED: 'bg-rose-100 text-rose-800 border border-rose-200',
  };
  return colors[status] || 'bg-slate-100 text-slate-700 border border-slate-200';
};

const getPaymentPill = (status) => {
  const colors = {
    PENDING: 'bg-amber-100 text-amber-800 border border-amber-200',
    AUTHORIZED: 'bg-sky-100 text-sky-800 border border-sky-200',
    PAID: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    FAILED: 'bg-rose-100 text-rose-800 border border-rose-200',
    REFUNDED: 'bg-purple-100 text-purple-800 border border-purple-200',
    CANCELLED: 'bg-slate-100 text-slate-600 border border-slate-200',
  };
  return colors[status] || 'bg-slate-100 text-slate-600 border border-slate-200';
};

const HERO_ACTION_STYLES = {
  primary:
    'inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-lg transition hover:bg-white/90',
  secondary:
    'inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-lg ring-1 ring-white/40 transition hover:bg-white/25',
  ghost:
    'inline-flex items-center gap-2 rounded-full border border-white/40 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/20',
};

const ROLE_DASHBOARD_CONFIG = {
  COMPANY_ADMIN: {
    hero: {
      badge: 'Live control tower',
      title: 'Stay ahead of every shipment',
      subtitle:
        'Launch new consignments, monitor fleet performance, and tap Tara for quick recommendations without leaving this dashboard.',
      gradient: 'from-blue-600 via-indigo-600 to-purple-600',
      actions: [
        {
          label: 'Create shipment',
          to: '/calculate',
          icon: PlusCircle,
          variant: 'primary',
          className: 'text-blue-700',
        },
        {
          label: 'View all shipments',
          scrollTo: 'shipments',
          icon: Truck,
          variant: 'secondary',
        },
      ],
    },
    sections: {
      stats: true,
      shipmentList: true,
      finance: true,
      billing: true,
      actionCenter: true,
      recentTable: true,
      tara: true,
      insights: false,
    },
  },
  FINANCE_APPROVER: {
    hero: {
      badge: 'Finance desk',
      title: 'Finance control room',
      subtitle: 'Approve POD, unblock pending payouts, and post entries to ERP from a single view.',
      gradient: 'from-emerald-600 via-emerald-700 to-teal-600',
      actions: [
        {
          label: 'Review pending invoices',
          scrollTo: 'finance',
          icon: CircleDollarSign,
          variant: 'primary',
          className: 'text-emerald-700',
        },
        {
          label: 'Open finance workspace',
          navigateTo: '/finance',
          icon: ArrowRight,
          variant: 'ghost',
        },
      ],
    },
    sections: {
      stats: false,
      shipmentList: false,
      finance: true,
      billing: true,
      actionCenter: false,
      recentTable: false,
      tara: true,
      insights: false,
    },
  },
  OPERATIONS: {
    hero: {
      badge: 'Ops cockpit',
      title: 'Keep assignments moving',
      subtitle: 'Prioritize loads needing confirmation, trigger transporter follow-ups, and log POD from one place.',
      gradient: 'from-amber-500 via-orange-500 to-rose-500',
      actions: [
        {
          label: 'Create shipment',
          to: '/calculate',
          icon: PlusCircle,
          variant: 'primary',
          className: 'text-amber-700',
        },
        {
          label: 'Open action centre',
          scrollTo: 'action',
          icon: AlertTriangle,
          variant: 'secondary',
        },
      ],
    },
    sections: {
      stats: true,
      shipmentList: true,
      finance: false,
      billing: false,
      actionCenter: true,
      recentTable: true,
      tara: true,
      insights: false,
    },
  },
  TRANSPORTER: {
    hero: {
      badge: 'Transporter tools',
      title: 'Your assigned loads',
      subtitle: 'Respond to allocations, upload POD, and manage driver details without switching tabs.',
      gradient: 'from-slate-900 via-slate-800 to-gray-700',
      actions: [
        {
          label: 'Open transporter inbox',
          navigateTo: '/transporter/inbox',
          icon: ArrowRight,
          variant: 'primary',
        },
        {
          label: 'View driver directory',
          navigateTo: '/transporter/drivers',
          icon: Truck,
          variant: 'ghost',
        },
      ],
    },
    sections: {
      stats: true,
      shipmentList: true,
      finance: false,
      billing: false,
      actionCenter: false,
      recentTable: true,
      tara: true,
      insights: false,
    },
  },
  USER: {
    hero: {
      badge: 'Client workspace',
      title: 'Track awarded shipments',
      subtitle: 'Monitor delivery milestones, review transporter performance, and raise new quote requests.',
      gradient: 'from-cyan-600 via-blue-600 to-indigo-600',
      actions: [
        {
          label: 'Request new quotes',
          to: '/quotes',
          icon: PlusCircle,
          variant: 'primary',
          className: 'text-cyan-700',
        },
        {
          label: 'Track live shipments',
          scrollTo: 'shipments',
          icon: Truck,
          variant: 'secondary',
        },
      ],
    },
    sections: {
      stats: true,
      shipmentList: true,
      finance: false,
      billing: false,
      actionCenter: false,
      recentTable: true,
      tara: true,
      insights: true,
    },
  },
  SUPER_ADMIN: {
    hero: {
      badge: 'Platform notice',
      title: 'Switch to platform view',
      subtitle: 'Tenant dashboards are limited. Use the Super Admin workspace for cross-company analytics.',
      gradient: 'from-slate-900 via-purple-900 to-black',
      actions: [
        {
          label: 'Open Super Admin',
          navigateTo: '/super-admin/dashboard',
          icon: ArrowRight,
          variant: 'primary',
        },
      ],
    },
    sections: {
      stats: false,
      shipmentList: false,
      finance: false,
      billing: false,
      actionCenter: false,
      recentTable: false,
      tara: false,
    },
    notice:
      'Need to review tenant shipments? Impersonate from the Super Admin area to avoid mixing production data.',
  },
};

ROLE_DASHBOARD_CONFIG.DEFAULT = ROLE_DASHBOARD_CONFIG.USER;

const ShipmentDashboard = () => {
  const { api, user } = useAuth();
  const normalizedRole = (user?.role || 'USER').toUpperCase();
  const roleConfig = ROLE_DASHBOARD_CONFIG[normalizedRole] || ROLE_DASHBOARD_CONFIG.DEFAULT;
  const { hero: heroConfig, sections, notice } = roleConfig;
  const navigate = useNavigate();
  const shipmentsSectionRef = useRef(null);
  const financeSectionRef = useRef(null);
  const actionSectionRef = useRef(null);

  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [billingToast, setBillingToast] = useState(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState({});

  const handleHeroAction = useCallback(
    (action) => {
      if (action.navigateTo) {
        navigate(action.navigateTo);
        return;
      }
      if (action.scrollTo === 'shipments') {
        shipmentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action.scrollTo === 'finance') {
        financeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action.scrollTo === 'action') {
        actionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [navigate],
  );

  const loadShipments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/shipments');
      const payload = response.data;
      const normalized = Array.isArray(payload) ? payload : payload?.shipments || [];
      setShipments(normalized);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch shipments.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  const stats = useMemo(() => {
    const delivered = shipments.filter((item) => item.status === 'DELIVERED').length;
    const inTransit = shipments.filter((item) => item.status === 'IN_TRANSIT').length;
    const assigned = shipments.filter((item) => item.status === 'ASSIGNED').length;
    const accepted = shipments.filter((item) => item.status === 'ACCEPTED').length;
    const attentionStatuses = ['PENDING', 'REQUESTED', 'QUOTE_APPROVED', 'PENDING_QUOTE'];
    const attention = shipments.filter((item) => attentionStatuses.includes(item.status)).length;

    return {
      total: shipments.length,
      delivered,
      live: inTransit + assigned + accepted,
      attention,
    };
  }, [shipments]);

  const recentShipments = useMemo(() => {
    const sorted = [...shipments].sort((a, b) => {
      const timeA = a.updatedAt || a.createdAt || a.estimatedDelivery;
      const timeB = b.updatedAt || b.createdAt || b.estimatedDelivery;
      return new Date(timeB || 0) - new Date(timeA || 0);
    });
    return sorted.slice(0, 6);
  }, [shipments]);

  const actionRequired = useMemo(() => {
    const actionableStatuses = ['PENDING', 'REQUESTED', 'QUOTE_APPROVED', 'PENDING_QUOTE'];
    return shipments.filter((item) => actionableStatuses.includes(item.status)).slice(0, 4);
  }, [shipments]);

  const billingQueue = useMemo(() => {
    if (!Array.isArray(shipments)) return [];
    return shipments
      .map((shipment) => {
        const invoice = shipment.invoice || null;
        const payments = Array.isArray(shipment.payments) ? shipment.payments : [];
        const latestPayment = payments[0] || null;
        const paymentStatus = shipment.paymentStatus || 'PENDING';
        const amount = invoice?.grandTotal ?? shipment.cost ?? 0;
        const currency = latestPayment?.currency || 'INR';
        const dueDate = invoice?.dueDate;
        const processingStatuses = new Set(['PENDING', 'AUTHORIZED']);
        const canInitiatePayment =
          invoice && invoice.status === 'ISSUED' && !['PAID', 'REFUNDED', 'CANCELLED'].includes(paymentStatus);

        return {
          shipment,
          invoice,
          payments,
          latestPayment,
          paymentStatus,
          amount,
          currency,
          dueDate,
          canInitiatePayment,
          processing: processingStatuses.has(paymentStatus),
        };
      })
      .filter((entry) => entry.invoice || entry.paymentStatus !== 'PENDING');
  }, [shipments]);

  const handleCreatePayment = useCallback(
    async (shipment) => {
      setBillingToast(null);
      setPaymentSubmitting((prev) => ({ ...prev, [shipment.id]: true }));
      try {
        const payload = {
          shipmentId: shipment.id,
          amount: shipment.invoice?.grandTotal ?? shipment.cost ?? undefined,
          currency: 'INR',
        };
        const response = await api.post('/payments', payload);
        const payment = response.data?.payment;
        setBillingToast({
          tone: 'success',
          message:
            payment?.status === 'PAID'
              ? 'Payment captured successfully.'
              : 'Payment initiated successfully. We will notify you once it is confirmed.',
        });
        await loadShipments();
      } catch (err) {
        setBillingToast({
          tone: 'error',
          message: err.response?.data?.error || 'Failed to initiate payment.',
        });
      } finally {
        setPaymentSubmitting((prev) => ({ ...prev, [shipment.id]: false }));
      }
    },
    [api, loadShipments],
  );

  const heroGradient = heroConfig?.gradient || 'from-blue-600 via-indigo-600 to-purple-600';
  const heroBadge = heroConfig?.badge || 'Live control tower';
  const heroTitle = heroConfig?.title || 'Stay ahead of every shipment';
  const heroSubtitle =
    heroConfig?.subtitle ||
    'Launch new consignments, monitor fleet performance, and tap Tara for quick recommendations.';
  const heroActions = heroConfig?.actions || [];

  const renderHeroAction = (action) => {
    const Icon = action.icon;
    const baseClass = HERO_ACTION_STYLES[action.variant || 'secondary'];
    const className = `${baseClass} ${action.className || ''}`.trim();

    if (action.to) {
      return (
        <Link key={action.label} to={action.to} className={className}>
          {Icon && <Icon className="h-4 w-4" />}
          {action.label}
        </Link>
      );
    }

    return (
      <button key={action.label} type="button" onClick={() => handleHeroAction(action)} className={className}>
        {Icon && <Icon className="h-4 w-4" />}
        {action.label}
      </button>
    );
  };

  const shouldRenderSecondaryGrid =
    sections.recentTable || sections.billing || sections.actionCenter || sections.tara;

  return (
    <div className="space-y-6 pb-16">
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className={`grid gap-6 ${sections.stats ? 'lg:grid-cols-2' : ''}`}>
        <div
          className={`relative overflow-hidden rounded-3xl bg-gradient-to-r ${heroGradient} p-8 text-white shadow-xl`}
        >
          <div className="absolute inset-y-0 right-0 w-1/2 rotate-6 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90 backdrop-blur">
              {heroBadge}
            </span>
            <h1 className="mt-4 text-3xl font-semibold">{heroTitle}</h1>
            <p className="mt-3 text-sm text-white/80">{heroSubtitle}</p>
            {heroActions.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-3">{heroActions.map(renderHeroAction)}</div>
            )}
          </div>
        </div>

        {sections.stats && (
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard title="Total shipments" value={stats.total} icon={Package} description="All time" />
            <StatCard
              title="Delivered"
              value={stats.delivered}
              icon={Activity}
              iconColor="text-emerald-500"
              description="Completed consignments"
            />
            <StatCard
              title="Live"
              value={stats.live}
              icon={Truck}
              iconColor="text-indigo-500"
              description="In transit"
            />
            <StatCard
              title="Needs attention"
              value={stats.attention}
              icon={AlertTriangle}
              iconColor="text-amber-500"
              description="Action items"
            />
          </div>
        )}
      </section>

      {sections.insights && <UserInsightsPanel />}

      {notice && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{notice}</div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="space-y-8">
          {sections.shipmentList && (
            <div ref={shipmentsSectionRef}>
              <ShipmentList />
            </div>
          )}
          {sections.finance && (
            <div ref={financeSectionRef}>
              <FinanceDashboard />
            </div>
          )}
          {shouldRenderSecondaryGrid && (
            <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
              <div className="flex flex-col gap-6">
                {sections.recentTable && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-slate-900">Recent shipments</h2>
                      <span className="text-xs text-slate-500">Latest updates</span>
                    </div>
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-6 py-3 text-left font-semibold">Shipment</th>
                            <th className="px-6 py-3 text-left font-semibold">Route</th>
                            <th className="px-6 py-3 text-left font-semibold">Status</th>
                            <th className="px-6 py-3 text-left font-semibold">ETA</th>
                            <th className="px-6 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {recentShipments.length > 0 ? (
                            recentShipments.map((shipment) => (
                              <tr
                                key={shipment.id}
                                className="group cursor-pointer transition hover:bg-slate-50"
                                onClick={() => navigate(`/shipments/${shipment.id}`)}
                              >
                                <td className="px-6 py-4">
                                  <p className="text-sm font-semibold text-blue-600">
                                    {shipment.trackingNumber || 'N/A'}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    Updated {formatDate(shipment.updatedAt || shipment.createdAt)}
                                  </p>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="text-sm text-slate-900">{shipment.fromLocation || 'N/A'}</p>
                                  <p className="text-xs text-slate-400">to {shipment.toLocation || 'N/A'}</p>
                                  {shipment.notes && <p className="mt-1 text-[11px] text-amber-600">{shipment.notes}</p>}
                                </td>
                                <td className="px-6 py-4">
                                  <span
                                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${getStatusPill(
                                      shipment.status,
                                    )}`}
                                  >
                                    {formatStatus(shipment.status)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500">
                                  {formatDate(shipment.estimatedDelivery)}
                                </td>
                                <td className="px-6 py-4 text-right text-slate-400">
                                  <ArrowRight className="h-4 w-4" />
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="5" className="px-6 py-12 text-center text-sm text-slate-500">
                                <Package className="mx-auto h-12 w-12 text-slate-300" />
                                <p className="mt-2 font-semibold text-slate-600">No shipments yet</p>
                                <p className="text-xs text-slate-400">
                                  Kickstart operations by creating your first shipment.
                                </p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {sections.billing && (
                  <>
                    {billingToast && (
                      <div
                        className={`rounded-3xl border px-4 py-3 text-sm ${
                          billingToast.tone === 'success'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-rose-200 bg-rose-50 text-rose-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p>{billingToast.message}</p>
                          <button
                            type="button"
                            onClick={() => setBillingToast(null)}
                            className="text-xs font-semibold uppercase tracking-wide"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-emerald-900">Billing & payments</h3>
                          <p className="mt-1 text-xs text-emerald-700">
                            Track invoice status and settle dues instantly.
                          </p>
                        </div>
                        <CircleDollarSign className="h-6 w-6 text-emerald-500" />
                      </div>
                      <div className="mt-4 space-y-3">
                        {billingQueue.length > 0 ? (
                          billingQueue.map((entry) => (
                            <div
                              key={entry.shipment.id}
                              className="rounded-2xl border border-emerald-200 bg-white/90 px-4 py-4 shadow-sm"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {entry.shipment.trackingNumber || `Shipment #${entry.shipment.id}`}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {entry.shipment.fromLocation || 'Origin'} {'->'} {entry.shipment.toLocation || 'Destination'}
                                  </p>
                                  {entry.dueDate && (
                                    <p className="text-xs text-emerald-600">Due {formatDate(entry.dueDate)}</p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-emerald-700">
                                    {formatCurrency(entry.amount, entry.currency)}
                                  </p>
                                  {entry.invoice && (
                                    <p className="text-xs text-slate-500">Invoice #{entry.invoice.invoiceNumber}</p>
                                  )}
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                <span
                                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getPaymentPill(
                                    entry.paymentStatus,
                                  )}`}
                                >
                                  {formatStatus(entry.paymentStatus || 'PENDING')}
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  {entry.latestPayment && (
                                    <span className="text-[11px] text-slate-500">
                                      Last update {formatDate(entry.latestPayment.createdAt)}
                                    </span>
                                  )}
                                  {entry.canInitiatePayment ? (
                                    <button
                                      type="button"
                                      onClick={() => handleCreatePayment(entry.shipment)}
                                      disabled={paymentSubmitting[entry.shipment.id]}
                                      className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                      {paymentSubmitting[entry.shipment.id] ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <CreditCard className="h-4 w-4" />
                                      )}
                                      Pay now
                                    </button>
                                  ) : entry.processing ? (
                                    <button
                                      type="button"
                                      disabled
                                      className="inline-flex items-center gap-2 rounded-full bg-amber-200 px-4 py-2 text-xs font-semibold text-amber-800"
                                    >
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Processing
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/shipments/${entry.shipment.id}`)}
                                      className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                                    >
                                      View details
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-emerald-100 bg-white/70 px-4 py-6 text-center text-xs text-emerald-700">
                            All invoices are settled. New bills will appear here once generated.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-6">
                {sections.actionCenter && (
                  <div ref={actionSectionRef} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-slate-900">Action centre</h3>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        {actionRequired.length} pending
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Shipments that need confirmation, assignment, or transporter follow-up.
                    </p>
                    <div className="mt-4 space-y-3">
                      {actionRequired.length > 0 ? (
                        actionRequired.map((shipment) => (
                          <button
                            key={shipment.id}
                            type="button"
                            onClick={() => navigate(`/shipments/${shipment.id}`)}
                            className="w-full rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-left transition hover:border-amber-200 hover:bg-amber-100"
                          >
                            <p className="text-sm font-semibold text-amber-900">
                              {shipment.trackingNumber || 'Shipment'}
                            </p>
                            <p className="text-xs text-amber-800">
                              {shipment.fromLocation || 'Origin'} {'->'} {shipment.toLocation || 'Destination'}
                            </p>
                            <span className="mt-2 inline-flex items-center rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              {formatStatus(shipment.status)}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                          All shipments are on track. Tara will alert you if anything needs attention.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {sections.tara && (
                  <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-blue-900">Ask Tara for help</h3>
                    <p className="mt-2 text-xs text-blue-700">
                      Need a quick lane analysis or SLA reminder? Open the Tara assistant from the widget and keep the momentum going.
                    </p>
                    <ul className="mt-4 space-y-2 text-xs text-blue-800">
                      <li>- Ask for a performance summary for the week.</li>
                      <li>- Check which agreements are nearing expiry.</li>
                      <li>- Draft a rate card for your next corridor.</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default ShipmentDashboard;
