// =============================
// 🚀 VENTSY - STARTUP BILIONÁRIA SYSTEM
// Toast + API Hook + Supabase Ready
// =============================

// FILE: /src/lib/useApi.ts
"use client";
import { useState } from "react";
import { useToast } from "src/components/proprietario/configuracoes/ToastContext";

export function useApi(fn: Function, options?: any) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const mutate = async (...args: any[]) => {
    try {
      setLoading(true);

      const result = await fn(...args);

      if (options?.successMessage !== false) {
        showToast({
          message: options?.successMessage || "Operação realizada com sucesso 🚀",
          type: "success",
        });
      }

      return result;
    } catch (error: any) {
      showToast({
        message: error?.message || "Erro inesperado",
        type: "error",
      });

      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading };
}

// =============================
// EXEMPLO COM SUPABASE
// =============================

/*
import { supabase } from "@/lib/supabase";
import { useApi } from "@/lib/useApi";

const updateUser = async (data: any) => {
  const { error } = await supabase
    .from("users")
    .update(data)
    .eq("id", "user_id");

  if (error) throw error;
};

const { mutate, loading } = useApi(updateUser, {
  successMessage: "Perfil atualizado com sucesso 💎",
});

<button onClick={() => mutate(form)} disabled={loading}>
  {loading ? "Salvando..." : "Salvar"}
</button>
*/