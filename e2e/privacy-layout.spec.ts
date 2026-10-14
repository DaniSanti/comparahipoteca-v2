import { test, expect } from "./fixtures";

for (const width of [320, 390, 1440]) {
  test(`privacidad compacta: ${width}px, información y controles accesibles`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const banner = page.getByRole("region", { name: "Analítica y privacidad" });
    const information = page.locator("#privacy-information");
    const more = banner.locator('button[aria-controls="privacy-information"]');
    await expect(information).toBeHidden();
    const bounds = await banner.boundingBox();
    expect(bounds!.height).toBeLessThanOrEqual(width < 760 ? 165 : 100);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const accept = banner.getByRole("button", { name: "Aceptar analíticas", exact: true });
    const reject = banner.getByRole("button", { name: "Rechazar", exact: true });
    const acceptBounds = (await accept.boundingBox())!;
    const rejectBounds = (await reject.boundingBox())!;
    expect(acceptBounds.height).toBeGreaterThanOrEqual(44);
    expect(rejectBounds.height).toEqual(acceptBounds.height);
    expect(rejectBounds.width).toEqual(acceptBounds.width);
    expect(rejectBounds.y).toEqual(acceptBounds.y);
    await more.focus();
    await page.keyboard.press("Enter");
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await expect(information).toBeVisible();
    await expect(information).toContainText("no enviamos los datos financieros");
    await expect.poll(async () => {
      const height = (await banner.boundingBox())!.height;
      const padding = await page.locator("footer").evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom));
      return Math.abs(padding - height - 32);
    }).toBeLessThan(1);
    await page.keyboard.press("Enter");
    await expect(information).toBeHidden();
    await page.keyboard.press("Tab");
    await expect(accept).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(reject).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(banner).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Precio de compra", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Preferencias de privacidad", exact: true }).click();
    await expect(banner).toBeVisible();
    await expect(information).toBeHidden();
    await expect(accept).toBeFocused();
  });
}

test("privacidad: texto ampliado y pantalla baja mantienen todos los controles alcanzables", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 320 });
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const banner = page.getByRole("region", { name: "Analítica y privacidad" });
  await banner.getByRole("button", { name: "Más información", exact: true }).click();
  const reject = banner.getByRole("button", { name: "Rechazar", exact: true });
  await reject.focus();
  await expect(reject).toBeInViewport();
  expect(await banner.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press("Enter");
  await expect(banner).toHaveCount(0);
});
