import { test as base, expect } from "@playwright/test";

type NetworkGuard = { euriborRequests: string[] };

export const test = base.extend<{ networkGuard: NetworkGuard }>({
  networkGuard: [async ({ context, baseURL }, use) => {
    const externalRequests: string[] = [];
    const euriborRequests: string[] = [];
    const origin = new URL(baseURL!).origin;

    // Install before navigation, covering popups, fetch, scripts and beacons.
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === "https://app.bde.es" && url.pathname.startsWith("/bierest/")) {
        euriborRequests.push(url.href);
        await route.fulfill({
          json: [{
            serie: "D_1NBAF472",
            descripcionCorta: "Euríbor a un año",
            codFrecuencia: "M",
            fechaValor: "2026-09-30T00:00:00Z",
            valor: "2,75",
          }],
        });
      } else if (url.origin === origin && url.pathname.startsWith("/_vercel/")) {
        // Speed Insights may mount after consent, but never reaches Vercel.
        await route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
      } else if (url.origin === origin) {
        await route.continue();
      } else {
        // In particular, real GA/gtag/collect attempts abort AND fail the test.
        externalRequests.push(url.href);
        await route.abort("blockedbyclient");
      }
    });

    await use({ euriborRequests });
    // Stop pending page activity before checking the entire journey's traffic.
    await Promise.all(context.pages().map((page) => page.close()));
    expect(externalRequests, "Unexpected external traffic (including GA)").toEqual([]);
  }, { auto: true }],
});

export { expect };
