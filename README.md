# Casa de Hongos — sistema de administración

Aplicación web de administración con ventas, gastos, visitas, repartos, stock, cuentas y rentabilidad. Los datos se guardan en el navegador y se sincronizan con Supabase al iniciar sesión.

Los costos, precios, clientes y teléfonos no vienen precargados: ingresalos en Configuración y Agenda al comenzar. Los datos existentes de cada navegador o cuenta Supabase se conservan.

## Configuración inicial de Supabase

1. En Supabase, abrí **SQL Editor**, pegá el contenido de `supabase/schema.sql` y ejecutalo.
2. En **Project Settings → API**, copiá la **Project URL** y la clave pública **anon / publishable**. No uses `service_role` ni una clave secreta.
3. Abrí la web. En la primera pantalla pegá esos dos valores.
4. Creá una cuenta con tu email y contraseña. Si Supabase pide confirmación por email, confirmala y después iniciá sesión.
5. Los movimientos que ya estaban guardados en ese navegador se copian a la cuenta de Supabase si todavía no existe una copia remota.

La tabla `public.app_state` guarda el estado de la aplicación como JSON. Las políticas RLS limitan lectura y escritura a la cuenta autenticada que creó cada fila. Cada cuenta tiene su propio estado; para compartir una misma operación entre varias personas hace falta definir roles y acceso compartido antes de habilitarlo.

## Publicación

El sitio es estático y Netlify puede publicar `index.html` como página principal. Configurá el directorio de publicación como la raíz del repositorio. La URL y la clave pública se ingresan en cada navegador desde la pantalla inicial; no se incluye ninguna clave privada en el repositorio.

