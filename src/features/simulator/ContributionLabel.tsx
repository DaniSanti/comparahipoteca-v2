import { useEffect, useRef, useState } from "react";

export function ContributionLabel() {
  const container = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  return (
    <div className="contribution-label" ref={container}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
      <label htmlFor="savings" className="sr-only">Aportación</label>
      <button type="button" className="contribution-help-trigger"
        aria-describedby="contribution-help" aria-expanded={open}
        aria-controls="contribution-help"
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}>
        Aportación
      </button>
      <div id="contribution-help" role="tooltip" hidden={!open}>
        Sobre el precio de compra, sin impuestos ni otros gastos.
      </div>
    </div>
  );
}
