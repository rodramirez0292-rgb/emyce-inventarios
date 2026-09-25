import Papa from "papaparse";
import { Snapshot, Inventory, differences, serialsFor } from "./domain";
export const safeCell = (v: unknown) =>
  typeof v === "string" && /^[=+@\t\r-]/.test(v) ? `'${v}` : v;
export function download(content: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function exportRows(data: Snapshot, s: Inventory) {
  const location =
    data.locations.find((v) => v.id === s.location_id)?.name || "";
  const rows = differences(data, s);
  return {
    counts: rows.map((d) => ({
      SKU: d.product.sku,
      Producto: d.product.name,
      Ubicación: location,
      "Cantidad esperada": d.expected ?? "Sin referencia",
      "Cantidad física": d.physical ?? "Pendiente",
      Diferencia: d.delta ?? "Sin referencia",
      Ronda: d.round,
      "Series faltantes": d.missing.join(" | "),
      "Series no esperadas": d.extra.join(" | "),
    })),
    serials: rows.flatMap((d) =>
      serialsFor(data, s.id, d.product.id, d.round).map((u) => ({
        SKU: d.product.sku,
        Producto: d.product.name,
        Ubicación: location,
        Serial: u.serial_number_normalized,
        "Serie original": u.serial_number_original,
        Estado: u.status,
        Ronda: d.round,
        Usuario:
          data.profiles.find((p) => p.id === u.user_id)?.full_name || u.user_id,
        Fecha: u.created_at,
        Notas: u.notes,
      })),
    ),
  };
}
export function csv(rows: Record<string, unknown>[], name: string) {
  download(
    "\uFEFF" +
      Papa.unparse(
        rows.map((r) =>
          Object.fromEntries(
            Object.entries(r).map(([k, v]) => [k, safeCell(v)]),
          ),
        ),
      ),
    name,
    "text/csv;charset=utf-8",
  );
}
export async function exportXlsx(data: Snapshot, s: Inventory) {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  book.creator = "EMYCE";
  const rows = exportRows(data, s);
  for (const [name, items] of [
    ["Conteos", rows.counts],
    ["Series", rows.serials],
  ] as const) {
    const sheet = book.addWorksheet(name);
    if (items.length) {
      sheet.columns = Object.keys(items[0]).map((key) => ({
        header: key,
        key,
        width: key === "Producto" ? 42 : 24,
      }));
      items.forEach((row) => sheet.addRow(row));
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF12263A" },
      };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      sheet.autoFilter = {
        from: "A1",
        to: { row: 1, column: sheet.columns.length },
      };
    }
  }
  const buffer = await book.xlsx.writeBuffer();
  download(
    new Uint8Array(buffer as ArrayBuffer),
    "inventario.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
