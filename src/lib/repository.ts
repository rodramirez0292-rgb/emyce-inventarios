import { createClient } from "@supabase/supabase-js";
import { openDB } from "idb";
import { applyDemo } from "./demo";
import { demoData } from "./seed";
import { emptySnapshot, Snapshot, Operation, Row, Product } from "./domain";
export const configured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
export const supabase = configured
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  : null;
export const localDB = () =>
  openDB("emyce-inventory-v1", 1, {
    upgrade(db) {
      db.createObjectStore("state");
    },
  });
export type Pending = { op: Operation; error?: string };
export async function getLocal<T>(key: string): Promise<T | undefined> {
  return (await localDB()).get("state", key);
}
export async function putLocal(key: string, value: unknown) {
  await (await localDB()).put("state", value, key);
}
export class Repository {
  constructor(
    public demo: boolean,
    public userId: string,
  ) {}
  get key() {
    return this.demo ? "demo" : `user:${this.userId}`;
  }
  async pending() {
    return (await getLocal<Pending[]>(`${this.key}:queue`)) || [];
  }
  async all(table: string) {
    if (!supabase) throw new Error("Configura Supabase.");
    const rows: Row[] = [];
    for (let page = 0; ; page++) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("id")
        .range(page * 1000, page * 1000 + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    return rows;
  }
  async load(): Promise<Snapshot> {
    if (this.demo) {
      const d = (await getLocal<Snapshot>(this.key)) || demoData();
      await putLocal(this.key, d);
      return d;
    }
    if (!navigator.onLine) {
      const cached = await getLocal<Snapshot>(this.key);
      if (!cached)
        throw new Error("Conéctate para descargar tu catálogo primero.");
      return cached;
    }
    if ((await this.pending()).length) {
      const cached = await getLocal<Snapshot>(this.key);
      if (cached) return cached;
    }
    const data = emptySnapshot();
    const tables = Object.keys(data) as (keyof Snapshot)[];
    const results = await Promise.all(tables.map((t) => this.all(t)));
    tables.forEach((t, i) => Object.assign(data, { [t]: results[i] }));
    const codes = await this.all("product_barcodes");
    data.products = data.products.map((p) => ({
      ...p,
      barcodes: codes
        .filter((b) => b.product_id === p.id)
        .map((b) => String(b.barcode)),
    }));
    await putLocal(this.key, {
      ...data,
      expected_inventory: [],
      expected_serials: [],
      inventory_audit_log: data.inventory_audit_log.filter(
        (a) => !String(a.action).startsWith("expected_"),
      ),
    });
    return data;
  }
  async photo(data: string, folder: string) {
    if (!data.startsWith("data:") || this.demo) return data;
    if (!supabase || !navigator.onLine)
      throw new Error("La fotografía necesita conexión para subir.");
    const blob = await (await fetch(data)).blob();
    const path = `${folder}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from("inventory-photos")
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    return path;
  }
  async remote(op: Operation) {
    if (!supabase) throw new Error("Configura Supabase.");
    if (
      typeof op.payload.photo_url === "string" &&
      op.payload.photo_url.startsWith("data:")
    ) {
      op = {
        ...op,
        payload: {
          ...op.payload,
          photo_url: await this.photo(
            op.payload.photo_url,
            op.type === "save_product"
              ? "products"
              : `sessions/${op.payload.inventory_session_id}`,
          ),
        },
      };
    }
    const { error } = await supabase.rpc("apply_operation", { command: op });
    if (error) throw new Error(error.message);
  }
  async write(op: Operation): Promise<Snapshot> {
    if (this.demo) {
      const db = await localDB();
      const tx = db.transaction("state", "readwrite");
      const d = (await tx.store.get(this.key)) || demoData();
      const result = applyDemo(d, op, this.userId);
      await tx.store.put(result, this.key);
      await tx.done;
      return result;
    }
    const pending = await this.pending();
    if (!navigator.onLine || pending.length) {
      if (!["count", "serial", "finish_product", "unknown"].includes(op.type))
        throw new Error(
          "Sincroniza tus registros antes de realizar esta acción.",
        );
      const current = await getLocal<Snapshot>(this.key);
      if (!current) throw new Error("Catálogo no disponible sin conexión.");
      const next = applyDemo(current, op, this.userId);
      const db = await localDB();
      const tx = db.transaction("state", "readwrite");
      await tx.store.put([...pending, { op }], `${this.key}:queue`);
      await tx.store.put(next, this.key);
      await tx.done;
      return next;
    }
    await this.remote(op);
    return this.load();
  }
  async sync() {
    if (this.demo || !navigator.onLine) return;
    const pending = await this.pending();
    while (pending.length) {
      try {
        await this.remote(pending[0].op);
        pending.shift();
        await putLocal(`${this.key}:queue`, pending);
      } catch (e) {
        pending[0].error =
          e instanceof Error ? e.message : "Error al sincronizar";
        await putLocal(`${this.key}:queue`, pending);
        throw e;
      }
    }
  }
  async resolvePending(id: string) {
    const q = await this.pending();
    const item = q.find((v) => v.op.id === id);
    if (!item) throw new Error("Registro no encontrado.");
    const sid = item.op.payload.inventory_session_id;
    await this.remote({
      id: crypto.randomUUID(),
      type: "unknown",
      created_at: new Date().toISOString(),
      payload: {
        inventory_session_id: sid,
        kind: "sync_conflict",
        barcode: String(item.op.payload.serial_number || ""),
        notes: `Conflicto de sincronización: ${item.error}. Operación original: ${JSON.stringify(item.op)}`,
      },
    });
    await putLocal(
      `${this.key}:queue`,
      q.filter((v) => v.op.id !== id),
    );
  }
}
export async function signedPhoto(path: string) {
  if (!path || path.startsWith("data:") || path.startsWith("https://"))
    return path;
  if (!supabase) return "";
  const { data, error } = await supabase.storage
    .from("inventory-photos")
    .createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}
export function catalogProduct(rows: Record<string, string>[]): Product[] {
  return rows.map((r, i) => ({
    id: String(i),
    sku: r.sku || "",
    name: r.name || "",
    brand: r.brand || "",
    category: r.category || "",
    description: r.description || "",
    barcode: r.barcode || "",
    barcodes: [],
    supplier_code: r.supplier_code || "",
    serialized: r.serialized === "true",
    photo_url: "",
    active: true,
  }));
}
