"use client";

type Props = {
  referralCode: string;
};

export function ReferralHero({ referralCode }: Props) {
  const link = `https://ventsy.com/anunciar?ref=${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(link)}`);
  };

  const handleEmail = () => {
    window.open(`mailto:?subject=Convite&body=${link}`);
  };

  return (
    <div className="bg-gradient-to-r from-black to-zinc-900 text-white rounded-2xl p-6 shadow-md mb-6">
      <span className="text-xs bg-white/10 px-2 py-1 rounded-full">
        Programa de Parceiros
      </span>

      <h2 className="text-2xl font-semibold mt-4">
        Indique um espaço e ganhe{" "}
        <span className="text-red-500">1 mês grátis</span>
      </h2>

      <p className="text-sm text-zinc-400 mt-2">
        Quando o indicado publicar e pagar o primeiro plano, você ganha 1 mês grátis.
      </p>

      <div className="flex flex-col md:flex-row gap-3 mt-6">
        <input
          value={link}
          readOnly
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
        />

        <button
          onClick={handleCopy}
          className="bg-red-500 hover:scale-[1.02] transition px-4 py-2 rounded-lg"
        >
          Copiar
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mt-4">
        <button
          onClick={handleWhatsApp}
          className="bg-green-500 hover:scale-[1.02] transition px-4 py-2 rounded-lg"
        >
          Enviar pelo WhatsApp
        </button>

        <button
          onClick={handleEmail}
          className="bg-zinc-800 hover:scale-[1.02] transition px-4 py-2 rounded-lg"
        >
          Enviar por Email
        </button>
      </div>
    </div>
  );
}