# Como funciona la solucion

Actualizado al 8 de julio de 2026.

## Explicacion simple

InsightPulse recibe una opinion de cliente, la envia a un modelo de IA y devuelve una lectura estructurada para negocio.

El resultado no se limita a "positivo" o "negativo". Tambien intenta detectar:

- resumen ejecutivo
- temas principales
- severidad
- riesgo de abandono
- impacto estimado
- accion recomendada
- categorias del problema

## Dos recorridos distintos

### Demo publica

La demo de la landing sirve para probar el valor del producto sin llenar la base de datos con pruebas.

Recorrido:

```text
Visitante
  -> Landing en Cloudflare Pages
  -> Worker: /api/demo/review
  -> Gemini via AI Gateway
  -> Respuesta visual
  -> Historial temporal en el navegador
```

Caracteristicas:

- no requiere login
- no guarda el feedback en D1
- conserva un historial temporal en cache del navegador
- el historial se borra solo despues de un tiempo
- sirve para ventas, demostraciones y pruebas livianas

### Producto privado

El panel privado es el espacio donde se procesan datos reales del cliente.

Recorrido:

```text
Usuario autenticado
  -> Panel privado /app
  -> Worker: /api/review
  -> Gemini via AI Gateway
  -> D1 guarda el analisis
  -> Dashboard, historial y metricas
```

Caracteristicas:

- requiere usuario y contrasena
- guarda historial por workspace
- permite eliminar feedback guardado
- registra metricas de uso
- respeta un limite mensual de analisis

## Que devuelve la IA

Para cada opinion, la solucion intenta generar:

- sentimiento: Positivo, Negativo, Neutro o Mixto
- score numerico
- subjetividad
- confianza
- tono
- severidad
- riesgo de churn
- impacto
- resumen
- accion recomendada
- palabras clave
- categorias

## Que pasa si algo falla

El sistema ya maneja errores importantes:

- texto vacio o invalido
- falta de sesion
- opinion demasiado larga
- errores del proveedor LLM
- limite 429 de Gemini
- intentos fallidos registrados como metrica

Esto es valioso porque permite cuidar costos, detectar problemas y entender por que una prueba no respondio.

