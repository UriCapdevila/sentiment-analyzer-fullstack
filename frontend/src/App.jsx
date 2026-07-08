import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'https://insightpulse-api.uricapdevil4.workers.dev'
const MAX_TEXT_LENGTH = 5000
const DEMO_HISTORY_KEY = 'insightpulse.demoHistory.v1'
const AUTH_STORAGE_KEY = 'insightpulse.auth.v1'
const DEMO_HISTORY_TTL_MS = 30 * 60 * 1000
const MAX_DEMO_HISTORY = 8
const MAX_CSV_FILE_BYTES = 1024 * 1024
const MAX_CSV_PROCESS_ROWS = 10
const CSV_PREVIEW_ROWS = 5

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

const DEFAULT_USAGE = {
  totals: {
    total: 0,
    successful: 0,
    failed: 0,
    rateLimited: 0,
    successRate: 0,
    avgLatencyMs: 0,
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
  },
  byRoute: [],
  byStatus: [],
  byProviderStatus: [],
  recentErrors: [],
}

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
const csvTextHeaderHints = ['feedback', 'review', 'opinion', 'comentario', 'resena', 'texto', 'text', 'message', 'mensaje']

const problemSolutionCards = [
  {
    label: 'Antes',
    title: 'Feedback repartido, decisiones lentas.',
    copy: 'Tickets, encuestas y notas quedan en lugares distintos. El equipo llega tarde a los patrones importantes.',
  },
  {
    label: 'Despues',
    title: 'Un panel que prioriza por impacto.',
    copy: 'Cada opinion se convierte en riesgo, tema, severidad y accion recomendada para decidir rapido.',
  },
  {
    label: 'Resultado',
    title: 'Menos lectura manual, mas foco.',
    copy: 'Producto, soporte y revenue ven la misma senal de negocio sin depender de planillas.',
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

const landingViews = [
  { id: 'overview', hash: '#top', label: 'Overview' },
  { id: 'platform', hash: '#platform', label: 'Problema' },
  { id: 'solutions', hash: '#use-cases', label: 'Soluciones' },
  { id: 'demo', hash: '#demo', label: 'Demo' },
  { id: 'pricing', hash: '#pricing', label: 'Pricing' },
  { id: 'faq', hash: '#faq', label: 'FAQ' },
]

const appViews = [
  { id: 'overview', hash: '#overview', label: 'Overview' },
  { id: 'usage', hash: '#usage-health', label: 'Uso' },
  { id: 'csv', hash: '#csv-import', label: 'CSV' },
  { id: 'analysis', hash: '#manual-analysis', label: 'Analisis' },
  { id: 'history', hash: '#history', label: 'Historial' },
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

function formatNumber(value) {
  return new Intl.NumberFormat('es-AR').format(Number(value || 0))
}

function getViewFromHash(views, fallbackId) {
  const activeHash = window.location.hash || views[0]?.hash
  return views.find((view) => view.hash === activeHash)?.id || fallbackId
}

function updateHash(hash) {
  if (window.location.hash !== hash) {
    window.history.pushState(null, '', hash)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }
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

function readDemoHistory() {
  try {
    const rawHistory = window.sessionStorage.getItem(DEMO_HISTORY_KEY)

    if (!rawHistory) return []

    const cache = JSON.parse(rawHistory)

    if (!cache?.expiresAt || cache.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(DEMO_HISTORY_KEY)
      return []
    }

    return Array.isArray(cache.reviews)
      ? cache.reviews.map(normalizeReviewResponse).slice(0, MAX_DEMO_HISTORY)
      : []
  } catch {
    return []
  }
}

function writeDemoHistory(reviews) {
  try {
    window.sessionStorage.setItem(
      DEMO_HISTORY_KEY,
      JSON.stringify({
        expiresAt: Date.now() + DEMO_HISTORY_TTL_MS,
        reviews: reviews.slice(0, MAX_DEMO_HISTORY),
      }),
    )
  } catch {
    // sessionStorage can be unavailable in strict privacy modes.
  }
}

function clearDemoHistory() {
  try {
    window.sessionStorage.removeItem(DEMO_HISTORY_KEY)
  } catch {
    // No-op: clearing cache is best effort.
  }
}

function readAuthSession() {
  try {
    const rawSession = window.localStorage.getItem(AUTH_STORAGE_KEY)

    if (!rawSession) return null

    const session = JSON.parse(rawSession)

    if (!session?.token || !session?.workspace) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }

    if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }

    return session
  } catch {
    return null
  }
}

function writeAuthSession(session) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

function clearAuthSession() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}

function authHeaders(session) {
  return {
    Authorization: `Bearer ${session.token}`,
  }
}

function normalizeCsvHeader(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function countUnquotedDelimiter(line, delimiter) {
  let count = 0
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === delimiter && !inQuotes) {
      count += 1
    }
  }

  return count
}

function detectCsvDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || ''
  const semicolons = countUnquotedDelimiter(firstLine, ';')
  const commas = countUnquotedDelimiter(firstLine, ',')

  return semicolons > commas ? ';' : ','
}

function parseCsv(text) {
  const delimiter = detectCsvDelimiter(text)
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const nextChar = text[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1
      }

      row.push(cell)
      if (row.some((value) => value.trim())) {
        rows.push(row)
      }
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  row.push(cell)
  if (row.some((value) => value.trim())) {
    rows.push(row)
  }

  return rows
}

function buildCsvDataset(text) {
  const parsedRows = parseCsv(text)

  if (parsedRows.length < 2) {
    throw new Error('El CSV necesita encabezados y al menos una fila de datos.')
  }

  const headerCounts = new Map()
  const headers = parsedRows[0].map((rawHeader, index) => {
    const baseHeader = rawHeader.trim() || `Columna ${index + 1}`
    const count = headerCounts.get(baseHeader) || 0
    headerCounts.set(baseHeader, count + 1)

    return count ? `${baseHeader} ${count + 1}` : baseHeader
  })

  const rows = parsedRows.slice(1)
    .map((values, rowIndex) => headers.reduce((acc, header, columnIndex) => {
      acc[header] = values[columnIndex]?.trim() || ''
      acc.__rowNumber = rowIndex + 2
      return acc
    }, {}))
    .filter((rowItem) => headers.some((header) => rowItem[header]))

  if (!rows.length) {
    throw new Error('No encontramos filas con contenido para analizar.')
  }

  return { headers, rows }
}

function chooseCsvTextColumn(headers) {
  return headers.find((header) => {
    const normalizedHeader = normalizeCsvHeader(header)
    return csvTextHeaderHints.some((hint) => normalizedHeader.includes(hint))
  }) || headers[0] || ''
}

function escapeCsvCell(value) {
  const text = String(value ?? '')

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function downloadTextFile(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function isSameDemoInput(review, input) {
  return review.original_text === input.text
    && (review.channel || 'manual') === input.channel
    && (review.customer_ref || '') === input.customerRef
    && (review.product_area || 'general') === input.productArea
}

function App() {
  const isPrivateApp = window.location.pathname.startsWith('/app')

  return isPrivateApp ? <PrivateApp /> : <LandingApp />
}

function LandingApp() {
  const [activeLandingView, setActiveLandingView] = useState(() => getViewFromHash(landingViews, 'overview'))
  const [text, setText] = useState('')
  const [channel, setChannel] = useState('manual')
  const [productArea, setProductArea] = useState('checkout')
  const [customerRef, setCustomerRef] = useState('cliente-demo')
  const [result, setResult] = useState(null)
  const [insights] = useState(DEFAULT_INSIGHTS)
  const [recentReviews, setRecentReviews] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const normalizedText = text.trim()
  const sentiment = getSentimentData(result)
  const analysis = result?.analysis

  useEffect(() => {
    const cachedReviews = readDemoHistory()
    setRecentReviews(cachedReviews)

    if (cachedReviews[0]) {
      setResult(cachedReviews[0])
    }
  }, [])

  useEffect(() => {
    const handleHashChange = () => {
      setActiveLandingView(getViewFromHash(landingViews, 'overview'))
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (!recentReviews.length) return undefined

    const timeoutId = window.setTimeout(() => {
      clearDemoHistory()
      setRecentReviews([])
      setResult(null)
    }, DEMO_HISTORY_TTL_MS)

    return () => window.clearTimeout(timeoutId)
  }, [recentReviews])

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

    const demoInput = {
      text: normalizedText,
      channel,
      customerRef,
      productArea,
    }
    const cachedResult = recentReviews.find((review) => isSameDemoInput(review, demoInput))

    if (cachedResult) {
      setError('')
      setResult(cachedResult)
      setRecentReviews((current) => {
        const nextReviews = [
          cachedResult,
          ...current.filter((review) => review.id !== cachedResult.id),
        ].slice(0, MAX_DEMO_HISTORY)

        writeDemoHistory(nextReviews)
        return nextReviews
      })

      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await axios.post(`${API_URL}/api/demo/review`, demoInput)
      const normalizedResult = normalizeReviewResponse(response.data)

      setResult(normalizedResult)
      setRecentReviews((current) => {
        const nextReviews = [
          normalizedResult,
          ...current.filter((review) => review.id !== normalizedResult.id),
        ].slice(0, MAX_DEMO_HISTORY)

        writeDemoHistory(nextReviews)
        return nextReviews
      })
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

  const handleClearDemoHistory = () => {
    clearDemoHistory()
    setRecentReviews([])
    setResult(null)
  }

  const navigateLanding = (view) => {
    if (!view) return

    setActiveLandingView(view.id)
    updateHash(view.hash)
  }

  return (
    <main className="site-shell">
      <header className="site-header" aria-label="Navegacion principal">
        <a className="brand" href="#top" aria-label="InsightPulse inicio" onClick={() => navigateLanding(landingViews[0])}>
          <span className="brand-mark" aria-hidden="true">IP</span>
          <strong>InsightPulse</strong>
        </a>

        <nav className="main-nav" aria-label="Secciones">
          {landingViews.slice(1).map((view) => (
            <a
              aria-current={activeLandingView === view.id ? 'page' : undefined}
              className={activeLandingView === view.id ? 'active' : ''}
              href={view.hash}
              key={view.id}
              onClick={(event) => {
                event.preventDefault()
                navigateLanding(view)
              }}
            >
              {view.label}
            </a>
          ))}
        </nav>

        <div className="header-actions">
          <a className="header-cta" href="/app">Ingresar</a>
        </div>
      </header>

      <div className="site-view-shell" data-view={activeLandingView}>
      {activeLandingView === 'overview' && (
      <>
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
          <p className="eyebrow">SaaS de inteligencia de feedback</p>
          <h1>Detecta clientes en riesgo antes de perderlos.</h1>
          <p>
            InsightPulse analiza opiniones, tickets y CSV para priorizar problemas reales por impacto, severidad y riesgo de churn.
          </p>

          <div className="hero-actions">
            <a
              className="primary-link"
              href="#demo"
              onClick={(event) => {
                event.preventDefault()
                navigateLanding(landingViews.find((view) => view.id === 'demo'))
              }}
            >
              Probar demo
            </a>
            <a
              className="secondary-link"
              href="#platform"
              onClick={(event) => {
                event.preventDefault()
                navigateLanding(landingViews.find((view) => view.id === 'platform'))
              }}
            >
              Ver problema
            </a>
          </div>

          <div className="hero-trust" aria-label="Prueba rapida de valor">
            <span>CSV en minutos</span>
            <span>Riesgo de churn</span>
            <span>Resumen ejecutivo</span>
            <span>Historial privado</span>
          </div>
        </div>
      </section>

      <section className="logo-strip" aria-label="Prueba social">
        <span>Para equipos de producto</span>
        <span>Soporte</span>
        <span>Revenue</span>
        <span>Founders</span>
        <span>Customer Success</span>
      </section>
      </>
      )}

      {activeLandingView === 'platform' && (
      <section className="platform-section" id="platform">
        <div className="section-copy">
          <p className="eyebrow">Problema vs solucion</p>
          <h2>El feedback no sirve si llega tarde a la decision.</h2>
          <p>InsightPulse reduce ruido operativo y muestra que requiere atencion ahora.</p>
        </div>

        <div className="module-grid">
          {problemSolutionCards.map((module) => (
            <article className="module-card" key={module.label}>
              <span>{module.label}</span>
              <h3>{module.title}</h3>
              <p>{module.copy}</p>
            </article>
          ))}
        </div>
      </section>
      )}

      {activeLandingView === 'solutions' && (
      <>
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
              <strong>Product mock</strong>
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
          <p className="eyebrow">Soluciones</p>
          <h2>Una lectura clara para cada equipo.</h2>
          <p>El mismo feedback, traducido al lenguaje de producto, soporte y revenue.</p>
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
          <h2>Prioridades accionables, no reportes largos.</h2>
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
      </>
      )}

      {activeLandingView === 'demo' && (
      <>
      <section className="demo-section" id="demo">
        <div className="section-copy">
          <p className="eyebrow">Demostracion visual</p>
          <h2>Prueba una opinion y mira la decision sugerida.</h2>
          <p>La demo es temporal; el producto privado guarda historial real.</p>
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

      {recentReviews.length > 0 && (
      <section className="signal-section compact" id="signals">
        <div className="signal-copy">
          <p className="eyebrow">Historial demo</p>
          <h2>Resultados temporales de esta sesion.</h2>
          <p>Sirve para comparar pruebas sin mezclar datos reales.</p>
        </div>

        <div className="signal-grid">
          <aside className="signal-summary">
            <span className="live-pill cache">Cache temporal</span>
            <strong>{recentReviews.length}</strong>
            <p>senales de demo guardadas solo en este navegador por 30 minutos.</p>

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

            <button className="clear-history-button" type="button" onClick={handleClearDemoHistory} disabled={!recentReviews.length}>
              Limpiar historial demo
            </button>
          </aside>

          <div className="signal-list" aria-live="polite">
            {recentReviews.length === 0 && (
              <article className="signal-card empty">
                <span>Sin historial de demo</span>
                <p>Analiza una opinion para crear una senal temporal. No se va a guardar en D1.</p>
              </article>
            )}

            {recentReviews.map((review) => {
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
      )}
      </>
      )}

      {activeLandingView === 'pricing' && (
      <>
      <section className="pricing-section" id="pricing">
        <div className="section-copy narrow">
          <p className="eyebrow">Precios</p>
          <h2>Empieza chico. Escala cuando el feedback lo justifique.</h2>
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
              <a
                href="#demo"
                onClick={(event) => {
                  event.preventDefault()
                  navigateLanding(landingViews.find((view) => view.id === 'demo'))
                }}
              >
                {plan.featured ? 'Validar Growth' : 'Explorar'}
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <p className="eyebrow">InsightPulse</p>
        <h2>Convierte opiniones en prioridades esta semana.</h2>
        <p>Prueba el analizador y valida si tus clientes estan avisando algo importante.</p>
        <a
          className="primary-link"
          href="#demo"
          onClick={(event) => {
            event.preventDefault()
            navigateLanding(landingViews.find((view) => view.id === 'demo'))
          }}
        >
          Probar ahora
        </a>
      </section>
      </>
      )}

      {activeLandingView === 'faq' && (
      <section className="faq-section" id="faq">
        <div className="section-copy narrow">
          <p className="eyebrow">FAQ</p>
          <h2>Preguntas antes de probar.</h2>
        </div>

        <div className="faq-grid">
          <article>
            <strong>¿Puedo subir CSV?</strong>
            <p>Si. El panel privado ya permite cargar CSV, elegir columna y procesar lotes controlados.</p>
          </article>
          <article>
            <strong>¿La demo guarda mis datos?</strong>
            <p>No. La demo usa cache temporal del navegador. El historial real vive solo en cuentas autenticadas.</p>
          </article>
          <article>
            <strong>¿Que pasa con los limites de IA?</strong>
            <p>El dashboard mide intentos, errores 429, tokens y latencia para cuidar consumo y costos.</p>
          </article>
          <article>
            <strong>¿Se puede cancelar?</strong>
            <p>La idea del plan inicial es simple: suscripcion mensual, sin contratos largos ni setup complejo.</p>
          </article>
        </div>
      </section>
      )}
      </div>

      <footer className="site-footer">
        <strong>InsightPulse</strong>
        <span>MVP SaaS de inteligencia de feedback</span>
        <span>Cloudflare + LLM + D1</span>
      </footer>
    </main>
  )
}

function PrivateApp() {
  const csvInputRef = useRef(null)
  const [activeAppView, setActiveAppView] = useState(() => getViewFromHash(appViews, 'overview'))
  const [session, setSession] = useState(() => readAuthSession())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [appLoading, setAppLoading] = useState(Boolean(session))
  const [appError, setAppError] = useState('')
  const [appInsights, setAppInsights] = useState(DEFAULT_INSIGHTS)
  const [appUsage, setAppUsage] = useState(DEFAULT_USAGE)
  const [appReviews, setAppReviews] = useState([])
  const [appText, setAppText] = useState('')
  const [appChannel, setAppChannel] = useState('manual')
  const [appProductArea, setAppProductArea] = useState('general')
  const [appCustomerRef, setAppCustomerRef] = useState('')
  const [appResult, setAppResult] = useState(null)
  const [appSubmitting, setAppSubmitting] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [csvFileName, setCsvFileName] = useState('')
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvRows, setCsvRows] = useState([])
  const [csvColumn, setCsvColumn] = useState('')
  const [csvStatus, setCsvStatus] = useState('')
  const [csvError, setCsvError] = useState('')
  const [csvProcessing, setCsvProcessing] = useState(false)
  const [csvProcessed, setCsvProcessed] = useState(0)
  const [csvResults, setCsvResults] = useState([])

  const csvPreviewRows = useMemo(() => csvRows.slice(0, CSV_PREVIEW_ROWS), [csvRows])
  const csvRowsWithText = useMemo(() => {
    if (!csvColumn) return []

    return csvRows.filter((row) => String(row[csvColumn] || '').trim())
  }, [csvRows, csvColumn])
  const csvRowsToProcess = useMemo(
    () => csvRowsWithText.slice(0, MAX_CSV_PROCESS_ROWS),
    [csvRowsWithText],
  )

  useEffect(() => {
    if (!session) return

    loadPrivateData(session)
  }, [session])

  useEffect(() => {
    const handleHashChange = () => {
      setActiveAppView(getViewFromHash(appViews, 'overview'))
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  async function loadPrivateData(activeSession) {
    setAppLoading(true)
    setAppError('')

    try {
      const [insightsResponse, reviewsResponse, usageResponse] = await Promise.all([
        axios.get(`${API_URL}/api/insights?days=30`, { headers: authHeaders(activeSession) }),
        axios.get(`${API_URL}/api/reviews?limit=8`, { headers: authHeaders(activeSession) }),
        axios.get(`${API_URL}/api/usage?days=7`, { headers: authHeaders(activeSession) }),
      ])

      setAppInsights(insightsResponse.data)
      setAppUsage(usageResponse.data || DEFAULT_USAGE)
      setAppReviews(Array.isArray(reviewsResponse.data?.data)
        ? reviewsResponse.data.data.map(normalizeReviewResponse)
        : [])
    } catch (err) {
      setAppError(getApiErrorMessage(err))

      if (err.response?.status === 401 || err.response?.status === 403) {
        clearAuthSession()
        setSession(null)
      }
    } finally {
      setAppLoading(false)
    }
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setLoginLoading(true)
    setLoginError('')

    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, { email, password })
      const nextSession = response.data
      writeAuthSession(nextSession)
      setSession(nextSession)
      setPassword('')
    } catch (err) {
      setLoginError(getApiErrorMessage(err))
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = async () => {
    const activeSession = session
    clearAuthSession()
    setSession(null)
    setAppReviews([])
    setAppResult(null)
    setAppUsage(DEFAULT_USAGE)
    setDeleteCandidate(null)

    if (activeSession?.token) {
      try {
        await axios.post(`${API_URL}/api/auth/logout`, {}, { headers: authHeaders(activeSession) })
      } catch {
        // Local logout already happened; remote revocation is best effort.
      }
    }
  }

  const handlePrivateAnalyze = async (event) => {
    event.preventDefault()

    if (!appText.trim() || !session) return

    setAppSubmitting(true)
    setAppError('')

    try {
      const response = await axios.post(
        `${API_URL}/api/review`,
        {
          text: appText.trim(),
          channel: appChannel,
          productArea: appProductArea,
          customerRef: appCustomerRef,
        },
        { headers: authHeaders(session) },
      )
      const normalizedResult = normalizeReviewResponse(response.data)

      setAppResult(normalizedResult)
      setAppReviews((current) => [
        normalizedResult,
        ...current.filter((review) => review.id !== normalizedResult.id),
      ].slice(0, 8))
      await loadPrivateData(session)
    } catch (err) {
      setAppError(getApiErrorMessage(err))
    } finally {
      setAppSubmitting(false)
    }
  }

  const resetCsvImport = () => {
    if (csvInputRef.current) {
      csvInputRef.current.value = ''
    }

    setCsvFileName('')
    setCsvHeaders([])
    setCsvRows([])
    setCsvColumn('')
    setCsvStatus('')
    setCsvError('')
    setCsvProcessing(false)
    setCsvProcessed(0)
    setCsvResults([])
  }

  const handleCsvFileChange = async (event) => {
    const file = event.target.files?.[0]

    resetCsvImport()

    if (!file) return

    setCsvFileName(file.name)

    if (file.size > MAX_CSV_FILE_BYTES) {
      setCsvError('El archivo supera 1 MB. Para el MVP conviene procesar lotes chicos y controlados.')
      return
    }

    try {
      setCsvStatus('Leyendo archivo...')
      const text = await file.text()
      const dataset = buildCsvDataset(text)
      const detectedColumn = chooseCsvTextColumn(dataset.headers)

      setCsvHeaders(dataset.headers)
      setCsvRows(dataset.rows)
      setCsvColumn(detectedColumn)
      setCsvStatus(`${dataset.rows.length} filas listas. Se procesaran hasta ${MAX_CSV_PROCESS_ROWS} por corrida.`)
    } catch (err) {
      setCsvError(err.message || 'No pudimos leer el CSV. Revisa el formato e intenta nuevamente.')
      setCsvStatus('')
    }
  }

  const handleProcessCsv = async () => {
    if (!session || !csvColumn || csvRowsToProcess.length === 0) return

    setCsvProcessing(true)
    setCsvProcessed(0)
    setCsvResults([])
    setCsvError('')
    setCsvStatus(`Procesando 0/${csvRowsToProcess.length} filas...`)

    const nextResults = []

    for (const row of csvRowsToProcess) {
      const rowNumber = row.__rowNumber
      const text = String(row[csvColumn] || '').trim().slice(0, MAX_TEXT_LENGTH)

      try {
        const response = await axios.post(
          `${API_URL}/api/review`,
          {
            text,
            channel: 'csv',
            productArea: 'general',
            customerRef: csvFileName ? `${csvFileName}#${rowNumber}` : `csv#${rowNumber}`,
          },
          { headers: authHeaders(session) },
        )
        const normalizedResult = normalizeReviewResponse(response.data)

        nextResults.push({
          rowNumber,
          ok: true,
          text,
          result: normalizedResult,
        })
        setAppResult(normalizedResult)
      } catch (err) {
        nextResults.push({
          rowNumber,
          ok: false,
          text,
          error: getApiErrorMessage(err),
        })
      }

      setCsvProcessed(nextResults.length)
      setCsvResults([...nextResults])
      setCsvStatus(`Procesando ${nextResults.length}/${csvRowsToProcess.length} filas...`)
    }

    const successfulResults = nextResults
      .filter((item) => item.ok)
      .map((item) => item.result)

    if (successfulResults.length) {
      setAppReviews((current) => [
        ...successfulResults.reverse(),
        ...current.filter((review) => !successfulResults.some((result) => result.id === review.id)),
      ].slice(0, 8))
      await loadPrivateData(session)
    }

    setCsvStatus(`Listo: ${successfulResults.length}/${nextResults.length} filas procesadas correctamente.`)
    setCsvProcessing(false)
  }

  const handleExportCsvResults = () => {
    if (!csvResults.length) return

    const headers = ['fila', 'estado', 'sentimiento', 'riesgo', 'impacto', 'resumen', 'accion', 'error']
    const rows = csvResults.map((item) => [
      item.rowNumber,
      item.ok ? 'ok' : 'error',
      item.result?.analysis?.label || '',
      item.result ? formatRisk(item.result.analysis.churn_risk) : '',
      item.result ? `${normalizeImpactScore(item.result.analysis.impact_score)}%` : '',
      item.result?.analysis?.summary || '',
      item.result?.analysis?.recommended_action || '',
      item.error || '',
    ])
    const content = [headers, ...rows]
      .map((row) => row.map(escapeCsvCell).join(','))
      .join('\n')

    downloadTextFile('insightpulse-resultados.csv', content, 'text/csv;charset=utf-8')
  }

  const handleConfirmDeleteReview = async () => {
    if (!session || !deleteCandidate?.id) return

    setDeleteLoading(true)
    setAppError('')

    try {
      await axios.delete(`${API_URL}/api/reviews/${encodeURIComponent(deleteCandidate.id)}`, {
        headers: authHeaders(session),
      })

      setAppReviews((current) => current.filter((review) => review.id !== deleteCandidate.id))
      setAppResult((current) => (current?.id === deleteCandidate.id ? null : current))
      setDeleteCandidate(null)
      await loadPrivateData(session)
    } catch (err) {
      setAppError(getApiErrorMessage(err))
    } finally {
      setDeleteLoading(false)
    }
  }

  const navigateApp = (view) => {
    if (!view) return

    setActiveAppView(view.id)
    updateHash(view.hash)
  }

  if (!session) {
    return (
      <main className="private-shell login-shell">
        <section className="login-panel" aria-labelledby="login-title">
          <a className="brand" href="/" aria-label="Volver a InsightPulse">
            <span className="brand-mark" aria-hidden="true">IP</span>
            <strong>InsightPulse</strong>
          </a>

          <div>
            <p className="eyebrow">Workspace privado</p>
            <h1 id="login-title">Ingresar al panel</h1>
            <p>Accede con tu email y contrasena para operar feedback real dentro de tu workspace.</p>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Contrasena
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contrasena"
                autoComplete="current-password"
                required
              />
            </label>

            {loginError && <p className="error-message" role="alert">{loginError}</p>}

            <button className="primary-button" type="submit" disabled={loginLoading}>
              {loginLoading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <a className="secondary-link" href="/">Volver a la landing</a>
        </section>
      </main>
    )
  }

  const workspace = session.workspace
  const usage = appInsights.totals?.total || 0
  const monthlyLimit = workspace.monthlyAnalysisLimit || 0
  const usagePercent = monthlyLimit ? clampPercent((usage / monthlyLimit) * 100) : 0
  const usageTotals = appUsage.totals || DEFAULT_USAGE.totals
  const provider429 = appUsage.byProviderStatus?.find((item) => item.label === '429')?.total || usageTotals.rateLimited || 0

  return (
    <main className="private-shell">
      <aside className="app-sidebar">
        <a className="brand" href="/" aria-label="InsightPulse landing">
          <span className="brand-mark" aria-hidden="true">IP</span>
          <strong>InsightPulse</strong>
        </a>
        <nav aria-label="Panel privado">
          {appViews.map((view) => (
            <a
              aria-current={activeAppView === view.id ? 'page' : undefined}
              className={activeAppView === view.id ? 'active' : ''}
              href={view.hash}
              key={view.id}
              onClick={(event) => {
                event.preventDefault()
                navigateApp(view)
              }}
            >
              {view.label}
            </a>
          ))}
        </nav>
        <button type="button" onClick={handleLogout}>Salir</button>
      </aside>

      <section className="app-main">
        <header className="app-header" id="overview">
          <div>
            <p className="eyebrow">Workspace privado</p>
            <h1>{workspace.name}</h1>
            <p>Plan {workspace.plan} activo. Este panel ya opera contra datos persistentes del workspace.</p>
          </div>
          <div className="workspace-badge">
            <span>Analisis del mes</span>
            <strong>{usage}/{monthlyLimit || '∞'}</strong>
          </div>
        </header>

        {appError && <p className="error-message" role="alert">{appError}</p>}

        <div className="app-view-shell" data-view={activeAppView}>
        {activeAppView === 'overview' && (
        <>
        <section className="app-metrics" aria-label="Metricas del workspace">
          <article>
            <span>Total</span>
            <strong>{appInsights.totals?.total || 0}</strong>
            <p>opiniones guardadas</p>
          </article>
          <article>
            <span>Riesgo alto</span>
            <strong>{appInsights.totals?.highChurnRisk || 0}</strong>
            <p>senales a revisar</p>
          </article>
          <article>
            <span>Impacto promedio</span>
            <strong>{appInsights.totals?.avgImpactScore || 0}%</strong>
            <p>prioridad estimada</p>
          </article>
          <article>
            <span>Uso del plan</span>
            <strong>{usagePercent}%</strong>
            <p>del limite mensual</p>
          </article>
        </section>

        <section className="workspace-module-grid" aria-label="Modulos del workspace">
          {appViews.slice(1).map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => navigateApp(view)}
            >
              <span>{view.label}</span>
              <strong>
                {view.id === 'usage' && 'Controlar consumo'}
                {view.id === 'csv' && 'Cargar lote'}
                {view.id === 'analysis' && 'Analizar manual'}
                {view.id === 'history' && 'Revisar senales'}
              </strong>
              <p>
                {view.id === 'usage' && 'Cuota, fallos, latencia y tokens registrados.'}
                {view.id === 'csv' && 'Procesamiento controlado para archivos simples.'}
                {view.id === 'analysis' && 'Carga puntual de feedback real del cliente.'}
                {view.id === 'history' && 'Feedback persistido y clasificado por el motor.'}
              </p>
            </button>
          ))}
        </section>
        </>
        )}

        {activeAppView === 'usage' && (
        <section className="private-card usage-card" id="usage-health">
          <div className="card-heading horizontal">
            <div>
              <p className="eyebrow">Uso y salud</p>
              <h2>Consumo operativo</h2>
              <p>Monitoreo de intentos reales de LLM en los ultimos 7 dias para cuidar cuota, costos y estabilidad.</p>
            </div>
            <button type="button" className="ghost-button" onClick={() => loadPrivateData(session)} disabled={appLoading}>
              {appLoading ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>

          <div className="usage-grid" aria-label="Metricas de uso del LLM">
            <article>
              <span>Intentos</span>
              <strong>{formatNumber(usageTotals.total)}</strong>
              <p>{formatNumber(usageTotals.successful)} exitosos</p>
            </article>
            <article>
              <span>Fallos</span>
              <strong>{formatNumber(usageTotals.failed)}</strong>
              <p>{formatNumber(provider429)} por limite 429</p>
            </article>
            <article>
              <span>Exito</span>
              <strong>{usageTotals.successRate || 0}%</strong>
              <p>en ventana monitoreada</p>
            </article>
            <article>
              <span>Latencia media</span>
              <strong>{formatNumber(usageTotals.avgLatencyMs)} ms</strong>
              <p>respuesta del proveedor</p>
            </article>
            <article>
              <span>Tokens</span>
              <strong>{formatNumber(usageTotals.totalTokens)}</strong>
              <p>{formatNumber(usageTotals.promptTokens)} input / {formatNumber(usageTotals.completionTokens)} output</p>
            </article>
          </div>

          <div className="usage-detail-grid">
            <div>
              <h3>Por flujo</h3>
              <div className="usage-list">
                {appUsage.byRoute?.length === 0 && <span>Sin eventos todavia</span>}
                {appUsage.byRoute?.map((item) => (
                  <div className="usage-row" key={item.label}>
                    <span>{item.label === 'private_review' ? 'Producto' : 'Demo'}</span>
                    <strong>{formatNumber(item.total)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3>Errores recientes</h3>
              <div className="usage-list">
                {appUsage.recentErrors?.length === 0 && <span>Sin errores recientes</span>}
                {appUsage.recentErrors?.map((error) => (
                  <div className="usage-error" key={error.id}>
                    <strong>{error.errorCode || `HTTP ${error.providerStatus || '-'}`}</strong>
                    <span>{formatRelativeTime(error.createdAt)}</span>
                    <p>{error.errorMessage || 'Error sin detalle.'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        )}

        {activeAppView === 'csv' && (
        <section className="private-card csv-card" id="csv-import">
          <div className="card-heading horizontal">
            <div>
              <p className="eyebrow">Carga por archivo</p>
              <h2>Analizar CSV</h2>
              <p>Procesa lotes chicos desde el workspace privado y guarda los resultados reales en el historial.</p>
            </div>
            <div className="csv-limit-badge">
              <span>Lote MVP</span>
              <strong>{MAX_CSV_PROCESS_ROWS} filas</strong>
            </div>
          </div>

          <div className="csv-layout">
            <label className="csv-file-picker" htmlFor="csv-file">
              <span>{csvFileName || 'Seleccionar CSV'}</span>
              <input
                ref={csvInputRef}
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFileChange}
                disabled={csvProcessing}
              />
            </label>

            <div className="csv-controls">
              <label>
                Columna de feedback
                <select
                  value={csvColumn}
                  onChange={(event) => setCsvColumn(event.target.value)}
                  disabled={!csvHeaders.length || csvProcessing}
                >
                  {!csvHeaders.length && <option value="">Sin archivo</option>}
                  {csvHeaders.map((header) => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </label>

              <div className="csv-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleProcessCsv}
                  disabled={csvProcessing || !csvRowsToProcess.length}
                >
                  {csvProcessing ? `Procesando ${csvProcessed}/${csvRowsToProcess.length}` : 'Procesar CSV'}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={resetCsvImport}
                  disabled={csvProcessing || (!csvFileName && !csvResults.length)}
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>

          {csvError && <p className="error-message" role="alert">{csvError}</p>}
          {csvStatus && <p className="csv-status">{csvStatus}</p>}

          {csvPreviewRows.length > 0 && (
            <div className="csv-preview">
              <div className="csv-preview-header">
                <strong>Preview</strong>
                <span>{csvRowsWithText.length} filas con texto detectado</span>
              </div>
              <div className="csv-table-wrap">
                <table className="csv-table">
                  <thead>
                    <tr>
                      <th>Fila</th>
                      {csvHeaders.slice(0, 4).map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreviewRows.map((row) => (
                      <tr key={row.__rowNumber}>
                        <td>{row.__rowNumber}</td>
                        {csvHeaders.slice(0, 4).map((header) => (
                          <td key={header}>{row[header] || '-'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {csvResults.length > 0 && (
            <div className="csv-results">
              <div className="csv-preview-header">
                <strong>Resultados del lote</strong>
                <button className="ghost-button" type="button" onClick={handleExportCsvResults}>
                  Exportar
                </button>
              </div>

              <div className="csv-result-grid">
                {csvResults.map((item) => (
                  <article className={`csv-result ${item.ok ? getSentimentData(item.result).className : 'failed'}`} key={item.rowNumber}>
                    <div>
                      <span>Fila {item.rowNumber}</span>
                      <strong>{item.ok ? item.result.analysis.label : 'Error'}</strong>
                    </div>
                    <p>{item.ok ? item.result.analysis.summary : item.error}</p>
                    {item.ok && (
                      <div className="signal-meta">
                        <span>Riesgo {formatRisk(item.result.analysis.churn_risk)}</span>
                        <span>Impacto {normalizeImpactScore(item.result.analysis.impact_score)}%</span>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
        )}

        {activeAppView === 'analysis' && (
        <section className="app-grid">
          <form className="private-card" id="manual-analysis" onSubmit={handlePrivateAnalyze}>
            <div className="card-heading">
              <p className="eyebrow">Analisis manual</p>
              <h2>Cargar feedback real</h2>
              <p>Esto persiste en D1 y queda asociado a tu workspace.</p>
            </div>

            <div className="context-grid">
              <label>
                Canal
                <select value={appChannel} onChange={(event) => setAppChannel(event.target.value)}>
                  {channelOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                Area
                <select value={appProductArea} onChange={(event) => setAppProductArea(event.target.value)}>
                  {areaOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                Cliente
                <input
                  type="text"
                  value={appCustomerRef}
                  onChange={(event) => setAppCustomerRef(event.target.value)}
                  placeholder="cliente o segmento"
                />
              </label>
            </div>

            <label className="input-label" htmlFor="private-review">Feedback</label>
            <textarea
              id="private-review"
              value={appText}
              onChange={(event) => setAppText(event.target.value)}
              maxLength={MAX_TEXT_LENGTH}
              placeholder="Pega aqui una opinion real de cliente..."
            />

            <button className="primary-button" type="submit" disabled={appSubmitting || !appText.trim()}>
              {appSubmitting ? 'Analizando...' : 'Guardar analisis'}
            </button>
          </form>

          <aside className="private-card">
            <div className="card-heading">
              <p className="eyebrow">Ultimo resultado</p>
              <h2>{appResult?.analysis?.label || 'Sin analisis reciente'}</h2>
              <p>{appResult?.analysis?.summary || 'Carga feedback real para ver el resultado accionable.'}</p>
            </div>

            {appResult && (
              <>
                <div className="result-meta">
                  <span>Riesgo {formatRisk(appResult.analysis.churn_risk)}</span>
                  <span>Impacto {normalizeImpactScore(appResult.analysis.impact_score)}%</span>
                  <span>{appResult.product_area || 'general'}</span>
                </div>
                <div className="action-box">
                  <span>Proxima accion</span>
                  <p>{appResult.analysis.recommended_action}</p>
                </div>
              </>
            )}
          </aside>
        </section>
        )}

        {activeAppView === 'history' && (
        <section className="private-card" id="history">
          <div className="card-heading horizontal">
            <div>
              <p className="eyebrow">Historial privado</p>
              <h2>Feedback persistido</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => loadPrivateData(session)} disabled={appLoading}>
              {appLoading ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>

          <div className="private-history">
            {appReviews.length === 0 && (
              <article className="signal-card empty">
                <span>Sin opiniones reales todavia</span>
                <p>El primer analisis manual aparecera aca y quedara asociado a este workspace.</p>
              </article>
            )}

            {appReviews.map((review) => (
              <article className={`signal-card ${getSentimentData(review).className}`} key={review.id}>
                <div className="signal-card-header">
                  <div>
                    <span>{review.analysis.label}</span>
                    <strong>{review.product_area || 'general'}</strong>
                  </div>
                  <time dateTime={review.created_at}>{formatRelativeTime(review.created_at)}</time>
                </div>
                <p>{review.analysis.summary}</p>
                <div className="signal-meta">
                  <span>{review.channel || 'manual'}</span>
                  <span>{review.customer_ref || 'sin cliente'}</span>
                  <span>Riesgo {formatRisk(review.analysis.churn_risk)}</span>
                </div>
                <div className="history-actions">
                  <button type="button" onClick={() => setDeleteCandidate(review)}>
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
        )}
        </div>
      </section>

      {deleteCandidate && (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-review-title">
            <div>
              <p className="eyebrow">Accion irreversible</p>
              <h2 id="delete-review-title">Eliminar feedback del historial</h2>
              <p>
                Esta accion no se puede deshacer. Se eliminara el feedback guardado y sus temas asociados; las metricas de uso quedaran solo como auditoria sin texto vinculado.
              </p>
            </div>

            <article className="delete-preview">
              <span>{deleteCandidate.analysis?.label || 'Feedback'}</span>
              <p>{deleteCandidate.analysis?.summary || deleteCandidate.original_text}</p>
            </article>

            <div className="confirm-actions">
              <button type="button" className="ghost-button" onClick={() => setDeleteCandidate(null)} disabled={deleteLoading}>
                Cancelar
              </button>
              <button type="button" className="danger-button" onClick={handleConfirmDeleteReview} disabled={deleteLoading}>
                {deleteLoading ? 'Eliminando...' : 'Eliminar definitivamente'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
