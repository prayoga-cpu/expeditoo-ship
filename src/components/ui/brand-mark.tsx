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

// ========================================
// Expedion — the sibling product
// ========================================

/** The logo's ring and bars keep this in both themes, as Expedion's does. */
const EXPEDION_AMBER = "#FFA91F";

/**
 * The Expedion mark, for the surfaces here that point back at the sibling
 * product: an amber ring holding a blue dot, trailed by two stacked amber
 * speed bars that tuck under the ring.
 *
 * A direct port of `XpdLogoMark` in `expedion_encheres/lib/design_system/
 * ds_logo.dart`, ratios included — that file establishes them off the 30px
 * header instance, and this reads them back the same way so the two marks
 * stay one mark. Expedion carries our mark for the same reason
 * (`ExpeditooLogoMark`, same file); change one side, change the other.
 *
 * The amber is `brandAmber`, deliberately un-themed: Expedion darkens amber
 * *text* in light mode for contrast and leaves the logo alone, so the mark
 * does not shift colour with the theme toggle.
 */
export function ExpedionMark({
  size = 30,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const stroke = (size * 3.5) / 30;
  const dot = (size * 9) / 30;
  const barThick = (size * 4) / 30;
  const barGap = (size * 3) / 30;
  const overlap = (size * 2) / 30;

  const bar = (widthRatio: number, opacity: number) => (
    <span
      className="block"
      style={{
        width: (size * widthRatio) / 30,
        height: barThick,
        borderRadius: barThick / 2,
        background: EXPEDION_AMBER,
        opacity,
      }}
    />
  );

  return (
    <span
      className={`flex flex-none items-center ${className ?? ""}`}
      aria-hidden="true"
    >
      <span
        className="box-border flex flex-none items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          border: `${stroke}px solid ${EXPEDION_AMBER}`,
        }}
      >
        <span
          className="block rounded-full"
          style={{ width: dot, height: dot, background: BRAND_BLUE }}
        />
      </span>
      {/* `margin-left:-2px` on the 30px instance — the bars overlap the
          ring's stroke rather than sitting beside it. */}
      <span
        className="flex flex-col items-start"
        style={{ gap: barGap, marginLeft: -overlap }}
      >
        {bar(10, 1)}
        {bar(6, 0.45)}
      </span>
    </span>
  );
}

/**
 * Mark plus the EXPEDION / ENCHÈRES lockup.
 *
 * Shares the lockup ratios with `BrandWordmark` above (cap:mark 0.5524,
 * gap:mark 0.3631) — the two products agreed on one system precisely so a
 * lockup can sit next to the other brand's without reading as a different
 * scale.
 *
 * ENCHÈRES is the one part that does follow the theme: Expedion's `--amber`
 * darkens to #C27B00 in light mode so amber text stays legible on white.
 */
export function ExpedionWordmark({ size = 30 }: { size?: number }) {
  const capSize = size * 0.5524;
  const subSize = capSize * 0.5;
  const lineGap = Math.max(1, Math.round(capSize * 0.0625));
  const markGap = Math.round(size * 0.3631);

  return (
    <span className="flex items-center" style={{ gap: markGap }}>
      <ExpedionMark size={size} />
      <span className="flex flex-col" style={{ gap: lineGap }}>
        <span
          className="font-bold leading-none tracking-[-0.02em]"
          style={{ fontSize: capSize }}
        >
          EXPEDION
        </span>
        <span
          className="font-mono leading-none tracking-[0.2em] text-[#C27B00] dark:text-[#FFA91F]"
          style={{ fontSize: subSize }}
        >
          ENCHÈRES
        </span>
      </span>
    </span>
  );
}
