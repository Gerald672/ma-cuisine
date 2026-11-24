import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import BibliothequePage from '../pages/BibliothequePage'
import StockPage from '../pages/StockPage'
import CoursesPage from '../pages/CoursesPage'
import BudgetPage from '../pages/BudgetPage'
import PlanningPage from '../pages/PlanningPage'
import PartageePage from '../pages/PartageePage'
import NutritionPage from '../pages/NutritionPage'
import CavePage from '../pages/CavePage'

const VERT = '#2F6B4A'
const VERT_FONCE = '#1F4A33'
const VERT_CLAIR = '#E3EDE2'

// Icônes ligne (même épaisseur partout) — look sobre et lisible
const ICONS = {
  bibliotheque: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5',
  planning:     'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM8 12h2M12 12h2M8 16h2M12 16h2',
  stock:        'M3 8l9-5 9 5v9l-9 5-9-5V8ZM3 8l9 5 9-5M12 13v9',
  courses:      'M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L19 8H6M9 19.5a1 1 0 1 0 0 .01M17 19.5a1 1 0 1 0 0 .01',
  budget:       'M12 3v18M16 7.5C16 6 14.4 5 12 5S8 6 8 7.8c0 4.2 8 2.2 8 6.4 0 1.8-1.8 2.8-4 2.8s-4-1-4-2.5',
  partage:      'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3 2.7-5 6-5s6 2 6 5M14 15.3c.6-.2 1.3-.3 2-.3 3.3 0 6 2 6 5',
  nutrition:    'M12 21c-4.5 0-8-3.4-8-8 0-5 4-9 8-10 4 1 8 5 8 10 0 4.6-3.5 8-8 8ZM12 8v13M12 14c-2 0-3.5-1-4-3M12 12c2 0 3.5-1 4-3',
  cave:         'M8 3h8v5a4 4 0 0 1-8 0V3ZM12 12v9M8 21h8M8 6h8',
  plus:         'M5 12h.01M12 12h.01M19 12h.01',
}

function Icon({ name, size = 22, color = 'currentColor', stroke = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={name === 'plus' ? 3.2 : stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

// Onglets principaux (barre du bas) et le reste (menu « Plus »)
const MAIN = [
  { id: 'bibliotheque', label: 'Recettes' },
  { id: 'planning',     label: 'Planning' },
  { id: 'courses',      label: 'Courses' },
  { id: 'stock',        label: 'Stock' },
]
const MORE = [
  { id: 'cave',      label: 'Cave',      desc: 'Vins & scan' },
  { id: 'budget',    label: 'Budget',    desc: 'Coût des repas' },
  { id: 'nutrition', label: 'Nutrition', desc: 'Calories & santé' },
  { id: 'partage',   label: 'Partage',   desc: 'Recettes entre comptes' },
]
const ALL = MAIN.concat(MORE)

const TITLES = {
  bibliotheque: 'Recettes',
  planning:     'Planning',
  stock:        'Mon stock',
  courses:      'Courses',
  budget:       'Budget & coût',
  partage:      'Partage de recettes',
  nutrition:    'Nutrition & santé',
  cave:         'Ma cave',
}

const CSS = `
  html { -webkit-text-size-adjust: 100%; }
  html, body { overflow-x: hidden; max-width: 100%; }
  body { background: #EEF1EA; -webkit-tap-highlight-color: transparent; overscroll-behavior-y: none; }
  .mc-shell { overflow-x: clip; min-height: 100vh; min-height: 100dvh; background: #EEF1EA; }
  .mc-header { position: sticky; top: 0; z-index: 30; background: rgba(238,241,234,0.92); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    padding-top: env(safe-area-inset-top); }
  .mc-header-in { max-width: 960px; margin: 0 auto; min-height: 76px; display: flex; align-items: center; gap: 12px; padding: 10px 16px 6px; }
  .mc-titlebox { flex: 1; min-width: 0; }
  .mc-title { font-family: var(--serif); font-size: 28px; line-height: 1.1; font-weight: 400; color: #2A2118; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mc-date { font-size: 12.5px; color: #8A8576; margin-top: 3px; }
  .mc-avatar { width: 38px; height: 38px; border-radius: 50%; border: none; background: ${VERT}; color: #F3E6CC; font-family: var(--serif); font-size: 16px; text-transform: uppercase; flex-shrink: 0; }
  .mc-main { max-width: 960px; margin: 0 auto; padding: 8px 16px calc(100px + env(safe-area-inset-bottom)); }
  .mc-topnav { display: none; }
  .mc-scroll { scrollbar-width: none; }
  .mc-scroll::-webkit-scrollbar { display: none; }
  .mc-bottom { position: fixed; left: 12px; right: 12px; bottom: calc(10px + env(safe-area-inset-bottom)); z-index: 30; max-width: 520px; margin: 0 auto;
    background: #2A2118; border-radius: 26px; display: flex; gap: 2px; padding: 6px; box-shadow: 0 10px 28px rgba(42,33,24,0.28); }
  .mc-tab { flex: 1; min-height: 50px; background: none; border: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    font-size: 10.5px; font-weight: 500; color: #A89B8A; border-radius: 20px; transition: background .2s, color .2s; }
  .mc-tab.on { color: #2A2118; background: #F3E6CC; font-weight: 700; }
  .mc-tab:active { transform: scale(0.96); }
  .mc-scrim { position: fixed; inset: 0; z-index: 40; background: rgba(42,33,24,0.45); animation: mcfade .15s ease; }
  .mc-sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 41; background: #FCFDFA; border-radius: 24px 24px 0 0;
    padding: 8px 16px calc(16px + env(safe-area-inset-bottom)); max-width: 560px; margin: 0 auto; animation: mcup .2s ease; max-height: 85vh; overflow-y: auto; }
  .mc-grab { width: 38px; height: 4px; border-radius: 2px; background: #d8d8d2; margin: 0 auto 12px; }
  .mc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
  .mc-card { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 16px; border: 1px solid #DDE2D6; background: #F6F8F2; text-align: left; min-height: 64px; }
  .mc-card.on { background: ${VERT_CLAIR}; border-color: #9DC2A8; }
  .mc-card:active { background: #E9ECE3; }
  .mc-row { width: 100%; text-align: left; background: none; border: none; padding: 13px 6px; font-size: 15px; border-top: 0.5px solid #E9ECE3; min-height: 48px; }
  @keyframes mcup { from { transform: translateY(30px); opacity: 0 } to { transform: none; opacity: 1 } }
  @keyframes mcfade { from { opacity: 0 } to { opacity: 1 } }

  /* Téléphone : champs à 16px (évite le zoom automatique), listes défilantes à l'aise */
  @media (max-width: 767px) {
    input, select, textarea { font-size: 16px !important; }
    .mc-two { grid-template-columns: minmax(0, 1fr) !important; }
    .mc-main { padding-left: 12px; padding-right: 12px; }
    .mc-title { font-size: 26px; }
  }

  /* Ordinateur / tablette large : onglets en haut, plus de barre du bas */
  @media (min-width: 768px) {
    .mc-bottom { display: none; }
    .mc-main { padding-bottom: 32px; }
    .mc-topnav { display: flex; gap: 4px; max-width: 960px; margin: 0 auto; padding: 12px 14px 0; }
    .mc-toptab { display: flex; align-items: center; gap: 7px; padding: 8px 14px; border: none; border-radius: 10px; background: transparent; color: #6B6556; font-size: 14px; }
    .mc-toptab:hover { background: #E3E8DC; }
    .mc-toptab.on { background: ${VERT_CLAIR}; color: ${VERT_FONCE}; font-weight: 600; }
  }
`

function dateJour() {
  var d = new Date().toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })
  return d.charAt(0).toUpperCase() + d.slice(1)
}

function pageDepuisHash() {
  var h = (window.location.hash || '').replace('#', '')
  return TITLES[h] ? h : 'bibliotheque'
}

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const [page, setPage]         = useState(pageDepuisHash())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [backing, setBacking]   = useState(false)

  const ADMIN_EMAIL = 'gerald.thevoz@pm.me'

  // La page courante est dans l'adresse (#cave) : bouton retour et rechargement fonctionnent
  useEffect(function() {
    function onHash() { setPage(pageDepuisHash()); setSheetOpen(false) }
    window.addEventListener('hashchange', onHash)
    return function() { window.removeEventListener('hashchange', onHash) }
  }, [])

  // Molette de la souris : fait défiler les rangées horizontales (filtres, onglets, tableaux)
  useEffect(function() {
    function onWheel(e) {
      if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      var el = e.target
      while (el && el !== document.body) {
        var cs = window.getComputedStyle(el)
        var ox = cs.overflowX === 'auto' || cs.overflowX === 'scroll'
        var oy = cs.overflowY === 'auto' || cs.overflowY === 'scroll'
        if (ox && el.scrollWidth > el.clientWidth + 1 && !(oy && el.scrollHeight > el.clientHeight + 1)) {
          var max = el.scrollWidth - el.clientWidth
          var next = Math.max(0, Math.min(max, el.scrollLeft + e.deltaY))
          if (next !== el.scrollLeft) { el.scrollLeft = next; e.preventDefault() }
          return
        }
        el = el.parentElement
      }
    }
    document.addEventListener('wheel', onWheel, { passive: false })
    return function() { document.removeEventListener('wheel', onWheel) }
  }, [])

  function go(id) {
    setSheetOpen(false)
    if (id === page) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    window.location.hash = id
    window.scrollTo(0, 0)
  }

  async function doBackup() {
    setBacking(true)
    try {
      var tables = ['recipes', 'stock', 'ingredient_prices', 'meal_plan', 'meal_plan_recipes', 'ingredient_nutrition', 'user_preferences', 'share_codes', 'wines', 'wine_movements']
      var backup = { date: new Date().toISOString(), user: user.email, data: {} }
      for (var table of tables) {
        var { data } = await supabase.from(table).select('*').eq('user_id', user.id)
        backup.data[table] = data || []
      }
      // Tables sans user_id
      var { data: nutrition } = await supabase.from('ingredient_nutrition').select('*')
      backup.data['ingredient_nutrition'] = nutrition || []

      var json = JSON.stringify(backup, null, 2)
      var blob = new Blob([json], { type: 'application/json' })
      var url = URL.createObjectURL(blob)
      var a = document.createElement('a')
      a.href = url
      a.download = 'ma-cuisine-backup-' + new Date().toISOString().slice(0, 10) + '.json'
      a.click()
      URL.revokeObjectURL(url)
      setSheetOpen(false)
    } catch(e) {
      alert('Erreur lors de la sauvegarde : ' + e.message)
    }
    setBacking(false)
  }

  const PAGES = {
    bibliotheque: <BibliothequePage />,
    planning:     <PlanningPage />,
    stock:        <StockPage />,
    courses:      <CoursesPage />,
    budget:       <BudgetPage />,
    partage:      <PartageePage />,
    nutrition:    <NutritionPage />,
    cave:         <CavePage />,
  }

  var inMore = MORE.some(function(m) { return m.id === page })
  var initiale = (user.email || '?').charAt(0)

  return (
    <div className="mc-shell">
      <style>{CSS}</style>

      {/* En-tête */}
      <header className="mc-header">
        <div className="mc-header-in">
          <div className="mc-titlebox">
            <div className="mc-title">{TITLES[page]}</div>
            <div className="mc-date">{dateJour()}</div>
          </div>
          <button className="mc-avatar" onClick={() => setSheetOpen(true)} aria-label="Compte et menu">{initiale}</button>
        </div>
      </header>

      {/* Onglets (ordinateur) */}
      <nav className="mc-topnav" aria-label="Navigation">
        {ALL.map(function(n) {
          return (
            <button key={n.id} className={'mc-toptab' + (page === n.id ? ' on' : '')} onClick={() => go(n.id)}>
              <Icon name={n.id} size={18} />{n.label}
            </button>
          )
        })}
      </nav>

      <main className="mc-main">{PAGES[page]}</main>

      {/* Barre du bas (téléphone) : 4 onglets + Plus */}
      <nav className="mc-bottom" aria-label="Navigation">
        {MAIN.map(function(n) {
          return (
            <button key={n.id} className={'mc-tab' + (page === n.id ? ' on' : '')} onClick={() => go(n.id)} aria-current={page === n.id ? 'page' : undefined}>
              <Icon name={n.id} size={22} stroke={page === n.id ? 2.2 : 1.8} />
              {n.label}
            </button>
          )
        })}
        <button className={'mc-tab' + (inMore ? ' on' : '')} onClick={() => setSheetOpen(true)} aria-label="Plus">
          <Icon name="plus" size={22} />
          Plus
        </button>
      </nav>

      {/* Menu « Plus » + compte */}
      {sheetOpen && (
        <div>
          <div className="mc-scrim" onClick={() => setSheetOpen(false)} />
          <div className="mc-sheet" role="dialog" aria-label="Menu">
            <div className="mc-grab" />
            <div className="mc-grid">
              {MORE.map(function(n) {
                return (
                  <button key={n.id} className={'mc-card' + (page === n.id ? ' on' : '')} onClick={() => go(n.id)}>
                    <span style={{ color: page === n.id ? VERT_FONCE : '#555', display: 'flex' }}><Icon name={n.id} size={26} /></span>
                    <span>
                      <span style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#2A2118' }}>{n.label}</span>
                      <span style={{ display: 'block', fontSize: '11px', color: '#888', marginTop: '2px' }}>{n.desc}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: '12px', color: '#888', padding: '4px 6px 8px', wordBreak: 'break-all' }}>{user.email}</div>
            {user.email === ADMIN_EMAIL && (
              <button className="mc-row" onClick={doBackup} disabled={backing} style={{ color: VERT_FONCE }}>
                {backing ? 'Sauvegarde...' : 'Sauvegarder les données'}
              </button>
            )}
            <button className="mc-row" onClick={() => { setSheetOpen(false); signOut() }} style={{ color: '#E24B4A' }}>Se déconnecter</button>
          </div>
        </div>
      )}
    </div>
  )
}
