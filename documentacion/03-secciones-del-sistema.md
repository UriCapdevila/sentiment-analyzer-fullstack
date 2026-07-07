# Secciones del sistema

## Vista general

El proyecto esta organizado en tres carpetas principales:

```text
frontend
backend
ai-service
```

Cada una tiene una responsabilidad distinta.

## Frontend

Carpeta: `frontend`

Es la parte que ve el usuario. Incluye la pantalla donde se escribe la resena y donde se muestra el resultado.

### Que hace

- muestra el formulario de texto
- evita enviar texto vacio
- manda el texto al backend
- muestra mensajes de error
- muestra el resultado del analisis

### Que mejoramos

Antes el frontend llamaba siempre a `http://localhost:3000`. Ahora usa una variable llamada `VITE_API_URL`.

Eso significa que la misma app puede funcionar en:

- desarrollo local
- servidor de pruebas
- produccion

sin cambiar codigo interno.

## Backend

Carpeta: `backend`

Es la puerta de entrada de la aplicacion. No hace el analisis de IA directamente; coordina la comunicacion entre la pantalla y el servicio de IA.

### Que hace

- recibe la resena desde el frontend
- revisa que el texto sea valido
- limita el tamano del texto
- llama al servicio de IA
- devuelve el resultado al frontend
- devuelve errores claros si algo falla

### Por que es importante

El backend permite que el frontend no tenga que conocer detalles internos del sistema de IA. Tambien es el lugar correcto para agregar en el futuro:

- usuarios
- historial
- permisos
- limites de uso
- metricas
- logs
- integracion con base de datos

## Servicio de IA

Carpeta: `ai-service`

Es el motor que analiza el texto. Esta hecho con FastAPI y TextBlob.

### Que hace

- recibe texto
- calcula sentimiento
- calcula subjetividad
- extrae palabras clave
- devuelve una respuesta estructurada

### Limitacion actual

TextBlob es una buena primera version, pero no es el mejor motor para espanol ni para analisis avanzado. Sirve para demostrar el flujo, pero el producto ganaria mucho con un modelo multilenguaje o una capa de IA mas potente.

## Documentacion

Carpeta: `documentacion`

Es esta carpeta. Su objetivo es explicar el proyecto desde el punto de vista funcional y de producto, no desde el codigo.

## Imagenes

Carpeta: `imagenes`

Guarda recursos visuales usados por el README, como la captura de pantalla de la demo.
