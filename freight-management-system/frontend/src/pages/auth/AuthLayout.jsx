import { Loader2 } from 'lucide-react';
import KcoLogo from '../../components/ui/KcoLogo';

const AuthLayout = ({ children, loading }) => (
  <div className="relative min-h-screen w-full overflow-hidden text-white">
    <AnimationStyles />
    <GradientBackdrop />

    <div className="relative z-10 grid min-h-screen items-center gap-12 px-6 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:px-16 xl:px-24">
      <LeftPanel />

      <div className="relative flex items-center justify-center">
        <div className="w-full max-w-md">
          {loading && (
            <div className="mb-6 inline-flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 backdrop-blur">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />
              Processing request...
            </div>
          )}
          {children}
        </div>
      </div>
    </div>

    <div className="pointer-events-none absolute bottom-0 left-0 h-3 w-full bg-gradient-to-r from-[#57B33E] via-[#3EA55A] to-[#1E8F5A]" />

    <EicherTruck />
    <SparkleField />
  </div>
);

const LeftPanel = () => (
  <div className="relative flex flex-col gap-8">
    <div className="inline-flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15">
        <KcoLogo className="h-6 w-6 text-white" />
      </div>
      <span className="font-medium tracking-wide text-white/90">KCO Freight Management System</span>
    </div>

    <div className="space-y-6">
      <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl xl:text-5xl">
        AI-Powered Freight Command Centre for Modern India
      </h1>
      <p className="max-w-xl text-lg text-white/80">
        Transforming fragmented logistics into intelligent, connected operations with real-time insights,
        unified compliance, and predictive alerts tailored for fast-moving supply chains.
      </p>
    </div>

    <div className="grid gap-6 md:grid-cols-2">
      <HighlightCard title="Unified Visibility" description="Live status across shipments, quotes, and compliance checkpoints." />
      <HighlightCard title="Decision Intelligence" description="Smart nudges for lanes, transporters, and SLA commitments." />
    </div>
  </div>
);

const HighlightCard = ({ title, description }) => (
  <div className="rounded-2xl border border-white/10 bg-white/8 p-5 backdrop-blur">
    <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-200/90">{title}</h2>
    <p className="mt-2 text-sm text-white/70">{description}</p>
  </div>
);

const GradientBackdrop = () => (
  <div className="pointer-events-none">
    <div className="absolute inset-0 bg-[#2E3AAC]" />
    <div
      className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(84,160,255,0.35),_transparent_55%)]"
      style={{ animation: 'gradientDrift 28s ease-in-out infinite alternate' }}
    />
    <div
      className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(28,158,133,0.3),_transparent_60%)]"
      style={{ animation: 'gradientDriftAlt 34s ease-in-out infinite alternate' }}
    />
    <div className="absolute inset-0 bg-gradient-to-br from-[#2B3A9F]/90 via-[#2A3C8F]/82 to-[#0F3D45]/80" />

    <svg
      viewBox="0 0 800 800"
      className="absolute inset-0 h-full w-full opacity-[0.18]"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ animation: 'gridGlow 16s ease-in-out infinite' }}
    >
      <defs>
        <linearGradient id="networkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(120,196,214,0.25)" />
          <stop offset="100%" stopColor="rgba(66,143,173,0.05)" />
        </linearGradient>
      </defs>
      <path
        d="M40 110 L220 70 L420 150 L640 110 L800 40
           M0 310 L200 270 L420 350 L620 300 L820 250
           M60 520 L240 460 L440 540 L640 500 L800 440
           M100 710 L280 650 L460 720 L660 680 L840 620"
        stroke="url(#networkGradient)"
        strokeWidth="1.4"
        fill="none"
      />
      <path
        d="M140 40 L200 270 L240 460 L280 650
           M360 120 L420 350 L440 540 L460 720
           M580 80 L620 300 L640 500 L660 680"
        stroke="rgba(120,196,214,0.18)"
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
  </div>
);

const EicherTruck = () => (
  <div className="pointer-events-none absolute bottom-4 left-0 w-full">
    <div className="relative h-24">
      <div className="absolute bottom-0 left-[-220px]" style={{ animation: 'truckDrive 18s linear infinite' }}>
        <TruckIcon className="h-20 w-40 text-white drop-shadow-[0_8px_12px_rgba(12,31,63,0.35)]" />
      </div>
    </div>
  </div>
);

const TruckIcon = ({ className }) => (
  <svg viewBox="0 0 240 120" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="truck-cabin" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#183363" />
        <stop offset="100%" stopColor="#10213f" />
      </linearGradient>
      <linearGradient id="truck-cargo" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#5ac14c" />
        <stop offset="100%" stopColor="#3d9b57" />
      </linearGradient>
      <linearGradient id="truck-window" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#cfe4ff" />
        <stop offset="50%" stopColor="#8fb5e5" />
        <stop offset="100%" stopColor="#5a7fb8" />
      </linearGradient>
      <radialGradient id="wheel-rim" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#e3ecff" />
        <stop offset="100%" stopColor="#93a4c8" />
      </radialGradient>
      <linearGradient id="bumper" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#283d69" />
        <stop offset="100%" stopColor="#101a30" />
      </linearGradient>
    </defs>

    <g transform="translate(4 10)">
      <rect x="20" y="68" width="196" height="28" rx="10" fill="#0b1631" opacity="0.55" />

      <rect x="14" y="38" width="110" height="58" rx="14" fill="url(#truck-cabin)" />
      <path
        d="M24 44 Q30 26 44 20 L96 10 Q104 8 112 14 L138 36 Q150 46 150 62 L150 96 H24 Z"
        fill="#1b2f59"
      />

      <rect x="140" y="26" width="94" height="60" rx="10" fill="url(#truck-cargo)" />
      <rect x="140" y="26" width="94" height="60" rx="10" fill="#ffffff" opacity="0.12" />

      <path
        d="M34 34 H96 Q108 34 116 40 L140 60 H34 Z"
        fill="url(#truck-window)"
      />
      <path d="M34 34 H96 Q108 34 116 40 L122 46 H102 Q90 46 84 42 L70 34 Z" fill="#f8fbff" opacity="0.35" />
      <rect x="36" y="62" width="74" height="6" rx="3" fill="#223a66" opacity="0.5" />

      <path d="M142 30 H230" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="2" strokeLinecap="round" />
      <path d="M142 40 H230" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="2" strokeLinecap="round" />
      <path d="M142 50 H230" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="2" strokeLinecap="round" />

      <rect x="144" y="42" width="46" height="26" rx="6" fill="#ffffff" opacity="0.18" />
      <rect x="196" y="42" width="26" height="12" rx="4" fill="#ffffff" opacity="0.18" />
      <rect x="198" y="60" width="18" height="8" rx="3" fill="#ffffff" opacity="0.1" />

      <path d="M14 74 H128" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="3" strokeLinecap="round" />
      <path d="M152 74 H230" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="3" strokeLinecap="round" />

      <path
        d="M30 22 L18 28 Q10 32 6 44 L0 66 H32 Z"
        fill="#14264a"
      />
      <path
        d="M30 50 H52 L44 74 H18 L24 56 C26 52 28 50 30 50 Z"
        fill="url(#bumper)"
      />

      <path
        d="M132 24 L124 12 Q120 6 126 4 L140 2"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.4"
      />

      <rect x="214" y="70" width="12" height="16" rx="4" fill="#294b3b" />
      <rect x="18" y="74" width="16" height="18" rx="5" fill="#1d3058" />

      <g transform="translate(52 92)">
        <circle r="20" fill="#172846" />
        <circle r="12" fill="url(#wheel-rim)" />
        <circle r="5" fill="#1f325c" />
        <circle r="2.5" fill="#dce7ff" />
      </g>

      <g transform="translate(176 92)">
        <circle r="20" fill="#172846" />
        <circle r="12" fill="url(#wheel-rim)" />
        <circle r="5" fill="#1f325c" />
        <circle r="2.5" fill="#dce7ff" />
      </g>

      <path
        d="M96 74 H126"
        stroke="#ffffff"
        strokeOpacity="0.12"
        strokeWidth="3"
        strokeLinecap="round"
      />

      <text
        x="188"
        y="60"
        fontFamily="Poppins, sans-serif"
        fontSize="18"
        fontWeight="700"
        fill="#103053"
        opacity="0.9"
      >
        KCO
      </text>

      <circle cx="114" cy="84" r="6" fill="#f5d85c" opacity="0.65" />
      <circle cx="20" cy="84" r="6" fill="#f88f4a" opacity="0.65" />

      <rect x="144" y="70" width="18" height="12" rx="4" fill="#103053" opacity="0.6" />
      <rect x="68" y="84" width="14" height="8" rx="3" fill="#1f3258" opacity="0.6" />
    </g>
  </svg>
);

const SparkleField = () => (
  <div className="pointer-events-none">
    {Array.from({ length: 8 }).map((_, index) => {
      const delay = `${index * 3}s`;
      const left = `${10 + index * 10}%`;
      const top = `${15 + (index % 4) * 18}%`;
      return (
        <span
          key={`spark-${index}`}
          className="absolute h-1 w-1 rounded-full bg-emerald-200/70 shadow-[0_0_12px_rgba(126,213,206,0.45)]"
          style={{ left, top, animation: `sparkDrift 12s linear infinite`, animationDelay: delay }}
        />
      );
    })}
  </div>
);

const AnimationStyles = () => (
  <style>
    {`
      @keyframes gradientDrift {
        0% { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }
        50% { transform: translate3d(18px, -12px, 0) scale(1.05); opacity: 0.85; }
        100% { transform: translate3d(-12px, 16px, 0) scale(1.02); opacity: 0.9; }
      }
      @keyframes gradientDriftAlt {
        0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.9; }
        50% { transform: translate3d(-20px, 18px, 0) scale(1.08); opacity: 0.75; }
        100% { transform: translate3d(14px, -10px, 0) scale(1.03); opacity: 0.85; }
      }
      @keyframes gridGlow {
        0%, 100% { opacity: 0.16; filter: drop-shadow(0 0 6px rgba(92, 170, 205, 0.25)); }
        50% { opacity: 0.26; filter: drop-shadow(0 0 12px rgba(126, 213, 206, 0.35)); }
      }
      @keyframes truckDrive {
        0% { transform: translate3d(-220px, 0, 0); }
        100% { transform: translate3d(calc(100vw + 220px), 0, 0); }
      }
      @keyframes sparkDrift {
        0% { transform: translate3d(0, 0, 0); opacity: 0.2; }
        25% { opacity: 0.5; }
        50% { transform: translate3d(12px, -10px, 0); opacity: 0.7; }
        75% { opacity: 0.4; }
        100% { transform: translate3d(-8px, 6px, 0); opacity: 0.2; }
      }
    `}
  </style>
);

export default AuthLayout;
