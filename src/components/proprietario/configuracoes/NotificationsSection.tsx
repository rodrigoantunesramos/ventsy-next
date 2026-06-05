// =============================
// FILE: /src/components/configuracoes/NotificationsSection.tsx
// =============================
import { useState } from "react";
import { SectionCard } from "./SectionCard";
import { ToggleSwitch } from "./ToggleSwitch";

export function NotificationsSection() {
  const [email, setEmail] = useState(true);
  const [whatsapp, setWhatsapp] = useState(false);
  const [news, setNews] = useState(true);
  const [report, setReport] = useState(true);
  const [visita, setVisita] = useState(false);

  return (
    <SectionCard title="Notificações e Alertas">
      <div className="space-y-4">
        <ToggleItem label="Receber email de leads" checked={email} onChange={setEmail} />
        <ToggleItem label="Receber WhatsApp" checked={whatsapp} onChange={setWhatsapp} />
        <ToggleItem label="Novidades VENTSY" checked={news} onChange={setNews} />
        <ToggleItem label="Relatório semanal" checked={report} onChange={setReport} />
        <ToggleItem label="Alerta de Visitas" checked={visita} onChange={setVisita} />
      </div>

      <button className="bg-red-500 text-white px-4 py-2 rounded-lg">
        Salvar preferências
      </button>
    </SectionCard>
  );
}

function ToggleItem({ label, checked, onChange }: any) {
  return (
    <div className="flex justify-between items-center">
      <span>{label}</span>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}