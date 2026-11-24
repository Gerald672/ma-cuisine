import Noix from './components/Noix'
import { AuthProvider, useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import AppLayout from './components/AppLayout'
import ResetPasswordPage from './pages/ResetPasswordPage'
 
function AppContent() {
  const { user, loading } = useAuth()
 
  // Détecter la page de réinitialisation de mot de passe
  const isResetPassword = window.location.pathname === '/reset-password'
  if (isResetPassword) return <ResetPasswordPage />
 
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#EEF1EA'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}><Noix size={56} /></div>
          <p style={{ color: '#888', fontSize: '14px' }}>Chargement...</p>
        </div>
      </div>
    )
  }
 
  return user ? <AppLayout /> : <LoginPage />
}
 
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
