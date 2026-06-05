'use client'

import { Eye, Smartphone, MessageCircle, Star, ExternalLink, Search } from 'lucide-react'
import { Card } from "@/components/proprietario/dashboard/dashboard-card";
import { motion } from "framer-motion";

export default function Painel() {
  return (

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
            >


    <div className="space-y-6">

     <div className="bg-gradient-to-r from-black via-zinc-900 to-zinc-800 shadow-lg text-white p-6 rounded-xl flex items-center justify-between">
  
            <div>
              <p className="text-xs text-gray-400">
                ÁREA DO PROPRIETÁRIO
              </p>
              <h1 className="text-2xl font-bold">
                Bem-vindo, Rodrigo!
              </h1>
              <p className="text-sm text-gray-400">
                Gerencie sua propriedade no Ventsy
              </p>
            </div>

            <div className="flex gap-2">
              <button className="border border-pink-500 text-pink-600 font-bold px-4 py-2 rounded-lg transition hover:bg-pink-500 hover:text-white">
                Ver propriedade
              </button>
              <button className="bg-white text-black px-4 py-2 rounded-lg">
                Explorar
              </button>
            </div>

            </div>

      {/* CARDS */}
      <div className="grid grid-cols-4 gap-4">
        <Card title="Visualizações (30d)" />
        <Card title="WhatsApp (30d)" />
        <Card title="Formulários" />
        <Card title="Avaliação" />
      </div>

      {/* GRÁFICO */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[320px]">
        Gráfico em breve
      </div>


    </div>
    </motion.div>
  );
}