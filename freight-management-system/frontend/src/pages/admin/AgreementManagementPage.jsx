import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, RotateCcw, Download, Save, Loader2, X } from 'lucide-react';
import MessageBox from '../../components/ui/MessageBox';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import RateCardForm from './RateCardForm';
import RateCardList from './RateCardList';

const defaultAgreement = () => ({
  id: null, //
  vendorId: '',
  title: '',
  referenceCode: '',
  status: 'Draft',
  effectiveFrom: '',
  effectiveTo: '',
  notes: '',
});

const uomOptions = ['Per Trip', 'Per KM', 'Per Hour', 'Per Day', 'Per Load'];

const defaultRateCard = () => ({
  id: null,
  routeName: '',
  origin: '',
  destination: '',
  distanceKm: '',
  ratePerKm: '',
  uom: 'Per KM',
  uomSelection: 'Per KM',
  vehicleType: '',
  effectiveFrom: '',
  remarks: '',
  agreementId: '',
});

const statusOptions = ['Draft', 'Active', 'Expired'];
const defaultVendorForm = () => ({
  name: '',
  email: '',
  phone: '',
  baseRate: '',
  rating: '4.0',
  speed: '60',
  isActive: true,
});

const AgreementManagementPage = () => {
  const { api, user } = useAuth();

  const [agreements, setAgreements] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [filterVendor, setFilterVendor] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [agreementForm, setAgreementForm] = useState(defaultAgreement());
  const [rateCards, setRateCards] = useState([]);
  const [rateCardDraft, setRateCardDraft] = useState(defaultRateCard());
  const [rateCardEditIndex, setRateCardEditIndex] = useState(null);

  const resetRateCardDraft = useCallback(
    (overrides = {}) => {
      setRateCardDraft({
        ...defaultRateCard(),
        agreementId: agreementForm.id ? String(agreementForm.id) : '',
        ...overrides,
      });
    },
    [agreementForm.id],
  );

  useEffect(() => {
    setRateCardDraft((prev) => ({
      ...prev,
      agreementId: agreementForm.id ? (prev.agreementId || String(agreementForm.id)) : '',
    }));
  }, [agreementForm.id]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState({ message: '', tone: 'info' });
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vendorSaving, setVendorSaving] = useState(false);
  const [vendorForm, setVendorForm] = useState(defaultVendorForm());

  const filteredAgreements = useMemo(() => {
    return agreements.filter((agreement) => {
      const vendorMatch = filterVendor === 'all' || String(agreement.vendorId) === filterVendor;
      const statusMatch = filterStatus === 'all' || agreement.status === filterStatus;
      return vendorMatch && statusMatch;
    });
  }, [agreements, filterVendor, filterStatus]);

  const selectedAgreement = useMemo(() => {
    return agreements.find((agreement) => agreement.id === agreementForm.id) ?? null;
  }, [agreements, agreementForm.id]);

  const agreementTitleById = useMemo(() => {
    const map = new Map();
    agreements.forEach((agreement) => {
      map.set(String(agreement.id), agreement.title || `Agreement #${agreement.id}`);
    });
    return map;
  }, [agreements]);

  const selectedRateCardAgreementLabel = useMemo(() => {
    if (rateCardDraft.agreementId) {
      return (
        agreementTitleById.get(rateCardDraft.agreementId) ||
        `Agreement #${rateCardDraft.agreementId}`
      );
    }

    if (agreementForm.id) {
      const existing = agreementTitleById.get(String(agreementForm.id));
      if (existing) return existing;
      if (agreementForm.title) return agreementForm.title;
      return `Agreement #${agreementForm.id}`;
    }

    return 'Will link automatically after this agreement is saved.';
  }, [agreementTitleById, agreementForm.id, agreementForm.title, rateCardDraft.agreementId]);

  const exportCsv = () => {
    if (filteredAgreements.length === 0) {
      showToast('No agreements to export for current filters.', 'info');
      return;
    }

    const headers = [
      'Agreement ID',
      'Title',
      'Transporter',
      'Status',
      'Reference Code',
      'Effective From',
      'Effective To',
      'Rate Card Count',
    ];

    const rows = filteredAgreements.map((agreement) => [
      agreement.id,
      `"${agreement.title.replace(/"/g, '""')}"`,
      `"${agreement.vendor?.name?.replace(/"/g, '""') || ''}"`,
      agreement.status || '',
      agreement.referenceCode || '',
      agreement.effectiveFrom ? new Date(agreement.effectiveFrom).toISOString().split('T')[0] : '',
      agreement.effectiveTo ? new Date(agreement.effectiveTo).toISOString().split('T')[0] : '',
      agreement.rateCards?.length ?? 0,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `agreements_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const showToast = useCallback(
    (message, tone = 'info') => setToast({ message, tone }),
    []
  );
  const resetToast = useCallback(
    () => setToast({ message: '', tone: 'info' }),
    []
  );

  const formatDateInput = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return '';
    return date.toISOString().split('T')[0];
  };

  const parseNumeric = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isNaN(number) ? null : number;
  };

  const resolveTransporterName = useCallback(
    (agreementIdValue) => {
      if (agreementIdValue) {
        const linkedAgreement = agreements.find((item) => String(item.id) === String(agreementIdValue));
        if (linkedAgreement?.vendor?.name) {
          return linkedAgreement.vendor.name;
        }
        const linkedVendor = vendors.find((vendor) => vendor.id === linkedAgreement?.vendorId);
        if (linkedVendor?.name) {
          return linkedVendor.name;
        }
      }

      if (agreementForm.id) {
        const activeAgreement = agreements.find((item) => item.id === agreementForm.id);
        if (activeAgreement?.vendor?.name) {
          return activeAgreement.vendor.name;
        }
      }

      if (agreementForm.vendorId) {
        const vendorMatch = vendors.find((vendor) => String(vendor.id) === agreementForm.vendorId);
        if (vendorMatch?.name) {
          return vendorMatch.name;
        }
      }

      return '';
    },
    [agreements, agreementForm.id, agreementForm.vendorId, vendors],
  );

  const loadAgreements = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/agreements');
      setAgreements(data.agreements || []);
    } catch (error) {
      console.error(error);
      showToast(error.response?.data?.error || 'Failed to load agreements.', 'error');
    }
  }, [api, showToast]);

  const loadVendors = useCallback(async () => {
    try {
      if (user?.role === 'AGENT' && user.vendorId) {
        const { data } = await api.get('/freight/vendors');
        const scopedVendor =
          (data.vendors || []).find((vendor) => Number(vendor.id) === Number(user.vendorId)) || null;

        setVendors(scopedVendor ? [scopedVendor] : []);

        if (scopedVendor) {
          setAgreementForm((prev) => ({ ...prev, vendorId: String(scopedVendor.id) }));
          setFilterVendor(String(scopedVendor.id));
        } else {
          showToast('Assigned transporter profile not found. Contact an administrator.', 'warning');
        }
        return;
      }

      if (user?.role === 'ADMIN') {
        const { data } = await api.get('/admin/vendors/list');
        setVendors(data.vendors || []);
      } else {
        const { data } = await api.get('/freight/vendors');
        setVendors(data.vendors || []);
      }
    } catch (error) {
      console.error(error);
      showToast(error.response?.data?.error || 'Failed to load transporters.', 'error');
    }
  }, [api, showToast, user]);

  const openVendorDialog = () => {
    setVendorForm(defaultVendorForm());
    setVendorDialogOpen(true);
  };

  const closeVendorDialog = () => {
    setVendorDialogOpen(false);
  };

  const handleVendorFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setVendorForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleVendorSubmit = async (event) => {
    event.preventDefault();

    if (!vendorForm.name.trim()) {
      showToast('Transporter name is required.', 'warning');
      return;
    }

    try {
      setVendorSaving(true);
      const payload = {
        name: vendorForm.name.trim(),
        email: vendorForm.email.trim() || undefined,
        phone: vendorForm.phone.trim() || undefined,
        baseRate: parseNumeric(vendorForm.baseRate) ?? undefined,
        rating: parseNumeric(vendorForm.rating) ?? undefined,
        speed: parseNumeric(vendorForm.speed) ?? undefined,
        isActive: vendorForm.isActive,
      };

      const { data } = await api.post('/admin/vendors', payload);
      await loadVendors();
      setAgreementForm((prev) => ({ ...prev, vendorId: String(data.vendor.id) }));
      setFilterVendor(String(data.vendor.id));
      showToast('Transporter created successfully.', 'success');
      setVendorDialogOpen(false);
    } catch (error) {
      console.error(error);
      showToast(error.response?.data?.error || 'Failed to create transporter.', 'error');
    } finally {
      setVendorSaving(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([loadAgreements(), loadVendors()]);
      setLoading(false);
    };
    if (user) fetchData();
  }, [user, loadAgreements, loadVendors]);

  const handleAgreementField = (event) => {
    const { name, value } = event.target;
    setAgreementForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRateCardField = (event) => {
    const { name, value } = event.target;
    setRateCardDraft((prev) => {
      if (name === 'uomSelection') {
        const isCustom = value === 'CUSTOM';
        const nextCustomValue =
          isCustom && prev.uomSelection === 'CUSTOM' ? prev.uom : '';

        return {
          ...prev,
          uomSelection: value,
          uom: isCustom ? nextCustomValue : value,
        };
      }

      if (name === 'agreementId') {
        return {
          ...prev,
          agreementId: value,
        };
      }

      if (name === 'uom') {
        return {
          ...prev,
          uom: value,
        };
      }

      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const handleSelectAgreement = (agreement) => {
    setAgreementForm({
      id: agreement.id,
      vendorId: String(agreement.vendorId),
      title: agreement.title,
      referenceCode: agreement.referenceCode ?? '',
      status: agreement.status ?? 'Draft',
      effectiveFrom: formatDateInput(agreement.effectiveFrom),
      effectiveTo: formatDateInput(agreement.effectiveTo),
      notes: agreement.notes ?? '',
    });
    setRateCards(
      (agreement.rateCards || []).map((card) => ({
        id: card.id,
        routeName: card.routeName,
        origin: card.origin,
        destination: card.destination,
        distanceKm: card.distanceKm ?? '',
        ratePerKm: card.ratePerKm,
        uom: card.uom || 'Per KM',
        uomSelection: uomOptions.includes(card.uom) ? card.uom : 'CUSTOM',
        vehicleType: card.vehicleType,
        effectiveFrom: formatDateInput(card.effectiveFrom),
        remarks: card.remarks ?? '',
        agreementId: String(card.agreementId ?? agreement.id),
      })),
    );
    resetRateCardDraft();
    setRateCardEditIndex(null);
    resetToast();
  };

  const handleResetForm = () => {
    setAgreementForm(defaultAgreement());
    setRateCards([]);
    resetRateCardDraft({ agreementId: '' });
    setRateCardEditIndex(null);
    resetToast();
  };

  const validateAgreement = () => {
    if (!agreementForm.vendorId) {
      showToast('Please select a transporter.', 'warning');
      return false;
    }
    if (!agreementForm.title.trim()) {
      showToast('Agreement title is required.', 'warning');
      return false;
    }

    const from = agreementForm.effectiveFrom ? new Date(agreementForm.effectiveFrom) : null;
    const to = agreementForm.effectiveTo ? new Date(agreementForm.effectiveTo) : null;
    if (from && to && from > to) {
      showToast('Agreement start date must be before the end date.', 'warning');
      return false;
    }
    return true;
  };

  const validateRateCardDraft = () => {
    if (!rateCardDraft.routeName.trim()) {
      showToast('Route name/description is required.', 'warning');
      return false;
    }
    if (!rateCardDraft.origin.trim() || !rateCardDraft.destination.trim()) {
      showToast('Origin and destination are required.', 'warning');
      return false;
    }
    if (!rateCardDraft.ratePerKm) {
      showToast('Rate amount is required.', 'warning');
      return false;
    }
    if (!rateCardDraft.vehicleType.trim()) {
      showToast('Vehicle type is required.', 'warning');
      return false;
    }

    const resolvedUom =
      rateCardDraft.uomSelection === 'CUSTOM'
        ? rateCardDraft.uom.trim()
        : (rateCardDraft.uomSelection || '').trim();

    if (!resolvedUom) {
      showToast('Please choose or enter a unit of measure.', 'warning');
      return false;
    }

    const resolvedAgreementId =
      rateCardDraft.agreementId || (agreementForm.id ? String(agreementForm.id) : '');

    if (!resolvedAgreementId && agreementForm.id) {
      showToast('Please link the rate card to an agreement.', 'warning');
      return false;
    }

    const rateCardDate = rateCardDraft.effectiveFrom ? new Date(rateCardDraft.effectiveFrom) : null;
    const agreementFrom = agreementForm.effectiveFrom ? new Date(agreementForm.effectiveFrom) : null;
    const agreementTo = agreementForm.effectiveTo ? new Date(agreementForm.effectiveTo) : null;

    if (rateCardDate && agreementFrom && rateCardDate < agreementFrom) {
      showToast('Rate card date cannot be before the agreement start date.', 'warning');
      return false;
    }

    if (rateCardDate && agreementTo && rateCardDate > agreementTo) {
      showToast('Rate card date must fall within the agreement period.', 'warning');
      return false;
    }

    return true;
  };

  const handleAddOrUpdateRateCard = () => {
    if (!validateRateCardDraft()) return;

    const resolvedUom =
      rateCardDraft.uomSelection === 'CUSTOM'
        ? rateCardDraft.uom.trim()
        : (rateCardDraft.uomSelection || '').trim();

    const resolvedAgreementId =
      rateCardDraft.agreementId || (agreementForm.id ? String(agreementForm.id) : '');

    const formattedCard = {
      ...rateCardDraft,
      distanceKm: rateCardDraft.distanceKm === '' ? '' : rateCardDraft.distanceKm,
      ratePerKm: rateCardDraft.ratePerKm,
      uom: resolvedUom,
      uomSelection: rateCardDraft.uomSelection === 'CUSTOM' && resolvedUom ? 'CUSTOM' : resolvedUom || 'Per KM',
      agreementId: resolvedAgreementId,
    };

    if (rateCardEditIndex !== null) {
      setRateCards((prev) =>
        prev.map((card, index) => (index === rateCardEditIndex ? { ...card, ...formattedCard } : card)),
      );
      showToast('Rate card updated.', 'success');
    } else {
      setRateCards((prev) => [...prev, formattedCard]);
      showToast('Rate card added.', 'success');
    }

    resetRateCardDraft();
    setRateCardEditIndex(null);
  };

  const handleEditRateCard = (index) => {
    const card = rateCards[index];
    setRateCardDraft({
      ...card,
      uomSelection: card.uomSelection || (uomOptions.includes(card.uom) ? card.uom : 'CUSTOM'),
      agreementId: card.agreementId || (agreementForm.id ? String(agreementForm.id) : ''),
    });
    setRateCardEditIndex(index);
  };

  const handleCloneRateCard = (index) => {
    const clone = { ...rateCards[index], id: null };
    setRateCards((prev) => [...prev, clone]);
    showToast('Rate card cloned. Adjust details and save the agreement to persist.', 'info');
  };

  const handleDeleteRateCard = (index) => {
    setRateCards((prev) => prev.filter((_, idx) => idx !== index));
    if (rateCardEditIndex === index) {
      resetRateCardDraft();
      setRateCardEditIndex(null);
    }
  };

  const serializeAgreementPayload = () => ({
    vendorId: Number(agreementForm.vendorId),
    title: agreementForm.title.trim(),
    referenceCode: agreementForm.referenceCode.trim() || null,
    status: agreementForm.status,
    effectiveFrom: agreementForm.effectiveFrom || null,
    effectiveTo: agreementForm.effectiveTo || null,
    notes: agreementForm.notes.trim() || null,
    rateCards: rateCards.map((card) => ({
      id: card.id,
      routeName: card.routeName.trim(),
      origin: card.origin.trim(),
      destination: card.destination.trim(),
      distanceKm: parseNumeric(card.distanceKm),
      ratePerKm: Number(card.ratePerKm),
      uom: card.uom,
      vehicleType: card.vehicleType.trim(),
      effectiveFrom: card.effectiveFrom || null,
      remarks: card.remarks.trim() || null,
      ...(card.agreementId ? { agreementId: Number(card.agreementId) } : {}),
    })),
  });

  const handleSaveAgreement = async () => {
    if (!validateAgreement()) return;

    setSaving(true);
    try {
      const payload = serializeAgreementPayload();

      if (agreementForm.id) {
        await api.put(`/admin/agreements/${agreementForm.id}`, payload);
        showToast('Agreement updated successfully.', 'success');
      } else {
        await api.post('/admin/agreements', payload);
        showToast('Agreement created successfully.', 'success');
      }

      await loadAgreements();
      await loadVendors(); // Re-fetch vendors in case a new one was just approved/created
      handleResetForm();
    } catch (error) {
      console.error(error);
      showToast(error.response?.data?.error || 'Failed to save agreement.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAgreement = async (agreementId) => {
    const target = agreements.find((item) => item.id === agreementId);
    const confirmation = window.confirm(
      `Are you sure you want to delete agreement "${target?.title || agreementId}"? This action cannot be undone.`,
    );
    if (!confirmation) return;

    try {
      await api.delete(`/admin/agreements/${agreementId}`);
      showToast('Agreement deleted successfully.', 'success');
      await loadAgreements();
      if (agreementForm.id === agreementId) {
        handleResetForm(); // This function is defined in the parent
      }
    } catch (error) {
      console.error(error);
      showToast(error.response?.data?.error || 'Failed to delete agreement.', 'error');
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading agreements..." />;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-slate-900 px-6 py-6 text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Transporter Agreements & Rate Cards</h1>
            <p className="text-sm text-slate-300">
              Maintain master agreements and detailed route pricing that fuel instant freight quotes.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleResetForm}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-600"
        >
          <RotateCcw className="h-5 w-5" />
          New Agreement
        </button>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr,3fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Agreement Details</h2>
            <p className="mt-1 text-xs text-slate-500">
              Fill in transporter contract details, then add granular route-level rate cards.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Transporter *</label>
                  {user?.role === 'ADMIN' && (
                    <button
                      type="button"
                      onClick={openVendorDialog}
                      className="text-xs font-semibold text-blue-600 transition hover:text-blue-700"
                    >
                      + New transporter
                    </button>
                  )}
                </div>
                <select
                  name="vendorId"
                  value={agreementForm.vendorId}
                  onChange={handleAgreementField}
                  disabled={user?.role === 'AGENT'}
                  className="block w-full rounded-lg border border-gray-300 py-2 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select transporter</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Agreement Title *</label>
                <input
                  type="text"
                  name="title"
                  value={agreementForm.title}
                  onChange={handleAgreementField}
                  className="block w-full rounded-lg border border-gray-300 py-2 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. FY25 Pan-India Contract"
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  Automatically generated from origin, destination, and transporter.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Reference Code</label>
                  <input
                    type="text"
                    name="referenceCode"
                    value={agreementForm.referenceCode}
                    onChange={handleAgreementField}
                    className="block w-full rounded-lg border border-gray-300 py-2 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="AG-2025-01"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
                  <select
                    name="status"
                    value={agreementForm.status}
                    onChange={handleAgreementField}
                    className="block w-full rounded-lg border border-gray-300 py-2 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Effective From</label>
                  <input
                    type="date"
                    name="effectiveFrom"
                    value={agreementForm.effectiveFrom}
                    onChange={handleAgreementField}
                    className="block w-full rounded-lg border border-gray-300 py-2 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Effective To</label>
                  <input
                    type="date"
                    name="effectiveTo"
                    value={agreementForm.effectiveTo}
                    onChange={handleAgreementField}
                    className="block w-full rounded-lg border border-gray-300 py-2 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  name="notes"
                  value={agreementForm.notes}
                  onChange={handleAgreementField}
                  rows={3}
                  className="block w-full rounded-lg border border-gray-300 py-2 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Important clauses, service levels, etc."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleSaveAgreement}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : agreementForm.id ? 'Update Agreement' : 'Create Agreement'}
              </button>
            </div>
          </div>

          <RateCardForm
            draft={rateCardDraft}
            onFieldChange={handleRateCardField}
            onSubmit={handleAddOrUpdateRateCard}
            onCancelEdit={() => {
              resetRateCardDraft();
              setRateCardEditIndex(null);
            }}
            isEditing={rateCardEditIndex !== null}
            agreementOptions={agreements.map((agreement) => (
              <option key={agreement.id} value={String(agreement.id)}>
                {agreement.title} {agreement.vendor?.name ? `- ${agreement.vendor.name}` : ''}
              </option>
            ))}
            selectedAgreementLabel={selectedRateCardAgreementLabel}
            resolveTransporterName={resolveTransporterName}
          />
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Agreement Summary</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Review all agreements. Select one to edit or manage rate cards.
                </p>
              </div>
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-400 hover:text-blue-600"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Filter by Transporter</label>
                <select
                  value={filterVendor}
                  disabled={user?.role === 'AGENT'}
                  onChange={(event) => setFilterVendor(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All transporters</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Filter by Status</label>
                <select
                  value={filterStatus}
                  onChange={(event) => setFilterStatus(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All statuses</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredAgreements.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                No agreements match your filters. Adjust the filters or create a new contract.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {filteredAgreements.map((agreement) => (
                  <div
                    key={agreement.id}
                    className={`rounded-2xl border p-4 transition ${
                      agreementForm.id === agreement.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{agreement.title}</h3>
                        <p className="text-xs text-slate-500">
                          {agreement.vendor?.name || 'Unknown transporter'} - {' '}
                          {agreement.rateCards?.length || 0} rate cards
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectAgreement(agreement)}
                          className="rounded-lg border border-blue-200 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAgreement(agreement.id)}
                          className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                      {agreement.referenceCode && <span>Ref: {agreement.referenceCode}</span>}
                      {agreement.status && <span>Status: {agreement.status}</span>}
                      {agreement.effectiveFrom && (
                        <span>From: {new Date(agreement.effectiveFrom).toLocaleDateString()}</span>
                      )}
                      {agreement.effectiveTo && (
                        <span>To: {new Date(agreement.effectiveTo).toLocaleDateString()}</span>
                      )}
                      {agreement.updatedAt && (
                        <span>Updated: {new Date(agreement.updatedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <RateCardList
            rateCards={rateCards}
            agreementTitleById={agreementTitleById}
            agreementForm={agreementForm}
            onEdit={handleEditRateCard}
            onClone={handleCloneRateCard}
            onDelete={handleDeleteRateCard}
            selectedAgreement={selectedAgreement}
          />
        </div>
      </section>

      {user?.role === 'ADMIN' && vendorDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Create transporter</h3>
                <p className="text-xs text-slate-500">
                  Add a transporter profile to unlock instant quoting from this agreement workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={closeVendorDialog}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close transporter form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleVendorSubmit} className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Transporter name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={vendorForm.name}
                    onChange={handleVendorFieldChange}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Contact email</label>
                  <input
                    type="email"
                    name="email"
                    value={vendorForm.email}
                    onChange={handleVendorFieldChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={vendorForm.phone}
                    onChange={handleVendorFieldChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Base rate (per km)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="baseRate"
                    value={vendorForm.baseRate}
                    onChange={handleVendorFieldChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Rating</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    name="rating"
                    value={vendorForm.rating}
                    onChange={handleVendorFieldChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Avg. speed (km/h)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    name="speed"
                    value={vendorForm.speed}
                    onChange={handleVendorFieldChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={vendorForm.isActive}
                  onChange={handleVendorFieldChange}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Active transporter
              </label>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeVendorDialog}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={vendorSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
                >
                  {vendorSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {vendorSaving ? 'Saving...' : 'Create transporter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <MessageBox message={toast.message} tone={toast.tone} onClose={resetToast} />
    </div>
  );
};

export default AgreementManagementPage;











