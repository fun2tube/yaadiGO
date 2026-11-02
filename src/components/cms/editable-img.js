import Img from "@/components/img";
import { getOverrides } from "@/lib/cms/store";

/**
 * An image the admin can swap, from the page editor.
 *
 * This closes a real gap rather than adding a feature: the Inspector has had
 * an image field all along — it renders when the selected node reports
 * `data-cms-kind="image"` — but nothing on the site ever reported it, because
 * `Editable` only ever emits "text" or "multiline". The control existed and
 * was unreachable, which is exactly why the editor looked text-only.
 *
 * Why a separate component rather than teaching `Img` to do it: `Img` is
 * rendered from `tour-detail.js`, a CLIENT component, so it has to stay
 * synchronous. Reading the override store is async. Splitting keeps both
 * honest instead of breaking the client path.
 *
 * An override replaces the image ID, not the file path — so a swapped image
 * brings its own alt text, dimensions and licence credit from the media
 * library. Swapping the file alone is how a site ends up describing a
 * photograph it is no longer showing.
 */
export default async function EditableImg({ id, cmsId, ...rest }) {
  const overrides = await getOverrides();

  if (overrides.hidden[cmsId]) return null;

  return <Img {...rest} id={overrides.image[cmsId] || id} cmsId={cmsId} />;
}
