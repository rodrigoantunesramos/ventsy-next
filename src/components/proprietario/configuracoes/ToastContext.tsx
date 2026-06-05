"use client";
import { createContext, useContext, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ToastContext = createContext<any>(null);

let idCounter = 0;

export function ToastProvider({ children }: any) {
  const [toasts, setToasts] = useState<any[]>([]);

  const showToast = ({ message, type = "success", duration = 3000 }: any) => {
    const id = idCounter++;

    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div className="fixed bottom-5 right-5 flex flex-col gap-3 z-50">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className={`px-5 py-3 rounded-xl shadow-xl text-white ${
                toast.type === "error"
                  ? "bg-red-600/90"
                  : toast.type === "warning"
                  ? "bg-yellow-500/90"
                  : "bg-emerald-600/90"
              }`}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}