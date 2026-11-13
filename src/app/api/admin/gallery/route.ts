import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminRequestContext } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getGalleryImageUrl } from "@/lib/gallery";

const imageTypes = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

function failure(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isMissingGalleryTable(error: { code?: string; message: string }) {
  const detail = `${error.code ?? ""} ${error.message}`.toLowerCase();
  return detail.includes("pgrst205") || detail.includes("42p01") ||
    detail.includes("public.gallery_items") || detail.includes("schema cache");
}

function isMissingGalleryBucket(message: string) {
  return /bucket.{0,30}(not found|does not exist)|not found.{0,30}bucket/i.test(message);
}

function isStoragePermissionError(message: string) {
  return /row.level security|permission denied|not allowed/i.test(message);
}

function gallerySchemaError() {
  return "Gallery database schema is missing. Apply supabase/media_07_gallery_certificates.sql, then retry.";
}

function isValidImage(bytes: Uint8Array, type: keyof typeof imageTypes) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((part, index) => bytes[index] === part);
  return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export async function GET() {
  const context = await getAdminRequestContext();
  if (!context.ok) return failure(context.error, context.status);
  const db = createSupabaseAdminClient();
  if (!db) return failure("Database services are not configured.", 503);
  const { data, error } = await db.from("gallery_items").select("*").order("sort_order").order("created_at", { ascending: false }).limit(200);
  if (error) {
    if (isMissingGalleryTable(error)) return failure(gallerySchemaError(), 503);
    console.error("Could not load gallery items:", error.message);
    return failure("Could not load gallery items. Check the Supabase database connection.", 500);
  }
  return NextResponse.json({ data: data?.map((item) => ({ ...item, image_url: getGalleryImageUrl(item.image_path) })) ?? [] });
}

export async function POST(request: NextRequest) {
  const context = await getAdminRequestContext();
  if (!context.ok) return failure(context.error, context.status);
  const db = createSupabaseAdminClient();
  if (!db) return failure("Database services are not configured.", 503);

  const form = await request.formData();
  const title = form.get("title");
  const description = form.get("description");
  const file = form.get("image");
  const isPublished = form.get("is_published") === "true";
  const sortOrderRaw = form.get("sort_order");
  const sortOrder = sortOrderRaw === null || sortOrderRaw === "" ? 0 : Number(sortOrderRaw);
  if (typeof title !== "string" || !title.trim() || title.trim().length > 160 ||
      typeof description !== "string" || description.length > 1000 ||
      !Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
    return failure("Enter a title, description, and valid display order.");
  }
  if (!(file instanceof File)) return failure("Choose an image to upload.");
  if (!Object.hasOwn(imageTypes, file.type)) return failure("Use a JPG, PNG, or WebP image.", 415);
  if (file.size < 1 || file.size > 5 * 1024 * 1024) return failure("Image must be no larger than 5 MB.", 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isValidImage(bytes, file.type as keyof typeof imageTypes)) return failure("The image contents do not match the selected file type.", 415);

  const path = `${context.user.id}/${randomUUID()}.${imageTypes[file.type as keyof typeof imageTypes]}`;
  const { error: uploadError } = await db.storage.from("tamark-gallery").upload(path, bytes, {
    contentType: file.type, cacheControl: "3600", upsert: false,
  });
  if (uploadError) {
    console.error("Could not upload gallery image:", uploadError.message);
    if (isMissingGalleryBucket(uploadError.message)) {
      return failure("Gallery storage bucket is missing. Apply supabase/media_07_gallery_certificates.sql to create tamark-gallery.", 503);
    }
    if (isStoragePermissionError(uploadError.message)) {
      return failure("Supabase rejected the image upload. Verify the server service-role key and Storage policies from migration 07.", 503);
    }
    return failure("Supabase Storage could not accept the image. Verify that tamark-gallery exists and the server service-role key can upload to it.", 500);
  }
  const { data, error } = await db.from("gallery_items").insert({
    title: title.trim(),
    description: description.trim(),
    image_path: path,
    sort_order: sortOrder,
    is_published: isPublished,
    created_by: context.user.id,
  }).select("*").single();
  if (error) {
    const { error: cleanupError } = await db.storage.from("tamark-gallery").remove([path]);
    if (cleanupError) console.error("Could not clean up an unlinked gallery image:", cleanupError.message);
    console.error("Could not save gallery item:", error.message);
    if (isMissingGalleryTable(error)) return failure(gallerySchemaError(), 503);
    return failure("The image uploaded, but its gallery record could not be saved.", 500);
  }
  return NextResponse.json({ data: { ...data, image_url: getGalleryImageUrl(path) } }, { status: 201 });
}
