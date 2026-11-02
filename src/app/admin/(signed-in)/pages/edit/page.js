import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { userCan } from "@/lib/crm/schema";
import { getEditableLayout } from "@/lib/cms/pages";
import Editor from "@/components/builder/editor";

export const metadata = { title: "Edit page" };
export const dynamic = "force-dynamic";

/**
 * The builder, full screen.
 *
 * Only the paths listed on the index are editable, checked here rather than
 * trusted from the query string — otherwise `?path=/admin/leads` would open a
 * drag-and-drop editor pointed at the CRM.
 */
const ALLOWED = new Set(["/", "/about", "/contact", "/corporate-travel"]);

export default async function EditPage({ searchParams }) {
  const user = await currentUser();
  if (!userCan(user, "content.write")) redirect("/admin");

  const { path } = await searchParams;
  if (!ALLOWED.has(path)) redirect("/admin/pages");

  const layout = await getEditableLayout(path);

  return <Editor path={path} initialData={layout} />;
}
