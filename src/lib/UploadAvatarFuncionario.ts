import { supabase } from "@/lib/supabase/supabase";

/* 🔥 CONFIG */
const MAX_SIZE_MB = 2;
const MAX_WIDTH = 800; // reduz resolução (economia brutal)
const QUALITY = 0.7; // compressão (0.0 a 1.0)

/* 🔥 COMPRESSÃO */
async function compressImage(file: File): Promise<File> {
  const imageBitmap = await createImageBitmap(file);

  const scale = Math.min(1, MAX_WIDTH / imageBitmap.width);

  const canvas = document.createElement("canvas");
  canvas.width = imageBitmap.width * scale;
  canvas.height = imageBitmap.height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob(
      (b) => resolve(b as Blob),
      "image/jpeg",
      QUALITY
    )
  );

  return new File([blob], "compressed.jpg", {
    type: "image/jpeg",
  });
}

/* 🔥 DELETE IMAGEM ANTIGA */
export async function deleteAvatar(oldUrl?: string) {
  if (!oldUrl) return;

  try {
    const path = oldUrl.split("/storage/v1/object/public/avatar/")[1];
    if (!path) return;

    await supabase.storage.from("avatar").remove([path]);
  } catch (err) {
    console.warn("Erro ao deletar imagem antiga:", err);
  }
}

/* 🔥 UPLOAD COMPLETO */
export async function uploadAvatar(file: File, oldUrl?: string) {
  try {
    /* 🚫 LIMITAR TAMANHO ORIGINAL */
    const sizeMB = file.size / 1024 / 1024;

    if (sizeMB > MAX_SIZE_MB) {
      alert("Imagem muito grande. Máximo permitido: 2MB");
      return null;
    }

    /* 🔥 COMPRESSÃO */
    const compressed = await compressImage(file);

    const fileName = `${crypto.randomUUID()}.jpg`;
    const filePath = `avatar/${fileName}`;

    const { error } = await supabase.storage
      .from("avatar")
      .upload(filePath, compressed, {
        upsert: false,
      });

    if (error) {
      console.error("Erro upload:", error);
      return null;
    }

    /* 🔥 DELETAR ANTIGA */
    if (oldUrl) {
      await deleteAvatar(oldUrl);
    }

    const { data } = supabase.storage
      .from("avatar")
      .getPublicUrl(filePath);

    return data.publicUrl;

  } catch (err) {
    console.error("Erro geral upload:", err);
    return null;
  }
}

