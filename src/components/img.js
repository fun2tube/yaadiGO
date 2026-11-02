import NextImage from "next/image";
import { getImage } from "@/lib/media";

/**
 * The only way an image gets onto this site.
 *
 * Components reference an image by ID, never by path, and the alt text comes
 * from the media library rather than the call site. That is the whole point:
 * alt text written once, next to the image, reviewed once — instead of
 * re-typed (or forgotten) at every one of the places the image appears.
 *
 * Width and height come from the library too, so every image reserves its
 * space before it loads and nothing shifts underneath the reader.
 *
 * `alt=""` is still available for genuinely decorative use via
 * `decorative`, which is the correct markup for an image that adds nothing
 * a screen-reader user needs.
 */
export default function Img({
  id,
  className = "",
  sizes = "100vw",
  priority = false,
  fill = false,
  decorative = false,
  quality = 78,
  /**
   * Marks this image selectable in the page editor.
   *
   * Only adds the two data attributes the Inspector looks for — it does NOT
   * read the override store, because `Img` must stay synchronous: it is
   * rendered from `tour-detail.js`, which is a client component, and an async
   * component cannot be used there. The override lookup lives in
   * `EditableImg`, which is server-only.
   */
  cmsId = null,
}) {
  const effectiveId = id;
  const image = getImage(effectiveId);

  if (!image) {
    // A missing image degrades to empty space rather than a crash, but it is
    // loud in development so it gets fixed before it ships.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[media] no image registered with id "${effectiveId}" — see src/lib/media.js`);
    }
    return null;
  }

  const alt = decorative ? "" : image.alt;

  if (fill) {
    return (
      <NextImage
        src={image.src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        quality={quality}
        className={className}
        {...(cmsId ? { "data-cms-id": cmsId, "data-cms-kind": "image" } : {})}
      />
    );
  }

  return (
    <NextImage
      src={image.src}
      alt={alt}
      width={image.width}
      height={image.height}
      sizes={sizes}
      priority={priority}
      quality={quality}
      className={className}
      {...(cmsId ? { "data-cms-id": cmsId, "data-cms-kind": "image" } : {})}
    />
  );
}
