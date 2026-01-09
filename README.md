# 🔮 Sentiment Analyzer - Full Stack AI App

Una aplicación web moderna que utiliza **Procesamiento de Lenguaje Natural (NLP)** para analizar reseñas de usuarios en tiempo real. Detecta polaridad (positivo/negativo), subjetividad y extrae palabras clave mediante una arquitectura de microservicios.

![Estado del Proyecto](https://img.shields.io/badge/Estado-Terminado-green)
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