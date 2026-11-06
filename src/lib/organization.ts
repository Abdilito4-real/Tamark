import { createSupabaseServerClient } from "@/lib/supabase";

export type OrganizationSettings = {
  organization_name: string;
  contact_email: string;
  contact_phone: string;
};

export async function getPublicOrganizationSettings(): Promise<OrganizationSettings | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("organization_settings")
    .select("organization_name,contact_email,contact_phone")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(`Could not load approved organization contact details: ${error.message}`);
  return data;
}
