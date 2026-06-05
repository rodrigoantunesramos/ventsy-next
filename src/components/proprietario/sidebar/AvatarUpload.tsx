"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/supabase";

const supabase = createClient();

export function AvatarUpload({
  userId,
  avatarUrl,
  onUpload,
}: {
  userId: string;
  avatarUrl?: string;
  onUpload: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(avatarUrl || "");

  async function handleUpload(e: any) {
    const file = e.target.files[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}.png`;

    // preview imediato
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    const { error } = await supabase.storage
      .from("avatar-prop")
      .upload(fileName, file, {
        upsert: true,
      });

    if (error) {
      console.error(error);
      return;
    }

    const { data } = supabase.storage
      .from("avatar-prop")
      .getPublicUrl(fileName);

    onUpload(data.publicUrl);
  }

  return (
    <div className="flex flex-col items-center">
      <div
        onClick={() => fileRef.current?.click()}
        className="cursor-pointer"
      >
        {preview ? (
          <img
            src={preview}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="bg-pink-500 text-white w-12 h-12 rounded-full flex items-center justify-center">
            U
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileRef}
        className="hidden"
        accept="image/*"
        onChange={handleUpload}
      />
    </div>
  );
}