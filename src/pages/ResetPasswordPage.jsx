import { useState, useEffect } from 'react'
import Noix from '../components/Noix'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false) // true quand Supabase a validé le token

  // Supabase envoie le token dans l'URL sous forme de hash (#access_token=...)
  // L'event PASSWORD_RECOVERY signale que la session est prête
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    if (password !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError('Erreur lors de la mise à jour. Le lien a peut-être expiré.')
    else setMessage('Mot de passe mis à jour ! Tu peux maintenant te connecter.')
    setLoading(false)
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
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}><Noix size={64} /></div>
          <h1 style={{ fontSize: '28px', margin: 0 }}>Ma cuisine</h1>
          <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>Choisir un nouveau mot de passe</p>
        </div>

        {/* Token pas encore prêt */}
        {!ready && !message && (
          <div style={{ textAlign: 'center', padding: '1rem', color: '#888', fontSize: '13px' }}>
            ⏳ Vérification du lien en cours…
          </div>
        )}

        {/* Formulaire */}
        {ready && !message && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
                Nouveau mot de passe
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required placeholder="••••••••" minLength={6}
                style={{ width: '100%', padding: '10px 14px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
                Confirmer le mot de passe
              </label>
              <input
                type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                required placeholder="••••••••" minLength={6}
                style={{ width: '100%', padding: '10px 14px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {error && (
              <div style={{ background: '#FCEBEB', color: '#791F1F', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', background: '#2F6B4A', color: 'white', border: 'none',
              borderRadius: '8px', padding: '11px', fontSize: '14px', fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1
            }}>
              {loading ? 'Mise à jour…' : 'Enregistrer le nouveau mot de passe'}
            </button>
          </form>
        )}

        {/* Succès */}
        {message && (
          <div>
            <div style={{ background: '#E3EDE2', color: '#143626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', lineHeight: '1.5' }}>
              ✓ {message}
            </div>
            <a href="/" style={{ display: 'block', textAlign: 'center', background: '#2F6B4A', color: 'white', borderRadius: '8px', padding: '11px', fontSize: '14px', fontWeight: '500', textDecoration: 'none' }}>
              Retour à la connexion
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
