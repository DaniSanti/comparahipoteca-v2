import { test, expect } from "./fixtures";

for (const width of [1280, 375]) {
  test(`aportación sincronizada y compacta a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const price = page.getByLabel("Precio de compra", { exact: true });
    const euros = page.getByLabel("Aportación", { exact: true });
    const percent = page.getByLabel("% de aportación", { exact: true });
    await price.fill("300000");
    await expect(percent).toHaveValue("20");
    await percent.fill("25");
    await expect(euros).toHaveValue("75000");
    await price.fill("240000");
    await expect(euros).toHaveValue("75000");
    await expect(percent).toHaveValue("31");
    await percent.focus();
    await percent.blur();
    await expect(euros).toHaveValue("75000");
    await euros.fill("60000");
    await expect(percent).toHaveValue("25");
    for (const value of ["0", "100"]) {
      await percent.fill(value);
      await expect(euros).toHaveValue(value === "0" ? "0" : "240000");
    }
    await price.fill("");
    await expect(percent).toBeDisabled();
    await price.fill("300000");
    await euros.fill("300001");
    await euros.blur();
    await expect(page.locator("#savings-error")).toBeVisible();
    const amountBox = await euros.boundingBox();
    const percentBox = await percent.boundingBox();
    expect(Math.abs(amountBox!.y - percentBox!.y)).toBeLessThan(1);
    expect(Math.abs(amountBox!.x + amountBox!.width - percentBox!.x)).toBeLessThan(1);
    expect(percentBox!.width).toBeLessThanOrEqual(90);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
