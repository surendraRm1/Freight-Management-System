import { Wifi, WifiOff } from 'lucide-react';
import useConnectivity from '../../hooks/useConnectivity';

const STATUS_MAP = {
  online: {
    label: 'Online',
    description: 'Internet + LAN available',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: Wifi,
  },
  lan: {
    label: 'LAN Mode',
    description: 'Host reachable over Wi-Fi',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Wifi,
  },
  degraded: {
    label: 'Degraded',
    description: 'Internet ok, backend unreachable',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: WifiOff,
  },
  offline: {
    label: 'Offline',
    description: 'No internet/LAN detected',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: WifiOff,
  },
  default: {
    label: 'Checking…',
    description: 'Probing connectivity',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: Wifi,
  },
};

const ConnectivityBadge = () => {
  const { status, lastChecked } = useConnectivity();
  const meta = STATUS_MAP[status] || STATUS_MAP.default;
  const Icon = meta.icon;

  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${meta.className}`}
      title={`${meta.description}${lastChecked ? ` • Last checked ${lastChecked.toLocaleTimeString()}` : ''}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{meta.label}</span>
    </div>
  );
};

export default ConnectivityBadge;
