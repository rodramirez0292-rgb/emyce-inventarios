import {
  Snapshot,
  Operation,
  Product,
  normalizeSerial,
  roundFor,
  validateQuantity,
  findDuplicate,
  progress,
  differences,
  validateCatalog,
} from "./domain";
export function applyDemo(
  d: Snapshot,
  op: Operation,
  userId: string,
): Snapshot {
  const next = structuredClone(d),
    p = op.payload,
    now = new Date().toISOString();
  const profile = next.profiles.find((u) => u.id === userId && u.active);
  if (!profile) throw new Error("Usuario no autorizado.");
  const admin = profile.role === "admin",
    supervisor = profile.role !== "counter";
  const uid = () => crypto.randomUUID();
  let s = next.inventory_sessions.find((s) => s.id === p.inventory_session_id);
  const product = next.products.find((v) => v.id === p.product_id);
  const requireAdmin = () => {
    if (!admin) throw new Error("Se requiere administrador.");
  };
  if (s) {
    if (s.user_id !== userId && !supervisor)
      throw new Error("Sesión de otro responsable.");
    if (s.status === "completed")
      throw new Error("El inventario está cerrado.");
  }
  const check = () => {
    if (
      !s ||
      !product ||
      !["counting", "recount"].includes(s.status) ||
      !next.session_products.some(
        (v) =>
          v.inventory_session_id === s!.id &&
          v.product_id === product.id &&
          (s!.status !== "recount" || v.recount_required),
      )
    )
      throw new Error("Producto fuera del alcance o sesión no editable.");
  };
  const mark = () => {
    const round = roundFor(s!);
    if (
      !next.product_checks.some(
        (v) =>
          v.inventory_session_id === s!.id &&
          v.product_id === p.product_id &&
          v.count_number === round,
      )
    )
      next.product_checks.push({
        id: uid(),
        inventory_session_id: s!.id,
        product_id: p.product_id,
        count_number: round,
        user_id: userId,
      });
  };
  switch (op.type) {
    case "create_session": {
      if (!String(p.name || "").trim()) throw new Error("Escribe un nombre.");
      if (!next.locations.some((l) => l.id === p.location_id && l.active))
        throw new Error("Ubicación inválida.");
      if (p.user_id !== userId && !supervisor)
        throw new Error("Responsable no autorizado.");
      s = {
        id: String(p.id),
        name: String(p.name),
        location_id: String(p.location_id),
        user_id: String(p.user_id),
        status: p.draft ? "draft" : "counting",
        started_at: now,
      };
      next.inventory_sessions.unshift(s);
      next.products
        .filter((v) => v.active)
        .forEach((v, i) => {
          next.session_products.push({
            id: uid(),
            inventory_session_id: s!.id,
            product_id: v.id,
            recount_required: false,
          });
          next.expected_inventory.push({
            id: uid(),
            inventory_session_id: s!.id,
            product_id: v.id,
            location_id: s!.location_id,
            expected_quantity: v.serialized ? 2 : 5 + i,
          });
          if (v.serialized)
            for (let n = 1; n <= 2; n++)
              next.expected_serials.push({
                id: uid(),
                inventory_session_id: s!.id,
                product_id: v.id,
                location_id: s!.location_id,
                serial_number: `${v.sku.replace(/-/g, "")}-00${n}`,
              });
        });
      break;
    }
    case "count":
      check();
      validateQuantity(product!, Number(p.quantity));
      {
        const round = roundFor(s!);
        const row = next.inventory_counts.find(
          (v) =>
            v.inventory_session_id === s!.id &&
            v.product_id === p.product_id &&
            v.count_number === round,
        );
        if (row) {
          row.quantity = Number(p.quantity);
          row.user_id = userId;
          row.updated_at = now;
        } else
          next.inventory_counts.push({
            id: op.id,
            inventory_session_id: s!.id,
            location_id: s!.location_id,
            product_id: product!.id,
            quantity: Number(p.quantity),
            count_number: round,
            user_id: userId,
            created_at: now,
          });
        mark();
      }
      break;
    case "serial": {
      check();
      if (!product!.serialized)
        throw new Error("Este producto se cuenta por cantidad.");
      const normalized = normalizeSerial(String(p.serial_number || ""));
      if (!normalized || normalized.length > 120)
        throw new Error(
          "La serie es obligatoria y admite hasta 120 caracteres.",
        );
      const round = roundFor(s!);
      if (findDuplicate(next, s!.id, normalized, round))
        throw new Error("SERIE YA REGISTRADA");
      let unit = next.inventory_serial_units.find(
        (v) =>
          v.inventory_session_id === s!.id &&
          v.serial_number_normalized === normalized,
      );
      if (unit && unit.product_id !== product!.id)
        throw new Error("La serie pertenece a otro producto.");
      if (!unit) {
        unit = {
          id: op.id,
          inventory_session_id: s!.id,
          product_id: product!.id,
          location_id: s!.location_id,
          serial_number_original: String(p.serial_number),
          serial_number_normalized: normalized,
          serial_barcode: String(p.serial_barcode || ""),
          status: String(p.status || "found"),
          notes: String(p.notes || ""),
          photo_url: String(p.photo_url || ""),
          count_number: round,
          user_id: userId,
          created_at: now,
        };
        next.inventory_serial_units.push(unit);
      }
      if (round === 2)
        next.serial_observations.push({
          id: uid(),
          inventory_session_id: s!.id,
          product_id: product!.id,
          serial_unit_id: unit.id,
          count_number: 2,
          user_id: userId,
        });
      break;
    }
    case "finish_product":
      check();
      if (!product!.serialized) throw new Error("Registra la cantidad.");
      mark();
      break;
    case "transition": {
      if (!s) throw new Error("Inventario no encontrado.");
      const target = p.status;
      if (target === "counting" && s.status === "draft") {
        s.status = "counting";
        break;
      }
      if (target === "review" && ["counting", "recount"].includes(s.status)) {
        if (progress(next, s).pending)
          throw new Error("Termina todos los productos antes de revisar.");
        s.status = "review";
        break;
      }
      if (!supervisor) throw new Error("Se requiere supervisor.");
      if (target === "recount" && s.status === "review") {
        const diff = differences(next, s).filter((v) => v.hasDifference);
        if (!diff.length) throw new Error("No hay diferencias para recontar.");
        if (
          next.product_checks.some(
            (c) => c.inventory_session_id === s!.id && c.count_number === 2,
          )
        )
          throw new Error("El segundo conteo ya se realizó.");
        next.session_products
          .filter((v) => v.inventory_session_id === s!.id)
          .forEach(
            (v) =>
              (v.recount_required = diff.some(
                (x) => x.product.id === v.product_id,
              )),
          );
        s.status = "recount";
        break;
      }
      if (target === "completed" && s.status === "review") {
        if (
          next.unidentified_items.some(
            (v) => v.inventory_session_id === s!.id && !v.resolved_at,
          )
        )
          throw new Error("Resuelve las incidencias pendientes.");
        s.status = "completed";
        s.completed_at = now;
        break;
      }
      throw new Error("Transición no permitida.");
    }
    case "unknown":
      if (!s || !["counting", "recount"].includes(s.status))
        throw new Error("Inventario no editable.");
      next.unidentified_items.push({
        id: op.id,
        ...p,
        location_id: s.location_id,
        user_id: userId,
        created_at: now,
        resolved_at: null,
      });
      break;
    case "resolve":
      if (!supervisor) throw new Error("Se requiere supervisor.");
      {
        const item = next.unidentified_items.find((v) => v.id === p.id);
        if (!item) throw new Error("Incidencia no encontrada.");
        if (!String(p.resolution || "").trim())
          throw new Error("Escribe cómo se resolvió.");
        item.resolution = p.resolution;
        item.resolved_at = now;
      }
      break;
    case "import_products":
      requireAdmin();
      {
        const rows = p.rows as Record<string, string>[];
        const errors = validateCatalog(rows, next.products);
        if (errors.length) throw new Error(errors[0]);
        for (const r of rows) {
          const barcodes = (r.barcode || "")
            .split("|")
            .map((v) => v.trim())
            .filter(Boolean);
          next.products.push({
            id: uid(),
            sku: r.sku.trim(),
            name: r.name.trim(),
            description: r.description || "",
            brand: r.brand || "",
            category: r.category || "",
            barcode: barcodes[0] || "",
            barcodes,
            supplier_code: r.supplier_code || "",
            serialized: ["true", "1", "si", "sí"].includes(
              (r.serialized || "").toLowerCase(),
            ),
            photo_url: "",
            active: true,
          });
        }
        break;
      }
    case "save_product":
      requireAdmin();
      {
        const value = p as unknown as Product;
        const duplicate = next.products.find(
          (v) =>
            v.id !== value.id &&
            (v.sku.toUpperCase() === value.sku.toUpperCase() ||
              value.barcodes.some(
                (b) => v.barcode === b || v.barcodes.includes(b),
              )),
        );
        if (duplicate) throw new Error("SKU o código duplicado.");
        const old = next.products.find((v) => v.id === value.id);
        if (
          old &&
          old.serialized !== value.serialized &&
          next.session_products.some((v) => v.product_id === old.id)
        )
          throw new Error(
            "No se puede cambiar el control de un producto inventariado.",
          );
        if (old) Object.assign(old, value);
        else next.products.push({ ...value, id: value.id || uid() });
        break;
      }
    case "add_location":
      requireAdmin();
      if (
        next.locations.some(
          (l) => l.name.toLowerCase() === String(p.name).trim().toLowerCase(),
        )
      )
        throw new Error("La ubicación ya existe.");
      next.locations.push({
        id: uid(),
        name: String(p.name).trim(),
        active: true,
      });
      break;
    case "update_profile":
      requireAdmin();
      {
        const target = next.profiles.find((u) => u.id === p.id);
        if (!target) throw new Error("Usuario no encontrado.");
        if (target.id === userId)
          throw new Error("No puedes cambiar tu propio acceso.");
        target.role = p.role as typeof target.role;
        target.active = Boolean(p.active);
        break;
      }
    case "import_expected":
      if (!supervisor || !s || s.status !== "draft")
        throw new Error("Importa existencias en un borrador.");
      {
        next.expected_inventory = next.expected_inventory.filter(
          (v) => v.inventory_session_id !== s!.id,
        );
        next.expected_serials = next.expected_serials.filter(
          (v) => v.inventory_session_id !== s!.id,
        );
        for (const row of p.rows as Record<string, string>[]) {
          const prod = next.products.find((v) => v.sku === row.sku);
          const loc =
            next.locations.find((v) => v.name === row.location) ||
            next.locations.find((v) => v.id === s!.location_id);
          if (!prod || !loc) throw new Error("SKU o ubicación no válida.");
          const q = Number(row.expected_quantity);
          if (!Number.isSafeInteger(q) || q < 0)
            throw new Error("Cantidad esperada inválida.");
          next.expected_inventory.push({
            id: uid(),
            inventory_session_id: s!.id,
            product_id: prod.id,
            location_id: loc.id,
            expected_quantity: q,
          });
          for (const serial of (row.serials || "").split("|").filter(Boolean))
            next.expected_serials.push({
              id: uid(),
              inventory_session_id: s!.id,
              product_id: prod.id,
              location_id: loc.id,
              serial_number: normalizeSerial(serial),
            });
        }
        break;
      }
    default:
      throw new Error("Operación desconocida.");
  }
  next.inventory_audit_log.unshift({
    id: op.id,
    actor_id: userId,
    action: op.type,
    inventory_session_id: s?.id || null,
    created_at: now,
    after_data: p,
  });
  return next;
}
