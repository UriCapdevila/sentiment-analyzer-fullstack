# Cambios realizados

Actualizado al 8 de julio de 2026.

## Cambio principal

El proyecto paso de ser una demo local de analisis de sentimiento a una primera base SaaS desplegada en Cloudflare.

Antes:

```text
React -> Express -> FastAPI -> TextBlob
```

Ahora, para el producto cloud:

```text
React -> Cloudflare Worker -> AI Gateway -> Gemini -> D1
```

## Producto y experiencia

Se reoriento la interfaz para venderse como SaaS:

- landing con propuesta de valor mas clara
- navegacion por secciones
- demo publica integrada
- tabla de precios mock para validar posicionamiento
- FAQ
- panel privado separado de la landing
- modulo de dashboard
- modulo de uso
- modulo de CSV
- modulo de analisis manual
- modulo de historial
- lectura ejecutiva del workspace
- prioridades por riesgo e impacto
- exportacion de reporte ejecutivo

## IA

Se abandono el enfoque principal basado en TextBlob para el producto real.

La decision fue usar Gemini como motor principal porque entiende mejor:

- feedback en espanol
- comentarios mixtos
- intencion del usuario
- riesgo de churn
- severidad
- recomendaciones accionables

Cloudflare AI Gateway queda como capa intermedia para mejorar observabilidad, control y escalabilidad.

## Demo vs producto real

Se separaron dos flujos:

- demo publica: no guarda datos reales en D1
- producto privado: guarda analisis reales asociados al workspace

Esto evita llenar la base de datos con pruebas y cuida recursos.

## Autenticacion

Se agrego acceso privado con usuario y contrasena.

Hoy existe:

- login
- logout
- sesion
- workspace
- limite mensual por plan
- endpoints protegidos

Todavia falta:

- registro desde la app
- recuperacion de contrasena
- roles y permisos
- hardening de seguridad antes de uso comercial amplio

## Historial y CRUD

El historial privado ya permite:

- crear analisis
- listar analisis
- eliminar analisis con confirmacion

Todavia no existe edicion de analisis guardados. Para este tipo de producto, eso no es urgente: normalmente conviene conservar el resultado como evidencia historica y permitir borrar si el cliente no lo quiere almacenar.

## CSV

Se agrego carga manual de CSV para el plan unipersonal.

La version actual permite:

- seleccionar un archivo CSV
- detectar columnas
- elegir la columna de feedback
- previsualizar filas
- procesar un lote chico
- guardar resultados reales
- exportar resultados
- continuar aunque algunas filas fallen

Limitaciones actuales:

- no soporta todavia Excel `.xlsx`
- no soporta todavia PDF
- el lote esta limitado para cuidar cuota y costos

## Metricas

Se agrego medicion de uso del LLM.

Hoy registramos:

- intentos
- exitos
- fallos
- errores 429
- proveedor
- modelo
- ruta demo/producto
- canal
- area
- longitud del texto
- latencia
- tokens aproximados
- error recibido

Esto permite controlar costos, estabilidad y limites desde el inicio.

## Control de costo y cuota

Se reforzo el control antes de llamar al LLM:

- el backend revisa el limite mensual antes de pedir un nuevo analisis
- los intentos bloqueados por limite quedan registrados como metrica
- si el mismo workspace ya analizo exactamente el mismo feedback con el mismo contexto, se reutiliza el resultado anterior
- el CSV muestra cuantas filas intentara procesar y cuantos analisis quedan disponibles

Esto reduce gasto accidental y prepara el modelo de suscripcion.

## Reportes

Se agrego un primer reporte ejecutivo exportable en Markdown.

Incluye:

- resumen ejecutivo
- indicadores principales
- distribucion por sentimiento
- areas con mayor atencion
- temas recurrentes
- prioridades sugeridas
- feedback reciente

## Cloudflare

Se desplego:

- Worker API
- Pages frontend
- D1 database
- AI Gateway
- secrets de produccion

Tambien se conecto el proyecto a GitHub para sostener un flujo mas ordenado.
