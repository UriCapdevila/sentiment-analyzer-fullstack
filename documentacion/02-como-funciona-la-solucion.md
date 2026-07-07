# Como funciona la solucion

## Explicacion simple

La aplicacion esta dividida en tres partes que trabajan juntas.

1. El usuario escribe una resena en la pantalla.
2. La pantalla envia esa resena al backend.
3. El backend revisa que el texto sea valido y se lo manda al servicio de IA.
4. El servicio de IA analiza el texto y devuelve un resultado.
5. El backend le devuelve ese resultado a la pantalla.
6. La pantalla muestra el veredicto con colores y datos simples.

## Recorrido de una resena

```text
Usuario
  -> Frontend
  -> Backend
  -> Servicio de IA
  -> Backend
  -> Frontend
  -> Resultado visual
```

## Que hace cada paso

### 1. El usuario escribe

La persona escribe una resena o comentario. Por ahora el analisis funciona mejor en ingles porque el motor actual usa TextBlob, una libreria simple orientada principalmente a textos en ingles.

### 2. El frontend envia el texto

El frontend es la parte visual. Toma el texto y lo manda al backend usando una direccion configurable.

Antes estaba fija en `http://localhost:3000`. Ahora usa `VITE_API_URL`, lo que permite cambiar la direccion cuando se haga deploy o cuando se use otro entorno.

### 3. El backend valida

El backend funciona como puerta de entrada. Antes pasaba el texto casi sin revisar. Ahora valida:

- que exista texto
- que sea texto real
- que no este vacio
- que no supere el maximo permitido

Esto evita errores raros y prepara el proyecto para un uso mas serio.

### 4. El backend llama al servicio de IA

El backend envia el texto al microservicio de IA. Ahora esa conexion tiene un tiempo maximo de espera. Si la IA no responde, el backend corta la espera y devuelve un error claro.

Esto es importante porque una aplicacion no deberia quedarse congelada esperando para siempre.

### 5. El servicio de IA analiza

El servicio de IA usa TextBlob para calcular:

- polaridad: si el texto se inclina a positivo o negativo
- subjetividad: si parece mas opinion que hecho
- palabras clave: frases o temas detectados

Despues etiqueta el resultado como positivo, negativo o neutro.

### 6. El resultado vuelve a la pantalla

La pantalla recibe la respuesta y muestra:

- veredicto
- polaridad
- subjetividad
- palabras clave
- texto original

## Que pasa si algo falla

Ahora los errores son mas ordenados:

- si falta texto, el usuario recibe un mensaje claro
- si el texto es demasiado largo, se informa el limite
- si el servicio de IA no responde, el backend responde con un error entendible
- si el frontend recibe un error del backend, intenta mostrar ese mensaje
