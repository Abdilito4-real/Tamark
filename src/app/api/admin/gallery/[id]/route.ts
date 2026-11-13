import { NextResponse, type NextRequest } from "next/server";
import { getAdminRequestContext } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isMissingGalleryTable(error: { code?: string; message: string }) {
  const detail = `${error.code ?? ""} ${error.message}`.toLowerCase();
  return detail.includes("pgrst205") || detail.includes("42p01") ||
    detail.includes("public.gallery_items") || detail.includes("schema cache");
}

function gallerySchemaError() {
  return "Gallery database schema is missing. Apply supabase/media_07_gallery_certificates.sql, then retry.";
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const context = await getAdminRequestContext();
  if (!context.ok) return failure(context.error, context.status);
  const { id } = await params;
  if (!idPattern.test(id)) return failure("Gallery item was not found.", 404);
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Request body must be valid JSON."); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return failure("Request body must be a JSON object.");
  const values = body as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("title" in values) {
    if (typeof values.title !== "string" || !values.title.trim() || values.title.trim().length > 160) return failure("Enter a valid gallery title.");
    patch.title = values.title.trim();
  }
  if ("description" in values) {
    if (typeof values.description !== "string" || values.description.length > 1000) return failure("Gallery description is too long.");
    patch.description = values.description.trim();
  }
  if ("is_published" in values) {
    if (typeof values.is_published !== "boolean") return failure("Choose whether to publish this gallery item.");
    patch.is_published = values.is_published;
  }
  if ("sort_order" in values) {
    if (!Number.isSafeInteger(values.sort_order) || Number(values.sort_order) < 0 || Number(values.sort_order) > 10000) return failure("Enter a valid display order.");
    patch.sort_order = values.sort_order;
  }
  const db = createSupabaseAdminClient();
  if (!db) return failure("Database services are not configured.", 503);
  const { data, error } = await db.from("gallery_items").update(patch).eq("id", id).select("*").maybeSingle();
  if (error) {
    if (isMissingGalleryTable(error)) return failure(gallerySchemaError(), 503);
    console.error("Could not update gallery item:", error.message);
    return failure("Could not update gallery item.", 500);
  }
  if (!data) return failure("Gallery item was not found.", 404);
  return NextResponse.json({ data });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const context = await getAdminRequestContext();
  if (!context.ok) return failure(context.error, context.status);
  const { id } = await params;
  if (!idPattern.test(id)) return failure("Gallery item was not found.", 404);
  const db = createSupabaseAdminClient();
  if (!db) return failure("Database services are not configured.", 503);
  const { data, error } = await db.from("gallery_items").delete().eq("id", id).select("image_path").maybeSingle();
  if (error) {
    if (isMissingGalleryTable(error)) return failure(gallerySchemaError(), 503);
    console.error("Could not delete gallery item:", error.message);
    return failure("Could not delete gallery item.", 500);
  }
  if (!data) return failure("Gallery item was not found.", 404);
  const { error: storageError } = await db.storage.from("tamark-gallery").remove([data.image_path]);
  if (storageError) {
    console.error("Gallery item was removed but its image could not be deleted:", storageError.message);
    if (/bucket.{0,30}(not found|does not exist)|not found.{0,30}bucket/i.test(storageError.message)) {
      return failure("Gallery record was removed, but the tamark-gallery Storage bucket is missing. Reapply migration 07 and clean up the unlinked file manually.", 500);
    }
    return failure("Gallery record was removed, but image cleanup failed. Check Supabase Storage permissions and logs.", 500);
  }
  return NextResponse.json({ success: true });
}
