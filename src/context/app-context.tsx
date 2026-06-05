"use client";

import { createContext, useContext, useState } from "react";

const AppContext = createContext<any>(null);

export function AppProvider({ children }: any) {
  const [eventos, setEventos] = useState<any[]>([]);
  const [receitas, setReceitas] = useState<any[]>([]);
  const [calendario, setCalendario] = useState<Record<string, any>>({});

  // 🎯 EVENTO
  function addEvento(evento: any) {
    setEventos((prev) => [...prev, evento]);
  }

  // 💰 RECEITA
  function addReceita(receita: any) {
    setReceitas((prev) => [...prev, receita]);
  }

  // 📅 BLOQUEAR DATA
  function bloquearData(data: string, evento: any) {
    const dia = new Date(data).getDate();

    setCalendario((prev) => ({
      ...prev,
      [dia]: {
        status: "reservado",
        evento,
      },
    }));
  }

  // 🚫 VALIDAR DATA
  function isDataDisponivel(data: string) {
    const dia = new Date(data).getDate();

    return !calendario[dia];
  }

  return (
    <AppContext.Provider
      value={{
        eventos,
        addEvento,
        receitas,
        addReceita,
        calendario,
        bloquearData,
        isDataDisponivel, // ✅ agora funciona
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}