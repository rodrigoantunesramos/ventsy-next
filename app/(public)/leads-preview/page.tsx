// TEMP smoke-test probe — renderiza /painel/leads fora do guard de auth p/ verificação visual.
// REMOVER após o teste.
import LeadsPage from '@/app/(proprietario)/painel/leads/page';

export default function LeadsPreviewProbe() {
  return <LeadsPage />;
}
