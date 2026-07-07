# Cambios realizados

## Enfoque general

La aplicacion ya funcionaba como demo. Lo que hicimos fue darle una base mas seria para que pueda crecer sin romperse facil.

No agregamos una arquitectura pesada ni funcionalidades grandes todavia. Primero reforzamos la base.

## Cambios en el backend

### Configuracion por entorno

Antes el backend tenia valores fijos dentro del codigo. Ahora se pueden configurar desde variables de entorno.

Esto permite cambiar cosas como:

- puerto del backend
- direccion del servicio de IA
- tiempo maximo de espera
- limite de caracteres
- origen permitido del frontend

### Validacion de texto

Ahora el backend revisa que el texto:

- exista
- sea realmente texto
- no este vacio
- no sea demasiado largo

Esto reduce errores y evita que el sistema procese entradas absurdas.

### Timeout al llamar a la IA

Antes, si el servicio de IA no respondia, el backend podia quedarse esperando. Ahora tiene un tiempo maximo.

Si la IA no responde, el backend devuelve un error claro.

### Health check

Agregamos una ruta `/health`.

Sirve para saber si el backend esta vivo. Es muy util para deploys, monitoreo y pruebas rapidas.

## Cambios en el servicio de IA

### Respuestas mas claras

El servicio ahora define mejor que recibe y que devuelve.

Esto ayuda a que el frontend y el backend sepan que esperar.

### Validacion propia

El servicio de IA tambien valida el texto. Esto es importante porque cada parte del sistema debe cuidar su propia entrada.

### Health check

Tambien agregamos `/health` al servicio de IA.

Asi se puede comprobar si el motor de analisis esta funcionando.

### Dependencias reproducibles

Agregamos `requirements.txt`.

Antes el README explicaba que habia que instalar librerias, pero no habia un archivo formal para hacerlo. Ahora se puede instalar con:

```bash
pip install -r requirements.txt
```

## Cambios en el frontend

### API configurable

Antes el frontend apuntaba a una direccion fija del backend. Ahora usa `VITE_API_URL`.

Esto prepara el proyecto para deploy.

### Mejor manejo de errores

Si el backend devuelve un mensaje especifico, el frontend intenta mostrar ese mensaje en lugar de usar siempre uno generico.

### Evita enviar texto vacio

Ahora se usa el texto limpio, sin espacios al principio o final, para decidir si se puede analizar.

## Cambios en la documentacion principal

El README fue reescrito para explicar mejor:

- que hace el proyecto
- como esta dividido
- como correr cada servicio
- que endpoints existen
- hacia donde puede crecer

## Seguridad y mantenimiento

Se ejecuto `npm audit fix` en backend y frontend.

Resultado:

- backend: 0 vulnerabilidades reportadas
- frontend: 0 vulnerabilidades reportadas

Esto no significa que el proyecto sea "seguro para todo", pero si elimina problemas conocidos de dependencias Node detectados por npm en este momento.
