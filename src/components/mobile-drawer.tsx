"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

export function MobileDrawer({
  id,
  label,
  triggerLabel,
  className,
  children,
}: {
  id: string;
  label: string;
  triggerLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    const previousOverflow = document.body.style.overflow;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }

    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
      if (dialog.open) dialog.close();
    };
  }, [open]);

  function close() {
    if (closeTimerRef.current !== null) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setClosing(false);
      setOpen(false);
    }, 200);
  }

  return (
    <>
      <button
        className="mobile-drawer-trigger"
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(true)}
      >
        <Menu size={22} aria-hidden="true" />
      </button>
      <dialog
        className={`mobile-drawer ${className ?? ""} ${closing ? "is-closing" : ""}`}
        id={id}
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        onClose={() => {
          setOpen(false);
          setClosing(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            close();
          } else if (event.target instanceof Element && event.target.closest("a")) {
            close();
          }
        }}
      >
        <div className="mobile-drawer-heading">
          <h2 id={`${id}-title`}>{label}</h2>
          <button className="mobile-drawer-close" type="button" onClick={close} aria-label="Close navigation menu">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
      </dialog>
    </>
  );
}
