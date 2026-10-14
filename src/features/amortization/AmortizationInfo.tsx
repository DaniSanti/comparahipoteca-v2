import { useEffect, useRef, useState } from "react";

export function AmortizationInfo() {
  const container = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const visible = !dismissed && (hovered || focused || pinned);

  useEffect(() => {
    if (!visible) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) {
        setPinned(false);
        setDismissed(true);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [visible]);

  return (
    <div ref={container} className="amortization-info"
      onMouseEnter={() => { setHovered(true); setDismissed(false); }}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") { setPinned(false); setDismissed(true); }
      }}>
      <button type="button" className="privacy-link" aria-label="Información sobre la amortización"
        aria-describedby="amortization-help" aria-expanded={visible} aria-controls="amortization-help"
        onFocus={() => { setFocused(true); setDismissed(false); }}
        onBlur={() => { setFocused(false); setPinned(false); }}
        onClick={() => { setPinned(!pinned); setDismissed(pinned); }}>
        ⓘ Información
      </button>
      <div id="amortization-help" role="tooltip" hidden={!visible}>
        Años y meses desde el inicio de la hipoteca. Amortización: capital devuelto en el periodo.
        Capital amortizado: total devuelto hasta ese momento. Importes en euros, redondeados a dos decimales.
        Las descargas incluyen todos los periodos de la vista seleccionada.
        Sistema francés, sin comisiones ni amortizaciones anticipadas.
      </div>
    </div>
  );
}
