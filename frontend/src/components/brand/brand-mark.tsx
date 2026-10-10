import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The two Anjali Diagnostics branding assets supplied in `public/`.
 *
 * They are intentionally different files used for different places — the wide
 * lockup in the application header, and the square main mark in the sidebar.
 * `BrandMark` only chooses the file and the display size; the images are never
 * generated, replaced, cropped or stretched.
 */
export const BRAND_ASSETS = {
  /** Wide lockup (2172×724) — the top application header. */
  header: "/Logo.png",
  /** Square main brand mark (1254×1254) — the sidebar branding area. */
  main: "/Main%20logo.png",
} as const;

export function BrandMark({
  src,
  className,
  alt = "Anjali Diagnostics Centre",
}: {
  /** Asset to render. Defaults to the sidebar main mark. */
  src?: string;
  className?: string;
  alt?: string;
}) {
  return (
    <Image unoptimized width={src === BRAND_ASSETS.header ? 2172 : 1254} height={src === BRAND_ASSETS.header ? 724 : 1254}
      src={src ?? BRAND_ASSETS.main}
      alt={alt}
      draggable={false}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
