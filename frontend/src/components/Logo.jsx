/**
 * HealthNexus logo mark — a cross + pulse line. Uses currentColor so it
 * inherits the surrounding text colour (blue on white, white on blue panel).
 */
export default function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="currentColor" opacity="0.12" />
      <path
        d="M6 17h4l2.2-5 3.2 9 2.4-6 1.6 2h6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
