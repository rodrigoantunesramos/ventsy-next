import { createClient } from "@/lib/supabase/supabase";

const supabase = createClient();

export async function getPropertyImages(propertyId: string) {
  const { data, error } = await supabase.storage
    .from("fotos-propriedade")
    .list(propertyId);

  if (error) {
    console.error(error);
    return [];
  }

  const images = data.map((file) => {
    const { data: publicUrl } = supabase.storage
      .from("fotos-propriedade")
      .getPublicUrl(`${propertyId}/${file.name}`);

    return publicUrl.publicUrl;
  });

  return images;
}