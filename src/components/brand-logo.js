import Image from "next/image";
import logo from "../../public/brand/yaadigo-logo.png";

/**
 * The YaadiGo logo as the owner supplied it (2026-11-02): the car over the
 * green-and-red wordmark, cut out onto a transparent background. It spells
 * the name itself, so it replaces the old pulse mark + typed "YaadiGo" pair.
 *
 * The dark green wordmark disappears on ink, so a dark bar passes `onDark`
 * for a white backing rather than recolouring the owner's logo.
 *
 * Documents that become PDFs pass `forPrint`: headless Chromium renders at
 * 1x, so the optimiser handed it a 96 px logo that printed soft. Print gets
 * the original 388 px file instead.
 */
export default function BrandLogo({
  height = 44,
  onDark = false,
  priority = false,
  forPrint = false,
  className = "",
}) {
  const width = Math.round((logo.width / logo.height) * height);
  return (
    <span
      className={`inline-flex shrink-0 ${onDark ? "rounded-[10px] bg-white px-2 py-1" : ""} ${className}`}
    >
      <Image
        src={logo}
        alt="YaadiGo"
        width={width}
        height={height}
        priority={priority}
        unoptimized={forPrint}
      />
    </span>
  );
}
