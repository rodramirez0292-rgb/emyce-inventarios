"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { toast } from "sonner";
import { Snapshot, Profile, Operation, emptySnapshot } from "@/lib/domain";
import { Repository, supabase, Pending, putLocal } from "@/lib/repository";
import { DEMO_USER } from "@/lib/seed";
type Store = {
  data: Snapshot;
  user: Profile | null;
  repo: Repository | null;
  loading: boolean;
  online: boolean;
  pending: Pending[];
  error: string;
  refresh: () => Promise<void>;
  write: (op: Operation) => Promise<void>;
  enterDemo: () => Promise<void>;
  logout: () => Promise<void>;
  sync: () => Promise<void>;
};
const Context = createContext<Store | null>(null);
export function Provider({ children }: { children: React.ReactNode }) {
  const [repo, setRepo] = useState<Repository | null>(null),
    [data, setData] = useState<Snapshot>(emptySnapshot),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [online, setOnline] = useState(true),
    [pending, setPending] = useState<Pending[]>([]);
  const lock = useRef(false);
  const refresh = useCallback(async () => {
    if (!repo) return;
    try {
      setData(await repo.load());
      setPending(await repo.pending());
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo cargar el inventario.",
      );
    } finally {
      setLoading(false);
    }
  }, [repo]);
  useEffect(() => {
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (localStorage.getItem("emyce-mode") === "demo") {
      setRepo(new Repository(true, DEMO_USER));
    } else if (supabase) {
      supabase.auth.getSession().then(({ data, error }) => {
        if (error) setError(error.message);
        if (data.session) setRepo(new Repository(false, data.session.user.id));
        else setLoading(false);
      });
    } else setLoading(false);
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (localStorage.getItem("emyce-mode") !== "demo") {
        if (session) setRepo(new Repository(false, session.user.id));
        else {
          setRepo(null);
          setData(emptySnapshot());
          setLoading(false);
        }
      }
    });
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      subscription?.data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const sync = useCallback(async () => {
    if (!repo || lock.current) return;
    lock.current = true;
    try {
      await repo.sync();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error de sincronización");
      setPending(await repo.pending());
    } finally {
      lock.current = false;
    }
  }, [repo, refresh]);
  useEffect(() => {
    if (online && repo && !repo.demo) void sync();
  }, [online, repo, sync]);
  const write = async (op: Operation) => {
    if (!repo) throw new Error("Inicia sesión.");
    if (lock.current)
      throw new Error("Espera a que termine la sincronización.");
    lock.current = true;
    try {
      setData(await repo.write(op));
      setPending(await repo.pending());
    } finally {
      lock.current = false;
    }
  };
  const enterDemo = async () => {
    localStorage.setItem("emyce-mode", "demo");
    setLoading(true);
    setRepo(new Repository(true, DEMO_USER));
  };
  const logout = async () => {
    if (pending.length)
      throw new Error("Sincroniza los registros pendientes antes de salir.");
    if (repo && !repo.demo) {
      await putLocal(repo.key, undefined);
      await supabase?.auth.signOut();
    }
    localStorage.removeItem("emyce-mode");
    setRepo(null);
    setData(emptySnapshot());
    setError("");
  };
  const user = repo
    ? data.profiles.find((p) => p.id === repo.userId) || null
    : null;
  return (
    <Context.Provider
      value={{
        data,
        user,
        repo,
        loading,
        error,
        online,
        pending,
        refresh,
        write,
        enterDemo,
        logout,
        sync,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const v = useContext(Context);
  if (!v) throw new Error("Provider requerido");
  return v;
}
