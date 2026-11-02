import { ImageResponse } from "next/og";
import { getPostBySlug, formatPostDate } from "@/lib/posts";
import { OgCard, OG_SIZE, OG_RESPONSE } from "@/components/og-card";

export const alt = "YaadiGo travel notes";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return new ImageResponse(
      <OgCard eyebrow="Travel notes" title="Straight answers about where and when to go." />,
      OG_RESPONSE
    );
  }

  return new ImageResponse(
    <OgCard
      eyebrow="Travel notes"
      title={post.title}
      meta={post.date ? [formatPostDate(post.date)] : []}
    />,
    OG_RESPONSE
  );
}
