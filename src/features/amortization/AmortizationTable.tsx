import { useMemo, useState } from "react";
import type { MortgageCalculation } from "../../domain/mortgage";
import { annualAmortization, monthlyAmortization, type AmortizationPeriod } from "../../domain/amortization";
import { amortizationCsv, amortizationHeaders, amortizationPdf, downloadAmortization, periodLabel } from "./exportAmortization";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export function AmortizationTable({ result, variable }: { result: MortgageCalculation; variable: boolean }) {
  const [period, setPeriod] = useState<AmortizationPeriod>("annual");
  const [feedback, setFeedback] = useState("");
  const months = useMemo(() => monthlyAmortization(result), [result]);
  const rows = useMemo(() => period === "annual" ? annualAmortization(months) : months, [months, period]);
  const exportTable = (format: "csv" | "pdf") => {
    try {
      const blob = format === "csv"
        ? new Blob([amortizationCsv(rows, period)], { type: "text/csv;charset=utf-8" })
        : new Blob([amortizationPdf(rows, period, result, variable)], { type: "application/pdf" });
      downloadAmortization(blob, `amortizacion-${period === "annual" ? "anual" : "mensual"}.${format}`);
      setFeedback(`Descarga ${format.toUpperCase()} preparada: ${rows.length} ${period === "annual" ? "años" : "meses"}.`);
    } catch {
      setFeedback("No se pudo preparar la descarga. Inténtalo de nuevo.");
    }
  };

  return (
    <details className="panel amortization-section">
      <summary>Tabla de amortización <span>Ver detalle anual o mensual</span></summary>
      {months.length === 0 ? <p>No hay capital financiado que amortizar.</p> : (
        <>
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
          <p id="amortization-help" className="comparison-help">
            Años y meses desde el inicio de la hipoteca. Amortización: capital devuelto en el periodo.
            Capital amortizado: total devuelto hasta ese momento. Importes en euros, redondeados a dos decimales.
            Las descargas incluyen todos los periodos de la vista seleccionada.
          </p>
          {variable && <p className="variable-note">Proyección con el TIN actual constante durante todo el plazo; cambiará si varía el Euríbor.</p>}
          <p className="form-note">Sistema francés, sin comisiones ni amortizaciones anticipadas.</p>
          <p role="status" aria-atomic="true">{feedback}</p>
          <div className="amortization-scroll" role="region" aria-label="Tabla de amortización desplazable" tabIndex={0} aria-describedby="amortization-help">
            <table>
              <caption>Amortización {period === "annual" ? "anual" : "mensual"} · {rows.length} periodos</caption>
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
