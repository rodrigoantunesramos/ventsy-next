"use client";

import { Employee } from "@/types/employee";
import { getEmployeeCost } from "@/lib/calc";

export function PayrollTable({ employees, charges }: any) {
  const total = employees.reduce(
    (acc: number, e: Employee) =>
      acc + getEmployeeCost(e.salary, e.contractType, charges).total,
    0
  );

  return (
    <div>
      <h2 className="mb-4 font-semibold">
        Total: R$ {total.toFixed(2)}
      </h2>

      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Salário</th>
            <th>Encargos</th>
            <th>Total</th>
          </tr>
        </thead>

        <tbody>
          {employees.map((e: Employee) => (
            <tr key={e.id} className="border-b">
              <td>{e.name}</td>
              <td>R$ {e.salary}</td>
              <td>
                R${" "}
                { (
                  getEmployeeCost(e.salary, e.contractType, charges)
                    .total - e.salary
                ).toFixed(2)}
              </td>
              <td>
                R$ {" "}
                {getEmployeeCost(
                  e.salary,
                  e.contractType,
                  charges
                ).total.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}