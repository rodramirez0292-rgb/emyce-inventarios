import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

test("foto dentro de la app conserva la serie y recupera el borrador tras recargar", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640; canvas.height = 480;
      const draw = () => { const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#287a69"; ctx.fillRect(0, 0, 640, 480); };
      draw();
      const stream = canvas.captureStream(10);
      Object.assign(window, { __cameraStream: stream });
      const timer = setInterval(draw, 100);
      setTimeout(() => clearInterval(timer), 30000);
      return stream;
    } });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: /Probar con datos/ }).click();
  await page.getByRole("link", { name: "Nuevo inventario", exact: true }).click();
  await page.getByRole("button", { name: "Comenzar inventario", exact: true }).click();
  await page.getByRole("link").filter({ has: page.locator(".eyebrow", { hasText: "/ CHC-110" }) }).click();
  const productUrl = page.url();
  await page.getByRole("button", { name: "Escribir serie manualmente" }).click();
  await page.getByLabel("Número de serie", { exact: true }).fill("CAMARA-001");
  await page.getByLabel("Notas (opcional)").fill("Placa fotografiada");
  await page.getByRole("button", { name: "Tomar foto de la placa", exact: true }).click();
  await page.getByRole("button", { name: "Capturar fotografía", exact: true }).click();
  await expect(page.getByAltText("Fotografía adjunta")).toBeVisible();
  await expect(page.getByLabel("Número de serie", { exact: true })).toHaveValue("CAMARA-001");
  await expect(page).toHaveURL(productUrl);
  expect(await page.evaluate(() => (window as unknown as { __cameraStream: MediaStream }).__cameraStream.getTracks().every((t) => t.readyState === "ended"))).toBe(true);
  await page.reload();
  await expect(page.getByLabel("Número de serie", { exact: true })).toHaveValue("CAMARA-001");
  await expect(page.getByLabel("Notas (opcional)")).toHaveValue("Placa fotografiada");
  await expect(page.getByAltText("Fotografía adjunta")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar serie", exact: true }).click();
  await expect(page.locator(".serial-list code")).toHaveText("CAMARA001");
  await page.reload();
  await expect(page.locator(".serial-list code")).toHaveText("CAMARA001");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const savedPhoto = await page.evaluate(() => new Promise<boolean>((resolve, reject) => {
    const request = indexedDB.open("emyce-inventory-v1", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction("state").objectStore("state").get("demo");
      read.onerror = () => { db.close(); reject(read.error); };
      read.onsuccess = () => {
        const unit = read.result.inventory_serial_units.find((row: { serial_number_normalized: string }) => row.serial_number_normalized === "CAMARA001");
        db.close();
        resolve(unit?.photo_url.startsWith("data:image/jpeg;") && unit.notes === "Placa fotografiada");
      };
    };
  }));
  expect(savedPhoto).toBe(true);
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith("emyce:serial-draft:")))).toEqual([]);
});

test("permiso de cámara denegado permite adjuntar foto sin perder la serie", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => { throw new DOMException("Denied", "NotAllowedError"); } });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: /Probar con datos/ }).click();
  await page.getByRole("link", { name: "Nuevo inventario", exact: true }).click();
  await page.getByRole("button", { name: "Comenzar inventario", exact: true }).click();
  await page.getByRole("link").filter({ has: page.locator(".eyebrow", { hasText: "/ CHC-110" }) }).click();
  await page.getByRole("button", { name: "Escribir serie manualmente" }).click();
  await page.getByLabel("Número de serie", { exact: true }).fill("PERMISO-001");
  await page.getByRole("button", { name: "Tomar foto de la placa", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("No se pudo abrir la cámara");
  await page.getByRole("button", { name: "Cancelar cámara" }).click();
  await page.locator("input[type=file]").setInputFiles("public/icons/icon-192.png");
  await expect(page.getByAltText("Fotografía adjunta")).toBeVisible();
  await expect(page.getByLabel("Número de serie", { exact: true })).toHaveValue("PERMISO-001");
  await page.getByRole("button", { name: "Confirmar serie", exact: true }).click();
  await expect(page.locator(".serial-list code")).toHaveText("PERMISO001");
});
test("scanner fallback ZXing lee un QR desde un flujo de vídeo y detiene la cámara", async ({
  page,
}) => {
  const zxing = require("@zxing/library") as typeof import("@zxing/library");
  const matrix = new zxing.QRCodeWriter().encode(
    "DEMO-CHC-110",
    zxing.BarcodeFormat.QR_CODE,
    400,
    400,
    new Map(),
  );
  const pixels: number[][] = [];
  for (let y = 0; y < 400; y++)
    for (let x = 0; x < 400; x++) if (matrix.get(x, y)) pixels.push([x, y]);
  await page.addInitScript(
    ({ pixels }) => {
      Object.defineProperty(window, "BarcodeDetector", { value: undefined });
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: async () => {
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext("2d")!;
          const draw = () => {
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, 640, 480);
            ctx.fillStyle = "#000";
            for (const [x, y] of pixels) ctx.fillRect(x + 120, y + 40, 1, 1);
          };
          draw();
          const stream = canvas.captureStream(10);
          Object.assign(window, { __cameraStream: stream });
          const timer = setInterval(draw, 100);
          setTimeout(() => clearInterval(timer), 30000);
          return stream;
        },
      });
    },
    { pixels },
  );
  await page.goto("/login");
  await page.getByRole("button", { name: /Probar con datos/ }).click();
  await page
    .getByRole("link", { name: "Nuevo inventario", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Comenzar inventario", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Escanear producto", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Congelador horizontal CHC-110" }),
  ).toBeVisible({ timeout: 20000 });
  expect(
    await page.evaluate(() =>
      (window as unknown as { __cameraStream: MediaStream }).__cameraStream
        .getTracks()
        .every((t) => t.readyState === "ended"),
    ),
  ).toBe(true);
});
