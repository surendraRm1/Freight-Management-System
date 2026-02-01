import { useState, useEffect, useRef } from 'react';

const KcoLogo = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="KCO Logistics logo"
  >
    <defs>
      <filter id="kco-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feOffset dy="8" in="SourceAlpha" result="offset" />
        <feGaussianBlur stdDeviation="12" in="offset" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="0 0 0 0 0.09  0 0 0 0 0.17  0 0 0 0 0.29  0 0 0 0.22 0"
        />
        <feBlend in="SourceGraphic" in2="blur" mode="normal" />
      </filter>
      <linearGradient id="card-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f5f7fa" />
        <stop offset="100%" stopColor="#e9edf3" />
      </linearGradient>
      <radialGradient id="sphere-light" cx="50%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
        <stop offset="65%" stopColor="#99b7e5" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#19407d" stopOpacity="0.05" />
      </radialGradient>
    </defs>

    <g filter="url(#kco-shadow)">
      <rect x="18" y="18" width="164" height="164" rx="36" fill="url(#card-grad)" />
    </g>

    <g opacity="0.22" stroke="#b9c7da" strokeLinecap="round">
      <path d="M60 62 C84 52 112 50 138 60" strokeWidth="1.5" />
      <path d="M72 48 C98 40 128 40 150 56" strokeWidth="1.5" />
      <path d="M148 74 C160 86 166 98 164 110" strokeWidth="1.3" />
      <path d="M58 132 C74 146 102 148 120 140" strokeWidth="1.3" />
      <path d="M44 88 C36 100 34 112 38 124" strokeWidth="1.2" />
    </g>

    <g transform="translate(40 44)">
      <circle cx="60" cy="56" r="58" fill="#0c2e66" />
      <circle cx="60" cy="56" r="58" fill="url(#sphere-light)" opacity="0.55" />

      <path
        d="M10 54 C30 14 60 10 80 14 C98 18 112 30 118 46 C94 56 74 60 44 60 C32 60 20 58 10 54Z"
        fill="#3fb04a"
      />

      <path
        d="M6 56 C28 64 48 68 76 68 C94 68 112 66 124 60 C122 72 114 84 102 94 C80 88 60 86 30 86 C20 80 10 70 6 56Z"
        fill="#0d3a7b"
      />

      <path
        d="M16 92 C36 104 58 108 78 106 C96 104 112 98 122 90 C112 116 88 128 60 128 C36 128 22 114 16 92Z"
        fill="#3fb04a"
      />

      <path
        d="M6 56 C28 64 48 68 76 68 C94 68 112 66 124 60"
        fill="none"
        stroke="#ffffff"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M16 92 C36 104 58 108 78 106 C96 104 112 98 122 90"
        fill="none"
        stroke="#ffffff"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M30 28 C36 22 44 18 54 16 C72 12 94 18 110 34"
        fill="none"
        stroke="#ffffff"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M26 120 C36 126 50 130 64 130 C84 130 104 124 116 110"
        fill="none"
        stroke="#ffffff"
        strokeWidth="8"
        strokeLinecap="round"
      />

      <path
        d="M78 18 C80 22 82 26 82 30 C82 36 78 40 70 40 C62 40 56 36 56 30 C56 26 58 22 60 18"
        fill="#3fb04a"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <text
        x="68"
        y="32"
        fontFamily="Poppins, sans-serif"
        fontSize="20"
        fontWeight="700"
        fill="#ffffff"
        textAnchor="middle"
      >
        O
      </text>

      <text
        x="36"
        y="74"
        fontFamily="Poppins, sans-serif"
        fontSize="30"
        fontWeight="800"
        fill="#ffffff"
        textAnchor="middle"
      >
        K
      </text>
      <text
        x="70"
        y="68"
        fontFamily="Poppins, sans-serif"
        fontSize="30"
        fontWeight="800"
        fill="#ffffff"
        textAnchor="middle"
      >
        C
      </text>
      <text
        x="98"
        y="82"
        fontFamily="Poppins, sans-serif"
        fontSize="30"
        fontWeight="800"
        fill="#ffffff"
        textAnchor="middle"
      >
        O
      </text>

      <text
        x="84"
        y="118"
        fontFamily="Poppins, sans-serif"
        fontSize="20"
        fontWeight="800"
        fill="#ffffff"
        textAnchor="middle"
      >
        K
      </text>
    </g>

    <g transform="translate(40 44)" opacity="0.18" stroke="#b2bcc9" strokeLinecap="round">
      <path d="M0 56 L-14 48" strokeWidth="2" />
      <path d="M0 56 L-10 68" strokeWidth="2" />
      <path d="M120 10 L132 0" strokeWidth="3" />
      <path d="M120 10 L136 6" strokeWidth="3" />
      <path d="M118 122 L132 134" strokeWidth="2" />
      <path d="M118 122 L132 120" strokeWidth="2" />
    </g>
  </svg>
);

export const LaunchIntro = ({ videoSrc, onFinish }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);
  
  // Handle video play
  const playVideo = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };
  
  useEffect(() => {
    const timer = setTimeout(() => {
      playVideo(); // play video after splash
    }, 2000); // Show logo for at least 2 seconds

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full h-screen bg-black">
      {/* Comet-themed background video */}
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-full h-full object-cover"
        src={videoSrc}
        muted={false}
        autoPlay
        loop
        playsInline
        onEnded={onFinish}
      />
      
      {/* KCO Logo Over Video */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
        <KcoLogo className="h-32 w-32" />
      </div>

      {/* Tap to Start Button (If autoplay is blocked) */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <button
            onClick={playVideo}
            className="text-white bg-blue-500 px-6 py-3 rounded-full text-xl"
          >
            Tap to Play
          </button>
        </div>
      )}
    </div>
  );
};

export default KcoLogo;
