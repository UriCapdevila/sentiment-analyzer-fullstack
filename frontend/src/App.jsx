import { useState } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAnalyze = async () => {
    if (!text) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      // Llamamos a NUESTRO backend en Node.js (puerto 3000)
      const response = await axios.post('http://localhost:3000/api/review', {
        text: text
      })
      setResult(response.data)
    } catch (err) {
      setError('Error al conectar con el servidor.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>🔮 Detector de Sentimientos</h1>
      <p>Escribe una reseña (en inglés) para ver si es Positiva o Negativa.</p>

      <div className="card">
        <textarea
          rows="4"
          placeholder="Escribe aquí... (Ej: I love this service!)"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        
        <button onClick={handleAnalyze} disabled={loading || !text}>
          {loading ? 'Analizando...' : 'Analizar Texto'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

{result && (
        <div className={`result ${result.analysis.label.toLowerCase()}`}>
          <h2>Veredicto: {result.analysis.label}</h2>
          
          <div style={{ display: 'flex', justifyContent: 'space-around', margin: '10px 0' }}>
            <p>Polaridad: <strong>{result.analysis.score}</strong></p>
            {/* Usamos ?. para preguntar si existe antes de mostrar */}
            <p>Subjetividad: <strong>{result.analysis.subjectivity || 0}</strong></p>
          </div>

          {/* BLINDAJE AQUÍ: Preguntamos si keywords existe Y si tiene contenido */}
          {result.analysis.keywords && result.analysis.keywords.length > 0 && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '5px' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem' }}>Palabras Clave:</p>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {result.analysis.keywords.map((kw, i) => (
                  <span key={i} style={{ background: '#fff', color: '#333', padding: '2px 8px', borderRadius: '10px', fontSize: '0.8rem' }}>
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          <small style={{ display: 'block', marginTop: '10px' }}>Original: "{result.original_text}"</small>
        </div>
      )}
    </div>
  )
}

export default App