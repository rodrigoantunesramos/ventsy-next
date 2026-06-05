"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "./SectionCard";
import { InputField } from "./InputField";
import { useToast } from "./ToastContext";
import { createClient } from "src/lib/supabase/supabase";
import { maskCPFCNPJ, maskPhone, getDocumentType, maskDate  } from "src/lib/masks";
import { useRef } from "react";

const supabase = createClient();

export function AccountSection() {
  const { showToast } = useToast();

  const [form, setForm] = useState({
    nome: "",
    email: "",
    cpf_cnpj: "",
    telefone: "",
    username: "",
    data_nascimento: "",
  });

  const [userId, setUserId] = useState<string | null>(null);
  const [docType, setDocType] = useState("CPF");

  // 🔥 carregar dados do usuário
  useEffect(() => {
    async function loadUser() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) return;

      setUserId(user.id);

      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Erro ao buscar usuário:", error);
        return;
      }

      setForm({
        nome: data?.nome || "",
        email: data?.email || user.email || "",
        cpf_cnpj: data?.cpf_cnpj || "",
        telefone: data?.telefone || "",
        username: data?.username || "",
        data_nascimento: data?.data_nascimento || "",
      });
      if (data?.cpf_cnpj) setDocType(getDocumentType(data.cpf_cnpj));
    }

    loadUser();
  }, []);



const dateRef = useRef<HTMLInputElement>(null);

function formatDateFromInput(value: string) {
  if (!value) return "";

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function parseToInputDate(value: string) {
  if (!value) return "";

  const [day, month, year] = value.split("/");
  return `${year}-${month}-${day}`;
}

  // 🔄 atualizar inputs
 function handleChange(e: any) {
  const { name, value } = e.target;

  let newValue = value;

  if (name === "cpf_cnpj") {
    newValue = maskCPFCNPJ(value);

    const type = getDocumentType(value);
    setDocType(type);
  }

  if (name === "telefone") {
    newValue = maskPhone(value);
  }

  if (name === "data_nascimento") {
  newValue = maskDate(value);
}

  setForm((prev) => ({
    ...prev,
    [name]: newValue,
  }));
}

  // 💾 salvar no banco
  async function handleSave() {
    if (!userId) return;

    const { error } = await supabase
      .from("usuarios")
      .update({
        nome: form.nome,
        email: form.email,
        cpf_cnpj: form.cpf_cnpj.replace(/\D/g, ""),
        telefone: form.telefone.replace(/\D/g, ""),
        username: form.username,
        data_nascimento: form.data_nascimento,
      })
      .eq("id", userId);

    if (error) {
      console.error(error);
      showToast("Erro ao salvar dados", "error");
    } else {
      showToast("Dados salvos com sucesso!", "success");
    }
  }

  return (
    <SectionCard title="Informações de Conta">
      <div className="grid grid-cols-2 gap-4">
        <InputField
          label="Nome"
          name="nome"
          value={form.nome}
          onChange={handleChange}
        />

        <InputField
          label="Email"
          name="email"
          value={form.email}
          onChange={handleChange}
        />

        <InputField
          label={`Documento (${docType === "CPF" ? "Pessoa Física" : "Pessoa Jurídica"})`}
          name="cpf_cnpj"
          value={form.cpf_cnpj}
          onChange={handleChange}
        />

        <InputField
          label="Telefone"
          name="telefone"
          value={form.telefone}
          onChange={handleChange}
        />

        <InputField
          label="Usuário"
          name="username"
          value={form.username}
          onChange={handleChange}
        />

        <div className="relative">
        <InputField
          label="Data de nascimento"
          name="data_nascimento"
          value={form.data_nascimento}
          onChange={handleChange}
          placeholder="dd/mm/aaaa"
        />

        {/* input invisível (calendário real) */}
        <input
          type="date"
          ref={dateRef}
          value={parseToInputDate(form.data_nascimento)}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              data_nascimento: formatDateFromInput(e.target.value),
            }))
          }
          className="absolute inset-0 opacity-0 pointer-events-none"
        />

        {/* botão do calendário */}
        <button
          type="button"
          onClick={() => dateRef.current?.showPicker()}
          className="absolute right-3 top-9 cursor-pointer"
        >
          📅
        </button>
      </div>
      </div>

      <button
        onClick={handleSave}
        className="mt-4 bg-red-500 text-white px-4 py-2 rounded-lg"
      >
        Salvar Alterações
      </button>
    </SectionCard>
  );
}