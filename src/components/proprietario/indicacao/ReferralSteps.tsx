const steps = [
  {
    title: "Envie o link",
    description: "Compartilhe seu link com donos de espaços.",
  },
  {
    title: "Eles testam",
    description: "O indicado cria e publica o espaço.",
  },
  {
    title: "Você ganha",
    description: "Receba 1 mês grátis automaticamente.",
  },
];

export function ReferralSteps() {
  return (
    <div className="grid md:grid-cols-3 gap-4 mb-6">
      {steps.map((step, index) => (
        <div
          key={index}
          className="bg-white rounded-2xl p-4 shadow-md hover:scale-[1.02] transition"
        >
          <h3 className="font-semibold">
            {index + 1}️⃣ {step.title}
          </h3>
          <p className="text-sm text-zinc-500 mt-1">{step.description}</p>
        </div>
      ))}
    </div>
  );
}