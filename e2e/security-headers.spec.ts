import { readFileSync } from "node:fs";
import { test, expect } from "./fixtures";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const headers = Object.fromEntries(config.headers[0].headers.map((header: { key: string; value: string }) => [header.key.toLowerCase(), header.value]));

test.beforeEach(async ({ context, baseURL }) => {
  // This applies the configured headers to local HTTP responses. It checks
  // browser compatibility, NOT Vercel's routing, edge headers or real GA.
  await context.route(`${baseURL}/**`, async (route) => {
    if (!route.request().isNavigationRequest()) return route.fallback();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...headers } });
  });
  await context.addInitScript(() => {
    const violations: string[] = [];
    Object.assign(window, { cspViolations: violations });
    document.addEventListener("securitypolicyviolation", (event) => violations.push(event.effectiveDirective));
  });
});

test("local HTTP CSP: app, CSSOM, variable, comparison and sharing fallback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true, value: { writeText: async () => { throw new Error("Use the local fallback"); } },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Tu estimación" })).toContainText("1047,73");
  // React's dynamic padding uses element.style properties, which CSP permits.
  const banner = page.getByRole("region", { name: "Analítica y privacidad" });
  await expect.poll(async () => {
    const height = await banner.evaluate((element) => element.getBoundingClientRect().height);
    const padding = await page.locator("footer").evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom));
    return Math.abs(padding - height - 32);
  }).toBeLessThan(1);
  await banner.getByRole("button", { name: "Rechazar", exact: true }).click();
  await page.getByRole("radio", { name: "Variable", exact: true }).check();
  await expect(page.getByRole("textbox", { name: "Euríbor", exact: true })).toHaveValue("2.75");
  await page.getByRole("button", { name: /Añadir a comparación/ }).click();
  await page.getByRole("button", { name: "Compartir Hipoteca 1", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Enlace de la hipoteca para compartir" })).toHaveValue(/\?sim=1%2Cv/);
  await page.getByRole("button", { name: "Preferencias de privacidad", exact: true }).click();
  await page.getByRole("button", { name: "Aceptar analíticas", exact: true }).click();
  await expect(page.locator('script[src*="/_vercel/speed-insights/script.js"]')).toHaveCount(1);
  await expect(page.locator("footer")).toHaveCSS("padding-bottom", "24px");
  expect(await page.evaluate(() => Reflect.get(window, "cspViolations"))).toEqual([]);
});

test("local HTTP CSP: static 404 retains its external CSS and home link", async ({ page }) => {
  await page.goto("/404.html");
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver a ComparaHipoteca" })).toHaveAttribute("href", "/");
  await expect(page.locator("main")).toHaveCSS("border-radius", "18px");
  expect(await page.evaluate(() => Reflect.get(window, "cspViolations"))).toEqual([]);
});

test("local HTTP CSP: injected inline JavaScript and style attributes are blocked", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.textContent = "window.untrustedInlineRan = true";
    document.head.appendChild(script);
    const probe = document.createElement("div");
    probe.setAttribute("style", "color: rgb(1, 2, 3)");
    probe.id = "untrusted-style";
    document.body.appendChild(probe);
  });
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "cspViolations"))).toEqual([
    "script-src-elem", "style-src-attr",
  ]);
  expect(await page.evaluate(() => Reflect.get(window, "untrustedInlineRan"))).toBeUndefined();
  await expect(page.locator("#untrusted-style")).not.toHaveCSS("color", "rgb(1, 2, 3)");
});
