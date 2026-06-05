import { z } from "zod";

export const employeeSchema = z.object({
  name: z.string().min(3, "Nome obrigatório"),
  role: z.string().min(2, "Cargo obrigatório"),
  department: z.string(),
  salary: z.number().min(1, "Salário inválido"),
  contractType: z.string(),
  admissionDate: z.string(),
  status: z.string(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export type EmployeeFormData = z.infer<typeof employeeSchema>;