// Utilitários de data do Diário — comparações por DATA DE CALENDÁRIO, imunes a
// fuso horário. O lembrete é escolhido como uma data (YYYY-MM-DD) mas é gravado
// como timestamptz (meia-noite UTC). Comparar o timestamp cru com a hora local
// empurra a data um dia para trás em fusos negativos (ex.: Brasil UTC−3), fazendo
// um lembrete de "hoje" aparecer como "vencido". Aqui comparamos só ano-mês-dia.

export function todayYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Extrai a parte da data (YYYY-MM-DD) de um ISO/timestamp.
export function ymd(iso: string): string {
  return iso.slice(0, 10);
}

// Dias de calendário entre hoje (local) e a data do lembrete. Negativo = passado.
export function dayDiff(iso: string): number {
  const [ty, tm, td] = todayYMD().split('-').map(Number);
  const [ry, rm, rd] = ymd(iso).split('-').map(Number);
  const todayUTC = Date.UTC(ty, tm - 1, td);
  const remUTC   = Date.UTC(ry, rm - 1, rd);
  return Math.round((remUTC - todayUTC) / 86_400_000);
}

export type ReminderStatus = 'past' | 'today' | 'soon' | 'future';

// 'past' vencido · 'today' vence hoje · 'soon' nos próximos 3 dias · 'future' depois.
export function reminderStatus(iso: string): ReminderStatus {
  const d = dayDiff(iso);
  if (d < 0)  return 'past';
  if (d === 0) return 'today';
  if (d <= 3)  return 'soon';
  return 'future';
}

export function relativeLabel(iso: string): string {
  const d = dayDiff(iso);
  if (d === 0)  return 'hoje';
  if (d === 1)  return 'amanhã';
  if (d === -1) return 'ontem';
  if (d < 0)    return `há ${Math.abs(d)} dias`;
  return `em ${d} dias`;
}

// Formata a data do lembrete a partir dos componentes Y-M-D (sem deslocar fuso).
export function formatReminderLabel(iso: string): string {
  const [y, m, d] = ymd(iso).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}
