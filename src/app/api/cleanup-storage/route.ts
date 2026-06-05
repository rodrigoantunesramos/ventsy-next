import { createServerSupabaseClient } from "src/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();

  // 🔍 lista arquivos
  const { data: files, error: storageError } = await supabase
    .storage
    .from("diary-files")
    .list("", { limit: 1000 });

  if (storageError) {
    return Response.json({ error: storageError.message });
  }

  // 📄 busca banco
  const { data: events, error: dbError } = await supabase
    .from("diary_events")
    .select("file_url");

  if (dbError) {
    return Response.json({ error: dbError.message });
  }

  const usedFiles = new Set(
    (events || [])
      .map((e) => e.file_url)
      .filter(Boolean)
      .map((url) =>
        url.split("/storage/v1/object/public/diary-files/")[1]
      )
  );

  const deleted: string[] = [];

  // 🧹 limpeza
  for (const file of files || []) {
    if (!usedFiles.has(file.name)) {
      await supabase.storage
        .from("diary-files")
        .remove([file.name]);

      deleted.push(file.name);
    }
  }

  return Response.json({
    success: true,
    deleted,
  });
}
