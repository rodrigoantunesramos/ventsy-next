// =============================
// FILE: /src/components/configuracoes/AdvancedSecuritySection.tsx
// =============================
import { SectionCard } from "./SectionCard";

export function AdvancedSecuritySection() {
  return (
    <SectionCard title="Segurança Avançada">
      <div className="space-y-3">
        <ActionItem label="2FA" button="Configurar" />
        <ActionItem label="Sessões ativas" button="Encerrar todas" />
        <ActionItem label="Histórico de acesso" button="Ver histórico" />
      </div>
    </SectionCard>
  );
}

function ActionItem({ label, button }: any) {
  return (
    <div className="flex justify-between items-center">
      <span>{label}</span>
      <button className="border px-3 py-1 rounded-lg">{button}</button>
    </div>
  );
}
