# Validación de la entrega

## Verificado automáticamente

- Lint y TypeScript sin errores.
- Compilación optimizada de Next.js.
- 22 pruebas de dominio y PostgreSQL embebido: normalización Unicode, búsqueda por códigos alternativos, validación CSV, cantidades, productos serializados, duplicados, progreso, diferencias de conjuntos, correcciones, reconteo, unicidad SQL, RLS, escalada de privilegios, aislamiento de responsables, idempotencia, rollback de importación y bloqueo tras el cierre.
- Flujo móvil de 390 px: crear inventario, registrar cantidad, identificar por código, registrar una serie, adjuntar una imagen, rechazar duplicado, confirmar productos con cero unidades, completar el alcance, revisar, exportar CSV/XLSX, cerrar y recargar sin perder datos.
- Escritorio: buscar código proveedor, importar catálogo con preview/códigos alternativos, agregar ubicación y navegar.
- Lectura de un QR real por ZXing desde un vídeo generado en el navegador, con BarcodeDetector desactivado; comprobación de que los tracks de cámara terminan tras la lectura.
- PWA compilada: recarga y consulta del catálogo demo sin Internet después de cachear el shell online.
- Contrato de la herramienta opcional WebMCP: registro, parámetros inválidos y navegación mediante un registro de pruebas. No se verificó integración con una implementación nativa de WebMCP.

La prueba PWA descubrió una carrera al clonar respuestas después de su consumo. Se corrigió guardando una copia antes de devolver la respuesta y se volvió a verificar el arranque sin conexión.

## Requiere el proyecto Supabase y hardware reales

- Registro/confirmación de correo, inicio de sesión y activación de roles en el proyecto alojado.
- Subida y lectura de fotografías en Supabase Storage con URLs firmadas.
- Dos usuarios en diferentes celulares intentando la misma serie simultáneamente y sincronización de registros que se capturaron sin conexión.
- Conflictos con una sesión cerrada por otro dispositivo, expiración de sesión y cuota de almacenamiento local.
- BarcodeDetector nativo, enfoque, linterna, cambios de cámara, vibración y captura de placas en iPhone y Android físicos; CODE128/EAN/QR reales en condiciones de almacén.
- Instalación desde Safari/Chrome y políticas del alojamiento privado para cada integrante del equipo.

PostgreSQL embebido ejecuta la migración real con tablas auth/storage de prueba. No se presenta como una verificación contra Supabase alojado. La demo no equivale a almacenamiento compartido ni sustituye las pruebas pendientes para la primera operación real.
