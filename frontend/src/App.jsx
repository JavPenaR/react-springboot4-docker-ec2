import { useEffect, useState } from 'react'

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'

export default function App() {
  const [estado, setEstado] = useState(null)
  const [nombre, setNombre] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function consultarEstado() {
    try {
      const respuesta = await fetch(`${apiBase}/estado`)
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`)
      setEstado(await respuesta.json())
      setError('')
    } catch (err) {
      setEstado(null)
      setError(`No se pudo conectar con la API: ${err.message}`)
    }
  }

  useEffect(() => { consultarEstado() }, [])

  async function enviarSaludo(event) {
    event.preventDefault()
    setEnviando(true)
    setMensaje('')
    setError('')
    try {
      const respuesta = await fetch(`${apiBase}/saludos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre })
      })
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`)
      const datos = await respuesta.json()
      setMensaje(datos.mensaje)
    } catch (err) {
      setError(`No se pudo enviar el saludo: ${err.message}`)
    } finally {
      setEnviando(false)
    }
  }

  return <main className="card">
    <span className="eyebrow">Laboratorio de despliegue</span>
    <h1>React local + Spring Boot 4 en EC2</h1>
    <p>Comprueba que el frontend de tu computador se comunica con la API desplegada en EC2.</p>
    <section className="status">
      <div>
        <strong>Estado de la API</strong>
        <small>{estado ? `Conectada · ${estado.servicio}` : 'Sin conexión'}</small>
      </div>
      <button type="button" onClick={consultarEstado}>Reintentar</button>
    </section>
    {estado && <p className="time">Hora del servidor: {new Date(estado.horaServidor).toLocaleString()}</p>}
    <form onSubmit={enviarSaludo}>
      <label htmlFor="nombre">Tu nombre</label>
      <div className="form-row">
        <input id="nombre" value={nombre} onChange={event => setNombre(event.target.value)} maxLength={80} required placeholder="Escribe tu nombre" />
        <button disabled={enviando}>{enviando ? 'Enviando…' : 'Saludar'}</button>
      </div>
    </form>
    {mensaje && <p className="success" role="status">{mensaje}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <footer>API: <code>{apiBase}</code></footer>
  </main>
}

