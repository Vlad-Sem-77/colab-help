type RotatingEyeProps = {
  size?: number;
  className?: string;
};

export function RotatingEye({ size = 32, className }: RotatingEyeProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Вращающийся глаз"
    >
      <style>{`
        @keyframes assistant-eye-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .assistant-eye-orbit {
          transform-origin: 16px 16px;
          animation: assistant-eye-spin 18s linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .assistant-eye-orbit {
            animation: none;
          }
        }
      `}</style>

      <circle cx="16" cy="16" r="15" fill="#668777" />

      <g className="assistant-eye-orbit">
        <ellipse
          cx="16"
          cy="16"
          rx="11"
          ry="4.2"
          fill="none"
          stroke="#fffdf5"
          strokeWidth="1.3"
          opacity=".85"
        />
        <circle cx="27" cy="16" r="1.6" fill="#fffdf5" />
      </g>

      <circle cx="16" cy="16" r="3.2" fill="#191d2c" />
    </svg>
  );
}
