# Proximos pasos

## Objetivo recomendado

Convertir la aplicacion en una herramienta de insights de feedback.

La idea no seria solamente decir si un comentario es positivo o negativo, sino ayudar a responder preguntas como:

- de que se quejan mas los usuarios
- que cosas valoran
- que temas aparecen seguido
- si la satisfaccion mejora o empeora con el tiempo
- que comentarios merecen atencion primero

## Camino 1: Persistencia e historial

Este es el siguiente paso mas natural.

### Que agregaria

- base de datos
- guardar cada analisis
- listar analisis anteriores
- filtrar por sentimiento
- ordenar por fecha
- ver detalle de cada comentario

### Por que conviene

Sin historial, la app analiza textos sueltos. Con historial, empieza a convertirse en producto.

## Camino 2: Dashboard

Despues de guardar analisis, se puede crear una vista de resumen.

### Que podria mostrar

- cantidad total de comentarios
- porcentaje positivos, negativos y neutros
- sentimiento promedio
- palabras clave mas repetidas
- ultimos comentarios analizados

### Por que conviene

Un dashboard transforma datos sueltos en informacion facil de entender.

## Camino 3: Mejor IA

El motor actual esta bien para empezar, pero tiene limites.

### Mejoras posibles

- soporte real para espanol
- deteccion automatica de idioma
- clasificacion por categorias
- resumen automatico de problemas frecuentes
- explicacion del resultado

### Decision tomada

La direccion elegida es usar un LLM como motor principal de analisis y mantener el motor local como fallback.

Esto permite que el producto entienda mejor:

- contexto
- ironia
- comentarios mixtos
- severidad
- riesgo de churn
- acciones recomendadas

### Configuracion del proveedor LLM

El servicio de IA soporta estas variables:

```env
ANALYSIS_PROVIDER=auto
GEMINI_API_KEY=tu_api_key
GEMINI_MODEL=gemini-3.5-flash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
LLM_TIMEOUT_SECONDS=25
```

En modo `auto`, si existe `GEMINI_API_KEY`, el servicio usa Gemini. Si no hay Gemini pero existe `OPENAI_API_KEY`, usa OpenAI. Si no hay key o el proveedor falla, vuelve al analizador local.

Para la etapa gratuita, la recomendacion es enviar solo textos de prueba, anonimizados o publicos. Antes de analizar datos reales de clientes, conviene pasar a un plan/proveedor con reglas claras de privacidad y no entrenamiento.

### Categorias utiles

Podriamos clasificar comentarios por:

- precio
- soporte
- experiencia de usuario
- rendimiento
- calidad
- entrega
- bugs

## Camino 4: Usuarios y proyectos

Cuando haya historial, puede tener sentido agregar usuarios.

## Camino 5: MVP cloud en Cloudflare

La direccion elegida para escalar el producto es llevar una primera version cloud a Cloudflare.

La arquitectura objetivo es:

```text
Cloudflare Pages
  -> Cloudflare Worker
  -> Cloudflare AI Gateway
  -> Gemini API
  -> Cloudflare D1
```

La idea es mantener la calidad de Gemini, pero agregar una capa de control con Cloudflare:

- API key segura como secret
- observabilidad de llamadas LLM
- rate limiting
- posible cache
- historial en D1
- endpoints para dashboard e insights

La carpeta `cloudflare-worker/` contiene la base de esta API cloud. Esta separada del backend local para poder avanzar sin romper el laboratorio actual.

Endpoints iniciales:

- `POST /api/review`: analiza y guarda feedback
- `GET /api/reviews`: lista historial
- `GET /api/insights`: resume metricas utiles para decision

Cuando este desplegado, el frontend solo debera cambiar `VITE_API_URL` para apuntar al Worker.

### Que permitiria

- login
- guardar historiales personales
- separar proyectos o productos
- comparar feedback entre productos

### Cuando conviene

No conviene hacerlo demasiado pronto. Primero deberia existir una razon clara para guardar datos por usuario.

## Camino 5: Deploy

Cuando la base este lista, se puede publicar.

### Opciones simples

- frontend en Vercel o Cloudflare Pages
- backend en Render, Fly.io o Railway
- AI service en Render, Fly.io o Railway
- base de datos en PostgreSQL gestionado

## Recomendacion de orden

1. Agregar base de datos e historial.
2. Crear dashboard basico.
3. Activar y evaluar el proveedor LLM con casos reales.
4. Agregar tests automaticos.
5. Preparar deploy.
6. Recien despues evaluar usuarios y autenticacion.

## Proxima decision concreta

La pregunta mas importante ahora es:

```text
Queremos que la siguiente version sea mas tecnica y robusta, o mas visual y orientada a producto?
```

Mi recomendacion: avanzar con persistencia + dashboard basico. Es el punto donde el proyecto empieza a mostrar valor real.
