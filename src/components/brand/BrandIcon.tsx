import icon from '@/app/_brand/app-icon-256.png';

/**
 * THE APP ICON AS A TILE (design "C", PR 2): the real icon file, not a
 * drawing of it. `src/app/_brand/app-icon-256.png` is the approved master
 * resized by scripts/brand/gen-app-icons.py (never edited by hand), so the
 * site header (40 pt) and the sign-in pages (84 pt, 3x) show exactly what
 * the home screen shows. The image is the tile: its own dark ground with the
 * gold ring and the page; the span rounds it and lifts it with a drop.
 *
 * Decorative (`alt=""`): it always stands beside the product's name or inside
 * a link that carries it.
 */
export function BrandIcon({ size, radius, className = '' }: { size: number; radius: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden ${className}`}
      style={{ width: size, height: size, borderRadius: radius, boxShadow: '0 5px 10px rgba(40, 28, 12, 0.25)' }}
    >
      {/* A plain <img>: one 38 KB file served from /_next/static, no optimiser
          round trip (the app's web view loads it like any static asset). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon.src} width={size} height={size} alt="" decoding="async" className="block h-full w-full" />
    </span>
  );
}
