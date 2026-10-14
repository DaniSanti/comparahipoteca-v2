import { test, expect } from "./fixtures";
import { readFile } from "node:fs/promises";

for (const width of [390, 1440]) {
  test(`amortización: expandir, cambiar vista y descargar a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Rechazar", exact: true }).click();
    const details = page.locator(".amortization-section");
    const summary = details.locator("summary");
    await expect(details.getByRole("table")).toBeHidden();
    await summary.focus();
    await page.keyboard.press("Enter");
    const table = details.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table.locator("tbody tr")).toHaveCount(25);
    await expect(table.getByRole("columnheader", { name: "Cuota anual" })).toBeVisible();
    await details.getByRole("radio", { name: "Mensual", exact: true }).check();
    await expect(table.locator("tbody tr")).toHaveCount(300);
    await expect(table.getByRole("columnheader", { name: "Cuota mensual" })).toBeVisible();
    const csvEvent = page.waitForEvent("download");
    await details.getByRole("button", { name: "Descargar CSV" }).click();
    const csv = await csvEvent;
    expect(csv.suggestedFilename()).toBe("amortizacion-mensual.csv");
    const csvText = await readFile((await csv.path())!, "utf8");
    expect(csvText.trim().split("\r\n")).toHaveLength(301);
    expect(csvText).toContain("Año 25 / mes 12;");
    await details.getByRole("radio", { name: "Anual", exact: true }).check();
    const pdfEvent = page.waitForEvent("download");
    await details.getByRole("button", { name: "Descargar PDF" }).click();
    const pdf = await pdfEvent;
    expect(pdf.suggestedFilename()).toBe("amortizacion-anual.pdf");
    expect((await readFile((await pdf.path())!)).toString("latin1")).toContain("%PDF-1.4");
    await page.getByRole("spinbutton", { name: "Plazo", exact: true }).fill("1");
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await page.getByRole("textbox", { name: "TIN fijo anual", exact: true }).fill("");
    await expect(details).toHaveCount(0);
    await page.getByRole("textbox", { name: "TIN fijo anual", exact: true }).fill("0");
    await summary.click();
    await expect(table).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await summary.click();
    await expect(table).toBeHidden();
  });
}

test("amortización: hipoteca variable y compra sin financiación", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Rechazar", exact: true }).click();
  await page.getByRole("radio", { name: "Variable", exact: true }).check();
  const details = page.locator(".amortization-section");
  await details.locator("summary").click();
  await expect(details).toContainText("TIN actual constante durante todo el plazo");
  await page.getByRole("textbox", { name: "Ahorro o aportación", exact: true }).fill("300000");
  await expect(details).toContainText("No hay capital financiado que amortizar");
  await expect(details.getByRole("button", { name: "Descargar CSV" })).toHaveCount(0);
});
