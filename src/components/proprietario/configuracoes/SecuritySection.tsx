"use client";

import { useState } from "react";
import { SectionCard } from "./SectionCard";
import { InputField } from "./InputField";
import { useToast } from "./ToastContext";
import { createClient } from "src/lib/supabase/supabase";

const supabase = createClient();

export function SecuritySection() {
  const { showToast } = useToast();

  const [form, setForm] = useState({
    senhaAtual: "",
    novaSenha: "",
    confirmarSenha: "",
  });

  function handleChange(e: any) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // 🔐 ALTERAR SENHA
async function handleChangePassword() {
  if (!form.senhaAtual || !form.novaSenha || !form.confirmarSenha) {
    showToast("Preencha todos os campos", "error");
    return;
  }

  if (form.novaSenha !== form.confirmarSenha) {
    showToast("As senhas não coincidem", "error");
    return;
  }

  const { data: authData } = await supabase.auth.getUser();
  const email = authData?.user?.email;

  if (!email) {
    showToast("Usuário não encontrado", "error");
    return;
  }

  // 🔥 RELLOGIN (valida senha atual)
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password: form.senhaAtual,
  });

  if (loginError) {
    showToast("Senha atual incorreta", "error");
    return;
  }

  // 🔐 Atualiza senha
  const { error } = await supabase.auth.updateUser({
    password: form.novaSenha,
  });

  if (error) {
    showToast("Erro ao alterar senha", "error");
  } else {
    showToast("Senha alterada com sucesso!", "success");
  }
}

  // 📩 RESET POR EMAIL
  async function handleResetPassword() {
    const { data: authData } = await supabase.auth.getUser();
    const email = authData?.user?.email;

    if (!email) {
      showToast("Usuário não encontrado", "error");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:3000/reset-password",
    });

    if (error) {
      console.error(error);
      showToast("Erro ao enviar e-mail", "error");
    } else {
      showToast("E-mail enviado para redefinir senha", "success");
    }
  }

const [showPassword, setShowPassword] = useState(false);

  return (
    <SectionCard title="Segurança">
      <div className="space-y-4">
        <InputField
          label="Senha Atual"
          name="senhaAtual"
          type="password"
          value={form.senhaAtual}
          onChange={handleChange}
        />

        <InputField
          label="Nova senha"
          name="novaSenha"
          type={showPassword ? "text" : "password"}
          value={form.novaSenha}
          onChange={handleChange}
        />

        <InputField
          label="Confirmar senha"
          name="confirmarSenha"
          type={showPassword ? "text" : "password"}
          value={form.confirmarSenha}
          onChange={handleChange}
        />

        </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={handleChangePassword}
          className="bg-red-500 text-white px-4 py-2 rounded-lg"
        >
          Alterar senha
        </button>

        <button
          onClick={handleResetPassword}
          className="border px-4 py-2 rounded-lg"
        >
          Receber e-mail com nova senha
        </button>

         <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {showPassword ? "🙈 Ocultar senhas" : "👁 Mostrar senhas"}
        </button>
      </div>
    </SectionCard>
  );
}