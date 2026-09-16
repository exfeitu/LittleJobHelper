"use client";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function TimelinePopover({ label, children, trigger, className = "" }: {
  label: string; children: ReactNode; trigger: ReactNode; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 300 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const rect = buttonRef.current!.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const height = Math.min(280, window.innerHeight - 24);
    setPosition({ width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - height - 12)) });
    panelRef.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
    };
    const dismiss = () => setOpen(false);
    const onScroll = (event: Event) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition(previous => ({ ...previous, left: Math.max(12, Math.min(rect.left, window.innerWidth - previous.width - 12)),
        top: Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - Math.min(280, window.innerHeight - 24) - 12)) }));
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", dismiss);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", dismiss);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);
  return <>
    <button type="button" ref={buttonRef} className={className} aria-label={label} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>{trigger}</button>
    {open && createPortal(<div ref={panelRef} role="dialog" aria-label={label} tabIndex={-1} className="at-popover" style={position}>
      <header><strong>{label}</strong><button type="button" aria-label="关闭列表" onClick={() => { setOpen(false); buttonRef.current?.focus(); }}>×</button></header>
      <div onClick={event => { if ((event.target as HTMLElement).closest("button")) setOpen(false); }}>{children}</div>
    </div>, document.body)}
  </>;
}
