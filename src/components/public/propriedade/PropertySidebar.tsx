"use client";

import { useState } from "react";

export function PropertySidebar({ property }: any) {
  const [guests, setGuests] = useState(50);
  const [hours, setHours] = useState(4);
  const [extras, setExtras] = useState<string[]>([]);

  const extraServices = [
    { name: "Decoração", price: 500 },
    { name: "Buffet", price: 1200 },
    { name: "DJ", price: 800 },
  ];

  // 💰 LÓGICA DE PREÇO POR CONVIDADOS
  const basePrice =
    guests <= 50
      ? 1000
      : guests <= 100
      ? 1800
      : 2500;

  const extrasTotal = extraServices
    .filter((e) => extras.includes(e.name))
    .reduce((acc, e) => acc + e.price, 0);

  const total = basePrice + extrasTotal;

  

  const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

  return (
    <div className="border p-5 rounded-2xl shadow-lg sticky top-24 bg-white space-y-4">

      {/* PREÇOS */}
      <div className="flex items-center bg-gray-50 rounded-xl p-4">

          {/* POR HORA */}
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-500">Por hora</p>
            <p className="text-xl font-bold tracking-tight">
              {formatCurrency(property.priceHour)}
            </p>
          </div>

          {/* DIVISOR */}
          <div className="w-px h-10 bg-gray-300" />

          {/* POR DIA */}
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-500">Por dia</p>
            <p className="text-xl font-bold tracking-tight">
              {formatCurrency(property.priceDay)} 
            </p>
          </div>

        </div>

      {/* BOTÃO */}
      <button className="w-full bg-black text-white py-3 rounded-xl font-medium">
        Entrar em contato
      </button>

      {/* FORM */}
      <div className="space-y-4">

  {/* NOME */}
  <div>
    <label className="text-sm font-medium text-gray-700">
      Nome completo
    </label>
    <input
      placeholder="Seu nome"
      className="w-full mt-1 border p-3 rounded-lg focus:ring-2 focus:ring-black outline-none"
    />
  </div>

  {/* WHATSAPP */}
  <div>
    <label className="text-sm font-medium text-gray-700">
      WhatsApp
    </label>
    <input
      placeholder="(11) 99999-9999"
      className="w-full mt-1 border p-3 rounded-lg focus:ring-2 focus:ring-black outline-none"
    />
  </div>

  {/* EMAIL */}
  <div>
    <label className="text-sm font-medium text-gray-700">
      Email
    </label>
    <input
      placeholder="seu@email.com"
      className="w-full mt-1 border p-3 rounded-lg focus:ring-2 focus:ring-black outline-none"
    />
  </div>

  {/* DATA */}
  <div>
    <label className="text-sm font-medium text-gray-700">
      Data do evento
    </label>
    <input
      type="date"
      className="w-full mt-1 border p-3 rounded-lg focus:ring-2 focus:ring-black outline-none"
    />
  </div>

  {/* CONVIDADOS */}
  <div>
    <label className="text-sm font-medium text-gray-700">
      Quantidade de convidados
    </label>
    <input
      type="number"
      value={guests}
      onChange={(e) => setGuests(Number(e.target.value))}
      className="w-full mt-1 border p-3 rounded-lg focus:ring-2 focus:ring-black outline-none"
    />
  </div>

  {/* DESCRIÇÃO */}
  <div>
    <label className="text-sm font-medium text-gray-700">
      Sobre o evento
    </label>
    <textarea
      placeholder="Descreva brevemente seu evento..."
      maxLength={120}
      className="w-full mt-1 border p-3 rounded-lg resize-none h-20 focus:ring-2 focus:ring-black outline-none"
    />
    <p className="text-xs text-gray-400 mt-1">
      Máximo de 120 caracteres
    </p>
  </div>

</div>

      {/* EXTRAS */}
      <div>
        <p className="font-semibold mb-2">Serviços extras</p>

        <div className="space-y-2">
          {extraServices.map((extra) => (
            <label
              key={extra.name}
              className="flex items-center justify-between border p-2 rounded-lg cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setExtras([...extras, extra.name]);
                    } else {
                      setExtras(extras.filter((e) => e !== extra.name));
                    }
                  }}
                />
                <span>{extra.name}</span>
              </div>

              <span className="text-sm text-gray-500">
                +R$ {extra.price}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* RESUMO */}
      <div className="border-t pt-4 space-y-1">
        <p className="text-sm text-gray-500">Resumo</p>

        <div className="flex justify-between text-sm">
          <span>Base ({guests} convidados)</span>
          <span>{formatCurrency(basePrice)}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span>Extras</span>
          <span>{formatCurrency(extrasTotal)}</span>
        </div>

        <div className="flex justify-between font-bold text-lg mt-2">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {/* CTA */}
      <button className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold">
        Pedir orçamento
      </button>

    </div>
  );
}