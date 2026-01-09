const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // Permite que React (puerto 5173) nos hable
app.use(express.json()); // Permite recibir JSON

// Ruta principal
app.post('/api/review', async (req, res) => {
    const { text } = req.body;

    // Validación básica
    if (!text) {
        return res.status(400).json({ error: "El texto es obligatorio" });
    }

    console.log(`📝 Recibido para analizar: "${text.substring(0, 30)}..."`);

    try {
        // AQUÍ ocurre la magia: Node llama a Python
        const pythonResponse = await axios.post('http://127.0.0.1:8000/analyze', {
            text: text
        });

        // Devolvemos la respuesta de Python al cliente (React)
        res.json(pythonResponse.data);

    } catch (error) {
        console.error("❌ Error conectando con Python:", error.message);
        res.status(500).json({ 
            error: "El servicio de IA no responde. ¿Está corriendo uvicorn?" 
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Node.js corriendo en http://localhost:${PORT}`);
});