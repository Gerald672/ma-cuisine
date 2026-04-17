import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import BibliothequePage from '../pages/BibliothequePage'
import StockPage from '../pages/StockPage'
import CoursesPage from '../pages/CoursesPage'
import BudgetPage from '../pages/BudgetPage'
import PlanningPage from '../pages/PlanningPage'
import PartageePage from '../pages/PartageePage'

const NAV = [
  { id: 'bibliotheque', label: 'Bibliothèque', icon: '📚' },
  { id: 'planning',     label: 'Planning',      icon: '📅' },
  { id: 'stock',        label: 'Mon stock',     icon: '🥕' },
  { id: 'courses',      label: 'Courses',       icon: '🛒' },
  { id: 'budget',       label: 'Budget',        icon: '💰' },
  { id: 'partage',      label: 'Partage',       icon: '🤝' },
]

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const [page, setPage] = useState('bibliotheque')
  const [menuOpen, setMenuOpen] = useState(false)

  const PAGES = {
    bibliotheque: <BibliothequePage />,
    planning:     <PlanningPage />,
    stock:        <StockPage />,
    courses:      <CoursesPage />,
    budget:       <BudgetPage />,
    partage:      <PartageePage />,
  }

  const PAGE_TITLES = {
    bibliotheque: 'Bibliothèque',
    planning:     'Planning',
    stock:        'Mon stock',
    courses:      'Liste de courses',
    budget:       'Budget & coût',
    partage:      'Partage de recettes',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f0' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '0.5px solid #e0e0e0', padding: '0 1rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <div style={{ width: '28px', height: '28px', background: '#1D9E75', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🍳</div>
            <span style={{ fontSize: '16px', fontWeight: '500' }}>Ma cuisine</span>
          </div>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: '#f5f5f0', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', color: '#666' }}>
              {user.email.split('@')[0]} ▾
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '6px', minWidth: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 20 }}>
                <div style={{ padding: '6px 10px', fontSize: '12px', color: '#888', borderBottom: '0.5px solid #f0f0ec', marginBottom: '4px' }}>{user.email}</div>
                <button onClick={() => { signOut(); setMenuOpen(false) }} style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: '7px 10px', fontSize: '13px', cursor: 'pointer', borderRadius: '6px', color: '#E24B4A' }}>Se déconnecter</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop nav */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1rem 1rem 0' }}>
        <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '6px', display: 'flex', gap: '6px', marginBottom: '1rem' }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{
              flex: 1, padding: '8px 4px', border: 'none', cursor: 'pointer', borderRadius: '8px',
              fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              background: page === n.id ? '#E1F5EE' : 'transparent',
              color: page === n.id ? '#0F6E56' : '#888',
              fontWeight: page === n.id ? '500' : '400',
            }}>
              <span style={{ fontSize: '18px' }}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </div>
        <div style={{ paddingBottom: '5rem' }}>{PAGES[page]}</div>
      </div>

      {/* Mobile bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderTop: '0.5px solid #e0e0e0', display: 'flex', padding: '6px 0 calc(6px + env(safe-area-inset-bottom))', zIndex: 10 }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)} style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            padding: '4px', fontSize: '10px',
            color: page === n.id ? '#0F6E56' : '#aaa',
            fontWeight: page === n.id ? '500' : '400'
          }}>
            <span style={{ fontSize: '20px' }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </div>
    </div>
  )
}
