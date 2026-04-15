import { useState, useEffect } from 'react'
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
      justifyContent: 'center', background: '#f5f5f0', padding: '1rem'
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', padding: '2rem',
        width: '100%', maxWidth: '400px', border: '0.5px solid #e0e0e0'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '56px', height: '56px', background: '#1D9E75', borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', margin: '0 auto 12px'
          }}>🍳</div>
          <h1 style={{ fontSize: '22px', fontWeight: '500', margin: 0 }}>Ma cuisine</h1>
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
              width: '100%', background: '#1D9E75', color: 'white', border: 'none',
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
            <div style={{ background: '#E1F5EE', color: '#085041', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', lineHeight: '1.5' }}>
              ✓ {message}
            </div>
            <a href="/" style={{ display: 'block', textAlign: 'center', background: '#1D9E75', color: 'white', borderRadius: '8px', padding: '11px', fontSize: '14px', fontWeight: '500', textDecoration: 'none' }}>
              Retour à la connexion
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
