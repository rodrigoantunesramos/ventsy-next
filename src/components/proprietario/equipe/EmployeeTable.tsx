"use client";

import { useState, useEffect } from "react";
import { Employee } from "@/types/employee";
import { getEmployeeCost } from "@/lib/calc";
import * as Tooltip from "@radix-ui/react-tooltip";

interface Props {
  employees: Employee[];
  charges: any;
  onEdit: (employee: Employee) => void;
  onDelete: (id: string) => void;
}

export function EmployeeTable({
  employees,
  charges,
  onEdit,
  onDelete,
}: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState("TODOS");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const filteredEmployees = employees.filter((e) => {
    const matchSearch = e.name
      .toLowerCase()
      .includes(debouncedSearch.toLowerCase());

    const matchFilter =
      filter === "TODOS" ? true : e.status === filter;

    return matchSearch && matchFilter;
  });

  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    const costA = getEmployeeCost(a.salary, a.contractType, charges).total;
    const costB = getEmployeeCost(b.salary, b.contractType, charges).total;
    return costB - costA;
  });

  if (!employees.length)
    return (
      <div className="bg-white rounded-2xl p-10 text-center text-gray-500 shadow-sm">
        Nenhum funcionário ainda
      </div>
    );

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* HEADER */}
        <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b bg-gray-50">
          
          <input
            placeholder="Buscar funcionário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-xl px-3 py-2 text-sm w-full md:w-64 focus:ring-2 focus:ring-black/80 outline-none"
          />

          <div className="flex gap-2">
            {["TODOS", "ATIVO", "FERIAS"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-lg text-xs transition ${
                  filter === f
                    ? "bg-black text-white"
                    : "bg-white border text-gray-600 hover:bg-gray-100"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full text-sm">
          
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr className="text-left">
              <th className="px-6 py-4">Funcionário</th>
              <th className="px-6 py-4">Cargo</th>
              <th className="px-6 py-4">Contrato</th>
              <th className="px-6 py-4">Salário</th>
              <th className="px-6 py-4">Custo</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>

          <tbody>
            {sortedEmployees.map((e, index) => {
              const cost = getEmployeeCost(e.salary, e.contractType, charges);
              const percent = cost.percent || 0;

              return (
                <tr key={e.id} className="border-t hover:bg-gray-50 transition">
                  
                  {/* 🔥 NOME COM AVATAR */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center text-xs font-medium">
                        {e.avatar ? (
                          <img
                            src={e.avatar}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          e.name?.charAt(0)
                        )}
                      </div>

                      <div>
                        <p className="font-medium">{e.name}</p>
                        <p className="text-xs text-gray-400">
                          {e.department}
                        </p>

                        {index === 0 && (
                          <span className="text-[10px] text-red-500">
                            🔥 Mais caro
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* CARGO */}
                  <td className="px-6 py-4 text-gray-600">{e.role}</td>

                  {/* CONTRATO */}
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 rounded-md text-xs">
                      {e.contractType}
                    </span>
                  </td>

                  {/* SALÁRIO */}
                  <td className="px-6 py-4 font-medium">
                    R$ {e.salary.toLocaleString("pt-BR")}
                  </td>

                  {/* CUSTO */}
                  <td className="px-6 py-4">
                    <Tooltip.Provider>
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <div className="flex flex-col cursor-pointer">
                            <span className="text-red-500 font-semibold">
                              R$ {cost.total.toFixed(2)}
                            </span>

                            <span className="text-xs text-gray-500">
                              +{percent.toFixed(0)}%
                            </span>

                            <div className="w-full h-1 bg-gray-100 rounded mt-2">
                              <div
                                className="h-1 bg-red-500 rounded"
                                style={{ width: `${Math.min(percent, 100)}%` }}
                              />
                            </div>
                          </div>
                        </Tooltip.Trigger>

                        <Tooltip.Content className="bg-black text-white text-xs p-2 rounded">
                          {Object.entries(charges[e.contractType] || {}).map(
                            ([key, value]: any) => (
                              <div key={key} className="flex justify-between gap-4">
                                <span>{key}</span>
                                <span>
                                  R$ {(e.salary * (value / 100)).toFixed(0)}
                                </span>
                              </div>
                            )
                          )}
                        </Tooltip.Content>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                  </td>

                  {/* STATUS */}
                  <td className="px-6 py-4">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      {e.status}
                    </span>
                  </td>

                  {/* AÇÕES */}
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => onEdit(e)}
                      className="text-blue-600 text-sm hover:underline"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => setConfirmId(e.id)}
                      className="text-red-600 text-sm hover:underline"
                    >
                      Deletar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {confirmId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          
          <div className="bg-white rounded-2xl p-6 w-[400px] shadow-xl space-y-4">
            
            <div>
              <h2 className="text-lg font-semibold">
                Excluir funcionário
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Tem certeza que deseja excluir? Essa ação não pode ser desfeita.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmId(null)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-100"
              >
                Cancelar
              </button>

              <button
                onClick={() => {
                  onDelete(confirmId);
                  setConfirmId(null);
                }}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}