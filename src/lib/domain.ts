export type Role = "admin" | "supervisor" | "counter";
export type SessionState =
  "draft" | "counting" | "recount" | "review" | "completed";
export type Row = { id: string; [key: string]: unknown };
export interface Profile extends Row {
  full_name: string;
  role: Role;
  active: boolean;
}
export interface Location extends Row {
  name: string;
  active: boolean;
}
export interface Product extends Row {
  sku: string;
  name: string;
  description: string;
  brand: string;
  category: string;
  barcode: string;
  barcodes: string[];
  supplier_code: string;
  serialized: boolean;
  photo_url: string;
  active: boolean;
}
export interface Inventory extends Row {
  name: string;
  location_id: string;
  user_id: string;
  status: SessionState;
  started_at: string;
  completed_at?: string;
}
export interface Count extends Row {
  inventory_session_id: string;
  product_id: string;
  quantity: number;
  count_number: number;
  user_id: string;
  location_id: string;
  created_at: string;
}
export interface Serial extends Row {
  inventory_session_id: string;
  product_id: string;
  location_id: string;
  serial_number_original: string;
  serial_number_normalized: string;
  serial_barcode: string;
  status: string;
  notes: string;
  photo_url: string;
  count_number: number;
  user_id: string;
  created_at: string;
}
export interface Snapshot {
  profiles: Profile[];
  locations: Location[];
  products: Product[];
  inventory_sessions: Inventory[];
  inventory_counts: Count[];
  inventory_serial_units: Serial[];
  session_products: Row[];
  product_checks: Row[];
  serial_observations: Row[];
  expected_inventory: Row[];
  expected_serials: Row[];
  unidentified_items: Row[];
  inventory_audit_log: Row[];
}
export const emptySnapshot = (): Snapshot => ({
  profiles: [],
  locations: [],
  products: [],
  inventory_sessions: [],
  inventory_counts: [],
  inventory_serial_units: [],
  session_products: [],
  product_checks: [],
  serial_observations: [],
  expected_inventory: [],
  expected_serials: [],
  unidentified_items: [],
  inventory_audit_log: [],
});
export const normalizeSerial = (value: string) =>
  value
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/[\s\p{Cf}\p{Pd}]/gu, "");
export const roundFor = (s: Inventory) => (s.status === "recount" ? 2 : 1);
export function parseEquipmentBarcode(code: string) {
  const parts = code.trim().split(";");
  if (parts.length === 3 && !parts[2].trim()) parts.pop();
  if (parts.length !== 2 || !parts.every((part) => part.trim())) return null;
  return { productCode: parts[0].trim(), serial: parts[1].trim() };
}
export function lookupBarcode(products: Product[], code: string) {
  const q = code.trim();
  return products.find(
    (p) =>
      p.barcode === q ||
      p.barcodes.includes(q) ||
      p.sku.toLowerCase() === q.toLowerCase(),
  );
}
export function searchProducts(products: Product[], q: string) {
  const term = q.toLocaleLowerCase().trim();
  return products.filter((p) =>
    [
      p.sku,
      p.name,
      p.description,
      p.brand,
      p.barcode,
      p.supplier_code,
      ...p.barcodes,
    ].some((v) => v.toLocaleLowerCase().includes(term)),
  );
}
export function serialsFor(
  data: Snapshot,
  sessionId: string,
  productId: string,
  round = 1,
) {
  return data.inventory_serial_units.filter(
    (u) =>
      u.inventory_session_id === sessionId &&
      u.product_id === productId &&
      (round === 1
        ? u.count_number === 1
        : data.serial_observations.some(
            (o) => o.serial_unit_id === u.id && o.count_number === 2,
          )),
  );
}
export function findDuplicate(
  data: Snapshot,
  sessionId: string,
  value: string,
  round = 1,
) {
  return data.inventory_serial_units.find(
    (u) =>
      u.inventory_session_id === sessionId &&
      u.serial_number_normalized === normalizeSerial(value) &&
      (round === 1 ||
        data.serial_observations.some(
          (o) => o.serial_unit_id === u.id && o.count_number === 2,
        )),
  );
}
export function quantityFor(
  data: Snapshot,
  sessionId: string,
  p: Product,
  round = 1,
): number | null {
  const checked = data.product_checks.some(
    (c) =>
      c.inventory_session_id === sessionId &&
      c.product_id === p.id &&
      c.count_number === round,
  );
  if (!checked) return null;
  return p.serialized
    ? serialsFor(data, sessionId, p.id, round).length
    : (data.inventory_counts.find(
        (c) =>
          c.inventory_session_id === sessionId &&
          c.product_id === p.id &&
          c.count_number === round,
      )?.quantity ?? null);
}
export function scopeFor(data: Snapshot, s: Inventory) {
  return data.products.filter((p) =>
    data.session_products.some(
      (sp) =>
        sp.inventory_session_id === s.id &&
        sp.product_id === p.id &&
        (s.status !== "recount" || sp.recount_required),
    ),
  );
}
export function differences(data: Snapshot, s: Inventory) {
  return data.products
    .filter((p) =>
      data.session_products.some(
        (sp) => sp.inventory_session_id === s.id && sp.product_id === p.id,
      ),
    )
    .map((p) => {
      const round = data.product_checks.some(
        (c) =>
          c.inventory_session_id === s.id &&
          c.product_id === p.id &&
          c.count_number === 2,
      )
        ? 2
        : 1;
      const physical = quantityFor(data, s.id, p, round);
      const expectedRow = data.expected_inventory.find(
        (e) =>
          e.inventory_session_id === s.id &&
          e.product_id === p.id &&
          e.location_id === s.location_id,
      );
      const expected = expectedRow
        ? Number(expectedRow.expected_quantity)
        : null;
      const expectedSerials = data.expected_serials
        .filter(
          (e) =>
            e.inventory_session_id === s.id &&
            e.product_id === p.id &&
            e.location_id === s.location_id,
        )
        .map((e) => normalizeSerial(String(e.serial_number)));
      const actual = serialsFor(data, s.id, p.id, round).map(
        (u) => u.serial_number_normalized,
      );
      const missing = expectedSerials.filter((v) => !actual.includes(v));
      const extra = actual.filter((v) => !expectedSerials.includes(v));
      const delta =
        physical === null || expected === null ? null : physical - expected;
      return {
        product: p,
        physical,
        expected,
        delta,
        missing,
        extra,
        expectedSerials,
        actual,
        round,
        hasDifference:
          expected !== null &&
          physical !== null &&
          (delta !== 0 ||
            (p.serialized && (missing.length > 0 || extra.length > 0))),
      };
    });
}
export function progress(data: Snapshot, s: Inventory) {
  const scope = scopeFor(data, s),
    round = roundFor(s);
  const checked = scope.filter(
    (p) => quantityFor(data, s.id, p, round) !== null,
  ).length;
  return {
    total: scope.length,
    checked,
    pending: scope.length - checked,
    percent: scope.length ? Math.round((100 * checked) / scope.length) : 0,
  };
}
export function validateQuantity(p: Product, q: number) {
  if (p.serialized)
    throw new Error("Este equipo requiere una serie por unidad.");
  if (!Number.isSafeInteger(q) || q < 0 || q > 1000000)
    throw new Error("Escribe una cantidad entera entre 0 y 1,000,000.");
}
export type Operation = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
};
export const operation = (
  type: string,
  payload: Record<string, unknown>,
): Operation => ({
  id: crypto.randomUUID(),
  type,
  payload,
  created_at: new Date().toISOString(),
});
export const statusLabel: Record<SessionState, string> = {
  draft: "Borrador",
  counting: "En conteo",
  recount: "Reconteo",
  review: "En revisión",
  completed: "Finalizado",
};
export function validateCatalog(
  rows: Record<string, string>[],
  existing: Product[],
) {
  const errors: string[] = [];
  const skus = new Set(existing.map((p) => p.sku.toUpperCase()));
  const codes = new Set(
    existing.flatMap((p) => [p.barcode, ...p.barcodes]).filter(Boolean),
  );
  rows.forEach((r, i) => {
    const line = i + 2;
    const sku = (r.sku || "").trim().toUpperCase();
    if (!sku || !r.name?.trim())
      errors.push(`Fila ${line}: SKU y nombre obligatorios.`);
    if (skus.has(sku)) errors.push(`Fila ${line}: SKU duplicado (${sku}).`);
    skus.add(sku);
    if (
      !["true", "false", "1", "0", "sí", "si", "no"].includes(
        (r.serialized || "false").toLowerCase(),
      )
    )
      errors.push(`Fila ${line}: serialized debe ser true o false.`);
    for (const b of (r.barcode || "")
      .split("|")
      .map((v) => v.trim())
      .filter(Boolean)) {
      if (codes.has(b)) errors.push(`Fila ${line}: código duplicado (${b}).`);
      codes.add(b);
    }
  });
  return errors;
}
