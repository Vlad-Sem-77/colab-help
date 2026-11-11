type Win95EyeProps = {
  size?: number;
  className?: string;
};

export function Win95Eye({ size = 32, className }: Win95EyeProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Вращающийся глаз в стиле Windows 95"
    >
      <style>{`
        @keyframes win95-eye-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .win95-eye-orbit {
          transform-origin: 16px 16px;
          animation: win95-eye-spin 18s linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .win95-eye-orbit {
            animation: none;
          }
        }
      `}</style>

      <rect x="1.5" y="1.5" width="29" height="29" fill="#c0c0c0" />
      <path
        d="M30.5 1.5H1.5V30.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        shapeRendering="crispEdges"
      />
      <path
        d="M1.5 30.5H30.5V1.5"
        fill="none"
        stroke="#555555"
        strokeWidth="2"
        shapeRendering="crispEdges"
      />

      <ellipse
        cx="16"
        cy="16"
        rx="9"
        ry="5"
        fill="#ffffff"
        stroke="#000080"
        strokeWidth="1.2"
      />

      <g className="win95-eye-orbit">
        <ellipse
          cx="16"
          cy="16"
          rx="11"
          ry="4.2"
          fill="none"
          stroke="#000080"
          strokeWidth="1"
        />
        <circle cx="27" cy="16" r="1.6" fill="#000080" />
      </g>

      <circle cx="16" cy="16" r="3.1" fill="#000080" />
      <circle cx="15" cy="15" r="0.8" fill="#ffffff" />
    </svg>
  );
}
