import type { AmortizationPeriod, AmortizationRow } from "../../domain/amortization";
import type { MortgageCalculation } from "../../domain/mortgage";

export const amortizationHeaders = (period: AmortizationPeriod) => [
  period === "annual" ? "Año" : "Año / mes",
  period === "annual" ? "Cuota anual" : "Cuota mensual",
  "Amortización", "Intereses", "Capital amortizado", "Capital pendiente",
];
export const periodLabel = (row: AmortizationRow) =>
  row.month === undefined ? `Año ${row.year}` : `Año ${row.year} / mes ${row.month}`;
const amounts = (row: AmortizationRow) =>
  [row.payment, row.principal, row.interest, row.repaid, row.remaining];
const decimal = (value: number) => (Math.abs(value) < 0.005 ? 0 : value).toFixed(2).replace(".", ",");

export function amortizationCsv(rows: readonly AmortizationRow[], period: AmortizationPeriod): string {
  return "\uFEFF" + [
    amortizationHeaders(period).join(";"),
    ...rows.map((row) => [periodLabel(row), ...amounts(row).map(decimal)].join(";")),
  ].join("\r\n") + "\r\n";
}

// Small text-only PDF, generated locally without external services or dependencies.
// WinAnsi covers Spanish labels; each JS character below is encoded as one byte.
export function amortizationPdf(
  rows: readonly AmortizationRow[], period: AmortizationPeriod,
  result: MortgageCalculation, variable: boolean,
): Uint8Array {
  const pageSize = 26;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Count ${pageCount} /Kids [${Array.from({ length: pageCount }, (_, i) => `${4 + i * 2} 0 R`).join(" ")}] >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  const escape = (value: string) => value.replace(/([\\()])/g, "\\$1");
  const text = (value: string, x: number, y: number, size = 9) =>
    `BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escape(value)}) Tj ET\n`;
  const currency = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  for (let page = 0; page < pageCount; page++) {
    let stream = text(`ComparaHipoteca · Amortización ${period === "annual" ? "anual" : "mensual"}`, 30, 558, 16);
    stream += text(`Capital: ${currency.format(result.financedAmount)} EUR · TIN: ${decimal(result.annualInterestRate)} % · Plazo: ${result.numberOfPayments / 12} años`, 30, 536);
    stream += text(variable ? "Hipoteca variable: proyección con el TIN actual constante; cambiará si varía el Euríbor." : "Sistema francés. Estimación orientativa, sin comisiones ni amortizaciones anticipadas.", 30, 519);
    stream += text("Importes en EUR. Amortización: capital del periodo. Capital amortizado: acumulado. Años desde el inicio.", 30, 504);
    const positions = [30, 172, 304, 428, 548, 680];
    amortizationHeaders(period).forEach((header, column) => { stream += text(header, positions[column], 480); });
    rows.slice(page * pageSize, (page + 1) * pageSize).forEach((row, index) => {
      [periodLabel(row), ...amounts(row).map((value) => currency.format(Math.abs(value) < 0.005 ? 0 : value))]
        .forEach((value, column) => { stream += text(value, positions[column], 461 - index * 16); });
    });
    stream += text(`Página ${page + 1} de ${pageCount}`, 730, 24);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + page * 2} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  }
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(pdf, (character) => character.charCodeAt(0));
}

export function downloadAmortization(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before releasing the URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
