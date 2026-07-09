# Proximos pasos

Actualizado al 8 de julio de 2026.

## Norte del producto

InsightPulse debe crecer como una herramienta simple para tomar decisiones desde feedback real, no como una demo tecnica de IA.

El objetivo del MVP es:

```text
Subi feedback simple, obtene patrones claros, prioriza acciones y controla el uso.
```

## Prioridad 1: cerrar el plan unipersonal

El primer plan comercial deberia enfocarse en emprendedores y equipos chicos.

Alcance recomendado:

- carga manual de CSV
- soporte para Excel
- soporte para PDF simple
- resumen ejecutivo por lote
- deteccion de problemas frecuentes
- oportunidades detectadas
- patrones por area/canal
- historial privado
- limite mensual visible
- exportacion simple

Esto nos permite vender una promesa concreta sin construir todavia una plataforma enterprise.

## Prioridad 2: mejorar el dashboard

El dashboard ya empezo a evolucionar de metricas basicas a lectura de negocio.

Ya existe una primera version con:

- lectura ejecutiva del periodo
- distribucion por sentimiento
- areas criticas
- temas repetidos
- prioridades por riesgo e impacto
- exportacion de reporte

Luego conviene agregar:

- problemas mas repetidos
- oportunidades mas repetidas
- temas por area
- riesgo de churn por cliente o segmento
- evolucion semanal
- comentarios que merecen respuesta urgente
- resumen ejecutivo del periodo

## Prioridad 3: calidad operativa

Antes de sumar muchos usuarios, conviene fortalecer:

- pruebas automaticas del Worker
- pruebas de frontend para flujos criticos
- validacion mas estricta de payloads
- rate limiting por workspace
- manejo de cuota mensual antes de llamar al LLM
- limpieza/retencion de datos
- backups/export de D1
- logs utiles para depurar

## Prioridad 4: usuarios y billing

Cuando el flujo de valor este mas claro, sumar:

- registro de usuario
- alta de workspace
- cambio de contrasena
- recuperacion por email
- Stripe u otro billing
- bloqueo suave al superar limite mensual
- upgrade de plan

## Prioridad 5: integraciones

No conviene empezar por integraciones. Primero debemos validar que el analisis manual produce valor.

Luego podrian venir:

- Google Sheets
- formularios
- Zendesk
- Intercom
- Slack
- Webhooks
- API publica

## Decision recomendada para la siguiente iteracion

Avanzar con una funcionalidad de negocio visible:

```text
Resumen ejecutivo por lote CSV con una lectura consolidada del archivo.
```

Por que:

- aprovecha lo que ya existe
- no requiere billing todavia
- aumenta mucho el valor percibido
- ayuda a vender el producto
- obliga a pensar en patrones, no solo registros individuales

Despues de eso, el siguiente paso natural seria soporte para Excel.
