// =============================
// FILE: /src/app/dashboard/configuracoes/page.tsx
// =============================
"use client";

import { AccountSection } from "src/components/proprietario/configuracoes/AccountSection";
import { SecuritySection } from "src/components/proprietario/configuracoes/SecuritySection";
import { NotificationsSection } from "src/components/proprietario//configuracoes/NotificationsSection";
import { AdvancedSecuritySection } from "src/components/proprietario//configuracoes/AdvancedSecuritySection";
import { DangerZoneSection } from "src/components/proprietario//configuracoes/DangerZoneSection";
import { ToastProvider } from "@/components/proprietario/configuracoes/ToastContext";

export default function ConfiguracoesPage() {
  return (
    <ToastProvider>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <SettingsContent />
      </div>
    </ToastProvider>
  );
}

function SettingsContent() {
  return (
    <div className="grid grid-cols-1  gap-6">

      <AccountSection />
      <SecuritySection />
      <NotificationsSection />
      <AdvancedSecuritySection />
      <DangerZoneSection />
    </div>
  );
}