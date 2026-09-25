import { describe, it, expect } from "vitest";
import {
  normalizeSerial,
  lookupBarcode,
  searchProducts,
  operation,
  findDuplicate,
  differences,
  quantityFor,
  progress,
  validateCatalog,
  validateQuantity,
} from "../src/lib/domain";
import { demoData, DEMO_USER } from "../src/lib/seed";
import { applyDemo } from "../src/lib/demo";
import { safeCell } from "../src/lib/export";
function fixture() {
  let d = demoData();
  const sid = crypto.randomUUID();
  d = applyDemo(
    d,
    operation("create_session", {
      id: sid,
      name: "Inventario prueba",
      location_id: d.locations[1].id,
      user_id: DEMO_USER,
    }),
    DEMO_USER,
  );
  return { d, sid };
}
describe("Normalización y búsqueda", () => {
  it.each([
    [" abc- 123 ", "ABC123"],
    ["a\u200Bb\uFEFFc", "ABC"],
    ["ａｂｃ－１２３", "ABC123"],
    ["AA—001", "AA001"],
    ["  a\tB\n1 ", "AB1"],
  ])("%s → %s", (a, b) => expect(normalizeSerial(a)).toBe(b));
  it("localiza código primario, alternativo y SKU", () => {
    const d = demoData(),
      p = d.products[0];
    for (const code of [p.barcode, p.barcodes[0], p.sku.toLowerCase()])
      expect(lookupBarcode(d.products, code)?.id).toBe(p.id);
    expect(lookupBarcode(d.products, "desconocido")).toBeUndefined();
    expect(searchProducts(d.products, p.supplier_code)[0].id).toBe(p.id);
  });
  it("valida importación contra SKU/código existente y dentro del archivo", () => {
    const p = demoData().products;
    expect(
      validateCatalog(
        [
          {
            sku: "CHC-110",
            name: "X",
            barcode: p[0].barcode,
            serialized: "maybe",
          },
        ],
        p,
      ),
    ).toHaveLength(3);
    expect(
      validateCatalog(
        [{ sku: "A", name: "X", barcode: "a|a", serialized: "true" }],
        [],
      ),
    ).toHaveLength(1);
  });
});
describe("Invariantes del inventario", () => {
  it("rechaza cantidades en equipos con serie y números inválidos", () => {
    const p = demoData().products;
    expect(() => validateQuantity(p[0], 3)).toThrow(/serie/);
    for (const q of [-1, 1.5, NaN, Infinity, 1000001])
      expect(() => validateQuantity(p[3], q)).toThrow();
  });
  it("impide duplicado normalizado entre productos de la sesión", () => {
    const { sid, d } = fixture();
    const next = applyDemo(
      d,
      operation("serial", {
        inventory_session_id: sid,
        product_id: d.products[0].id,
        serial_number: "abc-001",
      }),
      DEMO_USER,
    );
    expect(findDuplicate(next, sid, " ABC 001 ")).toBeDefined();
    expect(() =>
      applyDemo(
        next,
        operation("serial", {
          inventory_session_id: sid,
          product_id: d.products[1].id,
          serial_number: "ABC001",
        }),
        DEMO_USER,
      ),
    ).toThrow(/REGISTRADA/);
    expect(next.inventory_serial_units).toHaveLength(1);
  });
  it("pendiente no equivale a cero y serie requiere terminar producto", () => {
    const { sid, d } = fixture();
    const p = d.products[0];
    expect(quantityFor(d, sid, p)).toBeNull();
    expect(differences(d, d.inventory_sessions[0])[0].delta).toBeNull();
    const next = applyDemo(
      d,
      operation("finish_product", {
        inventory_session_id: sid,
        product_id: p.id,
      }),
      DEMO_USER,
    );
    expect(quantityFor(next, sid, p)).toBe(0);
    expect(progress(next, next.inventory_sessions[0]).checked).toBe(1);
  });
  it("detecta conjuntos de series diferentes con cantidades iguales", () => {
    const f = fixture();
    let d = f.d;
    const sid = f.sid;
    const p = d.products[0];
    for (const serial_number of ["X1", "X2"])
      d = applyDemo(
        d,
        operation("serial", {
          inventory_session_id: sid,
          product_id: p.id,
          serial_number,
        }),
        DEMO_USER,
      );
    d = applyDemo(
      d,
      operation("finish_product", {
        inventory_session_id: sid,
        product_id: p.id,
      }),
      DEMO_USER,
    );
    const diff = differences(d, d.inventory_sessions[0])[0];
    expect(diff.delta).toBe(0);
    expect(diff.hasDifference).toBe(true);
    expect(diff.missing).toHaveLength(2);
    expect(diff.extra).toHaveLength(2);
  });
  it("bloquea revisión incompleta y conserva historial de correcciones", () => {
    const f = fixture();
    let d = f.d;
    const sid = f.sid;
    expect(() =>
      applyDemo(
        d,
        operation("transition", {
          inventory_session_id: sid,
          status: "review",
        }),
        DEMO_USER,
      ),
    ).toThrow(/todos/);
    for (const quantity of [4, 7])
      d = applyDemo(
        d,
        operation("count", {
          inventory_session_id: sid,
          product_id: d.products[3].id,
          quantity,
        }),
        DEMO_USER,
      );
    expect(d.inventory_counts).toHaveLength(1);
    expect(d.inventory_counts[0].quantity).toBe(7);
    expect(
      d.inventory_audit_log.filter((v) => v.action === "count"),
    ).toHaveLength(2);
  });
  it("reconteo conserva primer conteo y no duplica la unidad", () => {
    const f = fixture();
    let d = f.d;
    const sid = f.sid;
    const p = d.products[0];
    d = applyDemo(
      d,
      operation("serial", {
        inventory_session_id: sid,
        product_id: p.id,
        serial_number: "AA1",
      }),
      DEMO_USER,
    );
    for (const prod of d.products)
      d = applyDemo(
        d,
        operation(prod.serialized ? "finish_product" : "count", {
          inventory_session_id: sid,
          product_id: prod.id,
          quantity: 0,
        }),
        DEMO_USER,
      );
    d = applyDemo(
      d,
      operation("transition", { inventory_session_id: sid, status: "review" }),
      DEMO_USER,
    );
    d = applyDemo(
      d,
      operation("transition", { inventory_session_id: sid, status: "recount" }),
      DEMO_USER,
    );
    d = applyDemo(
      d,
      operation("serial", {
        inventory_session_id: sid,
        product_id: p.id,
        serial_number: "AA1",
      }),
      DEMO_USER,
    );
    d = applyDemo(
      d,
      operation("finish_product", {
        inventory_session_id: sid,
        product_id: p.id,
      }),
      DEMO_USER,
    );
    expect(d.inventory_serial_units).toHaveLength(1);
    expect(d.serial_observations).toHaveLength(1);
    expect(quantityFor(d, sid, p, 1)).toBe(1);
    expect(quantityFor(d, sid, p, 2)).toBe(1);
    expect(() =>
      applyDemo(
        d,
        operation("serial", {
          inventory_session_id: sid,
          product_id: p.id,
          serial_number: "AA-1",
        }),
        DEMO_USER,
      ),
    ).toThrow();
  });
  it("neutraliza fórmulas CSV sin convertir diferencias numéricas", () => {
    expect(safeCell('=HYPERLINK("x")')).toBe('\'=HYPERLINK("x")');
    expect(safeCell(-1)).toBe(-1);
  });
});
