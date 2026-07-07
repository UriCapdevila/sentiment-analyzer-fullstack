import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'https://insightpulse-api.uricapdevil4.workers.dev'
const MAX_TEXT_LENGTH = 5000

const EXAMPLE_REVIEW = 'Me gusta que el producto sea facil de usar, pero el checkout falla seguido, soporte tarda demasiado y ya estoy evaluando otra opcion.'

const DEFAULT_INSIGHTS = {
  totals: {
    total: 128,
    negative: 31,
    mixed: 44,
    highSeverity: 18,
    highChurnRisk: 12,
    avgImpactScore: 74,
    riskRate: 19,
  },
  topTopics: [
    { topic: 'checkout', count: 24 },
    { topic: 'soporte', count: 18 },
    { topic: 'billing', count: 15 },
    { topic: 'onboarding', count: 12 },
  ],
  recent: [],
}

const DEFAULT_RECENT_REVIEWS = [
  {
    id: 'demo-1',
    original_text: 'El checkout falla al pagar con tarjeta corporativa y soporte todavia no responde.',
    channel: 'support',
    customer_ref: 'enterprise-demo',
    product_area: 'checkout',
    created_at: new Date(Date.now() - 1000 * 60 * 34).toISOString(),
    analysis: {
      score: -0.72,
      subjectivity: 0.74,
      label: 'Negativo',
      keywords: ['checkout', 'soporte', 'tarjeta corporativa'],
      confidence: 0.91,
      tone: 'frustrado',
      severity: 'high',
      summary: 'Friccion critica en pago con demora de soporte.',
      recommended_action: 'Escalar a producto y soporte con prioridad alta.',
      source: 'gemini',
      categories: ['payments', 'support'],
      churn_risk: 'high',
      impact_score: 88,
    },
  },
  {
    id: 'demo-2',
    original_text: 'La implementacion fue muy simple, aunque el reporte semanal necesita mas detalle.',
    channel: 'survey',
    customer_ref: 'growth-demo',
    product_area: 'reporting',
    created_at: new Date(Date.now() - 1000 * 60 * 92).toISOString(),
    analysis: {
      score: 0.18,
      subjectivity: 0.58,
      label: 'Mixto',
      keywords: ['implementacion', 'reporte semanal', 'detalle'],
      confidence: 0.87,
      tone: 'constructivo',
      severity: 'medium',
      summary: 'Buen onboarding con oportunidad clara en reporting.',
      recommended_action: 'Agregar detalle al reporte semanal y validar con cuentas Growth.',
      source: 'gemini',
      categories: ['onboarding', 'reporting'],
      churn_risk: 'medium',
      impact_score: 62,
    },
  },
  {
    id: 'demo-3',
    original_text: 'El equipo esta contento, el tablero nos ayuda a ordenar prioridades cada semana.',
    channel: 'sales',
    customer_ref: 'midmarket-demo',
    product_area: 'dashboard',
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    analysis: {
      score: 0.82,
      subjectivity: 0.48,
      label: 'Positivo',
      keywords: ['tablero', 'prioridades', 'equipo'],
      confidence: 0.89,
      tone: 'satisfecho',
      severity: 'low',
      summary: 'Senal positiva sobre valor operativo del dashboard.',
      recommended_action: 'Usar como caso para ventas y onboarding.',
      source: 'gemini',
      categories: ['dashboard', 'operations'],
      churn_risk: 'low',
      impact_score: 71,
    },
  },
]

const sentimentCopy = {
  Positivo: {
    tone: 'Advocacy signal',
    summary: 'El comentario inclina la conversacion hacia satisfaccion y confianza.',
    className: 'positive',
    decision: 'Convertir en aprendizaje replicable',
  },
  Negativo: {
    tone: 'Risk signal',
    summary: 'El comentario marca friccion y deberia revisarse como posible prioridad.',
    className: 'negative',
    decision: 'Priorizar investigacion y respuesta',
  },
  Mixto: {
    tone: 'Mixed opportunity',
    summary: 'El comentario combina valor percibido con fricciones que pueden afectar adopcion o retencion.',
    className: 'mixed',
    decision: 'Rescatar valor y remover friccion',
  },
  Neutro: {
    tone: 'Context signal',
    summary: 'El comentario no muestra una inclinacion clara y conviene leer el contexto.',
    className: 'neutral',
    decision: 'Agrupar con mas feedback similar',
  },
}

const channelOptions = ['manual', 'support', 'survey', 'sales', 'app-store']
const areaOptions = ['checkout', 'billing', 'onboarding', 'support', 'performance', 'general']

const platformModules = [
  {
    label: 'Ingest',
    title: 'Centraliza feedback de cualquier canal',
    copy: 'Tickets, encuestas, llamadas de ventas, reviews publicas y notas internas entran al mismo lenguaje operativo.',
    metric: '7+',
    unit: 'canales mock',
  },
  {
    label: 'Classify',
    title: 'LLM con criterio de negocio',
    copy: 'No solo etiqueta positivo o negativo: mide severidad, riesgo de churn, impacto y proxima accion.',
    metric: '92%',
    unit: 'confianza demo',
  },
  {
    label: 'Route',
    title: 'Prioridades para cada equipo',
    copy: 'Producto ve bugs y fricciones, soporte ve urgencias, revenue ve riesgo comercial antes de que escale.',
    metric: '18',
    unit: 'riesgos altos',
  },
]

const useCases = [
  {
    team: 'Producto',
    title: 'Detecta fricciones que se repiten antes del roadmap.',
    points: ['Agrupacion por area', 'Impact score por tema', 'Resumen para discovery'],
  },
  {
    team: 'Soporte',
    title: 'Convierte tickets repetidos en senales de operacion.',
    points: ['Severidad automatica', 'Riesgo de churn', 'Playbooks de respuesta'],
  },
  {
    team: 'Revenue',
    title: 'Encuentra cuentas en riesgo y objeciones comerciales.',
    points: ['Segmentos por cliente', 'Alertas de expansion', 'Motivos de perdida'],
  },
]

const pricingPlans = [
  {
    name: 'Launch',
    price: 'USD 29',
    copy: 'Para validar el flujo con un equipo chico.',
    items: ['1 workspace', '1.000 analisis/mes', 'Dashboard base'],
  },
  {
    name: 'Growth',
    price: 'USD 99',
    copy: 'Para equipos que ya operan feedback semanalmente.',
    items: ['5 workspaces', '10.000 analisis/mes', 'Alertas y segmentos'],
    featured: true,
  },
  {
    name: 'Scale',
    price: 'Custom',
    copy: 'Para multiples equipos, integraciones y compliance.',
    items: ['Multi-tenant', 'API dedicada', 'SLA y auditoria'],
  },
]

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

function normalizeImpactScore(value) {
  const score = Number(value || 0)

  if (!Number.isFinite(score)) return 0

  if (score > 0 && score <= 10) {
    return clampPercent(score * 10)
  }

  return clampPercent(score)
}

function formatRisk(value) {
  const copy = {
    low: 'Bajo',
    medium: 'Medio',
    high: 'Alto',
  }

  return copy[value] || 'Sin dato'
}

function formatRelativeTime(value) {
  if (!value) return 'Sin fecha'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha'
  }

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000))

  if (diffMinutes < 60) return `Hace ${diffMinutes} min`

  const diffHours = Math.round(diffMinutes / 60)

  if (diffHours < 24) return `Hace ${diffHours} h`

  const diffDays = Math.round(diffHours / 24)

  return `Hace ${diffDays} d`
}

function normalizeReviewResponse(data) {
  if (data?.analysis) {
    return {
      ...data,
      channel: data.channel ?? null,
      customer_ref: data.customer_ref ?? null,
      product_area: data.product_area ?? null,
    }
  }

  return {
    id: data?.id,
    analysis: {
      score: data?.score ?? 0,
      subjectivity: data?.subjectivity ?? 0,
      label: data?.label || 'Neutro',
      keywords: data?.keywords || [],
      confidence: data?.confidence ?? null,
      tone: data?.tone || '',
      severity: data?.severity || 'low',
      summary: data?.summary || '',
      recommended_action: data?.recommended_action || '',
      source: data?.source || 'local',
      categories: data?.categories || [],
      churn_risk: data?.churn_risk || 'low',
      impact_score: data?.impact_score ?? 0,
    },
    original_text: data?.original_text || data?.text || '',
    channel: data?.channel || null,
    customer_ref: data?.customer_ref || data?.customerRef || null,
    product_area: data?.product_area || data?.productArea || null,
    created_at: data?.created_at,
  }
}

function normalizeReviewsResponse(data) {
  const reviews = Array.isArray(data?.data) ? data.data : []

  return reviews.map(normalizeReviewResponse)
}

function getSentimentData(result) {
  if (!result) {
    return {
      label: 'En espera',
      tone: 'Ready for review',
      summary: 'Carga feedback de clientes para generar una lectura accionable.',
      className: 'pending',
      decision: 'Esperando nueva senal',
    }
  }

  return sentimentCopy[result.analysis.label] || sentimentCopy.Neutro
}

function App() {
  const [text, setText] = useState('')
  const [channel, setChannel] = useState('manual')
  const [productArea, setProductArea] = useState('checkout')
  const [customerRef, setCustomerRef] = useState('cliente-demo')
  const [result, setResult] = useState(null)
  const [insights, setInsights] = useState(DEFAULT_INSIGHTS)
  const [insightsMode, setInsightsMode] = useState('demo')
  const [recentReviews, setRecentReviews] = useState(DEFAULT_RECENT_REVIEWS)
  const [recentMode, setRecentMode] = useState('demo')
  const [recentLoading, setRecentLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const normalizedText = text.trim()
  const sentiment = getSentimentData(result)
  const analysis = result?.analysis

  useEffect(() => {
    let ignore = false

    async function loadInsights() {
      try {
        const response = await axios.get(`${API_URL}/api/insights?days=30`, { timeout: 3500 })

        if (!ignore) {
          setInsights(response.data)
          setInsightsMode('live')

          if (response.data?.recent?.length) {
            setRecentReviews(response.data.recent.map(normalizeReviewResponse))
            setRecentMode('live')
          }
        }
      } catch {
        if (!ignore) {
          setInsights(DEFAULT_INSIGHTS)
          setInsightsMode('demo')
        }
      }
    }

    loadInsights()

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false

    async function loadRecentReviews() {
      setRecentLoading(true)

      try {
        const response = await axios.get(`${API_URL}/api/reviews?limit=8`, { timeout: 3500 })
        const reviews = normalizeReviewsResponse(response.data)

        if (!ignore) {
          setRecentReviews(reviews.length ? reviews : [])
          setRecentMode('live')
        }
      } catch {
        if (!ignore) {
          setRecentReviews(DEFAULT_RECENT_REVIEWS)
          setRecentMode('demo')
        }
      } finally {
        if (!ignore) {
          setRecentLoading(false)
        }
      }
    }

    loadRecentReviews()

    return () => {
      ignore = true
    }
  }, [])

  const polarityPercent = useMemo(() => {
    if (!analysis) return 68
    return clampPercent(((analysis.score + 1) / 2) * 100)
  }, [analysis])

  const subjectivityPercent = useMemo(() => {
    if (!analysis) return 54
    return clampPercent(analysis.subjectivity * 100)
  }, [analysis])

  const impactScore = useMemo(() => {
    if (analysis?.impact_score != null) return normalizeImpactScore(analysis.impact_score)
    if (!analysis) return insights.totals.avgImpactScore
    return clampPercent((Math.abs(analysis.score) * 60) + (analysis.subjectivity * 40))
  }, [analysis, insights.totals.avgImpactScore])

  const themes = analysis?.keywords?.length
    ? analysis.keywords
    : insights.topTopics.map((topic) => topic.topic).slice(0, 5)

  const confidencePercent = analysis?.confidence != null
    ? clampPercent(analysis.confidence * 100)
    : null

  const activeRecommendation = analysis?.recommended_action || 'Analiza una nueva opinion para convertirla en decision de producto.'
  const activeSummary = analysis?.summary || sentiment.summary
  const highRiskCount = recentReviews.filter((review) => review.analysis?.churn_risk === 'high').length
  const latestSignal = recentReviews[0]

  const handleAnalyze = async (event) => {
    event.preventDefault()

    if (!normalizedText) return

    setLoading(true)
    setError('')

    try {
      const response = await axios.post(`${API_URL}/api/review`, {
        text: normalizedText,
        channel,
        customerRef,
        productArea,
      })
      const normalizedResult = normalizeReviewResponse(response.data)

      setResult(normalizedResult)
      setRecentReviews((current) => [
        normalizedResult,
        ...current.filter((review) => review.id !== normalizedResult.id),
      ].slice(0, 8))
      setRecentMode('live')
    } catch (err) {
      setError(getApiErrorMessage(err))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadExample = () => {
    setText(EXAMPLE_REVIEW)
    setChannel('support')
    setProductArea('checkout')
    setCustomerRef('cuenta-enterprise-demo')
    setError('')
  }

  return (
    <main className="site-shell">
      <header className="site-header" aria-label="Navegacion principal">
        <a className="brand" href="#top" aria-label="InsightPulse inicio">
          <span className="brand-mark" aria-hidden="true">IP</span>
          <strong>InsightPulse</strong>
        </a>

        <nav className="main-nav" aria-label="Secciones">
          <a href="#platform">Producto</a>
          <a href="#use-cases">Soluciones</a>
          <a href="#developers">Developers</a>
          <a href="#pricing">Pricing</a>
        </nav>

        <div className="header-actions">
          <a href="#demo">Demo</a>
          <a className="header-cta" href="#pricing">Empezar</a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-backdrop" aria-hidden="true">
          <div className="hero-product hero-product-main">
            <div className="mock-topbar">
              <span></span>
              <span></span>
              <span></span>
              <strong>Command center</strong>
            </div>
            <div className="mock-grid">
              <div className="mock-metric strong">
                <span>Feedback processed</span>
                <strong>{insights.totals.total}</strong>
              </div>
              <div className="mock-metric danger">
                <span>Churn risk</span>
                <strong>{insights.totals.riskRate}%</strong>
              </div>
              <div className="mock-feed">
                <span className="feed-hot"></span>
                <div>
                  <strong>Checkout failures rising</strong>
                  <small>24 mentions / high impact</small>
                </div>
              </div>
              <div className="mock-feed">
                <span className="feed-warm"></span>
                <div>
                  <strong>Support delay pattern</strong>
                  <small>18 mentions / churn watch</small>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-product hero-product-side">
            <span>LLM classification</span>
            <strong>Mixto</strong>
            <small>Severidad alta / accion recomendada</small>
          </div>
        </div>

        <div className="hero-content">
          <p className="eyebrow">Customer intelligence infrastructure</p>
          <h1>La IA que convierte feedback en decisiones.</h1>
          <p>
            InsightPulse convierte feedback disperso en senales de negocio: riesgo, temas recurrentes, prioridad e instrucciones claras para actuar.
          </p>

          <div className="hero-actions">
            <a className="primary-link" href="#demo">Probar el analizador</a>
            <a className="secondary-link" href="#platform">Explorar plataforma</a>
          </div>

          <div className="hero-trust" aria-label="Capacidades actuales">
            <span>Cloudflare Worker</span>
            <span>AI Gateway</span>
            <span>D1 analytics</span>
            <span>Gemini LLM</span>
          </div>
        </div>
      </section>

      <section className="logo-strip" aria-label="Integraciones mock">
        <span>Support desk</span>
        <span>CRM</span>
        <span>Surveys</span>
        <span>App reviews</span>
        <span>Sales notes</span>
        <span>Slack alerts</span>
      </section>

      <section className="platform-section" id="platform">
        <div className="section-copy">
          <p className="eyebrow">Plataforma</p>
          <h2>Todo el feedback entra, se clasifica y vuelve como decision.</h2>
          <p>
            La experiencia esta pensada para operar feedback a escala, no para leer comentarios uno por uno. Cada modulo se puede activar de forma independiente a medida que el SaaS crece.
          </p>
        </div>

        <div className="module-grid">
          {platformModules.map((module) => (
            <article className="module-card" key={module.label}>
              <span>{module.label}</span>
              <h3>{module.title}</h3>
              <p>{module.copy}</p>
              <div>
                <strong>{module.metric}</strong>
                <small>{module.unit}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="operating-section">
        <div className="operating-visual" aria-label="Mockup de operaciones">
          <div className="ops-sidebar">
            <strong>Insight OS</strong>
            <span>Inbox</span>
            <span>Risks</span>
            <span>Topics</span>
            <span>Automations</span>
          </div>
          <div className="ops-main">
            <div className="ops-header">
              <span>Live topic map</span>
              <strong>{insightsMode === 'live' ? 'Live data' : 'Mock data'}</strong>
            </div>
            <div className="topic-list">
              {insights.topTopics.map((topic, index) => (
                <div className="topic-row" key={`${topic.topic}-${index}`}>
                  <span>{topic.topic}</span>
                  <div className="topic-bar" aria-hidden="true">
                    <span style={{ width: `${clampPercent((topic.count / Math.max(insights.topTopics[0]?.count || 1, 1)) * 100)}%` }}></span>
                  </div>
                  <strong>{topic.count}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="operating-copy">
          <p className="eyebrow">Command center</p>
          <h2>Una vista ejecutiva para decidir donde poner energia.</h2>
          <p>
            InsightPulse ordena lo que normalmente queda repartido entre planillas, tickets y conversaciones internas.
          </p>
          <dl className="stat-list">
            <div>
              <dt>{insights.totals.highSeverity}</dt>
              <dd>senales de severidad alta</dd>
            </div>
            <div>
              <dt>{insights.totals.avgImpactScore}%</dt>
              <dd>impacto promedio detectado</dd>
            </div>
            <div>
              <dt>{insights.totals.mixed}</dt>
              <dd>opiniones mixtas con oportunidad</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="use-case-section" id="use-cases">
        <div className="section-copy narrow">
          <p className="eyebrow">Soluciones</p>
          <h2>Una misma inteligencia para producto, soporte y revenue.</h2>
        </div>

        <div className="use-case-grid">
          {useCases.map((useCase) => (
            <article className="use-case-card" key={useCase.team}>
              <span>{useCase.team}</span>
              <h3>{useCase.title}</h3>
              <ul>
                {useCase.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="demo-section" id="demo">
        <div className="section-copy">
          <p className="eyebrow">Demo funcional</p>
          <h2>Proba el motor de analisis con contexto comercial.</h2>
          <p>
            Esta demo ya consulta la API cloud cuando esta disponible. El contenido de la pagina puede ser mock, pero este flujo esta conectado al Worker.
          </p>
        </div>

        <div className="demo-grid">
          <form className="analysis-panel" onSubmit={handleAnalyze}>
            <div className="context-grid">
              <label>
                Canal
                <select value={channel} onChange={(event) => setChannel(event.target.value)}>
                  {channelOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                Area
                <select value={productArea} onChange={(event) => setProductArea(event.target.value)}>
                  {areaOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                Cliente
                <input
                  type="text"
                  value={customerRef}
                  onChange={(event) => setCustomerRef(event.target.value)}
                  placeholder="cliente, plan o segmento"
                />
              </label>
            </div>

            <label className="input-label" htmlFor="review-text">Feedback del cliente</label>
            <textarea
              id="review-text"
              maxLength={MAX_TEXT_LENGTH}
              placeholder="Ej: El producto resuelve bien mi problema, pero soporte demora y la facturacion es confusa..."
              value={text}
              onChange={(event) => setText(event.target.value)}
              aria-describedby="review-help review-count"
            />
            <div className="input-meta">
              <span id="review-help">Ideal para encuestas, tickets, reviews publicas y notas de ventas.</span>
              <span id="review-count">{normalizedText.length}/{MAX_TEXT_LENGTH}</span>
            </div>

            {error && <p className="error-message" role="alert">{error}</p>}

            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={loading || !normalizedText}>
                {loading ? 'Analizando...' : 'Generar decision'}
              </button>
              <button className="ghost-button" type="button" onClick={loadExample}>
                Cargar caso critico
              </button>
            </div>
          </form>

          <aside className={`result-panel ${sentiment.className}`} aria-live="polite">
            <div className="result-header">
              <div>
                <span className="result-kicker">{sentiment.tone}</span>
                <strong>{analysis?.label || sentiment.label}</strong>
              </div>
              <span className="priority-badge">{analysis?.severity ? `Severidad ${formatRisk(analysis.severity)}` : 'Listo'}</span>
            </div>

            <div className="decision-box">
              <span>Decision sugerida</span>
              <p>{analysis ? sentiment.decision : 'Esperando feedback para priorizar.'}</p>
            </div>

            <p>{activeSummary}</p>

            <div className="score-stack">
              <div className="score-line">
                <span>Polaridad</span>
                <strong>{analysis ? analysis.score : '--'}</strong>
              </div>
              <div className="meter" aria-hidden="true">
                <span style={{ width: `${polarityPercent}%` }}></span>
              </div>
              <div className="score-line">
                <span>Subjetividad</span>
                <strong>{analysis ? analysis.subjectivity : '--'}</strong>
              </div>
              <div className="meter" aria-hidden="true">
                <span style={{ width: `${subjectivityPercent}%` }}></span>
              </div>
              <div className="score-line">
                <span>Impacto</span>
                <strong>{impactScore}%</strong>
              </div>
              <div className="meter accent" aria-hidden="true">
                <span style={{ width: `${impactScore}%` }}></span>
              </div>
            </div>

            <div className="theme-list">
              <span>Temas detectados</span>
              <div>
                {themes.map((theme, index) => (
                  <mark key={`${theme}-${index}`}>{theme}</mark>
                ))}
              </div>
            </div>

            <div className="action-box">
              <span>Proxima accion</span>
              <p>{activeRecommendation}</p>
            </div>

            <div className="result-meta">
              <span>Confianza: {confidencePercent != null ? `${confidencePercent}%` : 'sin dato'}</span>
              <span>Riesgo: {formatRisk(analysis?.churn_risk)}</span>
              <span>Motor: {analysis?.source === 'gemini' ? 'Gemini LLM' : analysis?.source || 'en espera'}</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="signal-section" id="signals">
        <div className="signal-copy">
          <p className="eyebrow">Historial operativo</p>
          <h2>Las opiniones ya no se pierden: quedan como senales accionables.</h2>
          <p>
            Cada analisis se guarda y vuelve como una linea de tiempo para detectar urgencias, patrones y oportunidades sin esperar a una reunion semanal.
          </p>
        </div>

        <div className="signal-grid">
          <aside className="signal-summary">
            <span className={`live-pill ${recentMode}`}>{recentMode === 'live' ? 'Datos live' : 'Modo demo'}</span>
            <strong>{recentReviews.length}</strong>
            <p>senales recientes disponibles para lectura operativa.</p>

            <dl>
              <div>
                <dt>{highRiskCount}</dt>
                <dd>riesgo alto</dd>
              </div>
              <div>
                <dt>{latestSignal?.analysis?.label || 'Sin dato'}</dt>
                <dd>ultima clasificacion</dd>
              </div>
              <div>
                <dt>{latestSignal?.product_area || 'general'}</dt>
                <dd>area mas reciente</dd>
              </div>
            </dl>
          </aside>

          <div className="signal-list" aria-live="polite">
            {recentLoading && (
              <article className="signal-card empty">
                <span>Cargando historial...</span>
                <p>Consultando las ultimas opiniones guardadas en la API.</p>
              </article>
            )}

            {!recentLoading && recentReviews.length === 0 && (
              <article className="signal-card empty">
                <span>Sin historial todavia</span>
                <p>Analiza una opinion desde la demo para crear la primera senal real.</p>
              </article>
            )}

            {!recentLoading && recentReviews.map((review) => {
              const reviewSentiment = getSentimentData(review)
              const reviewImpact = normalizeImpactScore(review.analysis?.impact_score)

              return (
                <article className={`signal-card ${reviewSentiment.className}`} key={review.id || review.created_at || review.original_text}>
                  <div className="signal-card-header">
                    <div>
                      <span>{review.analysis?.label || 'Sin clasificar'}</span>
                      <strong>{review.product_area || 'general'}</strong>
                    </div>
                    <time dateTime={review.created_at}>{formatRelativeTime(review.created_at)}</time>
                  </div>

                  <p>{review.analysis?.summary || review.original_text}</p>

                  <div className="signal-meta">
                    <span>{review.channel || 'manual'}</span>
                    <span>{review.customer_ref || 'sin cliente'}</span>
                    <span>Riesgo {formatRisk(review.analysis?.churn_risk)}</span>
                  </div>

                  <div className="signal-impact">
                    <span>Impacto</span>
                    <div className="meter accent" aria-hidden="true">
                      <span style={{ width: `${reviewImpact}%` }}></span>
                    </div>
                    <strong>{reviewImpact}%</strong>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="developer-section" id="developers">
        <div className="developer-copy">
          <p className="eyebrow">Developers</p>
          <h2>API simple hoy, arquitectura lista para crecer.</h2>
          <p>
            El MVP ya separa frontend, Worker, AI Gateway y persistencia. El siguiente salto es autenticacion, multi-tenant y webhooks.
          </p>
        </div>

        <div className="code-window" aria-label="Ejemplo de API">
          <div className="mock-topbar">
            <span></span>
            <span></span>
            <span></span>
            <strong>review.create</strong>
          </div>
          <pre>{`POST /api/review
{
  "text": "Checkout falla y soporte demora",
  "channel": "support",
  "productArea": "checkout"
}

=> {
  "label": "Mixto",
  "severity": "high",
  "churn_risk": "high",
  "recommended_action": "Priorizar..."
}`}</pre>
        </div>
      </section>

      <section className="reliability-section">
        <div>
          <p className="eyebrow">Infraestructura</p>
          <h2>Construido para operar como servicio, no como experimento aislado.</h2>
        </div>
        <div className="reliability-grid">
          <article>
            <span>01</span>
            <strong>Edge API</strong>
            <p>Worker desplegable desde GitHub con build automatico.</p>
          </article>
          <article>
            <span>02</span>
            <strong>Provider control</strong>
            <p>AI Gateway permite observar, proteger y cambiar proveedor LLM.</p>
          </article>
          <article>
            <span>03</span>
            <strong>Data foundation</strong>
            <p>D1 guarda resultados para historial, tendencias y dashboards.</p>
          </article>
          <article>
            <span>04</span>
            <strong>Product expansion</strong>
            <p>Preparado para auth, billing, workspaces e integraciones.</p>
          </article>
        </div>
      </section>

      <section className="pricing-section" id="pricing">
        <div className="section-copy narrow">
          <p className="eyebrow">Pricing mock</p>
          <h2>Planes pensados para validar, vender y escalar.</h2>
        </div>

        <div className="pricing-grid">
          {pricingPlans.map((plan) => (
            <article className={`pricing-card ${plan.featured ? 'featured' : ''}`} key={plan.name}>
              <span>{plan.name}</span>
              <strong>{plan.price}</strong>
              <p>{plan.copy}</p>
              <ul>
                {plan.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <a href="#demo">{plan.featured ? 'Validar Growth' : 'Explorar'}</a>
            </article>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <p className="eyebrow">InsightPulse</p>
        <h2>El siguiente paso es convertir esta demo en un sistema de decision.</h2>
        <p>Tenemos clasificacion, nube y una narrativa SaaS. Ahora podemos avanzar hacia usuarios, workspaces, integraciones y monetizacion.</p>
        <a className="primary-link" href="#demo">Probar ahora</a>
      </section>

      <footer className="site-footer">
        <strong>InsightPulse</strong>
        <span>MVP SaaS de inteligencia de feedback</span>
        <span>Cloudflare + LLM + D1</span>
      </footer>
    </main>
  )
}

export default App
