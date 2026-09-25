import { test, expect, Page } from "@playwright/test";
async function demo(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: /Probar con datos/ }).click();
  await expect(
    page.getByRole("heading", { name: "Hola, Usuario." }),
  ).toBeVisible();
}
test("390px: cantidades, series, duplicados, fotos, revisión, exportación y persistencia", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await demo(page);
  await page.screenshot({
    path: "../../work/dashboard-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Nuevo inventario", exact: true })
    .click();
  await page.getByLabel("Nombre del inventario").fill("Inventario Almacén QA");
  await page.getByText("Almacén", { exact: true }).click();
  await page
    .getByRole("button", { name: "Comenzar inventario", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Almacén", exact: true }),
  ).toBeVisible();
  const sessionUrl = page.url();
  await expect(page.getByRole("columnheader", { name: "Sistema" })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: /Accesorio X/ }).click();
  await page.getByRole("spinbutton", { name: "Cantidad física" }).fill("7");
  await page
    .getByRole("button", { name: "Guardar conteo", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Escanear producto", exact: true }),
  ).toBeVisible();
  await page.getByLabel("O escribe el código").fill("DEMO-CHC-110");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("button", { name: "Escribir serie manualmente" })
    .click();
  await page.getByLabel("Número de serie", { exact: true }).fill(" abc-001 ");
  await page.getByLabel("Estado del equipo").selectOption("damaged");
  await page
    .locator("input[type=file]")
    .setInputFiles("public/icons/icon-192.png");
  await expect(page.getByAltText("Fotografía adjunta")).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar serie", exact: true })
    .click();
  await expect(page.locator(".serial-list code")).toHaveText("ABC001");
  await page
    .getByRole("button", { name: "Escribir serie manualmente" })
    .click();
  await page.getByLabel("Número de serie", { exact: true }).fill("ABC 001");
  await page
    .getByRole("button", { name: "Confirmar serie", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "SERIE YA REGISTRADA", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../work/duplicate-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Regresar", exact: true }).click();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(page.locator(".serial-list code")).toHaveCount(1);
  await page.getByRole("button", { name: "Terminar este producto" }).click();
  await page.getByRole("button", { name: "Confirmar y continuar" }).click();
  await page.getByRole("button", { name: "Cerrar cámara" }).click();
  await page.reload();
  await expect(page.getByText("2 de 8 productos revisados")).toBeVisible();
  for (const sku of ["VR-12", "BAR-8", "VIT-120", "M-22"]) {
    await page
      .getByRole("link")
      .filter({ has: page.locator(".eyebrow", { hasText: `/ ${sku}` }) })
      .click();
    await page.getByRole("button", { name: "Terminar este producto" }).click();
    await page.getByRole("button", { name: "Confirmar y continuar" }).click();
    await page.getByRole("button", { name: "Cerrar cámara" }).click();
  }
  for (const sku of ["EMP-01", "CHA-04"]) {
    await page
      .getByRole("link")
      .filter({ has: page.locator(".eyebrow", { hasText: `/ ${sku}` }) })
      .click();
    await page.getByRole("spinbutton", { name: "Cantidad física" }).fill("5");
    await page
      .getByRole("button", { name: "Guardar conteo", exact: true })
      .click();
    await page.getByRole("button", { name: "Cerrar cámara" }).click();
  }
  await page
    .getByRole("button", { name: "Terminar conteo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Resultados del conteo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Sistema" }),
  ).toBeVisible();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Series CSV", exact: true }).click();
  expect((await dl).suggestedFilename()).toBe("inventory_serials.csv");
  const xlsx = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel", exact: true }).click();
  expect((await xlsx).suggestedFilename()).toBe("inventario.xlsx");
  await page
    .getByRole("button", { name: "Cerrar inventario", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar cierre" }).click();
  await expect(page.getByText("Finalizado", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Finalizado", { exact: true })).toBeVisible();
  await page.goto(sessionUrl);
  await expect(page.getByText("8 de 8 productos revisados")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("escritorio: búsqueda, importación con preview, nueva ubicación y navegación", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await demo(page);
  await page.screenshot({
    path: "../../work/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Productos", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Buscar producto, SKU o código…" })
    .fill("PROV-VR-12");
  await expect(page.locator(".product-row")).toHaveCount(1);
  await page.getByRole("link", { name: "Importar", exact: true }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "prueba.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "sku,name,brand,barcode,serialized\nQA-ACC,Repuesto QA,EMYCE,QA123|QA456,false",
      ),
    });
  await expect(page.getByText("Validación correcta")).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar importación de 1 filas" })
    .click();
  await page.getByRole("link", { name: "Productos", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Buscar producto, SKU o código…" })
    .fill("QA456");
  await expect(page.locator(".product-row")).toHaveCount(1);
  await page.getByRole("link", { name: "Ubicaciones", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Sucursal QA");
  await page
    .getByRole("button", { name: "Agregar ubicación", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sucursal QA" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("WebMCP registra y valida navegación sin crear registros", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const registry: Record<
      string,
      {
        execute: (input: unknown) => unknown;
        inputSchema: unknown;
        annotations: unknown;
      }
    > = {};
    Object.defineProperty(document, "modelContext", {
      value: {
        registerTool: (tool: {
          name: string;
          execute: (input: unknown) => unknown;
          inputSchema: unknown;
          annotations: unknown;
        }) => {
          registry[tool.name] = tool;
        },
      },
    });
    Object.assign(window, { __tools: registry });
  });
  await demo(page);
  const result = await page.evaluate(async () => {
    const w = window as unknown as Window & {
      __tools: Record<
        string,
        {
          execute: (input: unknown) => Promise<unknown>;
          inputSchema: unknown;
          annotations: unknown;
        }
      >;
    };
    const tool = w.__tools.start_inventory_creation;
    let invalid = false;
    try {
      await tool.execute({ bad: true });
    } catch {
      invalid = true;
    }
    return {
      invalid,
      valid: await tool.execute({}),
      schema: tool.inputSchema,
      annotations: tool.annotations,
    };
  });
  expect(result.invalid).toBe(true);
  expect(result.valid).toEqual({ opened: "/inventory/new" });
  await expect(
    page.getByRole("heading", { name: "Comencemos." }),
  ).toBeVisible();
});
