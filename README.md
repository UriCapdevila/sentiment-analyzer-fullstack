# 🔮 Sentiment Analyzer - Full Stack AI App

Una aplicación web moderna que utiliza **Procesamiento de Lenguaje Natural (NLP)** para analizar reseñas de usuarios en tiempo real. Detecta polaridad (positivo/negativo), subjetividad y extrae palabras clave mediante una arquitectura de microservicios.

![Estado](https://img.shields.io/badge/Estado-En_Proceso-yellow)
![Licencia](https://img.shields.io/badge/Licencia-MIT-blue)

## 🚀 Tecnologías (The "Holy Trinity")

Este proyecto implementa una arquitectura desacoplada para demostrar habilidades Full Stack y Data Science:

* **Frontend:** React (Vite) + CSS Modules.
* **Backend Orchestrator:** Node.js (Express) - Gestiona peticiones y seguridad.
* **AI Microservice:** Python (FastAPI + TextBlob) - Motor de análisis de datos.

## 🏗️ Arquitectura

El flujo de datos sigue un patrón de microservicios:

```mermaid
[Usuario] -> [React Frontend] 
    -> (HTTP POST) -> [Node.js Server] 
    -> (HTTP POST) -> [Python AI Service]
    <- (JSON Analysis) <- [Python AI Service]
    <- (JSON Result) <- [Node.js Server]
<- [Visual Feedback] <- [React Frontend]

## 📸 Demo

![Captura de pantalla del analizador funcionando](./screenshots/IA-comentarios.png)
*Análisis de sentimiento con detección de palabras clave y polaridad.*

## 🚧 Roadmap (Próximos Pasos)

El proyecto está en desarrollo activo. Estas son las funcionalidades planificadas para las siguientes versiones:

- [ ] **Soporte Multi-idioma:** Integrar traducción automática o modelos NLP para español.
- [ ] **Base de Datos:** Persistencia de análisis históricos usando SQLite/PostgreSQL.
- [ ] **Autenticación:** Login de usuarios para guardar historiales personales.
- [ ] **Deploy:** Despliegue en la nube (Render/Vercel/AWS).
- [ ] **Mejoras UI:** Modo oscuro y gráficos estadísticos avanzados.

## 📂 Estructura del Proyecto

```bash
sentiment-analyzer-fullstack/
├── ai-service/        # Microservicio Python (FastAPI + TextBlob)
│   ├── main.py        # Lógica de NLP y Endpoints
│   └── requirements.txt
├── backend/           # API Gateway (Node.js + Express)
│   └── server.js      # Orquestación de servicios
├── frontend/          # UI (React + Vite)
│   ├── src/
│   └── package.json
└── README.md