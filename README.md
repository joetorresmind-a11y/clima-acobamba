# AgroClima Local

Proyecto web para registrar observaciones del campo, consultar lecturas horarias de SENAMHI, revisar el pronóstico de Google Weather y organizar alertas manuales. El ZIP incluye el código fuente, una versión estática para GitHub Pages, un flujo de publicación y un Worker que protege las consultas externas.

## Publicar la página en GitHub Pages

1. Descomprime el archivo y sube su contenido a un repositorio de GitHub en la rama `main`.
2. En **Settings → Pages**, selecciona **GitHub Actions** como origen de publicación. El flujo `.github/workflows/pages.yml` publicará el contenido de `github-pages/` cuando subas cambios.
3. Añade el dominio de GitHub Pages a los dominios autorizados de Firebase Authentication.
4. Publica el Worker descrito en la siguiente sección. Cuando tengas su URL, asígnala a `window.AGROCLIMA_API_BASE` en `github-pages/config.js`.

La interfaz y Firebase pueden cargar en GitHub Pages. Pages no ejecuta rutas de servidor; las consultas a SENAMHI y Google Weather pasan por el Worker de Cloudflare incluido en este proyecto.

## Activar el Worker de API

El Worker valida el token de Firebase, limita las solicitudes al origen configurado y sirve de intermediario para SENAMHI y Google Weather. La clave de Google se mantiene como secreto de Cloudflare.

1. Edita `cloudflare-worker/wrangler.toml` y cambia `ALLOWED_ORIGINS` por el origen que muestra GitHub Pages. Para probar localmente, agrega también el origen local que uses.
2. Desde la carpeta del proyecto, instala las dependencias con `npm ci` y autentica Wrangler con `npm exec wrangler -- login`.
3. Publica el Worker: `npm exec wrangler -- deploy --config cloudflare-worker/wrangler.toml`.
4. Guarda la clave sin agregarla al repositorio: `npm exec wrangler -- secret put GOOGLE_WEATHER_API_KEY --config cloudflare-worker/wrangler.toml`.
5. Copia la URL publicada del Worker en `github-pages/config.js`, en `window.AGROCLIMA_API_BASE`, sin una barra final. Sube ese cambio a GitHub para volver a publicar la página.

Google Weather requiere que la API esté habilitada y que el proyecto de Google Cloud tenga facturación configurada. El pronóstico muestra hasta 10 días y 24 horas en unidades métricas.

## Configurar Firebase

La aplicación usa la configuración web entregada para el proyecto `clima-f5f62`.

1. Activa Authentication con correo electrónico y contraseña.
2. Crea Cloud Firestore.
3. Publica las reglas desde la carpeta del proyecto: `firebase deploy --only firestore:rules`.
4. Autoriza el dominio de GitHub Pages en Firebase Authentication.
5. Para designar a una persona administradora, crea su cuenta normalmente y cambia `users/{uid}.role` a `admin` desde Firebase Console. El registro no permite asignar ese rol.

Las cuentas nuevas son `observador`. Cada persona puede administrar sus registros; el perfil `admin` puede consultar los registros del equipo. Las colecciones son `users`, `observations` y `alerts`.

## Funciones incluidas

- Inicio de sesión y creación de cuentas con Firebase Authentication.
- Observaciones manuales y de estación: fecha, hora, ubicación, temperatura, lluvia, humedad, viento, cielo, cultivo y notas.
- Consulta del catálogo SENAMHI WIS 2.0 y de observaciones sinópticas horarias. La lectura importada se puede revisar y completar antes de guardarla.
- Histórico filtrable con gráficos de observaciones guardadas; el pronóstico se muestra aparte.
- Alertas manuales con severidad y estado.
- Modo demostración local con ejemplos identificados como datos de muestra.

El ZIP no incluye una clave de Google Weather. Configúrala en Cloudflare como secreto, no en `config.js` ni en GitHub. La disponibilidad de las observaciones depende del servicio público de SENAMHI.
