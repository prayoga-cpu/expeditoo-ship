const BRAND_BLUE = "#0052FF";

/**
 * The Expeditoo mark: a blue rounded square holding a knocked-out disc with a
 * blue chevron. Single source of truth for the logo across marketing and app.
 *
 * The disc reads the surface behind it — the landing palette when rendered
 * inside `.lp`, the app background everywhere else.
 *
 * Every dimension, corner radius included, is a ratio of `size` — the corner
 * used to be a flat `9px` regardless of `size`, which looked right only at the
 * 32px default and read as a slightly different mark at every other call site.
 */
export function BrandMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const disc = Math.round(size * 0.53);
  const chevron = Math.round(size * 0.25);
  const radius = Math.round((size * 9) / 32);

  return (
    <span
      className={`flex flex-none items-center justify-center ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: BRAND_BLUE,
      }}
    >
      <span
        className="flex items-center justify-center rounded-full"
        style={{
          width: disc,
          height: disc,
          background: "var(--lp-bg, var(--background))",
        }}
      >
        <span
          className="box-border block"
          style={{
            width: chevron,
            height: chevron,
            borderTop: `2.5px solid ${BRAND_BLUE}`,
            borderRight: `2.5px solid ${BRAND_BLUE}`,
            transform: "rotate(45deg) translate(-1px, 1px)",
          }}
        />
      </span>
    </span>
  );
}

/**
 * Mark plus the EXPEDITOO / TRANSPORT lockup used in the landing chrome.
 *
 * `size` was only ever wired to the mark — the wordmark's two font sizes and
 * the gap between mark and text were flat pixel values, so the same component
 * read as a noticeably bigger mark relative to its text on the 32px landing
 * navbar than on the 24px mobile header. Every number here is now a ratio of
 * `size`.
 *
 * The ratios (cap:mark 0.5524, gap:mark 0.3631) are shared, deliberately, with
 * the sibling lockup in the Expedion codebase
 * (`expedion_encheres/lib/design_system/ds_logo.dart`, `XpdLogo`). Each brand
 * had shipped its own numbers — 0.571/0.393 here, 0.533/0.333 there — neither
 * validated against the other, just whatever this component's `size` prop
 * happened to be called with before it actually scaled. Averaging the two
 * gives one lockup system that has to work for both marks: this one a solid
 * filled square that reads heavy per pixel, Expedion's a thin ring that reads
 * light. Change one side, change the other the same way.
 */
export function BrandWordmark({ size = 32 }: { size?: number }) {
  const capSize = size * 0.5524;
  const subSize = capSize * 0.5;
  const lineGap = Math.max(1, Math.round(capSize * 0.0625));
  const markGap = Math.round(size * 0.3631);

  return (
    <span className="flex items-center" style={{ gap: markGap }}>
      <BrandMark size={size} />
      <span className="flex flex-col" style={{ gap: lineGap }}>
        <span
          className="font-bold leading-none tracking-[-0.02em]"
          style={{ fontSize: capSize }}
        >
          EXPEDITOO
        </span>
        <span
          className="font-mono leading-none tracking-[0.2em] text-[var(--lp-bluelink,var(--primary))]"
          style={{ fontSize: subSize }}
        >
          TRANSPORT
        </span>
      </span>
    </span>
  );
}
