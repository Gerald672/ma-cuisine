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
        justifyContent: 'center', background: '#f5f5f0'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🍳</div>
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
