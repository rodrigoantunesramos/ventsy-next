import { ReferralHeader } from "src/components/proprietario/indicacao/ReferralHeader";
import { ReferralHero } from "src/components/proprietario/indicacao/ReferralHero";
import { ReferralSteps } from "src/components/proprietario/indicacao/ReferralSteps";
import { ReferralStats } from "src/components/proprietario/indicacao/ReferralStats";
import { ReferralTable } from "src/components/proprietario/indicacao/ReferralTable";
import { Referral } from "src/types/referral";

import { getOrCreateReferralCode } from "@/lib/referral/getOrCreateReferral";
import { createClient } from "src/lib/supabase/server";

export default async function IndicacaoPage() {
  
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Usuário não autenticado</div>;
  }

  const referralCode = await getOrCreateReferralCode(user.id);

  const stats = {
    invited: 0,
    converted: 0,
    rewards: 0,
  };

  const referrals: Referral[] = [];

  return (
    <div className="p-6">
      <ReferralHeader />

      <div className="bg-white rounded-2xl p-4 shadow-md mb-6">
        <p className="text-sm text-zinc-500">Seu código de indicação</p>
        <div className="flex items-center justify-between mt-2">
          <span className="font-semibold">{referralCode}</span>
        </div>
      </div>

      <ReferralHero referralCode={referralCode} />
      <ReferralSteps />
      <ReferralStats stats={stats} />
      <ReferralTable data={referrals} />
    </div>
  );
}