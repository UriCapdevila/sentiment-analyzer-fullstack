const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 5000;
const MAX_TEXT_LENGTH = Number(process.env.MAX_TEXT_LENGTH) || 5000;
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const aiClient = axios.create({
    baseURL: AI_SERVICE_URL,
    timeout: AI_TIMEOUT_MS,
});

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Origen no permitido por CORS'));
    },
}));
app.use(express.json({ limit: '32kb' }));

app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'sentiment-backend',
        aiServiceUrl: AI_SERVICE_URL,
    });
});

function sendError(res, status, code, message) {
    return res.status(status).json({
        error: {
            code,
            message,
        },
    });
}

app.post('/api/review', async (req, res) => {
    const { text } = req.body;
    const normalizedText = typeof text === 'string' ? text.trim() : '';

    if (!normalizedText) {
        return sendError(res, 400, 'TEXT_REQUIRED', 'El texto es obligatorio');
    }

    if (normalizedText.length > MAX_TEXT_LENGTH) {
        return sendError(
            res,
            413,
            'TEXT_TOO_LONG',
            `El texto no puede superar ${MAX_TEXT_LENGTH} caracteres`,
        );
    }

    console.info('Review received for analysis', {
        textLength: normalizedText.length,
    });

    try {
        const pythonResponse = await aiClient.post('/analyze', {
            text: normalizedText,
        });

        return res.json(pythonResponse.data);
    } catch (error) {
        const status = error.code === 'ECONNABORTED' ? 504 : 502;

        console.error('AI service request failed', {
            message: error.message,
            code: error.code,
            status: error.response?.status,
        });

        return sendError(
            res,
            status,
            'AI_SERVICE_UNAVAILABLE',
            'El servicio de IA no responde. Revisa que FastAPI este corriendo.',
        );
    }
});

app.listen(PORT, () => {
    console.log(`Node.js corriendo en http://localhost:${PORT}`);
});
