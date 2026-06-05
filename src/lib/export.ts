import * as XLSX from 'xlsx'

export function exportAnalytics(data: any[]) {
  const sheet = XLSX.utils.json_to_sheet(data)
  const book = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(book, sheet, 'Relatório')

  XLSX.writeFile(book, 'relatorio.xlsx')
}