import { createSupabaseServerClient } from "@/lib/supabase";

export type GalleryItem = {
  id: string;
  title: string;
  description: string;
  image_path: string;
  sort_order: number;
};

export async function getPublishedGalleryItems(): Promise<GalleryItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("gallery_items")
    .select("id,title,description,image_path,sort_order")
    .eq("is_published", true)
    .order("sort_order")
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) throw new Error(`Could not load the public gallery: ${error.message}`);
  return data ?? [];
}

export function getGalleryImageUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return null;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/$/, "")}/storage/v1/object/public/tamark-gallery/${encodedPath}`;
}
