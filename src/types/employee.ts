export type ContractType = "CLT" | "PJ" | "DIARIA";

export type EmployeeStatus = "ATIVO" | "FERIAS" | "INATIVO";

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  salary: number;
  contractType: ContractType;
  admissionDate: string;
  status: EmployeeStatus;
  phone?: string;
  notes?: string;
}