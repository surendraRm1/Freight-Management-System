import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, PartyPopper, RefreshCcw, Send, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import MessageBox from '../ui/MessageBox';
import LoadingSpinner from '../ui/LoadingSpinner';

const INTRO_MESSAGE =
  "Hi! I'm Tara, on deck for freight. Ask me to analyse shipments, compliance queues, or rate cards - I'll respond with live data and insights.";

const SEGMENT_LIBRARY = [
  {
    id: 'operations',
    label: 'Operations Pulse',
    roles: ['SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'OPERATIONS', 'AGENT', 'USER', 'FINANCE_APPROVER'],
    questions: [
      'What shipments are awaiting pickup today?',
      'Which shipments are delayed beyond SLA?',
      'List high priority shipments requiring action now.',
      'How many shipments were delivered in the last 24 hours?',
      'What is the average door-to-door cycle time this week?',
      'Any shipments missing driver allocation?',
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance & Documentation',
    roles: ['SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'OPERATIONS', 'FINANCE_APPROVER'],
    questions: [
      'Which shipments have pending compliance review?',
      'How many GST invoices are outstanding?',
      'Any permits or documents expiring this week?',
      'Which transporters need RC or insurance updates?',
      'What compliance tasks require admin follow-up today?',
      'Share compliance health score for this week.',
    ],
  },
  {
    id: 'finance',
    label: 'Finance & Billing',
    roles: ['SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'FINANCE_APPROVER'],
    questions: [
      'What invoices await customer approval?',
      'Summarise payments collected this week.',
      'Highlight shipments with cash flow risk.',
      'Any PODs pending for billing release?',
      'What is the outstanding receivables aging?',
      'Share fuel surcharge variance for the week.',
    ],
  },
  {
    id: 'transporters',
    label: 'Transporter Performance',
    roles: ['SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'TRANSPORTER'],
    questions: [
      'Which transporters have best on-time performance?',
      'List transporters needing capacity reminders.',
      'Who is idle for more than five days?',
      'What driver safety issues were logged this month?',
      'How many vehicles are due for maintenance?',
      'Share transporter engagement summary.',
    ],
  },
];

const JSON_BLOCK_REGEX = /```json([\s\S]*?)```/gi;

const STATUS_CLASS_MAP = {
  PENDING: 'bg-amber-100 text-amber-800 border border-amber-200',
  PENDING_QUOTE: 'bg-purple-100 text-purple-800 border border-purple-200',
  QUOTE_SUBMITTED: 'bg-sky-100 text-sky-800 border border-sky-200',
  RESPONDED: 'bg-sky-100 text-sky-800 border border-sky-200',
  APPROVED: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-600 border border-slate-200',
  ASSIGNED: 'bg-blue-100 text-blue-800 border border-blue-200',
  IN_TRANSIT: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
  DELIVERED: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  REJECTED: 'bg-rose-100 text-rose-800 border border-rose-200',
  SUBMITTED: 'bg-blue-100 text-blue-800 border border-blue-200',
  FAILED: 'bg-rose-100 text-rose-800 border border-rose-200',
  OVERDUE: 'bg-rose-100 text-rose-800 border border-rose-200',
};

const toStatusClass = (value) => STATUS_CLASS_MAP[String(value || '').toUpperCase()] || '';

const parseStructuredBlocks = (rawText) => {
  if (!rawText) {
    return {
      text: '',
      tables: [],
      alerts: [],
    };
  }

  const tables = [];
  const alerts = [];

  const cleaned = rawText.replace(JSON_BLOCK_REGEX, (_, jsonBlock) => {
    try {
      const parsed = JSON.parse(jsonBlock.trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      items.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        if (item.type === 'table') {
          tables.push(item);
        } else if (item.type === 'alert') {
          alerts.push(item);
        }
      });
    } catch (error) {
      console.warn('Tara JSON block parse error', error);
    }
    return '';
  });

  return {
    text: cleaned.trim(),
    tables,
    alerts,
  };
};

const normaliseTable = (table) => {
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const headers =
    Array.isArray(table.headers) && table.headers.length
      ? table.headers
      : Array.from(
          rows.reduce((set, row) => {
            Object.keys(row || {}).forEach((key) => set.add(key));
            return set;
          }, new Set()),
        );

  return {
    title: table.title || table.name || 'Data',
    headers,
    rows,
  };
};

const TaraChatPanel = ({ layout = 'sidebar', onClose }) => {
  const { api, user } = useAuth();
  const userRole = (user?.role || 'USER').toUpperCase();
  const availableSegments = useMemo(() => {
    return SEGMENT_LIBRARY.filter((segment) => {
      if (!segment.roles || !segment.roles.length) {
        return true;
      }
      if (userRole === 'SUPER_ADMIN') {
        return true;
      }
      return segment.roles.includes(userRole);
    });
  }, [userRole]);
  const defaultSegmentId = availableSegments[0]?.id ?? SEGMENT_LIBRARY[0]?.id ?? '';

  const [chat, setChat] = useState([{ role: 'assistant', content: INTRO_MESSAGE }]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState({ message: '', tone: 'info' });
  const [highlights, setHighlights] = useState(null);
  const [contextData, setContextData] = useState(null);
  const [lastQuery, setLastQuery] = useState('');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [selectedSegmentId, setSelectedSegmentId] = useState(defaultSegmentId);

  const pendingRef = useRef(false);

  const selectedSegment = useMemo(
    () =>
      availableSegments.find((segment) => segment.id === selectedSegmentId) ||
      availableSegments[0] ||
      SEGMENT_LIBRARY[0],
    [availableSegments, selectedSegmentId],
  );

  useEffect(() => {
    if (!availableSegments.length) {
      return;
    }
    const exists = availableSegments.some((segment) => segment.id === selectedSegmentId);
    if (!exists) {
      setSelectedSegmentId(availableSegments[0].id);
    }
  }, [availableSegments, selectedSegmentId]);

  const disabled = useMemo(() => pending || input.trim().length === 0, [input, pending]);
  const closeToast = () => setToast({ message: '', tone: 'info' });

  const appendAssistantMessage = useCallback((payload, { refresh } = {}) => {
    setChat((prev) => {
      const nextEntry = { role: 'assistant', ...payload };
      if (refresh) {
        const next = [...prev];
        const index = [...next].reverse().findIndex((item) => item.role === 'assistant');
        if (index !== -1) {
          const actualIndex = next.length - 1 - index;
          next[actualIndex] = nextEntry;
          return next;
        }
      }
      return [...prev, nextEntry];
    });
  }, []);

  const processPrompt = useCallback(
    async (prompt, { echoUser = true, refresh = false } = {}) => {
      const trimmed = prompt.trim();
      if (!trimmed || pendingRef.current) return;

      if (echoUser) {
        setChat((prev) => [...prev, { role: 'user', content: trimmed }]);
      }

      pendingRef.current = true;
      setPending(true);
      try {
        const response = await api.post('/assistant/query', { query: trimmed });
        const textResponse = response.data?.text || response.data?.answer || '';
        const dataResponse = response.data?.data || null;

        const parsed = parseStructuredBlocks(textResponse);

        appendAssistantMessage(
          {
            content: parsed.text || textResponse || 'Tara could not find anything new right now.',
            tables: parsed.tables.map(normaliseTable),
            alerts: parsed.alerts,
            timestamp: new Date().toISOString(),
          },
          { refresh },
        );

        setHighlights(dataResponse?.highlights || null);
        setContextData(dataResponse);
        setLastQuery(trimmed);
      } catch (error) {
        console.error('Assistant error:', error);
        appendAssistantMessage(
          {
            content:
              error.response?.data?.error ||
              "Tara couldn't reach the AI co-pilot right now. Please try again shortly.",
          },
          { refresh },
        );
        setToast({
          message: error.response?.data?.error || 'Tara could not process that request.',
          tone: 'error',
        });
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    },
    [api, appendAssistantMessage],
  );

  useEffect(() => {
    if (!autoRefreshEnabled || !lastQuery) return undefined;

    const interval = setInterval(() => {
      processPrompt(lastQuery, { echoUser: false, refresh: true });
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, lastQuery, processPrompt]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt) return;
    setInput('');
    await processPrompt(prompt);
  };

  const handleSegmentChange = (event) => {
    setSelectedSegmentId(event.target.value);
  };

  const handleSegmentQuestion = async (question) => {
    if (!question || pending) return;
    await processPrompt(question);
  };

  const toggleAutoRefresh = () => setAutoRefreshEnabled((prev) => !prev);

  const highlightCards = useMemo(() => {
    if (!highlights) return [];
    const cards = [];

    if (typeof highlights.celebrations === 'number') {
      cards.push({
        id: 'celebrations',
        label: 'Celebrations',
        value: highlights.celebrations,
        icon: PartyPopper,
        tone: highlights.celebrations > 0 ? 'success' : 'neutral',
        helper:
          highlights.celebrations > 0
            ? 'Delivered shipments worth celebrating.'
            : 'No fresh wins yet - keep the fleet moving.',
      });
    }

    if (typeof highlights.complianceFollowUps === 'number') {
      cards.push({
        id: 'compliance-follow-ups',
        label: 'Compliance follow-ups',
        value: highlights.complianceFollowUps,
        icon: AlertTriangle,
        tone: highlights.complianceFollowUps > 0 ? 'warning' : 'neutral',
        helper:
          highlights.complianceFollowUps > 0
            ? 'Review pending compliance actions.'
            : 'Compliance queue is clear for now.',
      });
    }

    if (typeof highlights.pendingQuotes === 'number') {
      cards.push({
        id: 'pending-quotes',
        label: 'Pending quotations',
        value: highlights.pendingQuotes,
        icon: RefreshCcw,
        tone: highlights.pendingQuotes > 0 ? 'warning' : 'neutral',
        helper:
          highlights.pendingQuotes > 0 ? 'Review pending quote approvals.' : 'All recent quotes have been addressed.',
      });
    }

    if (Array.isArray(highlights.transporterAlerts) && highlights.transporterAlerts.length) {
      cards.push({
        id: 'transporter-alerts',
        label: 'Transporter alerts',
        value: highlights.transporterAlerts.length,
        icon: AlertTriangle,
        tone: 'warning',
        helper: highlights.transporterAlerts[0],
      });
    }

    return cards;
  }, [highlights]);

  return (
    <div
      className={`flex h-full w-full flex-col gap-4 ${layout === 'sidebar' ? 'mx-auto max-w-5xl' : ''}`}
    >
      {highlightCards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {highlightCards.map(({ id, label, value, icon: Icon, tone, helper }) => (
            <div
              key={id}
              className={`rounded-3xl border px-4 py-4 shadow-sm ${
                tone === 'warning'
                  ? 'border-amber-200 bg-amber-50'
                  : tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
                </div>
                <Icon className="h-5 w-5 text-slate-400" />
              </div>
              <p className="mt-2 text-xs text-slate-600">{helper}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {chat.map((entry, index) => (
            <div
              key={`chat-${index}`}
              className={`flex ${entry.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-full rounded-2xl px-4 py-3 text-sm shadow ${
                  entry.role === 'assistant' ? 'bg-slate-50 text-slate-800' : 'bg-blue-600 text-white'
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{entry.content}</div>

                {Array.isArray(entry.tables) &&
                  entry.tables.map((table, tableIndex) => (
                    <div
                      key={`table-${tableIndex}`}
                      className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm"
                    >
                      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {table.title}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-xs">
                          <thead className="bg-slate-100 text-slate-600">
                            <tr>
                              {table.headers.map((header) => (
                                <th key={header} className="px-3 py-2 text-left font-semibold uppercase tracking-wide">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {table.rows.map((row, rowIndex) => (
                              <tr key={rowIndex} className="hover:bg-slate-50">
                                {table.headers.map((header) => {
                                  const value = row?.[header];
                                  const pillClass = toStatusClass(value);
                                  return (
                                    <td key={header} className="px-3 py-2">
                                      {pillClass ? (
                                        <span
                                          className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${pillClass}`}
                                        >
                                          {value}
                                        </span>
                                      ) : (
                                        <span className="text-slate-700">{value ?? '-'}</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}

                {Array.isArray(entry.alerts) &&
                  entry.alerts.map((alert, alertIndex) => (
                    <div
                      key={`alert-${alertIndex}`}
                      className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                    >
                      {alert.message || alert.text || ''}
                    </div>
                  ))}

                {entry.timestamp && (
                  <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-400">
                    Updated {new Date(entry.timestamp).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          ))}
          {pending && <LoadingSpinner label="Tara is thinking..." className="py-3" />}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-slate-50 px-4 py-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label
              htmlFor="tara-segment"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Focus area
            </label>
            <select
              id="tara-segment"
              value={selectedSegmentId}
              onChange={handleSegmentChange}
              disabled={pending}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 outline-none transition focus:border-blue-400 focus:text-blue-600 disabled:opacity-50"
            >
              {availableSegments.map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={toggleAutoRefresh}
              disabled={pending}
              className="ml-auto inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
            >
              {autoRefreshEnabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
              Auto-refresh
            </button>
          </div>

          {selectedSegment?.questions?.length ? (
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              {selectedSegment.questions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => handleSegmentQuestion(question)}
                  disabled={pending}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-xs text-slate-500">
              No quick prompts are configured for your role yet. Ask Tara anything in the box below.
            </p>
          )}

          <div className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-3 py-2 shadow-inner focus-within:border-blue-500">
            <textarea
              className="max-h-32 min-h-[48px] flex-1 resize-none border-0 bg-transparent p-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
              rows={1}
              placeholder="Ask Tara about shipments, compliance, or transporter performance..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={pending}
            />
            <button
              type="submit"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              disabled={disabled}
              aria-label="Send message"
            >
              <Send className="h-5 w-5 -rotate-45" />
            </button>
          </div>
        </form>
      </div>

      {contextData?.highlights?.transporterAlerts?.length > 1 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <p className="font-semibold">Additional transporter alerts</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {contextData.highlights.transporterAlerts.slice(1).map((alert, index) => (
              <li key={`transporter-alert-${index}`}>{alert}</li>
            ))}
          </ul>
        </div>
      )}

      <MessageBox message={toast.message} tone={toast.tone} onClose={closeToast} />

      {layout === 'sidebar' && onClose && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-400 underline underline-offset-4 transition hover:text-slate-500"
          >
            Close Tara sidebar
          </button>
        </div>
      )}
    </div>
  );
};

export default TaraChatPanel;
