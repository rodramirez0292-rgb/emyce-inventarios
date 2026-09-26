# Actualización de fotografía — 25 de septiembre de 2026

Esta actualización permite fotografiar dentro de EMYCE sin salir a la cámara externa de Android. La serie, la imagen adjunta y las notas pendientes se recuperan al recargar la misma pestaña. El borrador se separa por usuario, inventario, producto y ronda; se elimina al confirmar o cancelar el registro. Si el navegador no permite almacenarlo, se muestra un aviso.

La foto se adjunta al formulario al pulsar **Capturar fotografía**. Después hay que pulsar **Confirmar serie** para guardar la unidad y subir la imagen a Supabase. También sigue disponible **Seleccionar foto guardada**.

## Actualizar la página

1. Extrae `EMYCE-Actualizacion-Fotos.zip`.
2. En GitHub abre el repositorio `emyce-inventarios`, en su página principal.
3. Usa **Add file → Upload files** y arrastra las carpetas `src`, `public`, `tests` y `docs` del paquete. Conserva sus nombres y estructura. Se actualizan archivos concretos; no borres carpetas existentes.
4. Escribe **Corregir captura de fotos en Android** y pulsa **Commit changes** en la rama de producción del repositorio.
5. En Vercel espera a que el nuevo despliegue de ese cambio aparezca como **Ready**. Si no se inicia automáticamente, revisa que Vercel siga conectado al repositorio y a la rama actualizada.
6. En Android cierra la pestaña de EMYCE y vuelve a abrir `https://emyce-inventarios.vercel.app/login`. No hace falta borrar los datos del navegador.
7. Comprueba que el formulario de serie muestre **Tomar foto de la placa** y **Seleccionar foto guardada**. Al tocar el primero debe aparecer una vista de cámara dentro del formulario con el botón **Capturar fotografía**.

No hay cambios de base de datos, permisos, claves ni variables de Vercel. No vuelvas a ejecutar la migración ni el catálogo de prueba.

## Prueba en el teléfono

1. Abre el inventario de prueba y el congelador CHC-110.
2. Escribe una serie nueva, por ejemplo `FOTO002`.
3. Pulsa **Tomar foto de la placa**, permite el uso de cámara y pulsa **Capturar fotografía**.
4. Comprueba que sigues en el formulario con la serie escrita y la imagen visible.
5. Pulsa **Confirmar serie** y espera el mensaje de registro correcto.
6. En Supabase comprueba la nueva fila en `inventory_serial_units`, su campo `photo_url` y el archivo correspondiente en **Storage → inventory-photos**.

## Alcance de la verificación

Se prueban en un navegador automatizado la captura desde un flujo de vídeo simulado, el cierre de la cámara, la recuperación de serie/foto/notas tras recargar, el guardado de la imagen en la demo, la limpieza del borrador y la alternativa de archivo cuando se deniega el permiso de cámara. La comprobación final con la cámara física Android y tu Supabase requiere publicar esta actualización y realizar los pasos anteriores. La causa exacta del cierre de la cámara externa no se ha reproducido en el teléfono del usuario.
