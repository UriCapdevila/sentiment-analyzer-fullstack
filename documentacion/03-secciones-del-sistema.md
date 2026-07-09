# Secciones del sistema

Actualizado al 8 de julio de 2026.

## Vista general

El proyecto conserva componentes locales de la primera etapa, pero el producto principal ya esta orientado a Cloudflare.

Arquitectura principal actual:

```text
Frontend React
  -> Cloudflare Pages
  -> Cloudflare Worker API
  -> Cloudflare AI Gateway
  -> Google Gemini
  -> Cloudflare D1
```

## `frontend`

Es la interfaz del producto.

Incluye dos experiencias:

- landing publica
- panel privado SaaS

Funciones principales:

- navegacion por secciones
- demo publica
- login
- dashboard privado
- analisis manual
- carga de CSV
- vista de uso y salud
- historial privado
- eliminacion de feedback con confirmacion

URL productiva actual:

```text
https://insightpulse-web.pages.dev
```

## `cloudflare-worker`

Es la API principal del MVP cloud.

Responsabilidades:

- recibir solicitudes del frontend
- autenticar usuarios
- separar demo de producto real
- llamar a Gemini mediante AI Gateway
- guardar feedback en D1
- listar historial
- eliminar feedback
- calcular insights
- registrar metricas de uso
- responder errores de forma consistente

Endpoints principales:

- `GET /health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `POST /api/demo/review`
- `POST /api/review`
- `GET /api/reviews`
- `DELETE /api/reviews/:id`
- `GET /api/insights`
- `GET /api/usage`

URL productiva actual:

```text
https://insightpulse-api.uricapdevil4.workers.dev
```

## `backend`

Es el backend Node/Express de la primera version local.

Hoy queda como referencia o laboratorio, no como camino principal del SaaS. Puede servir para comparar enfoques o rescatar logica, pero el foco actual esta en Cloudflare Worker.

## `ai-service`

Es el microservicio FastAPI/TextBlob original.

Tambien queda como pieza de laboratorio. Fue util para validar el concepto inicial, pero el producto actual usa Gemini porque interpreta mejor contexto, idioma, severidad e intencion.

## `documentacion`

Es la carpeta de decision y contexto.

Su objetivo no es documentar cada linea de codigo, sino explicar:

- que problema resuelve el producto
- que esta construido
- que falta
- como se despliega
- que riesgos y oportunidades existen

## `imagenes`

Guarda recursos visuales usados por el README o por documentacion.

