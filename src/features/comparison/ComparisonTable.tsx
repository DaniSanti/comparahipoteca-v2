import { useRef } from "react";
import { MAX_COMPARISONS, type MortgageSnapshot } from "./comparisonState";

const money = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 });

interface ComparisonTableProps {
  simulations: readonly MortgageSnapshot[];
  onRemove: (id: string) => void;
  onShare: (simulation: MortgageSnapshot, number: number) => void;
  sharingId: string | null;
}

export function ComparisonTable({
  simulations,
  onRemove,
  onShare,
  sharingId,
}: ComparisonTableProps) {
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());

  const remove = (item: MortgageSnapshot, index: number) => {
    const next = simulations[index + 1] ?? simulations[index - 1];
    onRemove(item.id);
    if (next) removeButtons.current.get(next.id)?.focus({ preventScroll: true });
  };

  if (simulations.length === 0) return null;

  const rows = [
    {
      label: "Cuota mensual",
      className: "payment-row",
      value: (item: MortgageSnapshot) => money.format(item.monthlyPayment),
    },
    {
      label: "Tipo",
      value: (item: MortgageSnapshot) =>
        item.type === "fixed" ? "Fija" : "Variable",
    },
    {
      label: "TIN aplicado",
      value: (item: MortgageSnapshot) =>
        `${percent.format(item.appliedTin)} %`,
    },
    {
      label: "Importe financiado",
      value: (item: MortgageSnapshot) => money.format(item.financedAmount),
    },
    { label: "Plazo", value: (item: MortgageSnapshot) => `${item.termYears} años` },
    {
      label: "Intereses totales",
      value: (item: MortgageSnapshot) => money.format(item.totalInterest),
    },
    {
      label: "Coste total",
      value: (item: MortgageSnapshot) => money.format(item.totalCost),
    },
    {
      label: "Precio",
      className: "secondary-row secondary-start",
      value: (item: MortgageSnapshot) => money.format(item.purchasePrice),
    },
    {
      label: "Ahorro",
      className: "secondary-row",
      value: (item: MortgageSnapshot) => money.format(item.savings),
    },
    {
      label: "Gastos de compra",
      className: "secondary-row",
      value: (item: MortgageSnapshot) => money.format(item.purchaseCosts),
    },
    {
      label: "Condiciones",
      className: "secondary-row",
      value: (item: MortgageSnapshot) =>
        item.type === "fixed"
          ? `${percent.format(item.fixedTin ?? 0)} % fijo`
          : `Euríbor ${percent.format(item.euribor ?? 0)} % + ${percent.format(item.differential ?? 0)} %`,
    },
  ];

  return (
    <section className="comparison-section" aria-labelledby="comparison-title">
      <div className="comparison-heading">
        <div>
          <p className="eyebrow">Comparación local</p>
          <h2 id="comparison-title">Tus simulaciones</h2>
        </div>
        <span>{simulations.length} de {MAX_COMPARISONS}</span>
      </div>
      <p className="comparison-help">
        Estimaciones orientativas. No se guardan al cerrar la sesión.
      </p>
      <p className="scroll-hint" id="comparison-scroll-hint">
        Desliza horizontalmente para comparar.
      </p>
      <div
        className="comparison-scroll"
        tabIndex={0}
        role="region"
        aria-labelledby="comparison-caption"
        aria-describedby="comparison-scroll-hint"
      >
        <table>
          <caption id="comparison-caption">
            Comparación de {simulations.length} {simulations.length === 1 ? "hipoteca" : "hipotecas"}
          </caption>
          <thead>
            <tr>
              <th scope="col">Dato</th>
              {simulations.map((item, index) => (
                <th scope="col" key={item.id}>
                  Hipoteca {index + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className={row.className} key={row.label}>
                <th scope="row">{row.label}</th>
                {simulations.map((item) => (
                  <td key={item.id}>{row.value(item)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tbody>
            <tr className="actions-row">
              <th scope="row">Acciones</th>
              {simulations.map((item, index) => (
                <td key={item.id}>
                  <button
                    type="button"
                    className="table-button"
                    onClick={() => onShare(item, index + 1)}
                    aria-label={`Compartir Hipoteca ${index + 1}`}
                    aria-busy={sharingId === item.id}
                    aria-disabled={sharingId !== null || undefined}
                  >
                    {sharingId === item.id ? "Compartiendo…" : "Compartir"}
                  </button>
                  <button
                    type="button"
                    className="table-button remove"
                    ref={(button) => {
                      if (button) removeButtons.current.set(item.id, button);
                      else removeButtons.current.delete(item.id);
                    }}
                    onClick={() => remove(item, index)}
                    aria-label={`Eliminar Hipoteca ${index + 1}`}
                  >
                    Eliminar
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
