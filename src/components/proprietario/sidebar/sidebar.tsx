// ESTE É O MENU LATERAL DO DASHBOARD DO PROPRIETÁRIO //

"use client";

import { Home, Building2, Image, Calendar, DollarSign, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/supabase";
import { compressImage } from "src/components/proprietario/sidebar/image";
import { useRouter } from "next/navigation";

const supabase = createClient();

const menu = [
  { label: "Dashboard", href: "/painel", icon: Home },
  { label: "Minha Propriedade", href: "/minha-propriedade", icon: Building2 },
  { label: "Fotos", href: "/fotos-propriedade", icon: Image },
  { section: "GESTÃO" },
  { label: "Eventos", href: "/eventos", icon: Calendar },
  { label: "Calendário", href: "/calendario-propriedade", icon: Calendar },
  { label: "Financeiro", href: "/financeiro", icon: DollarSign },
  { label: "Leads", href: "/leads", icon: DollarSign },
  { label: "Relatorios", href: "/relatorios", icon: DollarSign },
  { label: "Documentos", href: "/documentos", icon: DollarSign },
  { label: "Equipe", href: "/equipe", icon: DollarSign },
  { label: "Meu Diario", href: "/diario", icon: DollarSign },
  { section: "CONTA" },
  { label: "Planos", href: "/planos", icon: Settings },
  { label: "Indique & Ganhe", href: "/indique-ganhe", icon: DollarSign },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
  { label: "Sair", href: "/sair", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [userName, setUserName] = useState("Carregando...");
  const [username, setUsername] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  // 🔥 CARREGAR USUÁRIO (ESSENCIAL)
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);

        const { data } = await supabase
          .from("usuarios")
          .select("avatar_prop, nome, username")
          .eq("id", user.id)
          .single();

        if (data) {
          setAvatarUrl(data.avatar_prop || "");
          setUserName(data.nome || "Usuário");
          setUsername(data.username || "");
        }
      }
    }

    loadUser();
  }, []);

  // 🔥 UPLOAD + SALVAR
  async function handleFileChange(e: any) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    // opcional: limitar tamanho
    if (file.size > 2 * 1024 * 1024) {
      alert("Imagem muito grande (máx 2MB)");
      return;
    }

    const compressedFile = await compressImage(file);

    // 🔥 UPLOAD

    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}.png`;

    const { error: uploadError } = await supabase.storage
      .from("avatar-prop")
      .upload(fileName, compressedFile, {
        upsert: true,
      });

    if (uploadError) {
      console.error(uploadError);
      return;
    }

    const { data } = supabase.storage
      .from("avatar-prop")
      .getPublicUrl(fileName);

    const publicUrl = data.publicUrl;

    setAvatarUrl(publicUrl);

    await supabase
      .from("usuarios")
      .update({ avatar_prop: publicUrl })
      .eq("id", userId);
  }

  async function handleRemoveAvatar() {
    if (!userId) return;

    // tenta remover do storage (ignora erro se não existir)
    await supabase.storage
      .from("avatar-prop")
      .remove([`${userId}.png`, `${userId}.jpg`, `${userId}.jpeg`]);

    // limpa banco
    await supabase
      .from("usuarios")
      .update({ avatar_prop: null })
      .eq("id", userId);

    setAvatarUrl("");
    setShowMenu(false);
  }

const router = useRouter();

async function handleLogout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error(error);
    return;
  }

  router.push("/login"); // ou "/"
}
  return (
    <aside className="w-[260px] bg-white border-r border-gray-100 p-4">
      {/* USER */}
      <div className="mb-6 flex flex-col items-center justify-center text-center relative">
  
  <div
    onClick={() => setShowMenu(!showMenu)}
    className="cursor-pointer"
  >
    {avatarUrl ? (
      <img
        src={avatarUrl}
        className="w-12 h-12 rounded-full object-cover"
      />
    ) : (
      <div className="bg-pink-500 text-white w-12 h-12 rounded-full flex items-center justify-center">
        {userName?.[0]}
      </div>
    )}
  </div>

        <p className="font-semibold mt-2">{userName}</p>
        <p className="text-sm text-gray-400">@{username}</p>
      </div>

      <input
        type="file"
        ref={fileRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />

      {/* MENU */}
      <nav className="flex flex-col gap-1 text-sm">
        {menu.map((item, index) =>
          item.section ? (
            <p key={index} className="text-xs text-gray-400 mt-4">
              {item.section}
            </p>
          ) : item.label === "Sair" ? (
            <button
              key={index}
              onClick={handleLogout}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition text-red-500"
            >
              <item.icon size={16} />
              {item.label}
            </button>  
        ) : item.href ? (
            <Link
              key={index}
              href={item.href}
              className={`flex items-center gap-2 p-2 rounded-lg transition ${
                pathname === item.href
                  ? "bg-pink-50 text-pink-600 font-medium"
                  : "hover:bg-gray-100"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          ) : (
            <button
              key={index}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <item.icon size={16} />
              {item.label}
            </button>
          )
        )}
      </nav>
    </aside>
  );
}