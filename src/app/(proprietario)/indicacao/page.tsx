import { ReferralHeader } from "src/components/proprietario/indicacao/ReferralHeader";
import { ReferralHero } from "src/components/proprietario/indicacao/ReferralHero";
import { ReferralSteps } from "src/components/proprietario/indicacao/ReferralSteps";
import { ReferralStats } from "src/components/proprietario/indicacao/ReferralStats";
import { ReferralTable } from "src/components/proprietario/indicacao/ReferralTable";
import { Referral } from "src/types/referral";

import { createServerClient } from "@/lib/supabase/server";
import { generateReferralCode } from "./generateCode";

export async function getOrCreateReferralCode(userId: string) {
  const supabase = createServerClient();

  // 🔍 busca no lugar certo
  const { data: existing } = await supabase
    .from("usuarios") // ✅ corrigido aqui
    .select("referral_code")
    .eq("id", userId)
    .single();

  if (existing?.referral_code) {
    return existing.referral_code;
  }

  let newCode = generateReferralCode();
  let isUnique = false;

  while (!isUnique) {
    const { data } = await supabase
      .from("usuarios") // ✅ corrigido aqui também
      .select("id")
      .eq("referral_code", newCode)
      .maybeSingle();

    if (!data) {
      isUnique = true;
    } else {
      newCode = generateReferralCode();
    }
  }

  await supabase
    .from("usuarios") // ✅ aqui também
    .update({ referral_code: newCode })
    .eq("id", userId);

  return newCode;
}

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