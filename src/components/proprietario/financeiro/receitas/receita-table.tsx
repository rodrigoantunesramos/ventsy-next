import { Table, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const data = [
  {
    data: "10/03",
    descricao: "Casamento Ana & João",
    categoria: "Aluguel de espaço",
    evento: "Casamento",
    status: "pago",
    valor: 12000,
  },
  {
    data: "12/03",
    descricao: "Evento Corporativo XP",
    categoria: "Buffet",
    evento: "Corporativo",
    status: "pendente",
    valor: 8000,
  },
  {
    data: "15/03",
    descricao: "Aniversário 50 anos",
    categoria: "Decoração",
    evento: "Aniversário",
    status: "pago",
    valor: 3500,
  },
];

export function ReceitaTable({ data }: any) {
  return (
    <Table>
      <TableHead>
        <tr>
          <TableCell>Data</TableCell>
          <TableCell>Descrição</TableCell>
          <TableCell>Categoria</TableCell>
          <TableCell>Evento</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Valor</TableCell>
        </tr>
      </TableHead>

      <tbody>
        {data.map((r, i) => (
          <TableRow key={i}>
            <TableCell>{r.data}</TableCell>
            <TableCell>{r.descricao}</TableCell>
            <TableCell>{r.categoria}</TableCell>
            <TableCell>{r.evento}</TableCell>
            <TableCell>
              <Badge status={r.status} />
            </TableCell>
            <TableCell>
              <span className="text-green-600 font-semibold">
                R$ {r.valor.toLocaleString()}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </tbody>
    </Table>
  );
}