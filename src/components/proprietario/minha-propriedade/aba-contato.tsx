"use client";

import { Input } from "@/components/ui/imput";
import { Select } from "@/components/ui/select";
import { useState } from "react";
import { createClient } from "src/lib/supabase/supabase";
import { PROPRIEDADE_TYPES, propriedadeType } from "src/components/public/propriedadeTypes";
import { PropertyTypeSelect } from "@/components/proprietario/minha-propriedade/PropertyTypeSelect";



export function AbaContato() {


  const supabase = createClient();

  const [form, setForm] = useState({
  name: "",
  type: "",
  capacity: "",
  email: "",
  whatsapp: "",
  phone: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  youtube: "",
  linkedin: "",
  website: "",
  responsible_name: "",
});

  const handleChange = (field: string, value: string) => {
  setForm((prev) => ({
    ...prev,
    [field]: value,
  }));
};

const handleSave = async () => {
  const { error } = await supabase.from("properties").insert([
    {
      name: form.name,
      type: form.type,
      capacity: Number(form.capacity),
      email: form.email,
      whatsapp: form.whatsapp,
      phone: form.phone,
      instagram: form.instagram,
      facebook: form.facebook,
      tiktok: form.tiktok,
      youtube: form.youtube,
      linkedin: form.linkedin,
      website: form.website,
      responsible_name: form.responsible_name,
    },
  ]);

  if (error) {
    console.error(error);
    alert("Erro ao salvar");
  } else {
    alert("Salvo com sucesso 🚀");
  }
};

const groupedTypes = PROPRIEDADE_TYPES.reduce((acc, item) => {
  if (!acc[item.category]) {
    acc[item.category] = [];
  }
  acc[item.category].push(item);
  return acc;
}, {} as Record<string, propriedadeType[]>);

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">

      <div>
        <h2 className="font-semibold">Dados da Propriedade</h2>
        <p className="text-sm text-gray-400">
          Essas informações serão exibidas no seu anúncio público.
        </p>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-2 gap-4">

        <Input
            label="Nome do Espaço"
            placeholder="Ex: Mansão das Palmeiras"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />

       <div>
            <label className="text-sm font-medium text-gray-700">
              Tipo de Propriedade
            </label>

            <PropertyTypeSelect
                value={form.type}
                onChange={(value: string) => handleChange("type", value)}
              />
              <option value="">Selecione um tipo</option>

              {Object.entries(groupedTypes).map(([category, items]) => (
                <optgroup key={category} label={category}>
                  {items.map((item) => (
                    <option key={item.nome} value={item.nome}>
                      {item.emoji} {item.nome}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

        
          <Input
            label="Capacidade Máxima (pessoas)"
            placeholder="Ex: 200"
            value={form.capacity}
            onChange={(e) => handleChange("capacity", e.target.value)}
          />
          <Input
            label="E-mail de Contato"
            placeholder="contato@..."
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
          />  

        <Input
            label="WhatsApp"
            placeholder="(21) 99999-0000"
            value={form.whatsapp}
            onChange={(e) => handleChange("whatsapp", e.target.value)}
          />
        <Input
            label="Telefone Fixo"
            placeholder="(21) 3333-0000"
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
          />

        <Input
            label="Instagram"
            placeholder="@seuespaco"
            value={form.instagram}
            onChange={(e) => handleChange("instagram", e.target.value)}
          />

        <Input
            label="Facebook"
            placeholder="facebook.com/..."
            value={form.facebook}
            onChange={(e) => handleChange("facebook", e.target.value)}
          />

        <Input
            label="TikTok"
            placeholder="@seuespaco"
            value={form.tiktok}
            onChange={(e) => handleChange("tiktok", e.target.value)}
          />
          
        <Input
            label="YouTube"
            placeholder="youtube.com/..."
            value={form.youtube}
            onChange={(e) => handleChange("youtube", e.target.value)}
          />

        <Input
            label="LinkedIn"
            placeholder="linkedin.com/..."
            value={form.linkedin}
            onChange={(e) => handleChange("linkedin", e.target.value)}
          />
  
        <Input
            label="Site Externo"
            placeholder="www..."
            value={form.website}
            onChange={(e) => handleChange("website", e.target.value)}
          />

      </div>

      {/* RESPONSÁVEL */}
      <div className="border-t pt-4 space-y-4">

        <h3 className="font-semibold">Responsável pelo Atendimento</h3>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
            🙂
          </div>

          <Input
            label="Nome do Responsável"
            placeholder="Ex: Rodrigo Ramos"
            value={form.responsible_name}
            onChange={(e) => handleChange("responsible_name", e.target.value)}
          />
        </div>

      </div>

      {/* BOTÕES */}
      <div className="flex justify-end gap-2">
        <button className="px-4 py-2 border rounded-lg">
          Cancelar
        </button>

       <button
          onClick={handleSave}
          className="px-4 py-2 bg-pink-500 text-white rounded-lg"
        >
          Salvar Alterações
        </button>

      </div>


    </div>
  );
}