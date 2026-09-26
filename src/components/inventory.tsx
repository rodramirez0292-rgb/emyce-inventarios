"use client";
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Barcode,
  Check,
  CheckCheck,
  Plus,
  Minus,
  ScanLine,
  Search,
  ShieldCheck,
  AlertTriangle,
  Camera,
  Download,
  RotateCcw,
  ClipboardCheck,
  MapPin,
  Package,
  LockKeyhole,
} from "lucide-react";
import { toast } from "sonner";
import { readSerialDraft, saveSerialDraft } from "@/lib/serial-draft";
import { useStore } from "./store";
import {
  Action,
  ProductCard,
  SearchBox,
  InventoryProgress,
  Status,
  Empty,
  Modal,
  Photo,
  date,
} from "./ui";
import { BarcodeScanner, CameraCapture, feedback } from "./scanner";
import {
  operation,
  progress,
  scopeFor,
  roundFor,
  quantityFor,
  serialsFor,
  normalizeSerial,
  findDuplicate,
  lookupBarcode,
  searchProducts,
  differences,
  validateQuantity,
} from "@/lib/domain";
import { csv, exportRows, exportXlsx } from "@/lib/export";
export function NewInventory() {
  const { data, user, write } = useStore();
  const nav = useNavigate();
  const [query] = useSearchParams();
  const [name, setName] = useState(
      `Inventario ${new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(new Date())}`,
    ),
    [location, setLocation] = useState(
      query.get("location") || data.locations[0]?.id || "",
    ),
    [owner, setOwner] = useState(user!.id);
  const create = async (draft = false) => {
    if (!name.trim() || !location)
      throw new Error("Completa nombre y ubicación.");
    if (!data.products.some((p) => p.active))
      throw new Error("Primero agrega productos al catálogo.");
    const id = crypto.randomUUID();
    await write(
      operation("create_session", {
        id,
        name: name.trim(),
        location_id: location,
        user_id: owner,
        draft,
      }),
    );
    nav(`/inventory/${id}`);
  };
  return (
    <div className="narrow">
      <Link to="/inventory" className="back">
        <ArrowLeft size={17} />
        Inventarios
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">NUEVA SESIÓN</span>
          <h1>Comencemos.</h1>
          <p className="muted">Elige dónde vas a realizar el conteo.</p>
        </div>
      </div>
      <div className="panel form-panel">
        <label>
          Nombre del inventario
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={160}
          />
        </label>
        <fieldset>
          <legend>Ubicación</legend>
          <div className="location-options">
            {data.locations
              .filter((l) => l.active)
              .map((l) => (
                <label className={location === l.id ? "chosen" : ""} key={l.id}>
                  <input
                    type="radio"
                    name="location"
                    value={l.id}
                    checked={location === l.id}
                    onChange={() => setLocation(l.id)}
                  />
                  <MapPin size={20} />
                  <b>{l.name}</b>
                  {location === l.id && <Check size={17} />}
                </label>
              ))}
          </div>
        </fieldset>
        <label>
          Responsable
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            {data.profiles
              .filter(
                (p) =>
                  p.active && (user!.role !== "counter" || p.id === user!.id),
              )
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
          </select>
        </label>
        <div className="notice">
          <ShieldCheck size={20} />
          <span>
            Conteo ciego activado. Cuenta lo que encuentres; las existencias
            esperadas se comparan después.
          </span>
        </div>
        <Action action={() => create()}>
          <ScanLine size={20} />
          Comenzar inventario
        </Action>
        {user!.role !== "counter" && (
          <Action action={() => create(true)} className="btn secondary">
            Preparar borrador para importar existencias
          </Action>
        )}
        <p className="small muted">
          La fecha y hora de inicio se registran automáticamente.
        </p>
      </div>
    </div>
  );
}
export function InventoryPage() {
  const { id } = useParams();
  const { data, user, write } = useStore();
  const nav = useNavigate();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const s = data.inventory_sessions.find((v) => v.id === id);
  if (!s) return <Empty title="Inventario no encontrado" />;
  const p = progress(data, s),
    round = roundFor(s),
    scope = scopeFor(data, s),
    editable = ["counting", "recount"].includes(s.status);
  const items = searchProducts(scope, search).filter(
    (prod) =>
      filter === "all" ||
      (filter === "pending"
        ? quantityFor(data, s.id, prod, round) === null
        : quantityFor(data, s.id, prod, round) !== null),
  );
  return (
    <>
      <Link to="/inventory" className="back">
        <ArrowLeft size={17} />
        Inventarios
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{s.name}</span>
          <h1>{data.locations.find((l) => l.id === s.location_id)?.name}</h1>
        </div>
        <Status s={s} />
      </div>
      {s.status === "draft" ? (
        <div className="panel form-panel">
          <h2>Prepara tu inventario</h2>
          <p className="muted">
            El alcance contiene {scope.length} productos. Puedes importar las
            existencias esperadas antes de comenzar.
          </p>
          {user!.role !== "counter" && (
            <Link className="btn secondary" to={`/imports?session=${s.id}`}>
              Importar existencias esperadas
            </Link>
          )}
          <Action
            action={async () => {
              await write(
                operation("transition", {
                  inventory_session_id: s.id,
                  status: "counting",
                }),
              );
            }}
          >
            <ScanLine size={20} />
            Comenzar conteo ciego
          </Action>
        </div>
      ) : (
        <>
          <section className="panel count-dashboard">
            <div className="section-heading">
              <h2>
                {s.status === "recount"
                  ? "Segundo conteo"
                  : "Avance del inventario"}
              </h2>
              <ShieldCheck size={22} />
            </div>
            <InventoryProgress s={s} />
            <div className="count-stats">
              <div>
                <b>{p.checked}</b>
                <span>Revisados</span>
              </div>
              <div>
                <b>{p.pending}</b>
                <span>Pendientes</span>
              </div>
              <div>
                <b>
                  {
                    data.inventory_serial_units.filter(
                      (u) => u.inventory_session_id === s.id,
                    ).length
                  }
                </b>
                <span>Series</span>
              </div>
              <div>
                <b>
                  {
                    data.unidentified_items.filter(
                      (u) => u.inventory_session_id === s.id && !u.resolved_at,
                    ).length
                  }
                </b>
                <span>Incidencias</span>
              </div>
            </div>
            {editable ? (
              <div className="capture-actions">
                <Link
                  className="btn primary scan-button"
                  to={`/inventory/${s.id}/scan`}
                >
                  <ScanLine size={23} />
                  Escanear producto
                </Link>
                <a className="btn secondary" href="#product-search">
                  <Search size={19} />
                  Buscar producto
                </a>
              </div>
            ) : (
              <Link className="btn primary" to={`/inventory/${s.id}/review`}>
                Ver revisión y resultados
                <ArrowRight size={19} />
              </Link>
            )}
          </section>
          {s.status === "recount" && (
            <div className="notice">
              Sólo aparecen productos con diferencias. Registra nuevamente todas
              sus unidades físicas.
            </div>
          )}
          <div className="section-heading spaced">
            <h2>Productos del inventario</h2>
            <span className="count-badge">{scope.length}</span>
          </div>
          <div className="panel">
            <div className="list-toolbar" id="product-search">
              <SearchBox value={search} onChange={setSearch} />
              <div className="tabs compact">
                {[
                  ["all", "Todos"],
                  ["pending", "Pendientes"],
                  ["checked", "Revisados"],
                ].map(([k, v]) => (
                  <button
                    key={k}
                    className={filter === k ? "selected" : ""}
                    onClick={() => setFilter(k)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            {items.map((prod) => (
              <ProductCard
                key={prod.id}
                p={prod}
                checked={quantityFor(data, s.id, prod, round) !== null}
                to={
                  editable
                    ? `/inventory/${s.id}/product/${prod.id}`
                    : `/inventory/${s.id}/review`
                }
              />
            ))}
            {!items.length && <Empty title="No hay productos para mostrar" />}
          </div>
          {editable && (
            <div className="finish-section">
              <div>
                <h3>
                  {p.pending
                    ? "Sigue así, cada producto cuenta."
                    : "Todos los productos están revisados."}
                </h3>
                <p className="muted">
                  {p.pending
                    ? `Quedan ${p.pending} productos por revisar. Confirma también los que tengan cero unidades.`
                    : "El siguiente paso es revisar las diferencias."}
                </p>
              </div>
              <Action
                className="btn secondary"
                disabled={p.pending > 0}
                action={async () => {
                  await write(
                    operation("transition", {
                      inventory_session_id: s.id,
                      status: "review",
                    }),
                  );
                  nav(`/inventory/${s.id}/review`);
                }}
              >
                <ClipboardCheck size={19} />
                Terminar conteo
              </Action>
            </div>
          )}
        </>
      )}
    </>
  );
}
export function ScanPage() {
  const { id } = useParams();
  const { data, write } = useStore();
  const nav = useNavigate();
  const s = data.inventory_sessions.find((v) => v.id === id);
  const [unknown, setUnknown] = useState(""),
    [notes, setNotes] = useState(""),
    [photo, setPhoto] = useState("");
  if (!s || !["counting", "recount"].includes(s.status))
    return <Empty title="Esta sesión no está en conteo" />;
  if (unknown)
    return (
      <div className="narrow">
        <div className="panel unknown-panel">
          <span className="warning-icon">
            <Package size={35} />
          </span>
          <span className="eyebrow">PRODUCTO NO IDENTIFICADO</span>
          <h1>Vamos a revisarlo.</h1>
          <p className="muted">Código leído</p>
          <code className="code-display">{unknown}</code>
          <Link className="btn primary" to={`/inventory/${s.id}`}>
            Buscar manualmente
          </Link>
          <button className="btn secondary" onClick={() => setUnknown("")}>
            <ScanLine size={19} />
            Escanear otra vez
          </button>
          <hr />
          <h3>Guardar para revisión</h3>
          <label>
            Comentario
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe el producto o el problema…"
            />
          </label>
          <CameraCapture value={photo} onChange={setPhoto} />
          <Action
            className="btn secondary"
            action={async () => {
              await write(
                operation("unknown", {
                  inventory_session_id: s.id,
                  barcode: unknown,
                  notes,
                  photo_url: photo,
                  kind: "unknown",
                }),
              );
              toast.success("Producto enviado a revisión");
              setUnknown("");
              setPhoto("");
              setNotes("");
            }}
          >
            Agregar a revisión y continuar
          </Action>
        </div>
      </div>
    );
  return (
    <BarcodeScanner
      onClose={() => nav(`/inventory/${s.id}`)}
      onRead={(code) => {
        const product = lookupBarcode(scopeFor(data, s), code);
        if (product) nav(`/inventory/${s.id}/product/${product.id}`);
        else {
          feedback(true);
          setUnknown(code);
        }
      }}
    />
  );
}
export function CountProduct() {
  const { id, productId } = useParams();
  const { user, data, repo } = useStore();
  const session = data.inventory_sessions.find((v) => v.id === id);
  const draftKey = `emyce:serial-draft:${repo?.demo ? "demo" : "live"}:${user?.id}:${id}:${productId}:${session ? roundFor(session) : 1}`;
  return <CountProductForm key={draftKey} draftKey={draftKey} />;
}
function CountProductForm({ draftKey }: { draftKey: string }) {
  const { id, productId } = useParams();
  const { data, user, write } = useStore();
  const nav = useNavigate();
  const s = data.inventory_sessions.find((v) => v.id === id),
    p = data.products.find((v) => v.id === productId);
  const [draft] = useState(() => readSerialDraft(draftKey));
  const [quantity, setQuantity] = useState("0"),
    [scan, setScan] = useState(false),
    [candidate, setCandidate] = useState<string | null>(draft.candidate ?? null),
    [originalCode, setOriginalCode] = useState(draft.originalCode ?? ""),
    [photo, setPhoto] = useState(draft.photo ?? ""),
    [notes, setNotes] = useState(draft.notes ?? ""),
    [condition, setCondition] = useState(draft.condition ?? "found"),
    [duplicate, setDuplicate] = useState(""),
    [finish, setFinish] = useState(false);
  useEffect(() => {
    if (!saveSerialDraft(draftKey, { candidate, originalCode, photo, notes, condition }))
      toast.error("No hay espacio para recuperar el borrador si se recarga la página. Guarda la serie antes de salir.");
  }, [draftKey, candidate, originalCode, photo, notes, condition]);
  useEffect(() => {
    if (s && p)
      setQuantity(String(quantityFor(data, s.id, p, roundFor(s)) ?? 0));
  }, [id, productId]);
  if (!s || !p) return <Empty title="Producto no encontrado" />;
  const round = roundFor(s),
    units = serialsFor(data, s.id, p.id, round),
    dupe = findDuplicate(data, s.id, duplicate, round);
  if (
    !["counting", "recount"].includes(s.status) ||
    !scopeFor(data, s).some((v) => v.id === p.id)
  )
    return (
      <Empty title="Este producto no está disponible para conteo">
        <Link className="btn secondary" to={`/inventory/${s.id}`}>
          Volver al inventario
        </Link>
      </Empty>
    );
  const confirm = async () => {
    const serial = normalizeSerial(candidate || "");
    if (!serial) throw new Error("Escribe el número de serie.");
    const duplicateUnit =
      findDuplicate(data, s.id, serial, round) ||
      data.inventory_serial_units.find(
        (u) =>
          u.inventory_session_id === s.id &&
          u.serial_number_normalized === serial &&
          u.product_id !== p.id,
      );
    if (duplicateUnit) {
      feedback(true);
      setDuplicate(serial);
      return;
    }
    try {
      await write(
        operation("serial", {
          inventory_session_id: s.id,
          product_id: p.id,
          serial_number: candidate,
          serial_barcode: originalCode,
          photo_url: photo,
          notes,
          status: condition,
        }),
      );
      feedback();
      toast.success(`Serie ${serial} registrada`);
      setCandidate(null);
      setPhoto("");
      setNotes("");
      setCondition("found");
      setOriginalCode("");
    } catch (e) {
      if (
        e instanceof Error &&
        /registrada|duplicate|unique/i.test(e.message)
      ) {
        feedback(true);
        setDuplicate(serial);
      } else throw e;
    }
  };
  if (scan)
    return (
      <BarcodeScanner
        serial
        onClose={() => setScan(false)}
        onRead={(code) => {
          setScan(false);
          setOriginalCode(code);
          setCandidate(code);
        }}
      />
    );
  return (
    <div className="narrow">
      <Link className="back" to={`/inventory/${s.id}`}>
        <ArrowLeft size={17} />
        Volver al inventario
      </Link>
      <div className="product-heading">
        <Photo path={p.photo_url} name={p.name} />
        <div>
          <span className="eyebrow">
            {p.brand} · {p.sku}
          </span>
          <h1>{p.name}</h1>
          <span className={`type-pill ${p.serialized ? "serialized" : ""}`}>
            {p.serialized ? <Barcode size={15} /> : <Package size={15} />}{" "}
            {p.serialized ? "Equipo serializado" : "Conteo por cantidad"}
          </span>
        </div>
      </div>
      {round === 2 && (
        <div className="notice">
          <RotateCcw size={20} />
          Segundo conteo · Primer conteo:{" "}
          {quantityFor(data, s.id, p, 1) ?? "Sin registro"}
        </div>
      )}
      {p.serialized ? (
        <>
          <section className="panel serial-panel">
            <span className="eyebrow">UNIDADES ENCONTRADAS</span>
            <div className="unit-total">
              {units.length.toString().padStart(2, "0")}
            </div>
            {units.length ? (
              <div className="serial-list">
                {units.map((u) => (
                  <div key={u.id}>
                    <Check size={18} />
                    <code>{u.serial_number_normalized}</code>
                    <span>
                      {u.status === "damaged" ? "Dañado" : "Registrada"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">
                Registra una serie por cada equipo físico.
              </p>
            )}
            <button
              className="btn primary scan-button"
              onClick={() => setScan(true)}
            >
              <ScanLine size={23} />
              {units.length ? "Escanear otra unidad" : "Escanear unidad"}
            </button>
            <button className="btn secondary" onClick={() => setCandidate("")}>
              Escribir serie manualmente
            </button>
          </section>
          <button
            className="btn secondary full"
            onClick={() => setFinish(true)}
          >
            <CheckCheck size={20} />
            Terminar este producto
          </button>
        </>
      ) : (
        <section className="panel quantity-panel">
          <span className="eyebrow">CANTIDAD FÍSICA</span>
          <h2>¿Cuántas unidades hay?</h2>
          <div className="quantity-counter">
            <button
              aria-label="Restar unidad"
              disabled={Number(quantity) <= 0}
              onClick={() =>
                setQuantity(String(Math.max(0, Number(quantity) - 1)))
              }
            >
              <Minus size={25} />
            </button>
            <input
              type="number"
              min="0"
              max="1000000"
              step="1"
              inputMode="numeric"
              value={quantity}
              aria-label="Cantidad física"
              onChange={(e) => setQuantity(e.target.value)}
            />
            <button
              aria-label="Sumar unidad"
              onClick={() => setQuantity(String(Number(quantity) + 1))}
            >
              <Plus size={25} />
            </button>
          </div>
          <p className="muted">También puedes tocar el número y escribir.</p>
          <Action
            action={async () => {
              if (!quantity.trim()) throw new Error("Escribe una cantidad.");
              validateQuantity(p, Number(quantity));
              await write(
                operation("count", {
                  inventory_session_id: s.id,
                  product_id: p.id,
                  quantity: Number(quantity),
                }),
              );
              feedback();
              toast.success("Conteo guardado");
              nav(`/inventory/${s.id}/scan`);
            }}
          >
            <Check size={20} />
            Guardar conteo
          </Action>
        </section>
      )}
      <div className="subtle-note">
        <ShieldCheck size={17} />
        <span>Guardado con tu usuario, ubicación y fecha.</span>
      </div>
      {candidate !== null && !duplicate && (
        <Modal
          title="Confirmar número de serie"
          onClose={() => setCandidate(null)}
        >
          <p className="muted">
            {p.brand} · {p.name}
          </p>
          <label>
            Número de serie
            <input
              autoFocus
              value={candidate}
              onChange={(e) => setCandidate(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={180}
            />
          </label>
          <p className="small muted">
            Se guardará como: <code>{normalizeSerial(candidate) || "—"}</code>
          </p>
          <label>
            Estado del equipo
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
            >
              <option value="found">En buen estado</option>
              <option value="damaged">Dañado</option>
              <option value="unidentified">Requiere identificación</option>
            </select>
          </label>
          <CameraCapture
            value={photo}
            onChange={setPhoto}
            label="Tomar foto de la placa"
          />
          <button
            className="text-button"
            disabled
            title="OCR disponible en una próxima versión"
          >
            <Camera size={17} />
            Leer serie desde foto · Próximamente
          </button>
          <label>
            Notas (opcional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </label>
          <Action action={confirm}>
            <Check size={20} />
            Confirmar serie
          </Action>
        </Modal>
      )}
      {duplicate && (
        <Modal title="Serie ya registrada" onClose={() => setDuplicate("")}>
          <div className="duplicate-alert">
            <AlertTriangle size={42} />
            <h2>SERIE YA REGISTRADA</h2>
            <code>{duplicate}</code>
            <dl>
              <dt>Producto</dt>
              <dd>
                {data.products.find((v) => v.id === dupe?.product_id)?.name ||
                  "Conflicto detectado en el servidor"}
              </dd>
              <dt>Ubicación</dt>
              <dd>
                {data.locations.find((l) => l.id === dupe?.location_id)?.name ||
                  "Consulta la revisión"}
              </dd>
              <dt>Hora</dt>
              <dd>{dupe ? date(dupe.created_at) : "Registro existente"}</dd>
              <dt>Usuario</dt>
              <dd>
                {data.profiles.find((v) => v.id === dupe?.user_id)?.full_name ||
                  dupe?.user_id ||
                  "Usuario autorizado"}
              </dd>
            </dl>
          </div>
          <button
            className="btn secondary full"
            onClick={() => setDuplicate("")}
          >
            Regresar
          </button>
          <Action
            className="btn danger"
            action={async () => {
              await write(
                operation("unknown", {
                  inventory_session_id: s.id,
                  barcode: duplicate,
                  notes: `Intento duplicado al contar ${p.sku} por ${user!.full_name}`,
                  kind: "duplicate_review",
                  photo_url: photo,
                }),
              );
              setDuplicate("");
              setCandidate(null);
              toast.success(
                "Incidencia enviada a revisión. No se creó otra unidad.",
              );
            }}
          >
            Enviar a revisión
          </Action>
        </Modal>
      )}
      {finish && (
        <Modal title="Terminar este producto" onClose={() => setFinish(false)}>
          <h3>{p.name}</h3>
          <p>
            Unidades físicas encontradas: <strong>{units.length}</strong>
          </p>
          {units.length ? (
            <div className="serial-list">
              {units.map((u) => (
                <div key={u.id}>
                  <Check size={17} />
                  <code>{u.serial_number_normalized}</code>
                </div>
              ))}
            </div>
          ) : (
            <div className="notice">
              Confirmarás que no encontraste ninguna unidad de este producto.
            </div>
          )}
          <Action
            action={async () => {
              await write(
                operation("finish_product", {
                  inventory_session_id: s.id,
                  product_id: p.id,
                }),
              );
              toast.success("Producto revisado");
              nav(`/inventory/${s.id}/scan`);
            }}
          >
            Confirmar y continuar
            <ArrowRight size={19} />
          </Action>
        </Modal>
      )}
    </div>
  );
}
export function ReviewPage() {
  const { id } = useParams();
  const { data, user, online, repo, write } = useStore();
  const nav = useNavigate();
  const s = data.inventory_sessions.find((v) => v.id === id);
  const [detail, setDetail] = useState(""),
    [onlyDiff, setOnlyDiff] = useState(false),
    [close, setClose] = useState(false),
    [resolving, setResolving] = useState(""),
    [resolution, setResolution] = useState("");
  if (!s) return <Empty title="Inventario no encontrado" />;
  if (user!.role === "counter")
    return (
      <div className="panel">
        <Empty title="Conteo enviado al supervisor">
          <p>La revisión de diferencias y el cierre requieren un supervisor.</p>
          <Link className="btn primary" to="/dashboard">
            Volver al inicio
          </Link>
        </Empty>
      </div>
    );
  if (!["review", "completed", "recount"].includes(s.status))
    return (
      <Empty title="Termina el conteo para ver los resultados">
        <Link to={`/inventory/${s.id}`}>Volver al conteo</Link>
      </Empty>
    );
  if (!online && !repo?.demo)
    return <Empty title="Conéctate para consultar las existencias esperadas" />;
  const rows = differences(data, s),
    diff = rows.filter((v) => v.hasDifference),
    unknown = data.unidentified_items.filter(
      (v) => v.inventory_session_id === s.id,
    ),
    selected = rows.find((v) => v.product.id === detail),
    noExpected = rows.filter((v) => v.expected === null).length;
  return (
    <>
      <Link className="back" to={`/inventory/${s.id}`}>
        <ArrowLeft size={17} />
        Inventario
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">REVISIÓN DEL SUPERVISOR</span>
          <h1>Resultados del conteo</h1>
          <p className="muted">
            {s.name} ·{" "}
            {data.locations.find((l) => l.id === s.location_id)?.name}
          </p>
        </div>
        <Status s={s} />
      </div>
      <div className="stats-grid three">
        <div className="stat">
          <span>
            Sin diferencias
            <CheckCheck size={20} />
          </span>
          <strong>
            {
              rows.filter(
                (v) =>
                  v.expected !== null &&
                  v.physical !== null &&
                  !v.hasDifference,
              ).length
            }
          </strong>
        </div>
        <div className="stat warn">
          <span>
            Con diferencias
            <AlertTriangle size={20} />
          </span>
          <strong>{diff.length}</strong>
        </div>
        <div className="stat">
          <span>
            Incidencias pendientes
            <Package size={20} />
          </span>
          <strong>{unknown.filter((v) => !v.resolved_at).length}</strong>
        </div>
      </div>
      {noExpected > 0 && (
        <div className="notice">
          {noExpected} productos sin existencias esperadas. Sus cantidades
          físicas se conservarán; no se calcula una diferencia sin referencia.
        </div>
      )}
      <div className="review-actions">
        <div className="inline wrap">
          <Action
            className="btn secondary"
            action={async () => {
              csv(exportRows(data, s).counts, "inventory_counts.csv");
            }}
          >
            <Download size={18} />
            CSV
          </Action>
          <Action
            className="btn secondary"
            action={async () => {
              const rows = exportRows(data, s).serials;
              csv(
                rows.length
                  ? rows
                  : [
                      {
                        SKU: "",
                        Producto: "",
                        Ubicación: "",
                        Serial: "",
                        Estado: "",
                      },
                    ],
                "inventory_serials.csv",
              );
            }}
          >
            Series CSV
          </Action>
          <Action className="btn secondary" action={() => exportXlsx(data, s)}>
            Excel
          </Action>
        </div>
        {s.status === "review" && (
          <div className="inline wrap">
            <Action
              className="btn secondary"
              disabled={
                !diff.length ||
                data.product_checks.some(
                  (v) =>
                    v.inventory_session_id === s.id && v.count_number === 2,
                )
              }
              action={async () => {
                await write(
                  operation("transition", {
                    inventory_session_id: s.id,
                    status: "recount",
                  }),
                );
                nav(`/inventory/${s.id}/recount`);
              }}
            >
              <RotateCcw size={18} />
              Hacer reconteo
            </Action>
            <button
              className="btn primary"
              disabled={unknown.some((v) => !v.resolved_at)}
              onClick={() => setClose(true)}
            >
              <LockKeyhole size={17} />
              Cerrar inventario
            </button>
          </div>
        )}
      </div>
      <div className="panel">
        <div className="section-heading padded">
          <h2>Comparación de productos</h2>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={onlyDiff}
              onChange={(e) => setOnlyDiff(e.target.checked)}
            />
            Sólo diferencias
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Sistema</th>
                <th>Físico</th>
                <th>Diferencia</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((v) => !onlyDiff || v.hasDifference)
                .map((d) => (
                  <tr key={d.product.id}>
                    <td>
                      <b>{d.product.name}</b>
                      <small>
                        {d.product.sku}
                        {d.round === 2 ? " · Segundo conteo" : ""}
                      </small>
                    </td>
                    <td>{d.expected ?? "—"}</td>
                    <td>{d.physical ?? "Pendiente"}</td>
                    <td>
                      <span className={d.hasDifference ? "delta bad" : "delta"}>
                        {d.delta === null
                          ? "Sin referencia"
                          : d.delta > 0
                            ? `+${d.delta}`
                            : d.delta}
                        {d.product.serialized &&
                        d.hasDifference &&
                        d.delta === 0
                          ? " · Series distintas"
                          : ""}
                      </span>
                    </td>
                    <td>
                      {d.product.serialized ? (
                        <button
                          className="text-button"
                          onClick={() => setDetail(d.product.id)}
                        >
                          Ver series
                          <ArrowRight size={15} />
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="section-heading spaced">
        <h2>Incidencias para revisión</h2>
        <span className="count-badge">{unknown.length}</span>
      </div>
      <div className="panel">
        {unknown.length ? (
          unknown.map((u) => (
            <div className="issue-row" key={u.id}>
              <Photo
                path={String(u.photo_url || "")}
                name="Foto de incidencia"
              />
              <div>
                <b>{String(u.barcode || "Sin código")}</b>
                <p>{String(u.notes)}</p>
                <small>
                  {u.resolved_at
                    ? `Resuelta: ${u.resolution}`
                    : date(String(u.created_at))}
                </small>
              </div>
              {!u.resolved_at && s.status !== "completed" && (
                <button
                  className="btn secondary"
                  onClick={() => {
                    setResolving(u.id);
                    setResolution("");
                  }}
                >
                  Resolver
                </button>
              )}
            </div>
          ))
        ) : (
          <Empty title="No hay incidencias registradas" />
        )}
      </div>
      <details className="panel audit-panel">
        <summary>Historial de cambios</summary>
        {data.inventory_audit_log
          .filter((v) => v.inventory_session_id === s.id)
          .slice(0, 50)
          .map((a) => (
            <div className="audit-row" key={a.id}>
              <span>{String(a.action)}</span>
              <span>
                {data.profiles.find((p) => p.id === a.actor_id)?.full_name ||
                  "Sistema"}
              </span>
              <small>{date(String(a.created_at))}</small>
            </div>
          ))}
      </details>
      {selected && (
        <Modal title={selected.product.name} onClose={() => setDetail("")}>
          <div className="serial-comparison">
            <div>
              <h3>Series esperadas</h3>
              {selected.expectedSerials.length ? (
                selected.expectedSerials.map((v) => (
                  <div
                    className={
                      selected.missing.includes(v) ? "missing" : "matched"
                    }
                    key={v}
                  >
                    {selected.missing.includes(v) ? "✕" : "✓"} <code>{v}</code>
                    {selected.missing.includes(v) && <small>Faltante</small>}
                  </div>
                ))
              ) : (
                <p className="muted">Sin series de referencia</p>
              )}
            </div>
            <div>
              <h3>Series encontradas</h3>
              {selected.actual.map((v) => {
                const moved = data.expected_serials.find(
                  (e) =>
                    e.inventory_session_id === s.id &&
                    normalizeSerial(String(e.serial_number)) === v &&
                    e.location_id !== s.location_id,
                );
                return (
                  <div
                    className={selected.extra.includes(v) ? "extra" : "matched"}
                    key={v}
                  >
                    <code>{v}</code>
                    {selected.extra.includes(v) && (
                      <small>
                        {moved
                          ? `Posible equipo movido desde ${data.locations.find((l) => l.id === moved.location_id)?.name}. Revisar; sin ajuste automático.`
                          : "Sobrante / serie no registrada"}
                      </small>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
      {close && (
        <Modal title="Cerrar inventario" onClose={() => setClose(false)}>
          <p>
            Se conservarán los dos conteos, las series y el historial. Después
            del cierre no podrás modificar esta sesión.
          </p>
          {diff.length > 0 && (
            <div className="notice">
              El reporte conservará {diff.length} productos con diferencias
              pendientes de decisión operativa. No se ajustará ningún sistema
              automáticamente.
            </div>
          )}
          <Action
            action={async () => {
              await write(
                operation("transition", {
                  inventory_session_id: s.id,
                  status: "completed",
                }),
              );
              setClose(false);
              toast.success("Inventario finalizado");
            }}
          >
            <CheckCheck size={20} />
            Confirmar cierre
          </Action>
        </Modal>
      )}
      {resolving && (
        <Modal title="Resolver incidencia" onClose={() => setResolving("")}>
          <label>
            Describe la resolución
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Qué verificaste y cuál fue el resultado…"
            />
          </label>
          <Action
            action={async () => {
              if (!resolution.trim())
                throw new Error("Describe la resolución.");
              await write(
                operation("resolve", {
                  inventory_session_id: s.id,
                  id: resolving,
                  resolution,
                }),
              );
              setResolving("");
            }}
          >
            Guardar resolución
          </Action>
        </Modal>
      )}
    </>
  );
}
