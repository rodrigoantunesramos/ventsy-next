import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Uma fonte padrão bonita
import "./globals.css"; // Importa o CSS global do Tailwind

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ventsy - Gestão de Eventos e Propriedades",
  description: "A plataforma completa para proprietários e clientes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-br">
      <body className={inter.className}>
        {children} 
      </body>
    </html>
  );
}