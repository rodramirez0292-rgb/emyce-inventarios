# EMYCE Inventarios

**Instalación elegida: Vercel + Supabase.** Sigue [la guía paso a paso](docs/VERCEL_SUPABASE.md). El archivo `vercel.json` incluye compilación, carpeta de salida y rutas; selecciona Node.js 24.x en Vercel. La publicación en la cuenta Vercel y la conexión a Supabase aún requieren esos pasos.

PWA para inventario físico con conteo ciego, captura individual de equipos por serie, reconteo y revisión. Construida con Next.js, React, TypeScript, Tailwind y Supabase. El catálogo demo está marcado como ficticio y es local al dispositivo; el modo real utiliza exclusivamente PostgreSQL, Auth y Storage de Supabase.

**Estado de entrega:** código implementado y comprobado con pruebas de dominio, PostgreSQL embebido y navegador. El proyecto Supabase alojado no se ha creado: el modo real requiere completar [ACTIVAR_SUPABASE.md](docs/ACTIVAR_SUPABASE.md). No se ha certificado la cámara en un iPhone o Android físico. OCR se deja como una opción futura deshabilitada; la escritura manual funciona siempre.

## 1. Instalación

Recomendado Node.js 24 LTS y npm (ZXing actual declara Node >=24). El proyecto también compiló y pasó las pruebas con Node 22.18 en el entorno de entrega, con advertencia de motor de ZXing. Versiones resueltas y fijadas en package-lock.json.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

En PowerShell: `Copy-Item .env.example .env.local`. Abre `http://localhost:3000`. Sin variables aparece el acceso a la demo; no se crean usuarios ni datos reales automáticamente.

## 2. Crear Supabase y variables

Sigue [la guía paso a paso](docs/ACTIVAR_SUPABASE.md). Variables públicas de compilación:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA
NEXT_PUBLIC_ENABLE_DEMO=true
```

La clave puede ser publishable o `anon`; nunca `service_role`/secret. Para ocultar la demo en una instalación de producción, usa `NEXT_PUBLIC_ENABLE_DEMO=false`. Las variables `NEXT_PUBLIC_*` se incorporan al compilar: cualquier cambio requiere nueva compilación. Las claves reales no se incluyen en Git. Esta app no tiene servidor que utilice privilegios elevados.

## 3. Migración y seed

En SQL Editor ejecuta `supabase/migrations/202609240001_initial.sql` en una base vacía, y luego `supabase/seed.sql`. También puedes usar Supabase CLI: enlazar el proyecto y ejecutar `supabase db push` para las migraciones. No reinicies ni borres una base en uso para reaplicar esta migración.

La migración crea 15 tablas, relaciones, índices, políticas RLS, bucket privado y la RPC transaccional `apply_operation`. El seed crea Juárez, Almacén, Bodega, Departamento, Torrey CHC-110, Imbera VR-12, Rhino BAR-8 y Accesorio X. Los códigos son de prueba. `DEMO-CHC-110`, `DEMO-VR-12`, `DEMO-BAR-8` y `DEMO-ACC-X` funcionan como códigos alternativos y pueden imprimirse como CODE128/QR. Los números que empiezan por 750 son ficticios, no garantizan dígito verificador EAN.

## 4. Autenticación y roles

Email/contraseña con confirmación por Supabase Auth. Las nuevas cuentas son `counter` **inactivas**; no obtienen acceso al catálogo hasta que las active un administrador. El primer administrador se activa explícitamente desde SQL según la guía. El panel Equipo cambia rol/actividad de usuarios ya registrados, no necesita claves privilegiadas.

- Counter: inventarios asignados, cantidades, series, fotografías, incidencias y envío a revisión.
- Supervisor: acceso a inventarios, referencias en revisión, reconteo y cierre.
- Admin: además catálogo, importaciones, ubicaciones y acceso de usuarios.

La RLS restringe lecturas. Las escrituras directas están revocadas: pasan por una función que valida usuario activo, rol, ubicación, alcance y estado, bloquea la fila de sesión y aplica toda la operación en una transacción. El rol no procede de parámetros del navegador. La referencia esperada se oculta también en el registro de auditoría durante el conteo. Las fotografías se descargan mediante URLs firmadas que expiran a los 10 minutos.

## 5. Flujo diario

1. Nuevo inventario → nombre, ubicación, responsable → comenzar. El alcance congela el catálogo activo al crear la sesión.
2. Si necesitas existencias esperadas, prepara primero un **borrador**, importa su CSV y después inicia el conteo. Sin referencia el reporte muestra “Sin referencia”, nunca presupone cero.
3. Escanea o busca el producto por nombre, marca, descripción, SKU, código proveedor o cualquiera de sus barcodes.
4. Cantidades: escribe un entero >=0 y guarda. Series: escanea o escribe cada unidad, revisa el valor, estado, foto opcional y confirma. Termina el producto para registrar explícitamente que se revisó; cero unidades también requiere confirmación.
5. Los duplicados muestran una alerta roja. Enviar a revisión crea una incidencia, **no** otra unidad.
6. Termina todos los productos y envía a revisión. El supervisor compara cantidades y conjuntos de series. La misma cantidad con series distintas también cuenta como diferencia.
7. Reconteo: sólo productos con diferencias. Guarda la ronda 2 sin reemplazar la 1. Las unidades repetidas entre rondas usan observaciones, no duplican la unidad de la sesión. Sólo se admite un segundo conteo.
8. Resuelve incidencias describiendo la decisión. Cierra el inventario para volverlo inmutable. El cierre conserva diferencias; no ajusta ningún ERP.

## 6. Importación CSV

Catálogo: `sku,name,description,brand,category,barcode,supplier_code,serialized`. Obligatorios `sku` y `name`; `serialized`: true/false, 1/0, sí/no. Varios códigos separados por `|`. Hay plantilla, preview y validación de campos, SKU y barcodes tanto dentro del archivo como contra el catálogo. Una importación errónea no guarda parcialmente. Máximo 2,000 filas o 5 MB por lote. No actualiza productos existentes por SKU; las correcciones se hacen desde su ficha.

Referencia: `sku,location,expected_quantity,serials`, con series separadas por `|`. Se permite sólo en borrador y reemplaza la referencia completa de la sesión en una transacción. Para serializados la cantidad debe coincidir con el número de series. Puede incluir otras ubicaciones para identificar posibles movimientos; éstos se muestran para revisión y nunca se ajustan automáticamente.

## 7. Exportación

En revisión o después de cerrar: `inventory_counts.csv`, `inventory_serials.csv` y `inventario.xlsx` (hojas Conteos/Series). Cantidades esperadas/físicas, diferencia, ronda y detalle de series faltantes/no esperadas. Usa UTF-8 con BOM para CSV y neutraliza texto que pueda interpretarse como fórmula. Celdas sin referencia permanecen explícitas. Usuarios counter no acceden al reporte esperado.

## 8. Cámara, fotografías y teléfonos

Primero BarcodeDetector si permite QR/CODE128; fallback dinámico a ZXing. Cámara trasera preferida, cambio de cámara, linterna cuando el navegador la expone, cooldown y detención al detectar. No usa OCR obligatorio. Confirmación de serie editable y entrada manual incluso si la cámara es rechazada. Vibración cuando el dispositivo la soporta y sonido opcional desde Preferencias.

Las fotos usan captura nativa o selección de archivo. Se reducen a 1,400 px en el lado largo y JPEG calidad 0.78. El bucket acepta imágenes de hasta 2 MB. Si una foto no se puede leer (p. ej. ciertos HEIC), se muestra error y puede seleccionarse JPG. No se envían fotografías al ERP.

Para probar en la red local: misma Wi-Fi, inicia `npm run dev`; para cámara necesitas HTTPS con certificado confiable en el teléfono. `npx next dev --experimental-https --hostname 0.0.0.0` genera un certificado de desarrollo que tendrás que confiar en el dispositivo. `http://IP_LOCAL:3000` sirve para revisar interfaz, **no** para probar cámara. El método preferido para captura real es la URL HTTPS de una publicación. No desactives globalmente protecciones del navegador.

Safari/Chrome iPhone requieren `playsInline` y permiso explícito de cámara; ambos se contemplan. La linterna y vibración no están garantizadas en iOS. Comprueba en hardware real CODE128, EAN, QR, mala luz, enfoque y permiso denegado antes del piloto.

## 9. PWA y mala conexión

Manifest, iconos 192/512, favicon y service worker para el shell y recursos estáticos; no se cachean respuestas de Supabase en el service worker. Instalar en Android desde el navegador y en iPhone desde Compartir → Añadir a pantalla de inicio.

IndexedDB conserva catálogo/estado por usuario, sin referencias esperadas en el caché de producción, y una cola de cantidades, series, terminación de producto e incidencias. Las fotos pueden viajar en esa cola. Al volver la conexión se envía en orden con UUID idempotente. Los conflictos quedan visibles; enviarlos a revisión conserva el contenido original en una incidencia. No se cierra una sesión ni se sale de la cuenta con pendientes. Importaciones, usuarios, creación de sesiones y cambios de estado requieren conexión. Abrir rutas/escáner/Excel al menos una vez online permite cachear sus chunks; no se promete disponibilidad offline de módulos nunca descargados.

Limitaciones MVP: el catálogo completo se descarga paginado; no hay sincronización en tiempo real (se refresca al cargar o guardar). Un dispositivo desconectado puede intentar una serie registrada en otro equipo; el servidor la rechaza al reconectar. Si el supervisor cerró mientras otro equipo estaba sin conexión, el conflicto no se puede reenviar a esa sesión cerrada: conservar la cola y coordinar una nueva sesión. No borrar el almacenamiento del navegador con pendientes. Navegación privada/cuota del navegador puede impedir almacenamiento; no sustituye una copia en servidor.

## 10. Desarrollo, pruebas y publicación

```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium
# Con npm run dev ejecutándose en otra terminal:
npm run test:ui
npm run build
npm start
```

`npm start` sirve `out/` en `http://localhost:4173`. Para probar las pruebas UI contra producción: define `PLAYWRIGHT_BASE_URL=http://localhost:4173`. Las pruebas de base de datos ejecutan la migración en PostgreSQL embebido (PGlite), con stubs locales de las tablas auth/storage; prueban RLS, RPC, rollback, unicidad y cierre. No sustituyen una comprobación de Supabase Auth/Storage alojados.

Next exporta un shell estático; React Router administra `/login`, `/dashboard`, `/inventory`, `/inventory/new`, `/inventory/:id`, `/inventory/:id/scan`, `/inventory/:id/product/:productId`, `/inventory/:id/review`, `/inventory/:id/recount`, `/products`, `/products/:id`, `/imports`, `/settings/locations`, `/admin/users`. No hay SSR ni secretos servidor. En desarrollo se reescriben al shell. En producción **todas las rutas que no sean archivos deben servir `out/index.html` con estado 200**. `public/_redirects` incluye la regla para hosts compatibles; configura el equivalente en otros proveedores. Publica `out/` por HTTPS después de compilar con las variables Supabase. [Exportación estática de Next](https://nextjs.org/docs/app/guides/single-page-applications).

## 11. Estructura y ERP futuro

`src/lib/domain.ts`: reglas; `demo.ts`: operaciones demo; `repository.ts`: Supabase/IndexedDB; `components/scanner.tsx`: cámara; `components/inventory.tsx`: conteo/revisión; `components/management.tsx`: administración; `supabase/`: migración y seed; `tests/`: pruebas. [Arquitectura](docs/ARCHITECTURE.md).

`src/lib/erp.ts` define un adaptador de instantáneas. Un conector futuro puede transformar Alegra u otro ERP al mismo esquema de referencia e importar antes del conteo. No hay peticiones a ERP ni ajustes automáticos. Series y auditoría quedan preparadas para historial de movimientos, compras y ventas futuros; la ubicación mostrada actualmente es la observada en cada inventario, no una afirmación de ubicación en tiempo real.
