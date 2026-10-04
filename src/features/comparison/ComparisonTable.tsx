import type { MortgageSnapshot } from "./comparisonState";

const money = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 });

interface ComparisonTableProps {
  simulations: readonly MortgageSnapshot[];
  onRemove: (id: string) => void;
  onShare: (simulation: MortgageSnapshot) => void;
}

export function ComparisonTable({
  simulations,
  onRemove,
  onShare,
}: ComparisonTableProps) {
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
      className: "secondary-row",
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
        <span>{simulations.length} de 5</span>
      </div>
      <p className="comparison-help">
        Compara las cifras sin salir de esta página. No se guardan al cerrar la
        sesión.
      </p>
      <div
        className="comparison-scroll"
        tabIndex={0}
        aria-label="Tabla comparativa de hipotecas"
      >
        <table>
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
            <tr className="actions-row">
              <th scope="row">Acciones</th>
              {simulations.map((item, index) => (
                <td key={item.id}>
                  <button
                    type="button"
                    className="table-button"
                    onClick={() => onShare(item)}
                  >
                    Compartir
                  </button>
                  <button
                    type="button"
                    className="table-button remove"
                    onClick={() => onRemove(item.id)}
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
