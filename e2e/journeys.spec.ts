import type { Locator } from "@playwright/test";
import { test, expect } from "./fixtures";

const consentKey = "comparahipoteca:analytics-consent:v1";

async function expectVisibleFocus(control: Locator) {
  await expect(control).toBeFocused();
  await expect(control).toBeInViewport();
  const focus = await control.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      visible: element.matches(":focus-visible"),
      outline: style.outlineStyle,
      width: parseFloat(style.outlineWidth),
    };
  });
  expect(focus.visible).toBe(true);
  expect(focus.outline).not.toBe("none");
  expect(focus.width).toBeGreaterThan(0);
}

test("hipoteca fija: cálculo automático y TIN con coma", async ({ page }) => {
  await page.goto("/");
  const results = page.getByRole("region", { name: "Tu estimación" });
  await expect(results).toContainText("1047,73");
  await page.getByRole("textbox", { name: "Precio de compra", exact: true }).fill("300000");
  await expect(results).toContainText("1315,75");
  // Change the rate first so 3,25 must cause a fresh result (it is the default).
  const tin = page.getByRole("textbox", { name: "TIN fijo anual", exact: true });
  await tin.fill("2.75");
  await expect(results).toContainText("1245,54");
  await tin.fill("3,25");
  await expect(results).toContainText("1315,75");
  await expect(results).toContainText("TIN aplicado: 3,25 %");
  await expect(tin).toHaveAttribute("aria-invalid", "false");
  await expect(page.getByRole("button", { name: "Calcular hipoteca" })).toHaveCount(0);
});

test("hipoteca variable: Euríbor oficial simulado y diferencial con coma", async ({ page, networkGuard }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Variable", exact: true }).check();
  await expect(page.getByRole("status").filter({ hasText: "Euríbor oficial del Banco de España" }))
    .toContainText("2,75 % · septiembre de 2026");
  await expect(page.getByRole("textbox", { name: "Euríbor", exact: true })).toHaveValue("2.75");
  const results = page.getByRole("region", { name: "Tu estimación" });
  await expect(results).toContainText("1076,34");
  await page.getByRole("textbox", { name: "Diferencial", exact: true }).fill("1,25");
  await expect(results).toContainText("TIN: Euríbor + diferencial: 4 %");
  await expect(results).toContainText("1134,85");
  expect(networkGuard.euriborRequests).toHaveLength(1);
  expect(networkGuard.euriborRequests[0]).toContain("series=D_1NBAF472");
});

test("comparación: dos escenarios independientes y eliminación", async ({ page }) => {
  await page.goto("/");
  const add = page.getByRole("button", { name: /Añadir a comparación/ });
  await add.click();
  await page.getByRole("textbox", { name: "TIN fijo anual", exact: true }).fill("2,5");
  await expect(page.getByRole("region", { name: "Tu estimación" })).toContainText("964,53");
  await add.click();
  const table = page.getByRole("table", { name: "Comparación de 2 hipotecas" });
  await expect(table.getByRole("columnheader", { name: /^Hipoteca/ })).toHaveCount(2);
  const payments = table.getByRole("row", { name: /^Cuota mensual/ });
  await expect(payments.getByRole("cell")).toHaveText([/1047,73/, /964,53/]);
  await page.getByRole("button", { name: "Eliminar Hipoteca 1", exact: true }).click();
  const remaining = page.getByRole("table", { name: "Comparación de 1 hipoteca", exact: true });
  await expect(remaining.getByRole("columnheader", { name: /^Hipoteca/ })).toHaveCount(1);
  await expect(remaining.getByRole("row", { name: /^Cuota mensual/ })).toContainText("964,53");
});

test("sharing: una URL válida restaura campos y resultado", async ({ page }) => {
  // A literal v1 URL checks the public format independently of the serializer.
  await page.goto("/?sim=1,f,180000,50000,20,2.5");
  await expect(page.getByRole("status").filter({ hasText: "Simulación cargada" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Precio de compra", exact: true })).toHaveValue("180000");
  await expect(page.getByRole("textbox", { name: "Ahorro o aportación", exact: true })).toHaveValue("50000");
  await expect(page.getByRole("spinbutton", { name: "Plazo", exact: true })).toHaveValue("20");
  await expect(page.getByRole("radio", { name: "Fija", exact: true })).toBeChecked();
  await expect(page.getByRole("textbox", { name: "TIN fijo anual", exact: true })).toHaveValue("2.5");
  await expect(page.getByRole("region", { name: "Tu estimación" })).toContainText("784,26");
});

test("privacidad: rechazo persistente, preferencias y aceptación sin GA", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Analítica y privacidad" });
  await expect(banner).toBeVisible();
  await expect(page.locator('script[src*="googletagmanager"], script[src*="google-analytics"]')).toHaveCount(0);
  await banner.getByRole("button", { name: "Rechazar", exact: true }).click();
  await expect(banner).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), consentKey)).toBe("rejected");
  await page.reload();
  await expect(banner).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Analítica rechazada." })).toBeVisible();
  await page.getByRole("button", { name: "Preferencias de privacidad", exact: true }).click();
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Aceptar analíticas", exact: true }).click();
  await expect(banner).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), consentKey)).toBe("accepted");
  // Wait for the consent-controlled metrics component to mount. Its local script
  // is fulfilled by the fixture; no Speed Insights data reaches a real endpoint.
  await expect(page.locator('script[src*="/_vercel/speed-insights/script.js"]')).toHaveCount(1);
  await expect(page.locator('script[src*="googletagmanager"], script[src*="google-analytics"]')).toHaveCount(0);
  await page.reload();
  await expect(banner).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Analítica aceptada." })).toBeVisible();
  await expect(page.locator('script[src*="/_vercel/speed-insights/script.js"]')).toHaveCount(1);
  await expect(page.locator('script[src*="googletagmanager"], script[src*="google-analytics"]')).toHaveCount(0);
});

test("accesibilidad: teclado, labels y foco visible en controles principales", async ({ page }) => {
  await page.goto("/");
  const price = page.getByRole("textbox", { name: "Precio de compra", exact: true });
  await page.keyboard.press("Tab");
  await expectVisibleFocus(price);
  await page.keyboard.press("Tab");
  await expectVisibleFocus(page.getByRole("textbox", { name: "Ahorro o aportación", exact: true }));
  await page.keyboard.press("Tab");
  await expectVisibleFocus(page.getByRole("spinbutton", { name: "Plazo", exact: true }));
  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio", { name: "Fija", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Variable", exact: true })).toBeChecked();
  await expect(page.getByRole("textbox", { name: "Euríbor", exact: true })).toHaveValue("2.75");
  await page.keyboard.press("Tab");
  await expectVisibleFocus(page.getByRole("textbox", { name: "Euríbor", exact: true }));
  await page.keyboard.press("Tab");
  await expectVisibleFocus(page.getByRole("textbox", { name: "Diferencial", exact: true }));
  await page.keyboard.press("Tab");
  await expectVisibleFocus(page.getByRole("button", { name: /Añadir a comparación/ }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("table", { name: "Comparación de 1 hipoteca", exact: true })).toBeVisible();
});
