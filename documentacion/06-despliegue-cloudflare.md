# Despliegue en Cloudflare

Este documento resume como quedo preparado InsightPulse para pasar de una demo local a un servicio desplegable en la nube.

## Que queda conectado

El Worker de produccion se llama `insightpulse-api` y esta conectado al repositorio de GitHub:

```text
UriCapdevila/sentiment-analyzer-fullstack
```

La rama que representa produccion es `main`. Cada cambio que subamos a esa rama puede iniciar un build automatico en Cloudflare.

## Como construye Cloudflare el Worker

Cloudflare entra a la carpeta:

```text
/cloudflare-worker
```

Luego ejecuta:

```bash
npm ci && npm run typecheck
```

Si la validacion pasa, despliega con:

```bash
npx wrangler deploy
```

Esto nos da una barrera minima de calidad antes de publicar: el codigo TypeScript tiene que compilar correctamente.

## Que no va al repositorio

Las claves sensibles no se guardan en GitHub. Se cargan como secretos de Cloudflare.

Los secretos relevantes son:

- `GEMINI_API_KEY`: clave del proveedor LLM.
- `CF_AIG_TOKEN`: token para Cloudflare AI Gateway, si el gateway requiere autenticacion.

El repositorio puede explicar que variables existen, pero nunca debe incluir sus valores reales.

## Flujo recomendado

Para cambios normales de producto:

1. Desarrollar y probar localmente.
2. Subir cambios a una rama de trabajo o a `staging`.
3. Validar que el analisis sigue respondiendo bien.
4. Llevar a `main` solo lo que queremos publicar.
5. Dejar que Cloudflare haga el build y deploy automatico.

Para un MVP simple, podemos trabajar directo sobre `main` cuando el cambio sea pequeno y este verificado. A medida que el producto crezca, conviene usar `staging` como ambiente previo.

## Siguiente paso: frontend cloud

El Worker ya queda preparado para servir como API cloud. El siguiente paso es conectar el frontend a Cloudflare Pages.

Configuracion esperada para Pages:

```text
Root directory: frontend
Build command: npm run build
Output directory: dist
Environment variable: VITE_API_URL=https://insightpulse-api.uricapdevil4.workers.dev
```

Cuando Pages entregue su URL publica, hay que agregar esa URL a `ALLOWED_ORIGINS` en el Worker para permitir llamadas desde el frontend desplegado.

