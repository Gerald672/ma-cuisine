import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError('Email ou mot de passe incorrect.')
    } else {
      const { error } = await signUp(email, password)
      if (error) setError('Erreur lors de la création du compte.')
      else setMessage('Compte créé ! Vérifie ton email pour confirmer.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f5f5f0', padding: '1rem'
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', padding: '2rem',
        width: '100%', maxWidth: '400px', border: '0.5px solid #e0e0e0'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '56px', height: '56px', background: '#1D9E75',
            borderRadius: '14px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '28px', margin: '0 auto 12px'
          }}>🍳</div>
          <h1 style={{ fontSize: '22px', fontWeight: '500', margin: 0 }}>Ma cuisine</h1>
          <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
            {mode === 'login' ? 'Connecte-toi à ton compte' : 'Crée ton compte gratuitement'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="ton@email.com"
              style={{
                width: '100%', padding: '10px 14px', border: '0.5px solid #ddd',
                borderRadius: '8px', fontSize: '14px', outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
              Mot de passe
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required placeholder="••••••••" minLength={6}
              style={{
                width: '100%', padding: '10px 14px', border: '0.5px solid #ddd',
                borderRadius: '8px', fontSize: '14px', outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#FCEBEB', color: '#791F1F', padding: '10px 14px',
              borderRadius: '8px', fontSize: '13px', marginBottom: '12px'
            }}>{error}</div>
          )}
          {message && (
            <div style={{
              background: '#E1F5EE', color: '#085041', padding: '10px 14px',
              borderRadius: '8px', fontSize: '13px', marginBottom: '12px'
            }}>{message}</div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', background: '#1D9E75', color: 'white',
              border: 'none', borderRadius: '8px', padding: '11px',
              fontSize: '14px', fontWeight: '500', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}
            style={{
              background: 'none', border: 'none', color: '#1D9E75',
              fontSize: '13px', cursor: 'pointer', textDecoration: 'underline'
            }}
          >
            {mode === 'login' ? 'Pas encore de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
          </button>
        </div>
      </div>
    </div>
  )
}
