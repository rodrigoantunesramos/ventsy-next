import { FinanceiroTabs } from "@/components/proprietario/financeiro/financeiro-tabs";

export default function FinanceiroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">

      {/* MENU */}
      <FinanceiroTabs />

      {/* CONTEÚDO */}
      {children}

    </div>
  );
}