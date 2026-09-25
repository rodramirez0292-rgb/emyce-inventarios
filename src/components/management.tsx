"use client";
import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import Papa from "papaparse";
import {
  Plus,
  Upload,
  ArrowLeft,
  ArrowRight,
  Download,
  MapPin,
  Users,
  Check,
  FileSpreadsheet,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "./store";
import {
  Action,
  SearchBox,
  ProductCard,
  Empty,
  Modal,
  Photo,
  date,
} from "./ui";
import { CameraCapture } from "./scanner";
import {
  Product,
  searchProducts,
  operation,
  validateCatalog,
  normalizeSerial,
} from "@/lib/domain";
import { download } from "@/lib/export";
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useStore();
  return user?.role === "admin" ? (
    children
  ) : (
    <Empty title="Esta sección requiere un administrador" />
  );
}
const blankProduct = (): Product => ({
  id: crypto.randomUUID(),
  sku: "",
  name: "",
  brand: "",
  category: "",
  description: "",
  barcode: "",
  barcodes: [],
  supplier_code: "",
  serialized: false,
  photo_url: "",
  active: true,
});
function ProductForm({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { repo, write } = useStore();
  const [p, setP] = useState(product),
    [codes, setCodes] = useState(
      [...new Set([product.barcode, ...product.barcodes].filter(Boolean))].join(
        "\n",
      ),
    ),
    [photo, setPhoto] = useState("");
  const change = (field: keyof Product, value: string | boolean) =>
    setP({ ...p, [field]: value });
  return (
    <Modal
      title={product.name ? "Editar producto" : "Nuevo producto"}
      onClose={onClose}
    >
      <div className="form-grid">
        <label>
          SKU
          <input
            value={p.sku}
            onChange={(e) => change("sku", e.target.value)}
          />
        </label>
        <label>
          Marca
          <input
            value={p.brand}
            onChange={(e) => change("brand", e.target.value)}
          />
        </label>
      </div>
      <label>
        Nombre
        <input
          value={p.name}
          onChange={(e) => change("name", e.target.value)}
        />
      </label>
      <label>
        Descripción
        <textarea
          rows={2}
          value={p.description}
          onChange={(e) => change("description", e.target.value)}
        />
      </label>
      <div className="form-grid">
        <label>
          Categoría
          <input
            value={p.category}
            onChange={(e) => change("category", e.target.value)}
          />
        </label>
        <label>
          Código del proveedor
          <input
            value={p.supplier_code}
            onChange={(e) => change("supplier_code", e.target.value)}
          />
        </label>
      </div>
      <label>
        Códigos de barras · uno por línea
        <textarea
          value={codes}
          onChange={(e) => setCodes(e.target.value)}
          rows={3}
        />
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={p.serialized}
          onChange={(e) => change("serialized", e.target.checked)}
        />
        Registrar cada unidad por número de serie
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={p.active}
          onChange={(e) => change("active", e.target.checked)}
        />
        Producto activo
      </label>
      <CameraCapture
        value={photo}
        onChange={setPhoto}
        label="Fotografiar producto"
      />
      <Action
        action={async () => {
          if (!p.sku.trim() || !p.name.trim())
            throw new Error("SKU y nombre son obligatorios.");
          const barcodes = [
            ...new Set(
              codes
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean),
            ),
          ];
          const photo_url = photo
            ? await repo!.photo(photo, "products")
            : p.photo_url;
          await write(
            operation("save_product", {
              ...p,
              sku: p.sku.trim(),
              name: p.name.trim(),
              barcodes,
              barcode: barcodes[0] || "",
              photo_url,
            }),
          );
          onClose();
          toast.success("Producto guardado");
        }}
      >
        <Check size={18} />
        Guardar producto
      </Action>
    </Modal>
  );
}
export function Products() {
  const { data, user } = useStore();
  const [query, setQuery] = useState(""),
    [type, setType] = useState("all"),
    [add, setAdd] = useState(false);
  const list = searchProducts(
    data.products.filter((p) => (type === "inactive" ? !p.active : p.active)),
    query,
  ).filter(
    (p) =>
      type === "all" ||
      type === "inactive" ||
      (type === "serial" ? p.serialized : !p.serialized),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CATÁLOGO EMYCE</span>
          <h1>Productos</h1>
          <p className="muted">
            {data.products.filter((p) => p.active).length} productos activos ·{" "}
            {data.products.filter((p) => p.active && p.serialized).length}{" "}
            serializados
          </p>
        </div>
        {user!.role === "admin" && (
          <div className="inline">
            <Link to="/imports" className="btn secondary">
              <Upload size={18} />
              Importar
            </Link>
            <button className="btn primary" onClick={() => setAdd(true)}>
              <Plus size={18} />
              Nuevo producto
            </button>
          </div>
        )}
      </div>
      <div className="panel">
        <div className="list-toolbar">
          <SearchBox value={query} onChange={setQuery} />
          <div className="tabs compact">
            {[
              ["all", "Todos"],
              ["serial", "Con serie"],
              ["quantity", "Por cantidad"],
              ...(user!.role === "admin" ? [["inactive", "Inactivos"]] : []),
            ].map(([k, v]) => (
              <button
                className={type === k ? "selected" : ""}
                key={k}
                onClick={() => setType(k)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        {list.map((p) => (
          <ProductCard p={p} to={`/products/${p.id}`} key={p.id} />
        ))}
        {!list.length && <Empty title="No encontramos productos" />}
      </div>
      {add && (
        <ProductForm product={blankProduct()} onClose={() => setAdd(false)} />
      )}
    </>
  );
}
export function ProductDetail() {
  const { id } = useParams();
  const { data, user } = useStore();
  const [edit, setEdit] = useState(false),
    [serial, setSerial] = useState("");
  const p = data.products.find((v) => v.id === id);
  if (!p) return <Empty title="Producto no encontrado" />;
  const history = data.inventory_serial_units.filter(
    (u) =>
      u.product_id === p.id &&
      (!serial || u.serial_number_normalized.includes(normalizeSerial(serial))),
  );
  return (
    <div className="narrow">
      <Link to="/products" className="back">
        <ArrowLeft size={17} />
        Productos
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {p.brand} · {p.sku}
          </span>
          <h1>{p.name}</h1>
        </div>
        {user!.role === "admin" && (
          <button className="btn secondary" onClick={() => setEdit(true)}>
            Editar
          </button>
        )}
      </div>
      <div className="panel form-panel">
        <Photo path={p.photo_url} name={p.name} />
        <p>{p.description || "Sin descripción adicional."}</p>
        <dl className="detail-grid">
          <dt>Control</dt>
          <dd>{p.serialized ? "Por número de serie" : "Por cantidad"}</dd>
          <dt>Categoría</dt>
          <dd>{p.category || "—"}</dd>
          <dt>Código proveedor</dt>
          <dd>{p.supplier_code || "—"}</dd>
          <dt>Códigos de barras</dt>
          <dd>
            {[...new Set([p.barcode, ...p.barcodes].filter(Boolean))].map(
              (b) => (
                <code className="code-tag" key={b}>
                  {b}
                </code>
              ),
            )}
          </dd>
        </dl>
      </div>
      {p.serialized && (
        <>
          <div className="section-heading spaced">
            <h2>Historial de series</h2>
          </div>
          <SearchBox
            value={serial}
            onChange={setSerial}
            placeholder="Buscar número de serie…"
          />
          <div className="panel">
            {history.length ? (
              history.map((u) => (
                <Link
                  className="history-row"
                  key={u.id}
                  to={`/inventory/${u.inventory_session_id}`}
                >
                  <div>
                    <code>{u.serial_number_normalized}</code>
                    <small>
                      {
                        data.inventory_sessions.find(
                          (s) => s.id === u.inventory_session_id,
                        )?.name
                      }
                    </small>
                  </div>
                  <div>
                    <b>
                      {data.locations.find((l) => l.id === u.location_id)?.name}
                    </b>
                    <small>{date(u.created_at)}</small>
                  </div>
                  <ArrowRight size={17} />
                </Link>
              ))
            ) : (
              <Empty title="Sin registros de esta serie" />
            )}
          </div>
        </>
      )}
      {edit && <ProductForm product={p} onClose={() => setEdit(false)} />}
    </div>
  );
}
export function Imports() {
  const { data, user, write } = useStore();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [mode, setMode] = useState(
      params.has("session") ? "expected" : "catalog",
    ),
    [session, setSession] = useState(params.get("session") || ""),
    [rows, setRows] = useState<Record<string, string>[]>([]),
    [errors, setErrors] = useState<string[]>([]),
    [fileName, setFileName] = useState("");
  const allowed =
    user!.role === "admin" ||
    (mode === "expected" && user!.role === "supervisor");
  const template = () => {
    download(
      mode === "catalog"
        ? "sku,name,description,brand,category,barcode,supplier_code,serialized\nACC-TEST,Accesorio de prueba,Repuesto,EMYCE,Accesorios,DEMO-ACC-TEST,PROV-ACC,false\n"
        : "sku,location,expected_quantity,serials\nCHC-110,Almacén,2,CHC110-001|CHC110-002\nACC-X,Almacén,8,\n",
      mode === "catalog"
        ? "plantilla_productos.csv"
        : "plantilla_existencias.csv",
      "text/csv;charset=utf-8",
    );
  };
  const parse = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El CSV debe pesar menos de 5 MB.");
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().replace(/^\uFEFF/, ""),
      complete: (result) => {
        const found = result.errors.map(
          (e) => `Fila ${(e.row ?? 0) + 2}: ${e.message}`,
        );
        if (!result.data.length) found.push("El archivo está vacío.");
        if (result.data.length > 2000)
          found.push("Usa un máximo de 2,000 filas por archivo.");
        if (mode === "catalog")
          found.push(...validateCatalog(result.data, data.products));
        else {
          const seen = new Set<string>(),
            serials = new Set<string>();
          result.data.forEach((r, i) => {
            const p = data.products.find((v) => v.sku === r.sku);
            if (!p) found.push(`Fila ${i + 2}: SKU no encontrado.`);
            if (
              r.location &&
              !data.locations.some((l) => l.name === r.location)
            )
              found.push(`Fila ${i + 2}: ubicación no encontrada.`);
            if (!/^\d+$/.test(r.expected_quantity || ""))
              found.push(`Fila ${i + 2}: cantidad entera requerida.`);
            const key = `${r.sku}:${r.location}`;
            if (seen.has(key))
              found.push(`Fila ${i + 2}: producto/ubicación duplicado.`);
            seen.add(key);
            const values = (r.serials || "")
              .split("|")
              .filter(Boolean)
              .map(normalizeSerial);
            if (p?.serialized && values.length !== Number(r.expected_quantity))
              found.push(
                `Fila ${i + 2}: cantidad y número de series no coinciden.`,
              );
            for (const serial of values) {
              if (!serial || serials.has(serial))
                found.push(`Fila ${i + 2}: serie vacía o duplicada.`);
              serials.add(serial);
            }
          });
        }
        setRows(result.data);
        setErrors(found);
        setFileName(file.name);
      },
      error: (e) => toast.error(e.message),
    });
  };
  if (!allowed)
    return <Empty title="Se requiere administrador para importar catálogo" />;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DATOS DEL INVENTARIO</span>
          <h1>Importaciones</h1>
          <p className="muted">Revisa tus datos antes de incorporarlos.</p>
        </div>
      </div>
      <div className="tabs">
        {user!.role === "admin" && (
          <button
            className={mode === "catalog" ? "selected" : ""}
            onClick={() => {
              setMode("catalog");
              setRows([]);
              setErrors([]);
            }}
          >
            Catálogo de productos
          </button>
        )}
        <button
          className={mode === "expected" ? "selected" : ""}
          onClick={() => {
            setMode("expected");
            setRows([]);
            setErrors([]);
          }}
        >
          Existencias esperadas
        </button>
      </div>
      <div className="panel form-panel">
        {mode === "expected" && (
          <>
            <label>
              Inventario en borrador
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
              >
                <option value="">Selecciona un inventario</option>
                {data.inventory_sessions
                  .filter((s) => s.status === "draft")
                  .map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name} ·{" "}
                      {data.locations.find((l) => l.id === s.location_id)?.name}
                    </option>
                  ))}
              </select>
            </label>
            <p className="muted">
              La importación reemplazará la referencia de este borrador. Usa |
              para separar series. También puedes incluir otras ubicaciones para
              detectar posibles movimientos.
            </p>
          </>
        )}
        <label className="dropzone">
          <span className="file-icon">
            <FileSpreadsheet size={34} />
          </span>
          <b>Selecciona tu archivo CSV</b>
          <span>{fileName || "Hasta 2,000 filas · 5 MB máximo"}</span>
          <input
            aria-label="Importar archivo CSV"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              if (e.target.files?.[0]) parse(e.target.files[0]);
            }}
          />
        </label>
        <button className="text-button" onClick={template}>
          <Download size={17} />
          Descargar plantilla CSV
        </button>
        {mode === "catalog" && (
          <p className="small muted">
            Campos: sku, name, description, brand, category, barcode,
            supplier_code, serialized. Separa códigos alternativos con |.
          </p>
        )}
      </div>
      {rows.length > 0 && (
        <>
          <div className="section-heading spaced">
            <h2>Vista previa · {rows.length} filas</h2>
            {!errors.length && (
              <span className="status completed">
                <Check size={15} />
                Validación correcta
              </span>
            )}
          </div>
          {errors.length > 0 && (
            <div className="error-box">
              {errors.slice(0, 20).map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  {Object.keys(rows[0]).map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i}>
                    {Object.values(r).map((v, n) => (
                      <td key={n}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">Se muestran las primeras 20 filas.</p>
          <Action
            disabled={errors.length > 0 || (mode === "expected" && !session)}
            action={async () => {
              await write(
                operation(
                  mode === "catalog" ? "import_products" : "import_expected",
                  {
                    rows,
                    ...(mode === "expected"
                      ? { inventory_session_id: session }
                      : {}),
                  },
                ),
              );
              toast.success("Importación completada");
              setRows([]);
              setFileName("");
              if (mode === "expected") nav(`/inventory/${session}`);
            }}
          >
            <Upload size={19} />
            Confirmar importación de {rows.length} filas
          </Action>
        </>
      )}
    </>
  );
}
export function Locations() {
  const { data, write } = useStore();
  const [name, setName] = useState("");
  return (
    <AdminOnly>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN</span>
          <h1>Ubicaciones</h1>
        </div>
      </div>
      <div className="location-cards">
        {data.locations.map((l) => (
          <div className="panel location-card" key={l.id}>
            <MapPin size={27} />
            <h2>{l.name}</h2>
            <p className="muted">
              {
                data.inventory_sessions.filter((s) => s.location_id === l.id)
                  .length
              }{" "}
              inventarios registrados
            </p>
          </div>
        ))}
      </div>
      <div className="panel form-panel narrow">
        <h2>Agregar ubicación</h2>
        <label>
          Nombre
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nueva ubicación"
          />
        </label>
        <Action
          action={async () => {
            if (!name.trim()) throw new Error("Escribe el nombre.");
            await write(operation("add_location", { name: name.trim() }));
            setName("");
            toast.success("Ubicación agregada");
          }}
        >
          <Plus size={19} />
          Agregar ubicación
        </Action>
      </div>
    </AdminOnly>
  );
}
export function UsersPage() {
  const { data, repo, user, write } = useStore();
  return (
    <AdminOnly>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN</span>
          <h1>Equipo</h1>
          <p className="muted">Activa cuentas y asigna responsabilidades.</p>
        </div>
      </div>
      <div className="notice">
        <ShieldCheck size={20} />
        <span>
          {repo?.demo
            ? "El modo demo utiliza una cuenta local de administrador."
            : "Los nuevos usuarios solicitan una cuenta en la pantalla de acceso y confirman su correo. Aparecerán aquí inactivos hasta tu autorización."}
        </span>
      </div>
      <div className="panel">
        {data.profiles.map((p) => (
          <UserRow
            key={p.id}
            p={p}
            own={p.id === user!.id}
            save={async (role, active) => {
              await write(
                operation("update_profile", { id: p.id, role, active }),
              );
              toast.success("Acceso actualizado");
            }}
          />
        ))}
      </div>
    </AdminOnly>
  );
}
function UserRow({
  p,
  own,
  save,
}: {
  p: { full_name: string; role: string; active: boolean };
  own: boolean;
  save: (role: string, active: boolean) => Promise<void>;
}) {
  const [role, setRole] = useState(p.role),
    [active, setActive] = useState(p.active);
  return (
    <div className="user-row">
      <span className="user-icon">
        <Users size={22} />
      </span>
      <b>
        {p.full_name}
        {own ? " (tú)" : ""}
      </b>
      <select
        aria-label={`Rol de ${p.full_name}`}
        value={role}
        disabled={own}
        onChange={(e) => setRole(e.target.value)}
      >
        <option value="counter">Contador</option>
        <option value="supervisor">Supervisor</option>
        <option value="admin">Administrador</option>
      </select>
      <label className="checkbox-label">
        <input
          disabled={own}
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Activo
      </label>
      <Action
        className="btn secondary"
        disabled={own || (role === p.role && active === p.active)}
        action={() => save(role, active)}
      >
        Guardar
      </Action>
    </div>
  );
}
