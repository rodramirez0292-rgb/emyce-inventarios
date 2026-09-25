import { emptySnapshot, Product, Snapshot } from "./domain";
export const DEMO_USER = "00000000-0000-4000-8000-000000000001";
export function demoData(): Snapshot {
  const d = emptySnapshot();
  d.profiles = [
    {
      id: DEMO_USER,
      full_name: "Usuario de prueba",
      role: "admin",
      active: true,
    },
  ];
  d.locations = ["Juárez", "Almacén", "Bodega", "Departamento"].map(
    (name, i) => ({
      id: `10000000-0000-4000-8000-00000000000${i + 1}`,
      name,
      active: true,
    }),
  );
  const items = [
    [
      "CHC-110",
      "Congelador horizontal CHC-110",
      "Torrey",
      "Refrigeración",
      true,
    ],
    ["VR-12", "Refrigerador vertical VR-12", "Imbera", "Refrigeración", true],
    ["BAR-8", "Báscula comercial BAR-8", "Rhino", "Básculas", true],
    [
      "ACC-X",
      "Accesorio X · repuesto universal",
      "EMYCE",
      "Refacciones",
      false,
    ],
    ["VIT-120", "Vitrina refrigerada 120", "Torrey", "Vitrinas", true],
    ["M-22", "Molino de carne M-22", "Torrey", "Preparación", true],
    ["EMP-01", "Empaque para puerta", "Imbera", "Refacciones", false],
    ["CHA-04", "Charola de acero inoxidable", "EMYCE", "Accesorios", false],
  ];
  d.products = items.map(
    ([sku, name, brand, category, serialized], i) =>
      ({
        id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
        sku,
        name,
        brand,
        category,
        serialized,
        description: `${name}. Producto ficticio para probar el inventario.`,
        barcode: `75000000000${i + 1}0`,
        barcodes: [`DEMO-${sku}`],
        supplier_code: `PROV-${sku}`,
        photo_url: "",
        active: true,
      }) as Product,
  );
  return d;
}
