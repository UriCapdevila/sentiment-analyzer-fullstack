# Documentacion de InsightPulse

Actualizada al 8 de julio de 2026.

Esta carpeta explica el producto en lenguaje no tecnico para tomar decisiones de negocio y de desarrollo sin tener que leer el codigo.

## Como leer esta documentacion

1. `01-resumen-ejecutivo.md`: que es InsightPulse, para quien sirve y en que estado esta.
2. `02-como-funciona-la-solucion.md`: recorrido simple desde una opinion hasta un insight.
3. `03-secciones-del-sistema.md`: que hace cada parte del sistema.
4. `04-cambios-realizados.md`: avances concretos que ya quedaron implementados.
5. `05-proximos-pasos.md`: roadmap recomendado para escalar el producto.
6. `06-despliegue-cloudflare.md`: como estamos usando Cloudflare y GitHub.
7. `07-foda-2026-07-08.md`: fortalezas, oportunidades, debilidades y amenazas del proyecto hoy.

## Estado actual

InsightPulse ya no es solo una demo de sentimiento. Hoy es la base de un SaaS para convertir opiniones de clientes en senales accionables.

La solucion permite:

- probar una demo publica sin guardar datos reales
- ingresar a un panel privado con usuario y contrasena
- analizar feedback manual con Gemini
- cargar CSV simples desde el panel privado
- guardar historial por workspace
- eliminar feedback del historial
- ver metricas de uso, errores, latencia y tokens
- ver una lectura ejecutiva del workspace
- exportar un reporte ejecutivo en Markdown
- evitar llamadas duplicadas exactas al LLM
- operar sobre Cloudflare Pages, Workers, D1 y AI Gateway

## Decision de producto vigente

El enfoque recomendado es construir primero una suscripcion unipersonal para emprendedores:

- carga manual de CSV
- analisis con Gemini
- resumen ejecutivo
- deteccion de problemas, oportunidades y patrones
- historial privado
- limite mensual de analisis
- exportacion simple
- billing en una etapa posterior
