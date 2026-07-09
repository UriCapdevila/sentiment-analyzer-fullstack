# InsightPulse

SaaS en construccion para convertir feedback de clientes en senales accionables de negocio.

![Estado](https://img.shields.io/badge/Estado-MVP_cloud-yellow)
![Stack](https://img.shields.io/badge/Stack-React%20%2B%20Cloudflare%20%2B%20Gemini-blue)

## Que hace

InsightPulse analiza opiniones de clientes y devuelve una lectura estructurada:

- sentimiento: positivo, negativo, neutro o mixto
- resumen ejecutivo
- temas principales
- severidad
- riesgo de churn
- impacto estimado
- accion recomendada
- metricas de uso del LLM

El objetivo ya no es ser solo un detector de sentimiento, sino una plataforma liviana para tomar decisiones desde feedback real.

## Estado actual

Funciones disponibles:

- landing publica orientada a SaaS
- demo publica sin persistencia real en base de datos
- panel privado en `/app`
- login con usuario y contrasena
- analisis manual de feedback
- carga y procesamiento de CSV
- historial privado por workspace
- eliminacion de feedback guardado
- dashboard basico de insights
- metricas de uso, tokens, latencia, errores y 429
- deploy en Cloudflare Pages y Workers

## Arquitectura principal

```text
React + Vite
  -> Cloudflare Pages
  -> Cloudflare Worker API
  -> Cloudflare AI Gateway
  -> Google Gemini API
  -> Cloudflare D1
```

## URLs actuales

Frontend:

```text
https://insightpulse-web.pages.dev
```

API:

```text
https://insightpulse-api.uricapdevil4.workers.dev
```

## Carpetas

- `frontend`: landing y aplicacion privada React.
- `cloudflare-worker`: API principal cloud con auth, D1, Gemini y metricas.
- `documentacion`: explicacion funcional, roadmap y FODA.
- `backend`: backend Express del prototipo original.
- `ai-service`: servicio FastAPI/TextBlob del prototipo original.
- `imagenes`: recursos visuales del proyecto.

## Desarrollo local

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Variable principal:

```env
VITE_API_URL=https://insightpulse-api.uricapdevil4.workers.dev
```

### Worker

```bash
cd cloudflare-worker
npm install
npm run typecheck
npm run dev
```

Secrets necesarios:

```env
GEMINI_API_KEY=
CF_AIG_TOKEN=
```

Los secrets reales no deben subirse al repositorio.

## Calidad

Comandos usados con frecuencia:

```bash
cd cloudflare-worker
npm run typecheck
```

```bash
cd frontend
npm run lint
npm run build
```

## Documentacion

La documentacion de producto esta en:

```text
documentacion/
```

Incluye:

- resumen ejecutivo
- funcionamiento de la solucion
- secciones del sistema
- cambios realizados
- proximos pasos
- despliegue Cloudflare
- FODA fechado al 8 de julio de 2026

## Roadmap inmediato

La siguiente mejora recomendada es crear un resumen ejecutivo por lote CSV:

```text
Carga un archivo simple y recibe problemas, oportunidades, patrones y acciones sugeridas.
```

Luego conviene avanzar con soporte para Excel, PDF y billing.

## Autor

Uriel Capdevila - Full Stack Developer & Data Science enthusiast

