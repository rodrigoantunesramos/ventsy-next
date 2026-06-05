'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, Home, Camera, Calendar, DollarSign, 
  Users, FileText, FileStack, UsersRound, BookOpen, 
  Gift, Settings, CreditCard, UserCircle
} from 'lucide-react'
import Sidebar from "@/components/proprietario/sidebar/sidebar";
import Header from "@/components/proprietario/header/header";
import { AnimatePresence, motion } from "framer-motion";
import { AppProvider } from "@/context/app-context";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AppProvider>
    <div className="min-h-screen flex flex-col bg-gray-100">
      <Header />

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1  p-6">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
    </AppProvider>
  );
}