"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X, type LucideIcon } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type ToastInput = { kind: ToastKind; title: string; description?: string };
type Toast = ToastInput & { id: number };
type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const toastPresentation: Record<ToastKind, { Icon: LucideIcon; duration: number }> = {
  success: { Icon: CheckCircle2, duration: 4500 },
  error: { Icon: AlertCircle, duration: 8000 },
  info: { Icon: Info, duration: 5500 },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const id = ++nextId.current;
    const toast = { ...input, id };
    setToasts((current) => [...current.slice(-3), toast]);
    timers.current.set(id, setTimeout(() => dismissToast(id), toastPresentation[input.kind].duration));
  }, [dismissToast]);

  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
  }, []);

  return <ToastContext.Provider value={{ showToast }}>
    {children}
    <div className="toast-region" aria-label="Notifications">
      {toasts.map(({ id, kind, title, description }) => {
        const { Icon } = toastPresentation[kind];
        return <article className={`toast toast-${kind}`} key={id} role={kind === "error" ? "alert" : "status"} aria-live={kind === "error" ? "assertive" : "polite"}>
          <Icon className="toast-icon" size={20} aria-hidden="true" />
          <div className="toast-copy"><strong>{title}</strong>{description && <p>{description}</p>}</div>
          <button type="button" className="toast-dismiss" aria-label="Dismiss notification" onClick={() => dismissToast(id)}><X size={17} /></button>
          <span className="toast-progress" aria-hidden="true" />
        </article>;
      })}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider.");
  return context.showToast;
}
