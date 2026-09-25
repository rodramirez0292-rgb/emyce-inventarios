# Activar EMYCE con Supabase y Vercel

Supabase guardará usuarios, productos, inventarios y fotos. Vercel alojará la app con HTTPS. El dominio de la demo anterior es independiente: no se necesita para esta instalación.

Este documento describe los pasos; todavía no se ha creado el proyecto Supabase ni publicado en tu cuenta Vercel. Usa el paquete actualizado `EMYCE-Inventarios-Vercel.zip`, que ya incluye `vercel.json` y todas las rutas de la app.

## 1. Crear Supabase

1. Entra en https://supabase.com/dashboard y crea tu cuenta o inicia sesión.
2. Crea una organización llamada **EMYCE** si todavía no tienes una.
3. Pulsa **New project** y elige esa organización.
4. Nombre: **emyce-inventarios**.
5. Genera una contraseña de base de datos y guárdala en tu gestor de contraseñas. No se introduce en la app ni en Vercel.
6. Selecciona una región cercana a tus usuarios. Si operan en el norte de México, una región del oeste de Estados Unidos es una opción razonable, según disponibilidad.
7. Crea el proyecto y espera a que aparezca su panel operativo.

Mantén habilitada la **Data API** para que la app pueda acceder a las tablas con los permisos del usuario. Si la desactivaste al crear el proyecto, actívala en **Integrations → Data API** y comprueba que el esquema `public` esté expuesto. La migración de EMYCE configura los permisos y las reglas de acceso.

Referencia: https://supabase.com/docs/guides/platform/regions

## 2. Crear tablas, permisos y almacenamiento

1. Descomprime el paquete de la app.
2. En Supabase abre **SQL Editor → New query**.
3. Abre `supabase/migrations/202609240001_initial.sql` con un editor de texto. Copia TODO su contenido, pégalo en la consulta y pulsa **Run**.
4. Ejecútalo una sola vez sobre el proyecto nuevo. Si aparece un error, conserva el mensaje y resuélvelo antes de continuar; no lo vuelvas a ejecutar a ciegas ni borres tablas.
5. En una nueva consulta ejecuta el contenido de `supabase/seed.sql`. Crea las cuatro ubicaciones y cuatro productos ficticios para la primera prueba.
6. Comprueba en **Table Editor** las tablas `products`, `locations` e `inventory_sessions`. En **Storage** debe existir `inventory-photos`, privado.

El seed no carga cantidades esperadas automáticamente en inventarios reales. Para comparar cantidades tendrás que preparar un borrador e importar las existencias esperadas.

## 3. Crear tu primer administrador

Para la primera cuenta puedes usar directamente el panel de Supabase:

1. Abre **Authentication → Users**.
2. Usa **Add user → Create new user** (el nombre puede variar ligeramente).
3. Introduce TU correo y una contraseña de al menos 8 caracteres. Guarda la contraseña de forma privada.
4. Para esta cuenta tuya, creada manualmente, selecciona la opción de confirmar el correo automáticamente si aparece. Esto evita depender del envío de correo durante la instalación. No desactives globalmente las confirmaciones.
5. En SQL Editor ejecuta lo siguiente, sustituyendo el correo entre comillas:

```sql
update public.profiles
set full_name = 'Administrador EMYCE', role = 'admin', active = true
where id = (
  select id from auth.users
  where lower(email) = lower('TU_CORREO_REAL')
)
returning id, full_name, role, active;
```

Debe devolver una fila con `role = admin` y `active = true`. Si devuelve cero filas, revisa el correo y que hayas creado el usuario después de ejecutar la migración.

La contraseña de este usuario es para entrar a EMYCE. Es distinta de la contraseña de base de datos.

Para que el personal pueda usar **Solicitar una cuenta** y recibir confirmaciones en sus propios correos, configura después un proveedor de correo en **Authentication → Email/SMTP**. El servicio predeterminado de Supabase limita el envío a los miembros del proyecto. Alternativamente puedes crear las cuentas manualmente en el panel y activarlas desde **Equipo** en la app. No compartas una sola cuenta entre trabajadores.

Referencias: https://supabase.com/docs/guides/auth/managing-user-data y https://supabase.com/docs/guides/auth/auth-smtp

## 4. Obtener los dos valores públicos

1. En **Connect** copia la **Project URL**, con una forma parecida a `https://REFERENCIA.supabase.co`.
2. En **Settings → API Keys** copia la **Publishable key**, normalmente empieza con `sb_publishable_`. La clave pública heredada `anon` también es compatible.
3. Conserva los dos valores para Vercel. No necesitas copiar `service_role`, claves `secret`, tokens personales ni la contraseña de base de datos.

Referencia: https://supabase.com/docs/guides/getting-started/api-keys

## 5. Preparar el código en GitHub

La ruta más sencilla para mantener actualizaciones es GitHub conectado con Vercel:

1. Crea un repositorio **privado** llamado `emyce-inventarios` en tu cuenta GitHub.
2. Sube el contenido descomprimido del paquete actualizado. `package.json` y `vercel.json` deben quedar en la raíz del repositorio.
3. Sube las carpetas `app`, `src`, `public`, `supabase`, `scripts`, `docs` y `tests`, además de los archivos de configuración de la raíz y `package-lock.json`.
4. No subas `node_modules`, `out`, `.next`, `.env.local` ni contraseñas. El paquete de entrega ya excluye las dependencias y los archivos privados.
5. Si usas la web de GitHub: entra al repositorio, **Add file → Upload files**, arrastra los archivos/carpetas y confirma con **Commit changes**. Comprueba al terminar que puedas abrir `vercel.json` y `package-lock.json` desde la raíz.

Si ya tienes una cuenta o repositorio, puedes reutilizarlos. La carpeta `.openai` sólo identifica la demo anterior en Sites y no es necesaria para Vercel.

## 6. Publicar en Vercel

1. Entra en https://vercel.com y accede con tu cuenta.
2. Para el uso empresarial de EMYCE, elige un plan que permita uso comercial, como **Pro**. Hobby está limitado a uso personal/no comercial. Consulta las condiciones y costos actuales antes de contratar: https://vercel.com/docs/plans/hobby
3. Pulsa **Add New → Project**. Conecta GitHub si hace falta e importa `emyce-inventarios`.
4. Usa la carpeta que contiene `package.json` como **Root Directory**. Si subiste directamente el contenido del paquete, es la raíz; no es `out`.
5. Esta app usa una exportación estática de Next. La configuración incluida establece:

| Ajuste | Valor |
|---|---|
| Framework Preset | Other |
| Install Command | npm ci |
| Build Command | npm run build |
| Output Directory | out |
| Node.js Version | 24.x |

`framework: null` en `vercel.json` corresponde a **Other**. Esto conserva las rutas cliente y evita que se traten como páginas que requieren un servidor Next. La aplicación sigue construida con Next.js y React.

6. Antes de pulsar Deploy, abre **Environment Variables** y añade estas variables al entorno Production:

| Nombre exacto | Valor |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | La Project URL de Supabase |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | La clave pública publishable o anon |
| NEXT_PUBLIC_ENABLE_DEMO | false |

No pongas comillas alrededor de los valores. Aunque la segunda variable se llame ANON_KEY, acepta la nueva clave publishable. Usar `false` oculta la entrada demo en esta publicación para que las primeras pruebas se guarden en Supabase.

7. Pulsa **Deploy** y espera a que termine. Vercel te dará una dirección HTTPS de producción. Guarda la URL estable del proyecto, no sólo una dirección temporal de preview.
8. Si agregas o cambias variables después de desplegar, ejecuta **Redeploy**. Estas variables se incorporan durante la compilación.

Para Preview, usa un proyecto Supabase de pruebas independiente cuando empieces a introducir datos reales. No hace falta activar previews para la primera instalación.

Referencias: https://vercel.com/docs/project-configuration/vercel-json y https://vercel.com/docs/functions/runtimes/node-js/node-js-versions

## 7. Volver a Supabase y autorizar la dirección

1. Abre **Authentication → URL Configuration**.
2. En **Site URL** pega la URL HTTPS estable que te entregó Vercel, sin agregar `/login`.
3. En **Redirect URLs** agrega esa URL y su variante terminada en `/login`.
4. Guarda. Si después agregas un dominio propio, actualiza Site URL y las direcciones autorizadas.

Referencia: https://supabase.com/docs/guides/auth/redirect-urls

## 8. Primera prueba real

1. Abre la URL de Vercel en tu celular y entra con el correo/contraseña del administrador que creaste.
2. Comprueba que no aparezca la etiqueta **Modo demo**.
3. Crea **Prueba Almacén**, elige **Almacén** y comienza.
4. Escanea un QR/CODE128 que contenga `DEMO-ACC-X`, o escribe ese código. Guarda una cantidad.
5. Identifica `DEMO-CHC-110`, registra `PRUEBA001` y toma una fotografía.
6. Intenta registrar `PRUEBA-001`: debe aparecer la alerta de duplicado y no debe aumentar el número de unidades.
7. Termina ese producto. Revisa también los restantes y confirma cero si no hay unidades.
8. Recarga y abre la misma sesión desde otro dispositivo: cantidades y series deben seguir guardadas.
9. Comprueba las filas en Supabase y la foto en Storage.
10. Termina el conteo, revisa y exporta a Excel. Sin importar referencia, verás **Sin referencia**, lo cual es correcto.
11. Para probar diferencias, crea otro inventario como borrador, importa una referencia desde **Importaciones → Existencias esperadas**, y después comienza el conteo ciego.

No se borra la prueba silenciosamente: usa nombres que la identifiquen como tal. Antes de trabajar con catálogo real, desactiva los productos ficticios desde sus fichas e importa el catálogo de EMYCE.

## Si algo falla

- **Iniciar sesión deshabilitado:** faltan variables de compilación o hace falta Redeploy.
- **Acceso pendiente:** el perfil no está activo. Revisa el resultado de la consulta del administrador.
- **No llega el correo:** revisa SMTP; la cuenta inicial creada y confirmada en el panel no necesita ese correo para iniciar sesión.
- **404 al recargar una sesión:** comprueba que `vercel.json` está en la raíz y que el proyecto utiliza sus rewrites.
- **No abre la cámara:** usa HTTPS y autoriza la cámara en el navegador del teléfono. Sigue disponible escribir el código.
- **No aparecen ubicaciones/productos:** comprueba que ejecutaste el seed, que el perfil esté activo y que la URL/clave sean del mismo proyecto.
- **Error al crear usuario:** revisa primero que la migración terminara correctamente; el perfil depende de su trigger.

Si necesitas ayuda, comparte el texto del error y la pantalla donde aparece, sin incluir contraseñas ni claves secretas.
