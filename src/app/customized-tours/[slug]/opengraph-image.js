import { ImageResponse } from "next/og";
import { getPackageBySlug } from "@/lib/packages";
import { OgCard, OG_SIZE, OG_RESPONSE } from "@/components/og-card";

export const alt = "YaadiGo customized trip";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }) {
  const { slug } = await params;
  const pkg = getPackageBySlug(slug);

  if (!pkg) {
    return new ImageResponse(
      <OgCard eyebrow="Customized tours" title="Built around your dates and budget." />,
      OG_RESPONSE
    );
  }

  // "From" is explicit here, not implied. A customised package has no fixed
  // price — quoting one flat on a share card would be the kind of number a
  // customer screenshots and holds us to.
  const meta = [pkg.duration, `From ₹${pkg.fromPrice.toLocaleString("en-IN")} per person`];
  if (pkg.bestTime) meta.push(`Best: ${pkg.bestTime}`);

  return new ImageResponse(
    <OgCard eyebrow="Customized trip" title={pkg.title} meta={meta} />,
    OG_RESPONSE
  );
}
