"use client";

export function ChargesSettings({ charges, setCharges }: any) {
  return (
    <div className="space-y-6">

      {/* ALERTA */}
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl text-sm">
        ⚠️ Recomendamos que você peça ajuda ao seu contador para preencher esses valores corretamente.
        Os encargos podem variar por região, sindicato e regime tributário.
      </div>

      <button
  onClick={() =>
    setCharges({
      CLT: {
        inss: 20,
        fgts: 8,
        rat: 2,
        terceiros: 5.8,
        ferias: 11.11,
        decimoTerceiro: 8.33,
        valeTransporte: 6,
        valeAlimentacao: 10,
        planoSaude: 8,
        outros: 0,
      },
      PJ: {},
      DIARIA: {},
    })
  }
  className="bg-black text-white px-4 py-2 rounded-xl text-sm"
>
  🇧🇷 Usar padrão Brasil
</button>

      {/* CLT */}
      <Card title="CLT (Funcionários registrados)">
        
        <Section title="Encargos Legais">
          <Field label="INSS Patronal" valueKey="inss" />
          <Field label="FGTS" valueKey="fgts" />
          <Field label="RAT (Risco)" valueKey="rat" />
          <Field label="Terceiros (Sistema S)" valueKey="terceiros" />
        </Section>

        <Section title="Provisões">
          <Field label="Férias + 1/3" valueKey="ferias" />
          <Field label="13º Salário" valueKey="decimoTerceiro" />
        </Section>

        <Section title="Benefícios">
          <Field label="Vale Transporte" valueKey="valeTransporte" />
          <Field label="Vale Alimentação" valueKey="valeAlimentacao" />
          <Field label="Plano de Saúde" valueKey="planoSaude" />
          <Field label="Outros" valueKey="outros" />
        </Section>
      </Card>

      {/* PJ */}
      <Card title="PJ (Prestador de serviço)">
        <p className="text-sm text-gray-500">
          Profissionais PJ são responsáveis pelos próprios encargos (impostos e contribuições).
        </p>
      </Card>

      {/* DIÁRIA */}
      <Card title="Diária / Freelancer">
        <p className="text-sm text-gray-500">
          Contratação pontual sem encargos fixos.
        </p>
      </Card>
    </div>
  );

  function Field({ label, valueKey }: any) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{label}</span>

        <div className="flex items-center gap-2">
          <input
            type="number"
            value={charges.CLT[valueKey] || 0}
            onChange={(e) =>
              setCharges((prev: any) => ({
                ...prev,
                CLT: {
                  ...prev.CLT,
                  [valueKey]: Number(e.target.value),
                },
              }))
            }
            className="border rounded-lg px-3 py-1 w-20 text-sm"
          />
          <span className="text-sm">%</span>
        </div>
      </div>
    );
  }
}

function Card({ title, children }: any) {
  return (
    <div className="bg-white rounded-2xl shadow p-5 space-y-4">
      <h2 className="font-semibold text-lg">{title}</h2>
      {children}
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-400 mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}