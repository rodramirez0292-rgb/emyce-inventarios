import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
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
