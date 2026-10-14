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
    expect(csv.suggestedFilename()).toBe("hipoteca-1-amortizacion-mensual.csv");
    const csvText = await readFile((await csv.path())!, "utf8");
    expect(csvText.trim().split("\r\n")).toHaveLength(301);
    expect(csvText).toContain("Año 25 / mes 12;");
    await details.getByRole("radio", { name: "Anual", exact: true }).check();
    const pdfEvent = page.waitForEvent("download");
    await details.getByRole("button", { name: "Descargar PDF" }).click();
    const pdf = await pdfEvent;
    expect(pdf.suggestedFilename()).toBe("hipoteca-1-amortizacion-anual.pdf");
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

for (const width of [390, 1440]) {
  test(`amortización de hipotecas comparadas y tooltip a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Rechazar", exact: true }).click();
    const details = page.locator(".amortization-section");
    const summary = details.locator("summary");
    await expect(summary).toContainText("Hipoteca 1");
    await page.getByRole("button", { name: "Añadir a comparación" }).click();
    await page.getByRole("spinbutton", { name: "Plazo", exact: true }).fill("10");
    await page.getByRole("radio", { name: "Variable", exact: true }).check();
    await page.getByRole("textbox", { name: "Euríbor", exact: true }).fill("2");
    await page.getByRole("button", { name: "Añadir a comparación" }).click();
    await summary.click();
    // Default is the first saved comparison, not the edited form.
    await expect(details.locator("tbody tr")).toHaveCount(25);
    const info = details.getByRole("button", { name: "Información sobre la amortización" });
    const tooltip = details.getByRole("tooltip");
    await expect(tooltip).toBeHidden();
    await info.focus();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText("Sistema francés");
    await page.keyboard.press("Escape");
    await expect(tooltip).toBeHidden();
    await page.keyboard.press("Tab");
    await info.click();
    await expect(tooltip).toBeVisible();
    expect(await tooltip.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth;
    })).toBe(true);
    await page.getByRole("heading", { name: "Tus simulaciones", exact: true }).click();
    await expect(tooltip).toBeHidden();
    await info.hover();
    await expect(tooltip).toBeVisible();
    await summary.hover();
    await expect(tooltip).toBeHidden();
    await summary.click();
    await page.getByRole("button", { name: "Amortización Hipoteca 2", exact: true }).click();
    await expect(summary).toBeFocused();
    await expect(details.getByRole("table")).toBeVisible();
    await expect(summary).toContainText("Hipoteca 2");
    await expect(details.locator("tbody tr")).toHaveCount(10);
    await expect(details).toContainText("TIN actual constante");
    const comparison = page.locator(".comparison-section");
    expect((await details.boundingBox())!.y).toBeGreaterThan((await comparison.boundingBox())!.y + (await comparison.boundingBox())!.height);
    await page.getByRole("spinbutton", { name: "Plazo", exact: true }).fill("2");
    await page.getByRole("textbox", { name: "Euríbor", exact: true }).fill("");
    await expect(details.locator("tbody tr")).toHaveCount(10);
    await details.getByRole("radio", { name: "Mensual", exact: true }).check();
    await expect(details.locator("tbody tr")).toHaveCount(120);
    const pdfEvent = page.waitForEvent("download");
    await details.getByRole("button", { name: "Descargar PDF" }).click();
    const pdf = await pdfEvent;
    expect(pdf.suggestedFilename()).toBe("hipoteca-2-amortizacion-mensual.pdf");
    const pdfText = (await readFile((await pdf.path())!)).toString("latin1");
    expect(pdfText).toContain("Hipoteca 2 · Amortización mensual");
    expect(pdfText).toContain("Plazo: 10 años");
    await page.getByRole("button", { name: "Eliminar Hipoteca 1", exact: true }).click();
    await expect(summary).toContainText("Hipoteca 1");
    await expect(details.locator("tbody tr")).toHaveCount(120);
    await page.getByRole("button", { name: "Eliminar Hipoteca 1", exact: true }).click();
    await expect(details).toHaveCount(0);
    await page.getByRole("textbox", { name: "Euríbor", exact: true }).fill("2");
    await summary.click();
    await expect(details.locator("tbody tr")).toHaveCount(2);
  });
}
