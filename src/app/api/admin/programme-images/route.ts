import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminRequestContext } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const imageTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

function hasExpectedImageSignature(bytes: Uint8Array, contentType: keyof typeof imageTypes) {
  if (contentType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  return bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export async function POST(request: NextRequest) {
  const context = await getAdminRequestContext();
  if (!context.ok) return NextResponse.json({ error: context.error }, { status: context.status });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Database services are not configured." }, { status: 503 });

  const formData = await request.formData();
  const file = formData.get("image");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  if (!Object.hasOwn(imageTypes, file.type)) return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 415 });
  if (file.size < 1 || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Image must be no larger than 5 MB." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasExpectedImageSignature(bytes, file.type as keyof typeof imageTypes)) {
    return NextResponse.json({ error: "The image contents do not match the selected file type." }, { status: 415 });
  }

  const extension = imageTypes[file.type as keyof typeof imageTypes];
  const path = `${context.user.id}/${randomUUID()}.${extension}`;
  const { error } = await admin.storage.from("programme-images").upload(path, bytes, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    console.error("Could not upload programme image:", error.message);
    return NextResponse.json({ error: "Could not upload programme image." }, { status: 500 });
  }
  return NextResponse.json({ path }, { status: 201 });
}
