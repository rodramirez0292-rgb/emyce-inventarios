# EMYCE Inventarios — arquitectura

## Aplicación
Next.js, React, TypeScript y Tailwind. Una aplicación cliente con rutas reales y un shell exportable permite alojamiento estático por HTTPS y Supabase vía HTTP. En desarrollo Next reescribe las rutas al shell; en alojamiento estático se configura fallback a index.html. React Router administra /login, /dashboard, /inventory y sus detalles, /products, /imports, /settings/locations y /admin/users.

Dos repositorios implementan la misma interfaz: Supabase para operación real (Auth, PostgreSQL y Storage privado) y demo explícita en IndexedDB para pruebas ficticias. Nunca se sustituye un fallo de Supabase con datos demo. Sin configuración, el usuario puede entrar conscientemente a demo. Ninguna clave service_role llega al navegador.

## Modelo
profiles define usuarios y roles; locations, products y product_barcodes forman el catálogo. inventory_sessions conserva estado, responsable, ubicación y fechas. session_products congela el alcance de productos de la sesión sin revelar cantidades esperadas. inventory_counts admite rondas 1/2 únicamente para artículos no serializados. inventory_serial_units conserva unidades y normalización canónica, con UNIQUE(sesión, serie normalizada). serial_observations registra observaciones de reconteo sin duplicar unidades. product_checks marca productos terminados incluso con cero unidades. expected_inventory y expected_serials se consultan únicamente desde revisión autorizada. unidentified_items contiene incidencias; inventory_audit_log registra cambios con actor y valores antes/después.

## Invariantes y seguridad
RLS verifica roles activos, responsable de sesión y transiciones. Los contadores sólo operan sesiones asignadas, nunca pueden leer existencias esperadas ni otorgarse privilegios. Los supervisores revisan y cierran; los administradores gestionan catálogo, usuarios y ubicaciones. La RPC valida tipos, sesión/ubicación/ronda y bloqueo después de cierre; los privilegios de tabla impiden saltársela. Un trigger registra la auditoría. Normalización compartida TypeScript/SQL: NFKC, mayúsculas, eliminación de invisibles, espacios y guiones. Se conserva el texto original. Auditoría sin borrado desde la app. Los registros pendientes llevan UUID idempotente.

## Captura y sincronización
BarcodeDetector es preferente; ZXing se carga como fallback. La cámara se detiene al detectar, con cooldown y confirmación de serie. Fotografías JPEG comprimidas se guardan en bucket privado con permisos asociados a la sesión. IndexedDB mantiene un caché por usuario y una cola duradera de operaciones de conteo. La cola conserva errores y conflictos para revisión, y se sincroniza en orden. El caché de producción no incluye cantidades esperadas ni su auditoría. Importaciones y cambios de estado requieren conexión.

## Comparación
No se infiere cero cuando falta un conteo. Para serializados, la cantidad proviene de unidades observadas por ronda. Se comparan conjuntos de series, incluso cuando las cantidades coinciden. El segundo conteo no sobreescribe el primero. Cierre sólo desde revisión y con alcance completo; incidencias pendientes requieren resolución. ERP se conecta en el futuro mediante un adaptador de importación de instantáneas, nunca mediante ajustes automáticos.

## Entrega y validación
Migración SQL y seed versionados; pruebas de dominio, RLS y transacciones en PostgreSQL embebido, más flujos de demo y compilación. Las pruebas de cámara física y Supabase alojado requieren dispositivo/proyecto reales. README documenta instalación, configuración, despliegue y aceptación manual. Sin proyecto Supabase no se declara verificada la operación real multiusuario.
