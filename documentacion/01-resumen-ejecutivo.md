# Resumen ejecutivo

Actualizado al 8 de julio de 2026.

## Que es InsightPulse

InsightPulse es una plataforma SaaS en construccion para analizar opiniones de clientes y transformarlas en informacion util para decidir.

En lugar de leer comentarios uno por uno, el producto busca responder preguntas como:

- que problemas aparecen con mas frecuencia
- que clientes muestran riesgo de abandono
- que areas del producto generan friccion
- que oportunidades se repiten
- que accion conviene tomar primero

## Que hace hoy

La version actual ya permite analizar feedback real con un LLM y guardar los resultados en un workspace privado.

Funciones disponibles:

- landing publica con demo funcional
- demo sin persistencia real en base de datos
- panel privado en `/app`
- login con usuario y contrasena
- analisis manual de opiniones
- carga de CSV para lotes chicos
- historial privado persistido
- eliminacion de feedback guardado
- dashboard basico de insights
- dashboard de negocio por sentimiento, area, temas y prioridades
- reporte ejecutivo exportable
- metricas de consumo del LLM
- despliegue cloud en Cloudflare

## Para quien esta pensado

La primera suscripcion recomendada apunta a emprendedores, founders y equipos chicos que reciben feedback por canales simples:

- planillas
- encuestas
- tickets
- mensajes de soporte
- formularios
- resenas

El usuario ideal no necesita una herramienta compleja de customer success. Necesita subir opiniones, entender que pasa y decidir mejor.

## Propuesta de valor

```text
InsightPulse convierte feedback disperso en senales claras de riesgo, oportunidad y accion.
```

## Estado de madurez

El producto esta en etapa MVP temprana, pero ya supero la fase de experimento local.

Hoy cuenta con:

- arquitectura cloud operativa
- base de datos remota
- autenticacion inicial
- separacion entre demo y producto real
- medicion de uso
- flujo de analisis con Gemini
- frontend orientado a SaaS

Todavia faltan piezas importantes antes de venderlo como producto completo:

- alta de usuarios desde la app
- gestion real de suscripciones
- recuperacion de contrasena
- permisos por workspace
- soporte para Excel y PDF
- filtros avanzados
- integraciones externas
- pruebas automaticas mas amplias
- politicas de retencion de datos
