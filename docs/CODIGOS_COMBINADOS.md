# Actualización: códigos SKU;SERIE

Reconoce etiquetas como `CCCHC110003;11100112505270073`:

- Busca el producto mediante `CCCHC110003`.
- Abre la confirmación con la serie `11100112505270073`, lista para adjuntar la fotografía.
- Guarda el texto completo de la etiqueta en `serial_barcode` y solo la serie en los campos de serie.
- También funciona al escanear otra unidad dentro del producto. Rechaza etiquetas que corresponden a otro producto y mantiene el bloqueo de series duplicadas.
- Los códigos simples y la captura manual siguen disponibles. No guarda una unidad hasta pulsar **Confirmar serie**.

## Publicar en Vercel

1. Extrae `EMYCE-Codigos-SKU-Serie.zip`.
2. Abre en GitHub el repositorio conectado a Vercel, en la rama de producción.
3. En **Add file → Upload files**, arrastra las carpetas `src`, `public`, `tests` y `docs` del paquete, conservando su estructura. No borres las carpetas existentes ni subas una carpeta contenedora adicional.
4. Pulsa **Commit changes** con el mensaje **Reconocer etiquetas SKU y serie**.
5. Espera a que ese despliegue aparezca como **Ready** en Vercel.
6. Cierra y vuelve a abrir la pestaña de EMYCE en Android, con conexión a internet.
7. Escanea la etiqueta del CHC-110PR. Debe abrir su formulario con la serie `11100112505270073`. Adjunta la foto y pulsa **Confirmar serie** cuando corresponda registrar esa unidad.

No hay migraciones, cargas de catálogo ni cambios de variables de entorno. Esta actualización no borra inventarios.

## Verificación realizada

Lint, TypeScript, compilación y 24 pruebas unitarias/base de datos correctas. Prueba de interfaz móvil aprobada: lectura combinada desde el escáner de productos, recuperación al recargar, guardado, duplicado, rechazo de otro producto y ceros iniciales. Se prueba el texto decodificado mediante la entrada del escáner; falta la comprobación con la cámara física después de publicar.
