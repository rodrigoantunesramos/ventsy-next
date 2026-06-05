// =============================
// FILE: /src/components/configuracoes/ToggleSwitch.tsx
// =============================
export function ToggleSwitch({ checked, onChange }: any) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-12 h-6 flex items-center rounded-full p-1 transition-all ${
        checked ? "bg-red-500" : "bg-gray-300"
      }`}
    >
      <div
        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all ${
          checked ? "translate-x-6" : ""
        }`}
      />
    </button>
  );
}
