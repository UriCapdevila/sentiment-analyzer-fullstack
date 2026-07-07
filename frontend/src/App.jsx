import { useMemo, useState } from 'react'
import axios from 'axios'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const MAX_TEXT_LENGTH = 5000

const EXAMPLE_REVIEW = 'I love the onboarding flow, but the billing page feels confusing and support took too long to answer.'

const sentimentCopy = {
  Positivo: {
    tone: 'Advocacy signal',
    summary: 'El comentario inclina la conversacion hacia satisfaccion y confianza.',
    className: 'positive',
  },
  Negativo: {
    tone: 'Risk signal',
    summary: 'El comentario marca friccion y deberia revisarse como posible prioridad.',
    className: 'negative',
  },
  Mixto: {
    tone: 'Mixed opportunity',
    summary: 'El comentario combina valor percibido con fricciones que pueden afectar adopcion o retencion.',
    className: 'mixed',
  },
  Neutro: {
    tone: 'Context signal',
    summary: 'El comentario no muestra una inclinacion clara y conviene leer el contexto.',
    className: 'neutral',
  },
}

function getApiErrorMessage(error) {
  const apiError = error.response?.data?.error

  if (typeof apiError === 'string') {
    return apiError
  }

  return apiError?.message || 'No pudimos conectar con el servicio de analisis.'
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function getSentimentData(result) {
  if (!result) {
    return {
      label: 'En espera',
      tone: 'Ready for review',
      summary: 'Carga feedback de clientes para generar una lectura accionable.',
      className: 'pending',
    }
  }

  return sentimentCopy[result.analysis.label] || sentimentCopy.Neutro
}

function App() {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const normalizedText = text.trim()
  const sentiment = getSentimentData(result)

  const polarityPercent = useMemo(() => {
    if (!result) return 68
    return clampPercent(((result.analysis.score + 1) / 2) * 100)
  }, [result])

  const subjectivityPercent = useMemo(() => {
    if (!result) return 54
    return clampPercent(result.analysis.subjectivity * 100)
  }, [result])

  const impactScore = useMemo(() => {
    if (!result) return 82
    return clampPercent((Math.abs(result.analysis.score) * 60) + (result.analysis.subjectivity * 40))
  }, [result])

  const themes = result?.analysis.keywords?.length
    ? result.analysis.keywords
    : ['onboarding', 'billing', 'support']
  const confidencePercent = result?.analysis.confidence != null
    ? clampPercent(result.analysis.confidence * 100)
    : null

  const handleAnalyze = async (event) => {
    event.preventDefault()

    if (!normalizedText) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await axios.post(`${API_URL}/api/review`, {
        text: normalizedText,
      })

      setResult(response.data)
    } catch (err) {
      setError(getApiErrorMessage(err))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadExample = () => {
    setText(EXAMPLE_REVIEW)
    setError('')
  }

  return (
    <main className="app-shell">
      <header className="topbar" aria-label="Navegacion principal">
        <a className="brand" href="#workspace" aria-label="InsightPulse workspace">
          <span className="brand-mark" aria-hidden="true">IP</span>
          <span>
            <strong>InsightPulse</strong>
            <small>Customer sentiment OS</small>
          </span>
        </a>

        <nav className="topbar-nav" aria-label="Secciones">
          <a href="#workspace">Workspace</a>
          <a href="#signals">Signals</a>
          <a href="#roadmap">Roadmap</a>
        </nav>

        <div className="topbar-actions">
          <span className="status-dot" aria-label="Sistema listo"></span>
          <span>Live analysis</span>
        </div>
      </header>

      <section className="workspace-grid primary-workspace" id="workspace">
        <form className="analysis-panel" id="analyzer" onSubmit={handleAnalyze}>
          <div className="section-heading">
            <p className="eyebrow">Feedback intelligence for SaaS teams</p>
            <h1>Convierte resenas sueltas en senales de producto.</h1>
            <p>
              Analiza sentimiento, detecta temas y prioriza fricciones antes de que se pierdan entre tickets, encuestas y comentarios.
            </p>
          </div>

          <label className="input-label" htmlFor="review-text">Feedback del cliente</label>
          <textarea
            id="review-text"
            maxLength={MAX_TEXT_LENGTH}
            placeholder="Paste customer feedback here..."
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-describedby="review-help review-count"
          />
          <div className="input-meta">
            <span id="review-help">Con LLM analiza mejor espanol/ingles; el fallback local rinde mejor en ingles.</span>
            <span id="review-count">{normalizedText.length}/{MAX_TEXT_LENGTH}</span>
          </div>

          {error && <p className="error-message" role="alert">{error}</p>}

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={loading || !normalizedText}>
              {loading ? 'Analizando...' : 'Analizar ahora'}
            </button>
            <button className="ghost-button" type="button" onClick={loadExample}>
              Cargar ejemplo
            </button>
          </div>
        </form>

        <aside className={`result-panel ${sentiment.className}`} aria-live="polite">
          <div className="result-header">
            <span className="result-kicker">{sentiment.tone}</span>
            <strong>{result?.analysis.label || sentiment.label}</strong>
          </div>
          <p>{sentiment.summary}</p>

          {result?.analysis.summary && (
            <div className="insight-summary">
              <span>Lectura del motor</span>
              <p>{result.analysis.summary}</p>
            </div>
          )}

          <div className="score-stack">
            <div className="score-line">
              <span>Polaridad</span>
              <strong>{result ? result.analysis.score : '--'}</strong>
            </div>
            <div className="meter" aria-hidden="true">
              <span style={{ width: `${polarityPercent}%` }}></span>
            </div>
            <div className="score-line">
              <span>Subjetividad</span>
              <strong>{result ? result.analysis.subjectivity : '--'}</strong>
            </div>
            <div className="meter" aria-hidden="true">
              <span style={{ width: `${subjectivityPercent}%` }}></span>
            </div>
            {confidencePercent != null && (
              <>
                <div className="score-line">
                  <span>Confianza</span>
                  <strong>{confidencePercent}%</strong>
                </div>
                <div className="meter" aria-hidden="true">
                  <span style={{ width: `${confidencePercent}%` }}></span>
                </div>
              </>
            )}
          </div>

          <div className="theme-list" id="signals">
            <span>Temas detectados</span>
            <div>
              {themes.map((theme, index) => (
                <mark key={`${theme}-${index}`}>{theme}</mark>
              ))}
            </div>
          </div>

          <blockquote>
            {result?.original_text || 'El resultado aparecera aqui cuando conectes un comentario real.'}
          </blockquote>

          {result?.analysis.recommended_action && (
            <div className="action-box">
              <span>Accion recomendada</span>
              <p>{result.analysis.recommended_action}</p>
            </div>
          )}

          {result?.analysis.source && (
            <small className="engine-label">
              Motor: {result.analysis.source === 'gemini'
                ? 'Gemini LLM'
                : result.analysis.source === 'openai'
                  ? 'OpenAI LLM'
                  : 'Local fallback'}
              {result.analysis.severity ? ` / Severidad: ${result.analysis.severity}` : ''}
            </small>
          )}
        </aside>
      </section>

      <section className="metrics-row" aria-label="Metricas de resumen">
        <article className="metric-card">
          <span>Sentiment health</span>
          <strong>{polarityPercent}%</strong>
          <small>Lectura normalizada del tono actual.</small>
        </article>
        <article className="metric-card">
          <span>Subjectivity</span>
          <strong>{subjectivityPercent}%</strong>
          <small>Cuanto se acerca a opinion personal.</small>
        </article>
        <article className="metric-card">
          <span>Impact priority</span>
          <strong>{impactScore}%</strong>
          <small>Potencial de convertirse en insight accionable.</small>
        </article>
      </section>

      <section className="product-strip" id="roadmap" aria-label="Camino de producto">
        <div className="section-heading">
          <p className="eyebrow">SaaS roadmap</p>
          <h2>La base para escalarlo a servicio</h2>
        </div>

        <div className="growth-layout">
          <div className="signal-board" aria-label="Resumen de plataforma">
            <div className="signal-board-header">
              <span>Realtime signal map</span>
              <strong>{impactScore}%</strong>
            </div>
            <div className="signal-grid" aria-hidden="true">
              <span className="signal-cell hot"></span>
              <span className="signal-cell warm"></span>
              <span className="signal-cell cool"></span>
              <span className="signal-cell warm"></span>
              <span className="signal-cell cool"></span>
              <span className="signal-cell hot"></span>
              <span className="signal-cell cool"></span>
              <span className="signal-cell warm"></span>
              <span className="signal-cell cool"></span>
            </div>
            <div className="signal-caption">
              <span>Topic density</span>
              <span>Sentiment drift</span>
            </div>
          </div>

          <div className="roadmap-grid">
            <article>
              <span>01</span>
              <strong>Historial</strong>
              <p>Guardar analisis para ver evolucion y patrones.</p>
            </article>
            <article>
              <span>02</span>
              <strong>Dashboards</strong>
              <p>Convertir comentarios en metricas de producto.</p>
            </article>
            <article>
              <span>03</span>
              <strong>Segmentos</strong>
              <p>Filtrar por canal, cliente, equipo o prioridad.</p>
            </article>
            <article>
              <span>04</span>
              <strong>Automations</strong>
              <p>Alertar cuando crecen riesgos o temas criticos.</p>
            </article>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
