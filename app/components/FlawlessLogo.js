// app/components/FlawlessLogo.js
export default function FlawlessLogo({ size = 600 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 800 250"
      width={size}
      height={(size / 800) * 250}
    >
      {/* Gradient defs */}
      <defs>
        <linearGradient id="glitchGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff00c8" />
          <stop offset="50%" stopColor="#00f0ff" />
          <stop offset="100%" stopColor="#ffe600" />
        </linearGradient>

        <filter id="glow">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* FLAWLESS */}
      <text
        x="50%"
        y="45%"
        textAnchor="middle"
        fontFamily="'Orbitron', sans-serif"
        fontSize="90"
        fill="url(#glitchGrad)"
        filter="url(#glow)"
        style={{ fontWeight: "bold", letterSpacing: "4px" }}
      >
        FLAWLESS
      </text>

      {/* JOURNAL */}
      <text
        x="50%"
        y="80%"
        textAnchor="middle"
        fontFamily="'Share Tech Mono', monospace"
        fontSize="60"
        fill="#00f0ff"
        style={{ letterSpacing: "8px" }}
      >
        JOURNAL
      </text>
    </svg>
  );
}
