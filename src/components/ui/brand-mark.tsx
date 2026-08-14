const BRAND_BLUE = "#0052FF";

/**
 * The Expeditoo mark: a blue rounded square holding a knocked-out disc with a
 * blue chevron. Single source of truth for the logo across marketing and app.
 *
 * The disc reads the surface behind it — the landing palette when rendered
 * inside `.lp`, the app background everywhere else.
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

  return (
    <span
      className={`flex flex-none items-center justify-center rounded-[9px] ${className ?? ""}`}
      style={{ width: size, height: size, background: BRAND_BLUE }}
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

/** Mark plus the EXPEDITOO / TRANSPORT lockup used in the landing chrome. */
export function BrandWordmark({ size = 32 }: { size?: number }) {
  return (
    <span className="flex items-center gap-[11px]">
      <BrandMark size={size} />
      <span className="flex flex-col gap-px">
        <span className="text-base leading-none font-bold tracking-[-0.02em]">
          EXPEDITOO
        </span>
        <span className="font-mono text-[8px] leading-none tracking-[0.2em] text-[var(--lp-bluelink,var(--primary))]">
          TRANSPORT
        </span>
      </span>
    </span>
  );
}
