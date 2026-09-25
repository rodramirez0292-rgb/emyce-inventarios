"use client";
import { useEffect, useRef, useState } from "react";
import {
  LoaderCircle,
  X,
  Package,
  Search,
  ArrowRight,
  Barcode,
  Check,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Product, Inventory, progress, statusLabel } from "@/lib/domain";
import { signedPhoto } from "@/lib/repository";
import { useStore } from "./store";
export function Action({
  action,
  children,
  className = "btn primary",
  disabled = false,
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const gate = useRef(false);
  return (
    <button
      className={className}
      disabled={disabled || busy}
      onClick={async () => {
        if (gate.current) return;
        gate.current = true;
        setBusy(true);
        try {
          await action();
        } catch (e) {
          toast.error(
            e instanceof Error
              ? e.message
              : "No se pudo guardar. Intenta de nuevo.",
          );
        } finally {
          gate.current = false;
          setBusy(false);
        }
      }}
    >
      {busy ? <LoaderCircle className="spin" size={19} /> : null}
      {children}
    </button>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog className="modal" ref={ref} onCancel={onClose}>
      <div className="modal-title">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Photo({ path, name }: { path: string; name: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let cancel = false;
    void signedPhoto(path)
      .then((v) => {
        if (!cancel) setUrl(v);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [path]);
  return url ? (
    <img className="product-photo" src={url} alt={name} />
  ) : (
    <div className="product-placeholder">
      <Package size={27} />
    </div>
  );
}
export function ProductCard({
  p,
  to,
  checked = false,
  children,
}: {
  p: Product;
  to: string;
  checked?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Link className="product-row" to={to}>
      <Photo path={p.photo_url} name={p.name} />
      <div className="product-copy">
        <span className="eyebrow">
          {p.brand} <span className="muted">/ {p.sku}</span>
        </span>
        <strong>{p.name}</strong>
        <span className="product-meta">
          {p.serialized ? (
            <>
              <Barcode size={14} /> Por número de serie
            </>
          ) : (
            <>
              <Package size={14} /> Por cantidad
            </>
          )}
          {children}
        </span>
      </div>
      {checked ? (
        <span className="check-bubble">
          <Check size={16} />
        </span>
      ) : (
        <ArrowRight className="row-arrow" size={18} />
      )}
    </Link>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Buscar producto, SKU o código…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-box">
      <Search size={19} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          className="icon-button"
          aria-label="Limpiar búsqueda"
          onClick={() => onChange("")}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
export function InventoryProgress({ s }: { s: Inventory }) {
  const { data } = useStore();
  const p = progress(data, s);
  return (
    <div className="inventory-progress">
      <div>
        <span>
          {p.checked} de {p.total} productos revisados
        </span>
        <b>{p.percent}%</b>
      </div>
      <progress value={p.checked} max={p.total || 1} />
    </div>
  );
}
export function Status({ s }: { s: Inventory }) {
  return <span className={`status ${s.status}`}>{statusLabel[s.status]}</span>;
}
export const date = (s: string) =>
  new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(s));
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Package size={32} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
