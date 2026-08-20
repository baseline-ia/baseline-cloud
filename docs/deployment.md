# Despliegue de baseline-cloud

Esta guía describe cómo desplegar baseline-cloud con PostgreSQL mediante Docker Compose, una plataforma que construya `docker/Dockerfile` o una instalación nativa de Node.js. El procedimiento usa únicamente las rutas, scripts y puertos presentes en este repositorio.

## Ruta rápida

Para un VPS con Docker:

1. Instala Docker 24+ y Docker Compose V2.
2. Clona el repositorio y crea `.env` desde `.env.example`.
3. Genera valores distintos para `POSTGRES_PASSWORD`, `JWT_SECRET` y `TOKEN_PEPPER`.
4. Configura `DATABASE_URL` con el hostname interno `postgres`.
5. Ejecuta `docker compose -f docker/docker-compose.yml up -d`.
6. Desde un checkout con dependencias instaladas, ejecuta `npm run db:migrate` usando la URL publicada en `localhost:5432`.
7. Comprueba `http://localhost:3007/api/health`, crea el primer administrador y desactiva el bootstrap.

Para una PaaS con base de datos gestionada, usa `docker/Dockerfile`, configura las variables de entorno en la plataforma y ejecuta las migraciones desde un entorno con Node.js y acceso a la base de datos.

## Requisitos y convenciones

- PostgreSQL 16 es la base de datos soportada por el repositorio.
- Los scripts requieren Node.js 20 o superior; `package.json` declara `engines.node >=20.0.0`.
- El Dockerfile usa Node.js 20 Alpine y ejecuta Next.js standalone en el puerto `3007`.
- Compose publica la aplicación en `3007` y PostgreSQL únicamente en `127.0.0.1:5432`.
- `DATABASE_URL` dentro de la red Compose usa `postgres:5432`; desde el host usa `localhost:5432`.
- `JWT_SECRET` firma las sesiones del dashboard y `TOKEN_PEPPER` protege los hashes de tokens del CLI. No deben ser iguales ni cambiarse después de un despliegue salvo que se acepte invalidar sesiones o tokens existentes.
- No subas `.env` ni incluyas secretos en imágenes, logs, tickets o repositorios. `.gitignore` excluye `.env` y `.env.local`.

## Variables de entorno

La aplicación lee estas variables en `lib/config.ts`. Las variables `POSTGRES_*` son de Compose y las consume la imagen oficial de PostgreSQL, no la aplicación.

| Variable | Requerida | Alcance | Valor predeterminado | Notas de seguridad y uso |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | No | Aplicación | `development` | Usa `production` en despliegues. |
| `DATABASE_URL` | Sí en despliegue | Aplicación y migraciones | `postgres://baseline:baseline_dev@localhost:5432/baseline_cloud` | En Compose usa `postgres`; desde el host usa `localhost`. Contiene credenciales. |
| `JWT_SECRET` | Sí en despliegue | Aplicación | Valor de desarrollo inseguro de 32+ caracteres | Genera un secreto aleatorio de al menos 32 caracteres. Protege cookies de sesión. |
| `TOKEN_PEPPER` | Sí en despliegue | Aplicación | Valor de desarrollo inseguro de 32+ caracteres | Genera otro secreto aleatorio. Cambiarlo invalida los tokens del CLI. |
| `COOKIE_SECURE` | No | Aplicación | `true` | Déjalo en `true` detrás de HTTPS. Usa `false` solo para HTTP explícito local o de staging. |
| `ALLOWED_ORIGINS` | No | Aplicación | Vacío | Orígenes del navegador separados por comas, sin inventar dominios. |
| `BOOTSTRAP_ADMIN` | No | Aplicación | `true` | `true` permite que el primer signup sea administrador; cambia a `false` inmediatamente después. |
| `RATE_LIMIT_ENABLED` | No | Aplicación | `true` salvo en `test` | No lo desactives en producción salvo una investigación controlada. |
| `POSTGRES_USER` | Sí para Compose | Servicio `postgres` | Ninguno en Compose | Usuario inicial de PostgreSQL; trátalo como secreto junto con su contraseña. |
| `POSTGRES_PASSWORD` | Sí para Compose | Servicio `postgres` | Ninguno en Compose | Contraseña inicial. No la reutilices para otros servicios. |
| `POSTGRES_DB` | Sí para Compose | Servicio `postgres` | Ninguno en Compose | Nombre inicial de la base de datos. |

Genera secretos sin mostrarlos en la documentación:

```bash
openssl rand -base64 48
openssl rand -base64 48
openssl rand -hex 32
```

Pega cada resultado en el destino correspondiente de `.env` y verifica que `JWT_SECRET` y `TOKEN_PEPPER` sean diferentes.

## Opción A: Docker Compose

### 1. Preparar el servidor

```bash
git clone <URL_DEL_REPOSITORIO> baseline-cloud
cd baseline-cloud
cp .env.example .env
```

Edita `.env` y añade o ajusta estos valores. `POSTGRES_*` deben existir porque Compose los interpola antes de iniciar el contenedor:

```dotenv
POSTGRES_USER=baseline
POSTGRES_PASSWORD=<secreto-generado>
POSTGRES_DB=baseline_cloud
DATABASE_URL=postgres://baseline:<secreto-generado>@postgres:5432/baseline_cloud
NODE_ENV=production
JWT_SECRET=<secreto-generado>
TOKEN_PEPPER=<otro-secreto-generado>
BOOTSTRAP_ADMIN=true
COOKIE_SECURE=true
ALLOWED_ORIGINS=https://cloud.example.com
RATE_LIMIT_ENABLED=true
```

Sustituye `https://cloud.example.com` por el origen real o deja `ALLOWED_ORIGINS` vacío si no necesitas esa restricción.

### 2. Iniciar servicios

```bash
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml ps
```

El servicio `cloud` escucha en `3007` dentro y fuera del host (`3007:3007`). El healthcheck consulta `/api/health` en ese mismo puerto. PostgreSQL queda publicado solo como `127.0.0.1:5432`; el contenedor `cloud` no debe usar `localhost` para acceder a PostgreSQL.

### 3. Instalar dependencias y migrar

El runtime standalone del Dockerfile no contiene el checkout completo ni `tsx`. Ejecuta la migración desde el host o desde un job de mantenimiento con Node.js 20+:

```bash
npm install
DATABASE_URL="postgres://baseline:<secreto-generado>@localhost:5432/baseline_cloud" npm run db:migrate
```

`lib/db/migrate.ts` aplica de forma idempotente las migraciones de `lib/db/migrations`. Repite el comando después de cada cambio de esquema. No uses la URL con `@postgres:5432` desde el host: ese hostname solo existe dentro de la red Compose.

### 4. Verificar salud y crear el primer administrador

```bash
curl -i http://localhost:3007/api/health
curl -X POST http://localhost:3007/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","email":"admin@example.com","password":"<contraseña-fuerte>"}'
```

La respuesta esperada de salud es HTTP 200 con `{"status":"ok","service":"baseline-cloud","db":"ok"}`. El primer usuario recibe el rol `admin` únicamente si `BOOTSTRAP_ADMIN=true`; el endpoint devuelve `token.raw` una sola vez para configurar el CLI.

Desactiva el bootstrap y recrea el contenedor de aplicación:

```bash
# Edita .env y cambia BOOTSTRAP_ADMIN=false
docker compose -f docker/docker-compose.yml up -d --force-recreate cloud
```

El signup está limitado por IP. Si el primer intento falla, corrige la causa antes de repetirlo; no desactives el rate limit como solución permanente.

### 5. Backups y rollback

Haz un backup antes de migraciones y actualizaciones:

```bash
docker compose --env-file .env -f docker/docker-compose.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > backup-$(date +%Y%m%d-%H%M%S).sql
```

Conserva el backup fuera del servidor y prueba su restauración periódicamente. Para una restauración planificada, detén escrituras, guarda el estado actual, restaura el dump y vuelve a ejecutar el servicio:

```bash
cat backup.sql | docker compose --env-file .env -f docker/docker-compose.yml exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

No reviertas una migración de Drizzle borrando archivos. Si una versión nueva requiere rollback, restaura la base de datos y despliega la imagen anterior; valida primero en un entorno de prueba.

## Opción B: Dockerfile y plataformas de contenedores

`docker/Dockerfile` es una build multi-stage de Node.js 20 Alpine. `next.config.ts` define `output: 'standalone'`; la imagen final ejecuta `node server.js`, fija `NODE_ENV=production`, `HOSTNAME=0.0.0.0`, `PORT=3007` y expone `3007`.

Es válido para Coolify, Railway, Render, AWS App Runner, CapRover, Dokku y cualquier plataforma que construya un Dockerfile y permita configurar variables y una base PostgreSQL externa. La plataforma debe enrutar al puerto `3007`; no asumas que `3000` es correcto para producción.

### Construir y probar la imagen

Desde la raíz del repositorio:

```bash
docker build -f docker/Dockerfile -t baseline-cloud:local .
docker run --rm -p 3007:3007 --env-file .env \
  -e DATABASE_URL="<URL_ACCESIBLE_DESDE_EL_CONTENEDOR>" baseline-cloud:local
```

El override de `DATABASE_URL` es necesario si `.env` contiene la URL interna de Compose (`@postgres:5432`) y estás probando la imagen con `docker run` aislado.

La base de datos debe ser accesible desde el contenedor. Para migrar, usa un runner con Node.js y el script del repositorio:

```bash
npm install
DATABASE_URL="<URL_DE_POSTGRESQL_GESTIONADO>" npm run db:migrate
```

Después despliega o reinicia la aplicación con la misma `DATABASE_URL`, verifica `https://<dominio>/api/health` y completa el ciclo de bootstrap del administrador descrito arriba. En Coolify, por ejemplo, selecciona el Dockerfile `/docker/Dockerfile` y el puerto `3007`; los nombres exactos de los campos pueden variar por versión de la plataforma.

### Actualizaciones

1. Genera un backup.
2. Construye la nueva imagen o despliega el nuevo commit.
3. Ejecuta `npm run db:migrate` contra la base externa.
4. Comprueba `/api/health` y una página de login.
5. Si falla, conserva logs y revierte a la imagen anterior; restaura la base solo si la migración no es compatible y el procedimiento fue validado.

## Opción C: compilación y ejecución nativas

Esta ruta ejecuta Node.js directamente y requiere PostgreSQL accesible desde el mismo entorno o por red.

```bash
git clone <URL_DEL_REPOSITORIO> baseline-cloud
cd baseline-cloud
npm install
cp .env.example .env
```

Configura `DATABASE_URL` con el hostname real de PostgreSQL. Para una base local, la forma de desarrollo documentada es `localhost:5432`; no uses `postgres` salvo que tu DNS o red lo proporcione.

```bash
npm run db:migrate
npm run build
PORT=3007 npm run start
```

La compilación usa `npm run build` y la ejecución usa `npm run start`, tal como están definidos en `package.json`. Comprueba `http://localhost:3007/api/health`, crea el primer administrador y cambia `BOOTSTRAP_ADMIN=false` antes de exponer el servicio.

Para desarrollo interactivo, el script es `npm run dev` y Next.js usa `http://localhost:3000` por defecto. No confundas ese puerto de desarrollo con el puerto de producción `3007` del Dockerfile y Compose.

## Configuración del CLI

Después de crear un administrador, configura cada máquina o pipeline que enviará telemetría:

```bash
baseline login
```

El comando solicita la URL del servidor y el valor completo de `token.raw`; lo guarda en `~/.baseline/cloud.json`. Para CI también están soportadas:

```bash
export BASELINE_CLOUD_URL=https://cloud.example.com
export BASELINE_CLOUD_TOKEN=<token-raw>
```

Antes de enviar eventos, un administrador debe inscribir cada proyecto en `Dashboard -> Admin -> Projects`. Un proyecto no inscrito recibe `403 project_not_enrolled`. Para desactivar telemetría usa `BASELINE_TELEMETRY=0` o `--no-telemetry`.

## Verificación de puesta en producción

- [ ] `JWT_SECRET` y `TOKEN_PEPPER` son aleatorios, distintos y no están en Git.
- [ ] `DATABASE_URL` es correcta para el contexto: `postgres` dentro de Compose, `localhost` desde el host o el endpoint gestionado en PaaS.
- [ ] PostgreSQL responde y `npm run db:migrate` terminó con éxito.
- [ ] `/api/health` devuelve HTTP 200 y `db: ok`.
- [ ] El primer usuario administrador fue creado y su `token.raw` se almacenó de forma segura.
- [ ] `BOOTSTRAP_ADMIN=false` está aplicado y la aplicación fue recreada o reiniciada.
- [ ] `COOKIE_SECURE=true` está activo detrás de HTTPS.
- [ ] Existe un backup verificable y un plan de rollback.
- [ ] Los proyectos necesarios están inscritos en el panel de administración.

## Solución de problemas

| Síntoma | Comprobación |
| --- | --- |
| Compose no inicia PostgreSQL | Revisa que `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB` estén en `.env`; Compose no les asigna valores predeterminados. |
| El healthcheck falla | Confirma que la aplicación escucha en `3007` y que el mapeo es `3007:3007`; revisa `docker compose -f docker/docker-compose.yml logs cloud`. |
| La aplicación no conecta a la base | Dentro de Compose usa `@postgres:5432`; desde el host usa `@localhost:5432`; en PaaS usa la URL gestionada accesible desde el contenedor. |
| La migración no encuentra módulos o migraciones | No la ejecutes dentro del runtime standalone; usa un checkout con `npm install` y `npm run db:migrate`. |
| `/api/health` devuelve 503 | La ruta ejecuta `SELECT 1`; revisa conectividad, credenciales, SSL requerido por la PaaS y logs de la aplicación. |
| El signup devuelve `bootstrap_disabled` | Ya no se permite crear el primer usuario. Restaura temporalmente el flujo solo con un procedimiento controlado o crea el administrador por el mecanismo administrativo disponible. |
| El login no conserva la sesión por HTTP | `COOKIE_SECURE=true` requiere HTTPS. Para HTTP local o staging establece `COOKIE_SECURE=false`. |
| El CLI recibe `project_not_enrolled` | Inscribe el slug exacto en `Dashboard -> Admin -> Projects`; no es un fallo de autenticación. |

## Rutas de referencia

- `docker/docker-compose.yml`: servicios, puertos, healthchecks y volumen PostgreSQL.
- `docker/Dockerfile`: build y runtime de producción.
- `lib/config.ts`: validación, defaults y transformación de variables.
- `lib/db/migrate.ts`: aplicación idempotente de migraciones.
- `lib/db/migrations/`: historial de migraciones desplegable.
- `app/api/health/route.ts`: endpoint de salud con comprobación de PostgreSQL.
- `app/api/v1/auth/signup/route.ts`: bootstrap del primer administrador y emisión del token inicial.
