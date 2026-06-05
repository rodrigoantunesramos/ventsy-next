"use client";

import { useEffect, useState } from "react";
import { supabase } from '@/lib/supabase/supabase'
import { StatsCards } from "@/components/proprietario/equipe/StatsCards";
import { Tabs } from "@/components/proprietario/equipe/tabs";
import { EmployeeTable } from "@/components/proprietario/equipe/EmployeeTable";
import { PayrollTable } from "@/components/proprietario/equipe/PayrollTable";
import { ChargesSettings } from "@/components/proprietario/equipe/ChargesSettings";
import { EmployeeModal } from "@/components/proprietario/equipe/EmployeeModal";

export default function TeamPage() {
  const [tab, setTab] = useState("EQUIPE");
  const [open, setOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);

  const [employees, setEmployees] = useState<any[]>([]);

  const [charges, setCharges] = useState({
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
  });

  // 🔥 LOAD FROM SUPABASE
  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    // mapear snake_case → camelCase
    const mapped = data.map((e: any) => ({
      id: e.id,
      name: e.name,
      role: e.role,
      department: e.department,
      salary: Number(e.salary),
      contractType: e.contract_type,
      admissionDate: e.admission_date,
      status: e.status,
      avatar: e.avatar,
      phone: e.phone,
      notes: e.notes,
    }));

    setEmployees(mapped);
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // 🔥 CREATE + UPDATE
  const saveEmployee = async (emp: any) => {
    if (editingEmployee) {
      // UPDATE
      const { error } = await supabase
        .from("employees")
        .update({
          name: emp.name,
          role: emp.role,
          department: emp.department,
          salary: emp.salary,
          contract_type: emp.contractType,
          admission_date: emp.admissionDate,
          status: emp.status,
          avatar: emp.avatar,
          phone: emp.phone,
          notes: emp.notes,
        })
        .eq("id", emp.id);

      if (error) console.error(error);
    } else {
      // CREATE
      const { error } = await supabase.from("employees").insert([
        {
          name: emp.name,
          role: emp.role,
          department: emp.department,
          salary: emp.salary,
          contract_type: emp.contractType,
          admission_date: emp.admissionDate,
          status: emp.status,
          avatar: emp.avatar,
          phone: emp.phone,
          notes: emp.notes,
        },
      ]);

      if (error) console.error(error);
    }

    setEditingEmployee(null);
    fetchEmployees(); // 🔥 recarrega
  };

  // 🔥 DELETE
  const deleteEmployee = async (id: string) => {
    const { error } = await supabase
      .from("employees")
      .delete()
      .eq("id", id);

    if (error) console.error(error);

    fetchEmployees();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">

      {/* HEADER */}
      <div className="p-6">
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 text-white p-6 rounded-3xl shadow-lg flex items-center justify-between">
          
          <div>
            <h1 className="text-2xl font-semibold">
              Equipe & Folha
            </h1>

            <p className="text-zinc-400 text-sm mt-1">
              Controle completo de custos, encargos e equipe em tempo real
            </p>
          </div>

          <button
            onClick={() => {
              setEditingEmployee(null);
              setOpen(true);
            }}
            className="bg-white text-black px-5 py-2 rounded-xl font-medium hover:scale-105 transition"
          >
            + Novo Funcionário
          </button>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">

        <StatsCards employees={employees} charges={charges} />

        <Tabs active={tab} setActive={setTab} />

        {tab === "EQUIPE" && (
          <EmployeeTable
            employees={employees}
            charges={charges}
            onEdit={(emp: any) => {
              setEditingEmployee(emp);
              setOpen(true);
            }}
            onDelete={deleteEmployee}
          />
        )}

        {tab === "FOLHA" && (
          <PayrollTable employees={employees} charges={charges} />
        )}

        {tab === "ENCARGOS" && (
          <ChargesSettings charges={charges} setCharges={setCharges} />
        )}
      </div>

      {open && (
        <EmployeeModal
          onClose={() => {
            setOpen(false);
            setEditingEmployee(null);
          }}
          onSave={saveEmployee}
          employee={editingEmployee}
        />
      )}
    </div>
  );
}