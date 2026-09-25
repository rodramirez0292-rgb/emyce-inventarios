"use client";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  ScanLine,
  SwitchCamera,
  Flashlight,
  X,
  Keyboard,
} from "lucide-react";
import { toast } from "sonner";
type Detection = { rawValue: string };
type DetectorConstructor = {
  new (options: { formats: string[] }): {
    detect: (source: HTMLVideoElement) => Promise<Detection[]>;
  };
  getSupportedFormats: () => Promise<string[]>;
};
export function feedback(error = false) {
  navigator.vibrate?.(error ? [100, 70, 180] : 45);
  if (localStorage.getItem("emyce-sound") !== "on") return;
  try {
    const ctx = new AudioContext(),
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = error ? 220 : 1050;
    g.gain.value = 0.07;
    o.start();
    o.stop(ctx.currentTime + (error ? 0.25 : 0.09));
    o.onended = () => void ctx.close();
  } catch {}
}
export function BarcodeScanner({
  onRead,
  onClose,
  serial = false,
}: {
  onRead: (v: string) => void;
  onClose: () => void;
  serial?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    accepted = useRef(false),
    last = useRef(0);
  const callback = useRef(onRead);
  useEffect(() => {
    callback.current = onRead;
  }, [onRead]);
  const [facing, setFacing] = useState<"environment" | "user">("environment"),
    [error, setError] = useState(""),
    [torch, setTorch] = useState(false),
    [supportsTorch, setSupportsTorch] = useState(false),
    [manual, setManual] = useState("");
  useEffect(() => {
    let cancelled = false,
      frame: number | undefined,
      stop: (() => void) | undefined;
    accepted.current = false;
    setError("");
    setTorch(false);
    setSupportsTorch(false);
    const accept = (code: string) => {
      if (cancelled || accepted.current || Date.now() - last.current < 1800)
        return;
      accepted.current = true;
      last.current = Date.now();
      stream.current?.getTracks().forEach((t) => t.stop());
      feedback();
      callback.current(code);
    };
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "La cámara necesita HTTPS. Puedes escribir el código.",
          );
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        const el = video.current;
        if (!el) return;
        el.srcObject = media;
        await el.play();
        setSupportsTorch(
          Boolean(
            (
              media
                .getVideoTracks()[0]
                .getCapabilities() as MediaTrackCapabilities & {
                torch?: boolean;
              }
            ).torch,
          ),
        );
        const Native = (
          window as Window & { BarcodeDetector?: DetectorConstructor }
        ).BarcodeDetector;
        let nativeOK = false;
        if (Native) {
          try {
            const formats = await Native.getSupportedFormats();
            if (formats.includes("qr_code") && formats.includes("code_128")) {
              const detector = new Native({
                formats: formats.filter((v) =>
                  [
                    "qr_code",
                    "code_128",
                    "code_39",
                    "ean_13",
                    "ean_8",
                    "upc_a",
                    "upc_e",
                    "itf",
                    "data_matrix",
                    "pdf417",
                  ].includes(v),
                ),
              });
              const run = async () => {
                if (cancelled || accepted.current) return;
                try {
                  const hits = await detector.detect(el);
                  if (hits[0]) accept(hits[0].rawValue);
                } catch {}
                if (!cancelled && !accepted.current)
                  frame = window.setTimeout(run, 140);
              };
              void run();
              nativeOK = true;
            }
          } catch {}
        }
        if (!nativeOK) {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (cancelled) return;
          const reader = new BrowserMultiFormatReader(undefined, {
            delayBetweenScanAttempts: 140,
            delayBetweenScanSuccess: 1800,
          });
          const controls = await reader.decodeFromStream(
            media,
            el,
            (result) => {
              if (result) accept(result.getText());
            },
          );
          stop = () => controls.stop();
          if (cancelled) stop();
        }
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error && e.name === "NotAllowedError"
              ? "Autoriza el acceso a la cámara en tu navegador."
              : e instanceof Error
                ? e.message
                : "No se pudo abrir la cámara.",
          );
      }
    }
    void start();
    return () => {
      cancelled = true;
      if (frame) clearTimeout(frame);
      stop?.();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);
  const toggleTorch = async () => {
    try {
      const track = stream.current?.getVideoTracks()[0];
      await track?.applyConstraints({
        advanced: [{ torch: !torch } as MediaTrackConstraintSet],
      });
      setTorch(!torch);
    } catch {
      toast.error("La linterna no está disponible.");
    }
  };
  return (
    <div
      className="scanner"
      role="dialog"
      aria-modal="true"
      aria-label={serial ? "Escanear serie" : "Escanear producto"}
    >
      <header>
        <span>
          <ScanLine size={21} />{" "}
          {serial ? "Escanear unidad" : "Escanear producto"}
        </span>
        <button aria-label="Cerrar cámara" onClick={onClose}>
          <X />
        </button>
      </header>
      <video ref={video} muted autoPlay playsInline />
      <div className="scan-overlay">
        <div className="viewfinder">
          <i />
          <i />
          <i />
          <i />
          <span />
        </div>
        <p>
          {serial
            ? "Apunta al código de la serie"
            : "Apunta al código del producto"}
        </p>
        {error && (
          <div className="camera-error">
            <Camera />
            <p>{error}</p>
          </div>
        )}
      </div>
      <div className="scanner-bottom">
        <div className="camera-tools">
          {supportsTorch && (
            <button onClick={toggleTorch}>
              <Flashlight /> {torch ? "Apagar" : "Linterna"}
            </button>
          )}
          <button
            onClick={() =>
              setFacing(facing === "environment" ? "user" : "environment")
            }
          >
            <SwitchCamera /> Cambiar cámara
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) {
              accepted.current = true;
              feedback();
              onRead(manual.trim());
            }
          }}
        >
          <label htmlFor="manual-code">
            <Keyboard size={17} />{" "}
            {serial ? "O escribe la serie" : "O escribe el código"}
          </label>
          <div className="inline">
            <input
              id="manual-code"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder={serial ? "ABC123456" : "Código o SKU"}
              autoComplete="off"
            />
            <button className="btn primary" disabled={!manual.trim()}>
              Continuar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
export function CameraCapture({
  value,
  onChange,
  label = "Tomar fotografía",
}: {
  value: string;
  onChange: (s: string) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const capture = async (file: File) => {
    setBusy(true);
    try {
      if (!file.type.startsWith("image/"))
        throw new Error("Selecciona una imagen.");
      if (file.size > 25 * 1024 * 1024)
        throw new Error("La imagen debe pesar menos de 25 MB.");
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        const scale = Math.min(1, 1400 / Math.max(img.width, img.height)),
          canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas
          .getContext("2d")!
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        onChange(canvas.toDataURL("image/jpeg", 0.78));
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "No se pudo leer la foto. Prueba con JPG.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="capture">
      {value && <img src={value} alt="Fotografía adjunta" />}
      <label className="btn secondary">
        <Camera size={18} />
        {busy ? "Preparando foto…" : value ? "Cambiar fotografía" : label}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={busy}
          onChange={(e) => {
            if (e.target.files?.[0]) void capture(e.target.files[0]);
          }}
        />
      </label>
      {value && (
        <button
          type="button"
          className="text-button"
          onClick={() => onChange("")}
        >
          Quitar foto
        </button>
      )}
    </div>
  );
}
