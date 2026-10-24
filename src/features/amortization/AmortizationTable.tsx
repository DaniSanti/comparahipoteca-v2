import { useEffect, useMemo, useRef, useState } from "react";
import type { MortgageCalculation } from "../../domain/mortgage";
import { annualAmortization, monthlyAmortization, type AmortizationPeriod } from "../../domain/amortization";
import { amortizationCsv, amortizationHeaders, amortizationPdf, downloadAmortization, periodLabel } from "./exportAmortization";

import { AmortizationInfo } from "./AmortizationInfo";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export function AmortizationTable({ result, variable, mortgageNumber = 1, revealRequest = 0 }: {
  result: MortgageCalculation; variable: boolean; mortgageNumber?: number; revealRequest?: number;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!revealRequest || !detailsRef.current) return;
    detailsRef.current.open = true;
    detailsRef.current.querySelector("summary")?.focus({ preventScroll: true });
    detailsRef.current.scrollIntoView({ block: "start" });
  }, [revealRequest]);
  const [period, setPeriod] = useState<AmortizationPeriod>("annual");
  const [feedback, setFeedback] = useState("");
  const months = useMemo(() => monthlyAmortization(result), [result]);
  const rows = useMemo(() => period === "annual" ? annualAmortization(months) : months, [months, period]);
  const exportTable = (format: "csv" | "pdf") => {
    try {
      const blob = format === "csv"
        ? new Blob([amortizationCsv(rows, period)], { type: "text/csv;charset=utf-8" })
        : new Blob([new Uint8Array(amortizationPdf(rows, period, result, variable, mortgageNumber))], { type: "application/pdf" });
      downloadAmortization(blob, `hipoteca-${mortgageNumber}-amortizacion-${period === "annual" ? "anual" : "mensual"}.${format}`);
      setFeedback(`Descarga ${format.toUpperCase()} preparada: ${rows.length} ${period === "annual" ? "años" : "meses"}.`);
    } catch {
      setFeedback("No se pudo preparar la descarga. Inténtalo de nuevo.");
    }
  };

  return (
    <details ref={detailsRef} id="amortization-table" className="panel amortization-section">
      <summary>Tabla de amortización · Hipoteca {mortgageNumber} <span>Ver detalle anual o mensual</span></summary>
      {months.length === 0 ? <p>No hay capital financiado que amortizar.</p> : (
        <>
          <AmortizationInfo />
          <div className="amortization-toolbar">
            <fieldset>
              <legend>Ver amortización</legend>
              <div className="type-options">
                {(["annual", "monthly"] as const).map((value) => (
                  <label key={value} className={`type-option${period === value ? " selected" : ""}`}>
                    <input type="radio" name="amortization-period" checked={period === value}
                      onChange={() => { setPeriod(value); setFeedback(""); }} />
                    {value === "annual" ? "Anual" : "Mensual"}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="amortization-downloads">
              <button type="button" onClick={() => exportTable("pdf")}>Descargar PDF</button>
              <button type="button" onClick={() => exportTable("csv")}>Descargar CSV</button>
            </div>
          </div>
          {variable && <p className="variable-note">Proyección con el TIN actual constante durante todo el plazo; cambiará si varía el Euríbor.</p>}
          <p role="status" aria-atomic="true">{feedback}</p>
          <div className="amortization-scroll" role="region" aria-label="Tabla de amortización desplazable" tabIndex={0}>
            <table>
              <caption>Hipoteca {mortgageNumber} · Amortización {period === "annual" ? "anual" : "mensual"} · {rows.length} periodos</caption>
              <thead><tr>{amortizationHeaders(period).map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={`${row.year}-${row.month ?? 0}`}>
                  <th scope="row">{periodLabel(row)}</th>
                  {[row.payment, row.principal, row.interest, row.repaid, row.remaining].map((value, index) => <td key={index}>{money.format(Math.abs(value) < 0.005 ? 0 : value)}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </details>
  );
}
