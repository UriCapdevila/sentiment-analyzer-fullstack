# InsightPulse Cloudflare Worker

API cloud para el MVP SaaS de InsightPulse. Esta carpeta esta separada del backend local para poder escalar, desplegar y depurar la version cloud sin acoplarla al laboratorio Node/FastAPI.

## Arquitectura

```text
Cloudflare Pages
  -> Cloudflare Worker
  -> Cloudflare AI Gateway
  -> Google Gemini API
  -> Cloudflare D1
```

## Estructura

- `src/index.ts`: entrada del Worker.
- `src/router.ts`: rutas HTTP.
- `src/http/`: CORS, request parsing y respuestas de error.
- `src/domain/`: tipos, errores y validacion.
- `src/infrastructure/`: integraciones externas, hoy Gemini via AI Gateway.
- `src/repositories/`: acceso D1.
- `src/services/`: casos de uso de producto.
- `migrations/`: schema versionado de D1.

## Endpoints

- `GET /health`: estado de la API.
- `POST /api/review`: analiza y guarda feedback.
- `GET /api/reviews?limit=25&offset=0`: historial.
- `GET /api/insights?days=30`: metricas para decision.

`POST /api/review` conserva el contrato que ya usa el frontend:

```json
{
  "text": "La app es util, pero checkout falla y soporte demora.",
  "channel": "manual",
  "customerRef": "cliente-demo",
  "productArea": "checkout"
}
```

## Configuracion local

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.dev.vars` desde la plantilla:

```bash
copy .dev.vars.example .dev.vars
```

3. Completar secretos:

```env
GEMINI_API_KEY=tu_key_de_google_ai_studio
CF_AIG_TOKEN=opcional_si_el_gateway_es_autenticado
```

4. Crear D1 en Cloudflare y reemplazar `database_id` en `wrangler.jsonc`:

```bash
npx wrangler d1 create insightpulse-feedback
```

5. Generar tipos y migrar:

```bash
npm run cf-typegen
npm run db:migrate:local
npm run dev
```

## Secrets de produccion

Los secretos nunca van en Git ni en `wrangler.jsonc`.

```bash
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put CF_AIG_TOKEN
```

Si el AI Gateway no requiere autenticacion, `CF_AIG_TOKEN` puede omitirse.

## Deploy

```bash
npm run cf-typegen
npm run typecheck
npm run db:migrate:remote
npm run deploy
```

Luego el frontend debe apuntar su `VITE_API_URL` al dominio del Worker o a la ruta conectada en Cloudflare Pages.
