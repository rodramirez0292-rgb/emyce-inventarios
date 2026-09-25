import { test, expect } from "@playwright/test";
test("PWA de producción vuelve a abrir la demo sin conexión", async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.PLAYWRIGHT_BASE_URL,
    "El service worker se activa en producción.",
  );
  await page.goto("/login");
  await page.getByRole("button", { name: /Probar con datos/ }).click();
  await expect(
    page.getByRole("heading", { name: "Hola, Usuario." }),
  ).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hola, Usuario." }),
  ).toBeVisible();
  await expect(page.getByText("Sin conexión", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Productos", exact: true }).click();
  await expect(page.locator(".product-row")).toHaveCount(8);
  await context.setOffline(false);
});
