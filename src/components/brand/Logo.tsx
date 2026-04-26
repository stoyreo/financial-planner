/**
 * Logo — Financial 101 Master (crafted by Toy)
 *
 * Single source of truth for the brand mark. Renders an inline SVG so it
 * scales cleanly, supports light + dark mode, and avoids an extra HTTP
 * request. Use the `size` prop for the icon-only variant in nav bars; use
 * `withWordmark` to render the icon + the brand wordmark side-by-side.
 *
 * Palette
 *   navy  #0B1330  - icon background
 *   gold  #D4A84A  - F mark + 101 subscript
 *   edge  #1B254A  - 1px inner stroke for depth
 */
type LogoProps = {
  /** Pixel size of the square icon. Defaults to 28. */
  size?: number;
  /** Render the wordmark "Financial 101 Master" + "crafted by Toy" beside the icon. */
  withWordmark?: boolean;
  /** Tailwind class applied to the wrapper. */
  className?: string;
};

export function Logo({ size = 28, withWordmark = false, className = "" }: LogoProps) {
  const id = `f101-gold-${size}`;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label="Financial 101 Master"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F4D27A" />
            <stop offset="1" stopColor="#C99A3A" />
          </linearGradient>
        </defs>
        {/* Navy tile */}
        <rect x="0" y="0" width="64" height="64" rx="14" fill="#0B1330" />
        <rect x="0" y="0" width="64" height="64" rx="14" fill="none" stroke="#1B254A" strokeWidth="1" />
        {/* Crown notch (Master) */}
        <path d="M32 7 L36 13 L28 13 Z" fill={`url(#${id})`} />
        <rect x="29" y="13" width="6" height="2" rx="1" fill={`url(#${id})`} />
        {/* F mark */}
        <g transform="translate(18,17)">
          <rect x="0" y="0" width="28" height="5" rx="1" fill={`url(#${id})`} />
          <rect x="0" y="0" width="5" height="34" rx="1" fill={`url(#${id})`} />
          <rect x="0" y="14" width="20" height="4" rx="1" fill={`url(#${id})`} />
          {/* 101 subscript */}
          <text
            x="9"
            y="44"
            fontSize="9"
            fontWeight="600"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            letterSpacing="0.5"
            fill={`url(#${id})`}
          >
            101
          </text>
        </g>
      </svg>
      {withWordmark && (
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-sm tracking-tight">Financial 101 Master</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            crafted by Toy
          </span>
        </div>
      )}
    </div>
  );
}

export default Logo;
