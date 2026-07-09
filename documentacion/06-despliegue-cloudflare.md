# Despliegue en Cloudflare

Actualizado al 8 de julio de 2026.

## Servicios actuales

InsightPulse usa Cloudflare como base cloud del MVP.

Servicios activos:

- Cloudflare Pages para el frontend
- Cloudflare Workers para la API
- Cloudflare D1 para la base de datos
- Cloudflare AI Gateway para pasar llamadas hacia Gemini
- Secrets de Cloudflare para claves sensibles

## URLs actuales

Frontend:

```text
https://insightpulse-web.pages.dev
```

API:

```text
https://insightpulse-api.uricapdevil4.workers.dev
```

Base de datos:

```text
insightpulse-feedback
```

AI Gateway:

```text
insightpulse
```

## GitHub y despliegue

El repositorio es la fuente de verdad del codigo.

Rama de produccion:

```text
main
```

Hasta ahora venimos usando dos acciones:

- commit y push a GitHub para guardar el estado del proyecto
- deploy con Wrangler a Cloudflare para publicar cambios

La direccion recomendada es que Cloudflare quede conectado a GitHub para builds automaticos desde `main`, manteniendo GitHub como fuente de verdad.

## Que no debe subirse al repo

Nunca deben quedar en GitHub:

- claves de Gemini
- tokens de Cloudflare
- secretos de AI Gateway
- contrasenas reales
- dumps con datos sensibles de clientes

Esos valores deben vivir como secrets de Cloudflare o variables locales no versionadas.

## Limites actuales

Cloudflare Free esta lejos de ser el cuello de botella para este MVP.

El cuello actual es Gemini Free, que ya mostro errores 429 por cuota.

Lectura practica:

- Cloudflare alcanza para seguir desarrollando y testeando el MVP
- Gemini Free sirve para pruebas controladas
- al validar producto con mas usuarios, habra que activar billing del proveedor LLM o sumar una estrategia de fallback/cache

## Flujo recomendado de trabajo

Para cambios chicos:

1. Cambiar codigo local.
2. Probar build/lint/typecheck.
3. Deploy a Cloudflare.
4. Validar en URL publica.
5. Commit y push a GitHub.

Para cambios grandes:

1. Crear rama de trabajo.
2. Probar local.
3. Deploy preview/staging.
4. Revisar visual y funcionalmente.
5. Merge a `main`.
6. Deploy productivo.

