import { createSupabaseServerClient } from "@/lib/supabase";

export type Programme = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  category: string;
  duration: string | null;
  curriculum: string[];
  outcomes: string[];
  entry_requirements: string | null;
  is_published?: boolean;
  is_listed?: boolean;
  image_path?: string | null;
};

export async function getListedProgrammes(): Promise<Programme[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("programmes")
    .select(
      "id,slug,name,summary,category,duration,curriculum,outcomes,entry_requirements,is_published,is_listed,image_path",
    )
    .eq("is_listed", true)
    .order("name");
  if (error) throw new Error(`Could not load listed training programmes: ${error.message}`);
  return (data ?? []) as Programme[];
}

export async function getPublishedProgrammes(): Promise<Programme[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("programmes")
    .select(
      "id,slug,name,summary,category,duration,curriculum,outcomes,entry_requirements,is_published,is_listed,image_path",
    )
    .eq("is_published", true)
    .order("name");
  if (error) throw new Error(`Could not load training programmes: ${error.message}`);
  return (data ?? []) as Programme[];
}
