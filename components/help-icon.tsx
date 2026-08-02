"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type HelpIconProps = {
  /** Array of help text lines, each rendered as a <p> */
  tips: string[];
};

export function HelpIcon({ tips }: HelpIconProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const openPopover = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, left: rect.left });
    }
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!wrapRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleScroll = () => setOpen(false);
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="header-dropdown-wrap" style={{ marginBottom: "4px" }}>
      <button
        ref={btnRef}
        className="timeline-help-trigger"
        type="button"
        onClick={openPopover}
        title="使用帮助"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="使用帮助"
      >
        ⓘ
      </button>
      {open && (
        <div
          className="timeline-help-popover"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
          }}
          role="dialog"
          aria-label="使用帮助"
        >
          {tips.map((tip, i) => (
            <p key={i}>{tip}</p>
          ))}
        </div>
      )}
    </div>
  );
}
