"use client";
import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Upload,
  MapPin,
  Users,
  LogOut,
  WifiOff,
  Wifi,
  ScanLine,
  ArrowRight,
  Plus,
  ShieldCheck,
  ChevronRight,
  Warehouse,
  Settings2,
  Volume2,
  RefreshCw,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { Provider, useStore } from "./store";
import { Action, Empty, InventoryProgress, Status, date } from "./ui";
import { configured, supabase } from "@/lib/repository";
import { progress } from "@/lib/domain";
import {
  NewInventory,
  InventoryPage,
  ScanPage,
  CountProduct,
  ReviewPage,
} from "./inventory";
import {
  Products,
  ProductDetail,
  Imports,
  Locations,
  UsersPage,
} from "./management";
function Login() {
  const { enterDemo, repo, user, loading, logout } = useStore();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [register, setRegister] = useState(false);
  const nav = useNavigate();
  if (loading) return <div className="boot">Abriendo tu espacio…</div>;
  if (user?.active) return <Navigate to="/dashboard" replace />;
  return (
    <div className="login-page">
      <div className="login-brand">
        <Link to="/login" className="wordmark">
          EMYCE<span>•</span>
        </Link>
        <span>INVENTARIOS</span>
        <div className="login-statement">
          <span className="outline-icon">
            <ScanLine size={42} />
          </span>
          <h1>
            Cada equipo.
            <br />
            Cada unidad.
            <br />
            <em>Todo en su lugar.</em>
          </h1>
          <p>El control de tu inventario comienza con un buen conteo.</p>
        </div>
        <small>TIENDA · ALMACÉN · BODEGA</small>
      </div>
      <main className="login-form">
        <span className="eyebrow">CONTROL DE INVENTARIOS</span>
        <h2>
          {repo
            ? "Acceso pendiente"
            : register
              ? "Solicitar acceso"
              : "Bienvenido a EMYCE"}
        </h2>
        <p className="muted">
          {repo
            ? "Un administrador debe activar tu cuenta."
            : "Inicia sesión para comenzar tu jornada."}
        </p>
        {repo ? (
          <Action action={logout} className="btn secondary">
            Volver al inicio
          </Action>
        ) : (
          <form onSubmit={(e) => e.preventDefault()}>
            {register && (
              <label>
                Nombre completo
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Correo electrónico
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                autoComplete="username"
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete={register ? "new-password" : "current-password"}
              />
            </label>
            <Action
              disabled={
                !configured ||
                !email ||
                password.length < 8 ||
                (register && !name.trim())
              }
              action={async () => {
                if (!supabase) return;
                localStorage.removeItem("emyce-mode");
                const result = register
                  ? await supabase.auth.signUp({
                      email,
                      password,
                      options: { data: { full_name: name } },
                    })
                  : await supabase.auth.signInWithPassword({ email, password });
                if (result.error) throw result.error;
                if (register)
                  toast.success(
                    "Revisa tu correo para confirmar. Después solicita la activación a tu administrador.",
                  );
                else nav("/dashboard");
              }}
            >
              {register ? "Crear cuenta" : "Iniciar sesión"}
              <ArrowRight size={18} />
            </Action>
            {configured && (
              <button
                type="button"
                className="text-button"
                onClick={() => setRegister(!register)}
              >
                {register ? "Ya tengo una cuenta" : "Solicitar una cuenta"}
              </button>
            )}
          </form>
        )}
        {!configured && (
          <div className="notice">
            El acceso de tu empresa estará disponible al conectar Supabase.
            Puedes probar todos los flujos con el catálogo de demostración.
          </div>
        )}
        {process.env.NEXT_PUBLIC_ENABLE_DEMO !== "false" && (
          <div className="demo-login">
            <span>EXPLORA ANTES DE COMENZAR</span>
            <Action
              className="btn secondary"
              action={async () => {
                await enterDemo();
                nav("/dashboard");
              }}
            >
              Probar con datos de ejemplo <ArrowRight size={18} />
            </Action>
            <p>Datos ficticios, guardados sólo en este dispositivo.</p>
          </div>
        )}
      </main>
    </div>
  );
}
function Shell() {
  const { user, repo, loading, error, online, pending, sync, logout, refresh } =
    useStore();
  const loc = useLocation(),
    nav = useNavigate();
  const [settings, setSettings] = useState(false),
    [sound, setSound] = useState(false);
  useEffect(() => {
    setSound(localStorage.getItem("emyce-sound") === "on");
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    setSettings(false);
  }, [loc.pathname]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => Promise<void> | void;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "start_inventory_creation",
            description:
              "Abre el formulario visible para preparar un nuevo inventario; no crea registros.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute: async (input: unknown) => {
              if (
                !input ||
                typeof input !== "object" ||
                Object.keys(input).length
              )
                throw new Error("Se requiere un objeto vacío.");
              if (!user?.active) throw new Error("Inicia sesión.");
              nav("/inventory/new");
              return { opened: "/inventory/new" };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [nav, user?.active]);
  if (loc.pathname === "/login") return <Login />;
  if (loading)
    return (
      <div className="boot">
        <b>
          EMYCE<span>•</span>
        </b>
        <p>Cargando tu inventario…</p>
      </div>
    );
  if (error)
    return (
      <div className="boot">
        <h2>No pudimos cargar tus datos</h2>
        <p>{error}</p>
        <Action action={refresh}>Volver a intentar</Action>
        <Link to="/login">Ir al acceso</Link>
      </div>
    );
  if (!user?.active) return <Navigate to="/login" replace />;
  const links = [
    { to: "/dashboard", label: "Inicio", icon: LayoutDashboard },
    { to: "/inventory", label: "Inventarios", icon: ClipboardList },
    { to: "/products", label: "Productos", icon: Package },
  ];
  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/dashboard" className="wordmark">
          EMYCE<span>•</span>
        </Link>
        <div className="sidebar-caption">CONTROL DE INVENTARIOS</div>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to}>
              <l.icon size={21} />
              {l.label}
            </NavLink>
          ))}
          {user.role === "admin" && (
            <NavLink to="/imports">
              <Upload size={21} />
              Importaciones
            </NavLink>
          )}
          <span className="nav-label">ADMINISTRACIÓN</span>
          {user.role === "admin" && (
            <>
              <NavLink to="/settings/locations">
                <MapPin size={20} />
                Ubicaciones
              </NavLink>
              <NavLink to="/admin/users">
                <Users size={20} />
                Equipo
              </NavLink>
            </>
          )}
          <button onClick={() => setSettings(!settings)}>
            <Settings2 size={20} />
            Preferencias
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar">
            {user.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <strong>{user.full_name}</strong>
            <small>
              {
                {
                  admin: "Administrador",
                  supervisor: "Supervisor",
                  counter: "Contador",
                }[user.role]
              }
            </small>
          </div>
          <Action
            className="icon-button"
            action={async () => {
              await logout();
              nav("/login");
            }}
          >
            <LogOut size={18} />
            <span className="sr-only">Cerrar sesión</span>
          </Action>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            Espacio de trabajo <ChevronRight size={14} />{" "}
            <b>EMYCE Inventarios</b>
          </span>
          <Link className="mobile-logo" to="/dashboard">
            EMYCE<span>•</span>
          </Link>
          <div className="topbar-right">
            {repo?.demo && <span className="demo-pill">Modo demo</span>}
            <span className={`connection ${online ? "" : "offline"}`}>
              {online ? <Wifi size={15} /> : <WifiOff size={15} />}
              <span>{online ? "Online" : "Sin conexión"}</span>
            </span>
            <button
              className="mobile-settings icon-button"
              aria-label="Preferencias"
              onClick={() => setSettings(!settings)}
            >
              <Settings2 size={19} />
            </button>
          </div>
        </header>
        {repo?.demo && (
          <div className="demo-banner">
            <ShieldCheck size={15} />
            <span>
              Espacio de prueba · Los datos se guardan sólo en este dispositivo.
            </span>
          </div>
        )}
        {pending.length > 0 && (
          <div className="sync-banner">
            <span>
              {pending.length} registros pendientes de sincronizar
              {pending[0].error && ` · ${pending[0].error}`}
            </span>
            <Action className="text-button" action={sync}>
              <RefreshCw size={16} />
              Sincronizar
            </Action>
            {pending[0].error && (
              <Action
                className="text-button"
                action={async () => {
                  await repo!.resolvePending(pending[0].op.id);
                  await sync();
                }}
              >
                Enviar conflicto a revisión
              </Action>
            )}
          </div>
        )}
        {settings && (
          <div className="preferences panel">
            <h3>Preferencias</h3>
            {user.role === "admin" && (
              <div className="inline wrap">
                <Link className="btn secondary" to="/settings/locations">
                  <MapPin size={17} />
                  Ubicaciones
                </Link>
                <Link className="btn secondary" to="/admin/users">
                  <Users size={17} />
                  Equipo
                </Link>
              </div>
            )}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={sound}
                onChange={(e) => {
                  setSound(e.target.checked);
                  localStorage.setItem(
                    "emyce-sound",
                    e.target.checked ? "on" : "off",
                  );
                }}
              />
              <Volume2 size={18} /> Sonido al escanear
            </label>
            <p className="muted">
              Para instalar: abre el menú de tu navegador y elige “Añadir a
              pantalla de inicio”. En iPhone está en Compartir.
            </p>
            <Action
              className="btn secondary"
              action={async () => {
                await logout();
                nav("/login");
              }}
            >
              Cerrar sesión
            </Action>
          </div>
        )}
        <main className="main-content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inventory" element={<InventoryList />} />
            <Route path="/inventory/new" element={<NewInventory />} />
            <Route path="/inventory/:id" element={<InventoryPage />} />
            <Route path="/inventory/:id/scan" element={<ScanPage />} />
            <Route
              path="/inventory/:id/product/:productId"
              element={<CountProduct />}
            />
            <Route path="/inventory/:id/review" element={<ReviewPage />} />
            <Route path="/inventory/:id/recount" element={<InventoryPage />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/imports" element={<Imports />} />
            <Route path="/settings/locations" element={<Locations />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
        <nav className="bottom-nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to}>
              <l.icon size={22} />
              <span>{l.label}</span>
            </NavLink>
          ))}
          {user.role === "admin" && (
            <NavLink to="/imports">
              <Upload size={22} />
              <span>Importar</span>
            </NavLink>
          )}
        </nav>
      </div>
    </div>
  );
}
function Dashboard() {
  const { data, user } = useStore();
  const sessions = data.inventory_sessions,
    active = sessions.filter((s) => s.status !== "completed"),
    latest = active[0];
  const totalSerials = data.inventory_serial_units.length;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TU ESPACIO DE TRABAJO</span>
          <h1>
            Hola, {user?.full_name.split(" ")[0]}
            <span className="heading-dot">.</span>
          </h1>
          <p className="muted">Todo listo para un conteo preciso.</p>
        </div>
        <Link className="btn primary" to="/inventory/new">
          <Plus size={20} />
          Nuevo inventario
        </Link>
      </div>
      <div className="stats-grid">
        <div className="stat">
          <span>
            Inventarios activos <ClipboardList size={19} />
          </span>
          <strong>{active.length.toString().padStart(2, "0")}</strong>
          <small>En proceso de conteo y revisión</small>
        </div>
        <div className="stat">
          <span>
            Productos en catálogo <Package size={19} />
          </span>
          <strong>
            {data.products
              .filter((p) => p.active)
              .length.toString()
              .padStart(2, "0")}
          </strong>
          <small>
            {data.products.filter((p) => p.serialized && p.active).length} con
            número de serie
          </small>
        </div>
        <div className="stat">
          <span>
            Ubicaciones <Warehouse size={19} />
          </span>
          <strong>
            {data.locations
              .filter((l) => l.active)
              .length.toString()
              .padStart(2, "0")}
          </strong>
          <small>Espacios para inventariar</small>
        </div>
        <div className="stat">
          <span>
            Series registradas <ScanLine size={19} />
          </span>
          <strong>{totalSerials.toString().padStart(2, "0")}</strong>
          <small>Unidades identificadas</small>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="active-card">
          <div className="section-kicker">
            <span>{latest ? "CONTINUAR INVENTARIO" : "UN NUEVO CONTEO"}</span>
            <ScanLine size={25} />
          </div>
          <h2>
            {latest
              ? data.locations.find((l) => l.id === latest.location_id)?.name
              : "Cada unidad cuenta."}
          </h2>
          <p>
            {latest
              ? latest.name
              : "Comienza por elegir la ubicación que vas a revisar."}
          </p>
          {latest ? (
            <>
              <InventoryProgress s={latest} />
              <Link className="btn light" to={`/inventory/${latest.id}`}>
                <ScanLine size={21} />
                Continuar inventario
                <ArrowRight size={19} />
              </Link>
            </>
          ) : (
            <>
              <div className="start-steps">
                <span>
                  01 <b>Elige ubicación</b>
                </span>
                <span>
                  02 <b>Escanea y cuenta</b>
                </span>
                <span>
                  03 <b>Revisa resultados</b>
                </span>
              </div>
              <Link className="btn light" to="/inventory/new">
                <Plus size={20} />
                Comenzar inventario
                <ArrowRight size={19} />
              </Link>
            </>
          )}
        </section>
        <section className="panel location-panel">
          <div className="section-heading">
            <h2>Ubicaciones</h2>
            <span className="count-badge">{data.locations.length}</span>
          </div>
          {data.locations
            .filter((l) => l.active)
            .map((l) => (
              <Link
                to={`/inventory/new?location=${l.id}`}
                key={l.id}
                className="location-row"
              >
                <span className="location-icon">
                  <Warehouse size={21} />
                </span>
                <div>
                  <b>{l.name}</b>
                  <small>
                    {
                      sessions.filter(
                        (s) =>
                          s.location_id === l.id && s.status !== "completed",
                      ).length
                    }{" "}
                    inventarios activos
                  </small>
                </div>
                <ChevronRight size={17} />
              </Link>
            ))}
        </section>
      </div>
      <div className="section-heading spaced">
        <h2>Actividad reciente</h2>
        <Link to="/inventory" className="text-button">
          Ver inventarios anteriores <ArrowRight size={16} />
        </Link>
      </div>
      <div className="panel">
        {sessions.length ? (
          sessions.slice(0, 4).map((s) => (
            <Link className="session-row" to={`/inventory/${s.id}`} key={s.id}>
              <span className="session-icon">
                <ClipboardList size={21} />
              </span>
              <div>
                <strong>{s.name}</strong>
                <small>
                  {data.locations.find((l) => l.id === s.location_id)?.name} ·{" "}
                  {date(s.started_at)}
                </small>
              </div>
              <Status s={s} />
              <ChevronRight className="row-arrow" size={19} />
            </Link>
          ))
        ) : (
          <Empty title="Tu primer inventario empieza aquí">
            <p>Los conteos que crees aparecerán en este espacio.</p>
          </Empty>
        )}
      </div>
      <div className="subtle-note">
        <ShieldCheck size={17} />
        <span>
          Conteo ciego: las existencias esperadas se muestran únicamente en la
          revisión del supervisor.
        </span>
      </div>
    </>
  );
}
function InventoryList() {
  const { data } = useStore();
  const [filter, setFilter] = useState("active");
  const rows = data.inventory_sessions.filter(
    (s) =>
      filter === "all" ||
      (filter === "completed"
        ? s.status === "completed"
        : s.status !== "completed"),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CONTEO FÍSICO</span>
          <h1>Inventarios</h1>
        </div>
        <Link to="/inventory/new" className="btn primary">
          <Plus size={20} />
          Nuevo inventario
        </Link>
      </div>
      <div className="tabs" role="tablist" aria-label="Estado del inventario">
        {[
          ["active", "En curso"],
          ["completed", "Finalizados"],
          ["all", "Todos"],
        ].map(([k, v]) => (
          <button
            role="tab"
            aria-selected={filter === k}
            className={filter === k ? "selected" : ""}
            key={k}
            onClick={() => setFilter(k)}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="inventory-grid">
        {rows.map((s) => (
          <Link
            className="panel inventory-card"
            to={`/inventory/${s.id}`}
            key={s.id}
          >
            <div className="section-heading">
              <span className="eyebrow">
                {data.locations.find((l) => l.id === s.location_id)?.name}
              </span>
              <Status s={s} />
            </div>
            <h2>{s.name}</h2>
            <p className="muted">{date(s.started_at)}</p>
            <InventoryProgress s={s} />
            <div className="card-footer">
              <span>{progress(data, s).pending} pendientes</span>
              <ArrowRight size={20} />
            </div>
          </Link>
        ))}
      </div>
      {!rows.length && (
        <div className="panel">
          <Empty title="No hay inventarios en esta vista">
            <Link to="/inventory/new" className="btn secondary">
              Crear inventario
            </Link>
          </Empty>
        </div>
      )}
    </>
  );
}
export default function Application() {
  return (
    <Provider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
      <Toaster richColors position="top-center" closeButton />
    </Provider>
  );
}
