# Activar el uso real de EMYCE

**Para la instalación elegida en Vercel, sigue [la guía de Supabase + Vercel](VERCEL_SUPABASE.md)**. Incluye la creación manual del primer administrador, la configuración de Vercel y la primera prueba real. Los pasos siguientes son una referencia general para otros entornos.

La aplicación ya incluye la conexión, autenticación, migración y almacenamiento de fotografías. La demo funciona sin cuenta, pero sus datos son ficticios y se guardan únicamente en el navegador de ese dispositivo. Falta crear el proyecto de tu empresa para compartir datos entre celulares.

1. Abre [Supabase](https://supabase.com/dashboard) y crea una cuenta. Elige **New project**, una organización y el nombre **EMYCE Inventarios**. Elige una región cercana y guarda la contraseña de base de datos en tu gestor de contraseñas. No hace falta compartirla en el chat.
2. Cuando el proyecto termine de prepararse, abre **SQL Editor → New query**. Pega y ejecuta el archivo `supabase/migrations/202609240001_initial.sql` del proyecto entregado. Ejecútalo una sola vez en un proyecto vacío.
3. En otra consulta, ejecuta `supabase/seed.sql`. Crea las cuatro ubicaciones y cuatro productos de prueba. Son ficticios; puedes desactivarlos después de probar y cargar tu catálogo verdadero. Si prefieres comenzar sin productos de prueba, ejecuta sólo la primera sentencia de ubicaciones.
4. En **Connect** copia la **Project URL**. En **Settings → API Keys** copia la **Publishable key** o la clave pública `anon` heredada. Ambas son claves destinadas al cliente. **No copies `secret` ni `service_role`.** [Referencia oficial de claves](https://supabase.com/docs/guides/getting-started/api-keys).
5. En la carpeta de la aplicación copia `.env.example` a `.env.local`. Rellena `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con esos dos valores. El nombre de la segunda variable admite también la clave publishable. Reinicia el desarrollo o vuelve a compilar y publicar si ya estaba alojada.
6. En **Authentication → URL Configuration** configura **Site URL** con la dirección HTTPS donde alojes EMYCE. Para trabajar localmente agrega `http://localhost:3000` a las direcciones permitidas. [Referencia de redirecciones](https://supabase.com/docs/guides/auth/redirect-urls).
7. Abre la app, pulsa **Solicitar una cuenta**, registra tu correo y confirma el enlace recibido. La cuenta aparecerá pendiente de activación.
8. Para convertir esa primera cuenta en administrador, ejecuta esta consulta en SQL Editor, sustituyendo el correo por el tuyo:

```sql
update public.profiles
set role = 'admin', active = true
where id = (select id from auth.users where email = 'TU_CORREO_REAL');
```

9. Sal y vuelve a entrar. Desde **Equipo** podrás activar al resto y asignar `Contador`, `Supervisor` o `Administrador`.
10. Prueba un inventario con dos dispositivos: guarda una serie en el primero e intenta repetirla en el segundo. La base de datos debe rechazarla. Toma una foto y verifica que esté en el bucket privado `inventory-photos`.

El sitio de demostración publicado tiene acceso privado del propietario. Para usarlo con personal de tienda debes configurar el acceso del alojamiento o desplegar los archivos en tu propio dominio HTTPS; el acceso de Supabase se controla por separado.

Cuando tengas el proyecto, sólo hace falta proporcionar la URL del proyecto y su clave **pública** para conectar una nueva compilación. No envíes contraseñas, claves secretas ni service role.
