// RonApps brand mark -- three ascending squares in teal, matching the icon
// used in the "About RonApps" panel across other RonApps applications.
//
// `variant="mark"` renders just the glyph (teal on transparent) for use on
// a dark navy background, like the About modal header.
// `variant="badge"` wraps it in a small navy rounded-square badge so it
// still reads clearly on a light background, like the Sidebar footer.
export const RonAppsLogo = ({ size = 20, variant = 'badge', className = '' }) => {
  const glyph = (glyphSize) => (
    <svg
      width={glyphSize}
      height={glyphSize}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="2" y="15" width="5" height="7" rx="1.2" fill="#5EEAD4" />
      <rect x="9.5" y="9" width="5" height="13" rx="1.2" fill="#5EEAD4" />
      <rect x="17" y="2" width="5" height="20" rx="1.2" fill="#5EEAD4" />
    </svg>
  )

  if (variant === 'mark') {
    return <span className={className}>{glyph(size)}</span>
  }

  return (
    <div
      className={`bg-[#1E2761] rounded-lg flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {glyph(size * 0.62)}
    </div>
  )
}
