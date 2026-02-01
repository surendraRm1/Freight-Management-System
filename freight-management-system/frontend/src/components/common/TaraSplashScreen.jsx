import { useEffect } from 'react';
import taraLogo from '../../assets/tara-logo.svg';

const TaraSplashScreen = ({ onFinish, duration = 2000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish?.();
    }, Math.max(duration, 2000)); // Ensure minimum duration of 2 seconds

    return () => clearTimeout(timer);
  }, [onFinish, duration]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950 text-white">
      <div className="relative flex h-40 w-40 items-center justify-center rounded-3xl bg-white/10 shadow-2xl backdrop-blur">
        <div className="absolute inset-0 -z-10 animate-pulse rounded-3xl bg-gradient-to-r from-blue-500/30 via-emerald-400/20 to-blue-500/30 blur-3xl" />
        <img
          src={taraLogo}
          alt="Tara logo"
          className="h-24 w-24 animate-[fadeIn_0.4s_ease-out] drop-shadow-lg"
        />
      </div>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.92); }
            to { opacity: 1; transform: scale(1); }
          }
        `}
      </style>
    </div>
  );
};

export default TaraSplashScreen;
