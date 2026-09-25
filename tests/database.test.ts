import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeSerial, operation } from "../src/lib/domain";
const admin = "00000000-0000-4000-8000-000000000011",
  counter = "00000000-0000-4000-8000-000000000012",
  other = "00000000-0000-4000-8000-000000000013";
const pid = "20000000-0000-4000-8000-000000000001",
  normal = "20000000-0000-4000-8000-000000000004",
  location = "10000000-0000-4000-8000-000000000002";
let db: PGlite;
let sid: string;
async function asUser(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function rpc(
  type: string,
  payload: Record<string, unknown>,
  id?: string,
) {
  const op = operation(type, payload);
  if (id) op.id = id;
  return db.query("select public.apply_operation($1::jsonb)", [
    JSON.stringify(op),
  ]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,name text,bucket_id text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`,
  );
  const sql = readFileSync(
    "supabase/migrations/202609240001_initial.sql",
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(sql);
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  for (const id of [admin, counter, other])
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      id,
      `${id}@example.test`,
    ]);
  await db.exec(
    `update public.profiles set active=true;update public.profiles set role='admin' where id='${admin}';`,
  );
  await asUser(counter);
  sid = crypto.randomUUID();
  await rpc("create_session", {
    id: sid,
    name: "Prueba DB",
    location_id: location,
    user_id: counter,
  });
});
afterAll(async () => {
  await db?.close();
});
describe("PostgreSQL: restricciones, RLS y transacciones reales", () => {
  it("normaliza igual que el cliente", async () => {
    for (const value of [
      " abc- 123 ",
      "AA\u200B001",
      "ａｂｃ－１２３",
      "AA—01",
      "A\u2060B",
      "A\u0600B",
      "C\u{E0001}D",
    ]) {
      const result = await db.query<{ v: string }>(
        "select normalize_serial($1) as v",
        [value],
      );
      expect(result.rows[0].v).toBe(normalizeSerial(value));
    }
  });
  it("impide escrituras directas y escalada de roles", async () => {
    await expect(
      db.exec("update profiles set role='admin' where id=auth.uid() "),
    ).rejects.toThrow(/permission denied/);
    await expect(
      rpc("update_profile", { id: counter, role: "admin", active: true }),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into inventory_counts(inventory_session_id,product_id,location_id,quantity,user_id,count_number) values('${sid}','${normal}','${location}',4,'${counter}',1)`,
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("restringe otros responsables y referencias incluso durante revisión", async () => {
    await db.exec("reset role");
    await db.query(
      "insert into expected_inventory(inventory_session_id,product_id,location_id,expected_quantity) values($1,$2,$3,2)",
      [sid, pid, location],
    );
    await asUser(counter);
    expect(
      (await db.query("select * from expected_inventory")).rows,
    ).toHaveLength(0);
    await asUser(other);
    expect(
      (await db.query("select * from inventory_sessions")).rows,
    ).toHaveLength(0);
    await expect(
      rpc("count", {
        inventory_session_id: sid,
        product_id: normal,
        quantity: 2,
      }),
    ).rejects.toThrow(/autorizado/);
    await asUser(counter);
  });
  it("valida tipo de producto, números enteros y protección de duplicados", async () => {
    await expect(
      rpc("count", { inventory_session_id: sid, product_id: pid, quantity: 2 }),
    ).rejects.toThrow(/series/);
    await expect(
      rpc("count", {
        inventory_session_id: sid,
        product_id: normal,
        quantity: 1.3,
      }),
    ).rejects.toThrow(/entera/);
    await expect(
      rpc("serial", {
        inventory_session_id: sid,
        product_id: normal,
        serial_number: "X",
      }),
    ).rejects.toThrow(/cantidad/);
    await rpc("serial", {
      inventory_session_id: sid,
      product_id: pid,
      serial_number: " Abc-001 ",
    });
    await expect(
      rpc("serial", {
        inventory_session_id: sid,
        product_id: pid,
        serial_number: "ABC001",
      }),
    ).rejects.toThrow(/REGISTRADA/);
    expect(
      (await db.query("select * from inventory_serial_units")).rows,
    ).toHaveLength(1);
  });
  it("reintentos son idempotentes y las correcciones quedan auditadas", async () => {
    const id = crypto.randomUUID();
    await rpc(
      "count",
      { inventory_session_id: sid, product_id: normal, quantity: 3 },
      id,
    );
    await rpc(
      "count",
      { inventory_session_id: sid, product_id: normal, quantity: 3 },
      id,
    );
    await rpc("count", {
      inventory_session_id: sid,
      product_id: normal,
      quantity: 4,
    });
    expect(
      (
        await db.query<{ quantity: number }>(
          "select quantity from inventory_counts",
        )
      ).rows[0].quantity,
    ).toBe(4);
    await asUser(admin);
    expect(
      (
        await db.query(
          "select * from inventory_audit_log where action='inventory_counts:UPDATE'",
        )
      ).rows,
    ).toHaveLength(1);
    await asUser(counter);
  });
  it("bloquea revisión incompleta, cierre por contador y revela referencia sólo a supervisor", async () => {
    await expect(
      rpc("transition", { inventory_session_id: sid, status: "review" }),
    ).rejects.toThrow(/todos/);
    const products = await db.query<{ id: string }>(
      "select id from products where serialized",
    );
    for (const p of products.rows)
      await rpc("finish_product", {
        inventory_session_id: sid,
        product_id: p.id,
      });
    await rpc("transition", { inventory_session_id: sid, status: "review" });
    expect(
      (await db.query("select * from expected_inventory")).rows,
    ).toHaveLength(0);
    await expect(
      rpc("transition", { inventory_session_id: sid, status: "completed" }),
    ).rejects.toThrow(/Transición/);
    await asUser(admin);
    expect(
      (await db.query("select * from expected_inventory")).rows,
    ).toHaveLength(1);
  });
  it("reconteo usa observaciones separadas y conserva la unicidad", async () => {
    await rpc("transition", { inventory_session_id: sid, status: "recount" });
    await rpc("serial", {
      inventory_session_id: sid,
      product_id: pid,
      serial_number: "ABC-001",
    });
    await expect(
      rpc("serial", {
        inventory_session_id: sid,
        product_id: pid,
        serial_number: "ABC 001",
      }),
    ).rejects.toThrow(/REGISTRADA/);
    expect(
      (await db.query("select * from inventory_serial_units")).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select * from serial_observations")).rows,
    ).toHaveLength(1);
    await rpc("finish_product", { inventory_session_id: sid, product_id: pid });
    await rpc("transition", { inventory_session_id: sid, status: "review" });
    await rpc("transition", { inventory_session_id: sid, status: "completed" });
    await expect(
      rpc("serial", {
        inventory_session_id: sid,
        product_id: pid,
        serial_number: "X2",
      }),
    ).rejects.toThrow(/cerrado/);
  });
  it("importación falla atómicamente ante SKU duplicado", async () => {
    const before = (await db.query("select * from products")).rows.length;
    await expect(
      rpc("import_products", {
        rows: [
          { sku: "NEW-1", name: "New", serialized: "false" },
          { sku: "CHC-110", name: "Dup", serialized: "true" },
        ],
      }),
    ).rejects.toThrow();
    expect((await db.query("select * from products")).rows).toHaveLength(
      before,
    );
  });
});
