import { createClient } from "@/lib/supabase/server";
import { generateReferralCode } from "./generateCode";

export async function getOrCreateReferralCode(userId: string) {
  const supabase = await createClient();

  // 1. Verifica se já existe
  const { data: existing } = await supabase
    .from("usuarios")
    .select("referral_code")
    .eq("id", userId)
    .single();

  if (existing?.referral_code) {
    return existing.referral_code;
  }

  // 2. Gera novo código único
  let newCode = generateReferralCode();
  let isUnique = false;

  while (!isUnique) {
    const { data } = await supabase
      .from("usuarios")
      .select("id")
      .eq("referral_code", newCode)
      .maybeSingle();

    if (!data) {
      isUnique = true;
    } else {
      newCode = generateReferralCode();
    }
  }

  // 3. Salva no usuário
  await supabase
    .from("profiles")
    .update({ referral_code: newCode })
    .eq("id", userId);

  return newCode;
}