import { useState } from 'react'
import Noix from '../components/Noix'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  function switchMode(newMode) {
    setMode(newMode)
    setError('')
    setMessage('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError('Email ou mot de passe incorrect.')

    } else if (mode === 'signup') {
      const { error } = await signUp(email, password)
      if (error) setError('Erreur lors de la création du compte.')
      else setMessage('Compte créé ! Vérifie ton email pour confirmer.')

    } else if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password'
      })
      if (error) setError('Impossible d\'envoyer l\'email. Vérifie l\'adresse saisie.')
      else setMessage('Email envoyé ! Consulte ta boîte mail et clique sur le lien pour choisir un nouveau mot de passe.')
    }

    setLoading(false)
  }

  const titles = {
    login:  'Connecte-toi à ton compte',
    signup: 'Crée ton compte gratuitement',
    reset:  'Réinitialiser le mot de passe',
  }

  const submitLabels = {
    login:  'Se connecter',
    signup: 'Créer mon compte',
    reset:  'Envoyer le lien',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#EEF1EA', padding: '1rem'
    }}>
      <div style={{
        background: 'white', borderRadius: '24px', padding: '2rem',
        width: '100%', maxWidth: '400px', border: '1px solid #DDE2D6', boxShadow: '0 12px 32px rgba(42,33,24,0.08)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}><Noix size={64} /></div>
          <h1 style={{ fontSize: '28px', margin: 0 }}>Ma cuisine</h1>
          <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
            {titles[mode]}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email — toujours visible */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="ton@email.com"
              style={{
                width: '100%', padding: '10px 14px', border: '0.5px solid #ddd',
                borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Mot de passe — masqué en mode reset */}
          {mode !== 'reset' && (
            <div style={{ marginBottom: mode === 'login' ? '6px' : '16px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
                Mot de passe
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required placeholder="••••••••" minLength={6}
                style={{
                  width: '100%', padding: '10px 14px', border: '0.5px solid #ddd',
                  borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          {/* Lien "Mot de passe oublié ?" sous le champ password en mode login */}
          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => switchMode('reset')}
                style={{
                  background: 'none', border: 'none', color: '#888',
                  fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', padding: 0
                }}
              >
                Mot de passe oublié ?
              </button>
            </div>
          )}

          {/* Message d'info en mode reset */}
          {mode === 'reset' && !message && (
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px', lineHeight: '1.5' }}>
              Saisis ton adresse email ci-dessus. Tu recevras un lien pour choisir un nouveau mot de passe.
            </p>
          )}

          {error && (
            <div style={{
              background: '#FCEBEB', color: '#791F1F', padding: '10px 14px',
              borderRadius: '8px', fontSize: '13px', marginBottom: '12px'
            }}>{error}</div>
          )}
          {message && (
            <div style={{
              background: '#E3EDE2', color: '#143626', padding: '10px 14px',
              borderRadius: '8px', fontSize: '13px', marginBottom: '12px',
              lineHeight: '1.5'
            }}>{message}</div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', background: '#2F6B4A', color: 'white',
              border: 'none', borderRadius: '8px', padding: '11px',
              fontSize: '14px', fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Chargement...' : submitLabels[mode]}
          </button>
        </form>

        {/* Liens de navigation entre les modes */}
        <div style={{ textAlign: 'center', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {mode !== 'login' && (
            <button
              onClick={() => switchMode('login')}
              style={{ background: 'none', border: 'none', color: '#2F6B4A', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Déjà un compte ? Se connecter
            </button>
          )}
          {mode !== 'signup' && (
            <button
              onClick={() => switchMode('signup')}
              style={{ background: 'none', border: 'none', color: '#2F6B4A', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Pas encore de compte ? Créer un compte
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
