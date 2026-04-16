import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// ─── Constantes ───────────────────────────────────────────────────────────────

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const REPAS = ['Petit-déjeuner', 'Dîner', 'Souper']

const REPAS_ICON = {
  'Petit-déjeuner': '☕',
  'Dîner':          '🍽️',
  'Souper':         '🌙',
}

const CAT_STYLE = {
  'Épicerie':          { bg: '#E6F1FB', color: '#185FA5' },
  'Frais':             { bg: '#EAF3DE', color: '#3B6D11' },
  'Fruits & légumes':  { bg: '#E1F5EE', color: '#085041' },
  'Produits laitiers': { bg: '#FAEEDA', color: '#854F0B' },
  'Viande & poisson':  { bg: '#FAECE7', color: '#712B13' },
  'Surgelés':          { bg: '#EEEDFE', color: '#3C3489' },
  'Autres':            { bg: '#f0f0ec', color: '#666' },
}

const ING_CATS = {
  'farine': 'Épicerie', 'sucre': 'Épicerie', 'riz': 'Épicerie', 'quinoa': 'Épicerie',
  'huile': 'Épicerie', 'vin': 'Épicerie', 'pâtes': 'Épicerie', 'bouillon': 'Épicerie',
  'lait': 'Produits laitiers', 'beurre': 'Produits laitiers', 'crème': 'Produits laitiers',
  'fromage': 'Produits laitiers', 'parmesan': 'Produits laitiers', 'gruyère': 'Produits laitiers',
  'mozzarella': 'Produits laitiers', 'yaourt': 'Produits laitiers',
  'œuf': 'Frais', 'menthe': 'Frais', 'basilic': 'Frais', 'thym': 'Frais', 'persil': 'Frais',
  'champignon': 'Fruits & légumes', 'oignon': 'Fruits & légumes', 'ail': 'Fruits & légumes',
  'tomate': 'Fruits & légumes', 'carotte': 'Fruits & légumes', 'pomme': 'Fruits & légumes',
  'citron': 'Fruits & légumes', 'courgette': 'Fruits & légumes', 'banane': 'Fruits & légumes',
  'poulet': 'Viande & poisson', 'bœuf': 'Viande & poisson', 'saumon': 'Viande & poisson', 'lardon': 'Viande & poisson',
}

function getCat(name) {
  const lower = (name || '').toLowerCase()
  for (const [key, cat] of Object.entries(ING_CATS)) {
    if (lower.includes(key)) return cat
  }
  return 'Autres'
}

// Calcule le lundi de la semaine courante
function getLundi(offset = 0) {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1 + offset * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(date) {
  return date.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })
}

function weekKey(lundi) {
  return lundi.toISOString().slice(0, 10)
}

// ─── Composant PrintView ──────────────────────────────────────────────────────

function printPlanning(plan, recipes, lundi) {
  const recipeMap = {}
  recipes.forEach(r => { recipeMap[r.id] = r })

  const rows = JOURS.map((jour, ji) => {
    const date = new Date(lundi); date.setDate(date.getDate() + ji)
    const cells = REPAS.map(repas => {
      const slot = plan[ji]?.[repas]
      const r = slot ? recipeMap[slot.recipe_id] : null
      return `<td style="border:1px solid #e0e0e0;padding:8px;vertical-align:top;min-width:120px">
        ${r ? `<div style="font-weight:500;font-size:13px">${r.emoji} ${r.title}</div><div style="color:#888;font-size:11px">${r.time} min</div>` : '<span style="color:#ccc;font-size:12px">—</span>'}
      </td>`
    }).join('')
    return `<tr>
      <td style="border:1px solid #e0e0e0;padding:8px;font-weight:500;font-size:13px;white-space:nowrap">${jour}<br><span style="font-weight:400;color:#888;font-size:11px">${formatDate(date)}</span></td>
      ${cells}
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Planning semaine</title>
  <style>body{font-family:system-ui,sans-serif;padding:24px}h2{margin-bottom:16px}table{border-collapse:collapse;width:100%}th{background:#f5f5f0;padding:8px;border:1px solid #e0e0e0;font-size:13px}@media print{button{display:none}}</style>
  </head><body>
  <h2>🍳 Planning semaine du ${formatDate(lundi)}</h2>
  <table><thead><tr><th></th>${REPAS.map(r => `<th>${REPAS_ICON[r]} ${r}</th>`).join('')}</tr></thead>
  <tbody>${rows}</tbody></table>
  <br><button onclick="window.print()">Imprimer</button>
  </body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
}

function printCourses(coursesList, lundi) {
  const aAcheter = coursesList.filter(i => !i.enStock)
  const groups = {}
  aAcheter.forEach(item => {
    if (!groups[item.cat]) groups[item.cat] = []
    groups[item.cat].push(item)
  })

  const sections = Object.entries(groups).map(([cat, items]) => `
    <div style="margin-bottom:16px">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px;color:#555">${cat}</div>
      ${items.map(i => `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f0f0ec">
        <span style="width:14px;height:14px;border:1px solid #ccc;display:inline-block;border-radius:3px;flex-shrink:0"></span>
        <span style="flex:1;font-size:13px">${i.name}</span>
        <span style="font-size:12px;color:#888">${i.manque} ${i.unit}</span>
      </div>`).join('')}
    </div>`).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Liste de courses</title>
  <style>body{font-family:system-ui,sans-serif;padding:24px;max-width:600px}h2{margin-bottom:4px}p{color:#888;font-size:13px;margin-bottom:20px}@media print{button{display:none}}</style>
  </head><body>
  <h2>🛒 Liste de courses</h2>
  <p>Semaine du ${formatDate(lundi)} · ${aAcheter.length} article${aAcheter.length > 1 ? 's' : ''}</p>
  ${sections}
  <br><button onclick="window.print()">Imprimer</button>
  </body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function PlanningPage() {
  const { user } = useAuth()
  const [recipes, setRecipes]       = useState([])
  const [stock, setStock]           = useState([])
  const [plan, setPlan]             = useState({}) // { jourIndex: { repas: { recipe_id } } }
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [showCourses, setShowCourses] = useState(false)
  const [showRecipePicker, setShowRecipePicker] = useState(null) // { jourIndex, repas }
  const [pickerSearch, setPickerSearch] = useState('')
  const [dragSource, setDragSource]   = useState(null) // { jourIndex, repas }
  const [dragOver, setDragOver]       = useState(null)
  const [persons, setPersons]         = useState(2)

  const lundi = getLundi(weekOffset)
  const wKey  = weekKey(lundi)

  useEffect(() => { loadAll() }, [user])
  useEffect(() => { loadPlan() }, [wKey, user])

  async function loadAll() {
    const [{ data: r }, { data: s }] = await Promise.all([
      supabase.from('recipes').select('*').eq('user_id', user.id),
      supabase.from('stock').select('*').eq('user_id', user.id)
    ])
    setRecipes(r || [])
    setStock(s || [])
    setLoading(false)
  }

  async function loadPlan() {
    const { data } = await supabase
      .from('meal_plan')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start', wKey)
    const p = {}
    for (const row of (data || [])) {
      if (!p[row.jour_index]) p[row.jour_index] = {}
      p[row.jour_index][row.repas] = { id: row.id, recipe_id: row.recipe_id }
    }
    setPlan(p)
  }

  const recipeMap = {}
  recipes.forEach(r => { recipeMap[r.id] = r })

  // ── Assigner une recette à un slot ─────────────────────────────────────────

  async function assignRecipe(jourIndex, repas, recipeId) {
    setSaving(true)
    const existing = plan[jourIndex]?.[repas]

    if (existing) {
      // Mise à jour
      await supabase.from('meal_plan').update({ recipe_id: recipeId }).eq('id', existing.id)
    } else {
      // Insertion
      await supabase.from('meal_plan').insert({
        user_id: user.id, week_start: wKey,
        jour_index: jourIndex, repas, recipe_id: recipeId
      })
    }
    await loadPlan()
    setSaving(false)
    setShowRecipePicker(null)
    setPickerSearch('')
  }

  async function removeSlot(jourIndex, repas) {
    const existing = plan[jourIndex]?.[repas]
    if (!existing) return
    await supabase.from('meal_plan').delete().eq('id', existing.id)
    await loadPlan()
  }

  // ── Drag & drop ────────────────────────────────────────────────────────────

  function handleDragStart(e, jourIndex, repas) {
    setDragSource({ jourIndex, repas })
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, jourIndex, repas) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver({ jourIndex, repas })
  }

  function handleDrop(e, jourIndex, repas) {
    e.preventDefault()
    setDragOver(null)
    if (!dragSource) return
    const srcRecipe = plan[dragSource.jourIndex]?.[dragSource.repas]
    const dstRecipe = plan[jourIndex]?.[repas]

    // Échanger les deux slots
    const doSwap = async () => {
      setSaving(true)
      if (srcRecipe) await supabase.from('meal_plan').update({ jour_index: jourIndex, repas }).eq('id', srcRecipe.id)
      if (dstRecipe) await supabase.from('meal_plan').update({ jour_index: dragSource.jourIndex, repas: dragSource.repas }).eq('id', dstRecipe.id)
      await loadPlan()
      setSaving(false)
    }
    doSwap()
    setDragSource(null)
  }

  function handleDragEnd() { setDragSource(null); setDragOver(null) }

  // ── Liste de courses depuis le planning ────────────────────────────────────

  const factor = persons / 2
  const plannedRecipes = [...new Set(
    Object.values(plan).flatMap(day => Object.values(day).map(s => s.recipe_id))
  )].map(id => recipeMap[id]).filter(Boolean)

  const needed = {}
  plannedRecipes.forEach(r => {
    (r.ingredients || []).forEach(ing => {
      if (!needed[ing.name]) needed[ing.name] = { name: ing.name, qty: 0, unit: ing.unit }
      needed[ing.name].qty += (ing.qty || 0) * factor
    })
  })

  const coursesList = Object.values(needed).map(item => {
    const inStock = stock.find(s => s.name.toLowerCase() === item.name.toLowerCase())
    const stockQty = inStock ? inStock.qty : 0
    const manque = Math.max(0, item.qty - stockQty)
    return { ...item, inStock: stockQty, manque: Math.ceil(manque), enStock: manque <= 0, cat: getCat(item.name) }
  })

  const aAcheter  = coursesList.filter(i => !i.enStock)
  const dejaDispo = coursesList.filter(i => i.enStock)
  const coursesGroups = {}
  aAcheter.forEach(item => {
    if (!coursesGroups[item.cat]) coursesGroups[item.cat] = []
    coursesGroups[item.cat].push(item)
  })

  // ── Partage email ──────────────────────────────────────────────────────────

  function shareByEmail(type) {
    let subject, body

    if (type === 'planning') {
      subject = encodeURIComponent(`Planning repas semaine du ${formatDate(lundi)}`)
      const lines = JOURS.map((jour, ji) => {
        const date = new Date(lundi); date.setDate(date.getDate() + ji)
        const repasLines = REPAS.map(repas => {
          const slot = plan[ji]?.[repas]
          const r = slot ? recipeMap[slot.recipe_id] : null
          return `  ${REPAS_ICON[repas]} ${repas} : ${r ? r.title : '—'}`
        }).join('\n')
        return `${jour} ${formatDate(date)}\n${repasLines}`
      }).join('\n\n')
      body = encodeURIComponent(`Planning semaine du ${formatDate(lundi)}\n\n${lines}\n\nEnvoyé depuis Ma Cuisine 🍳`)
    } else {
      subject = encodeURIComponent(`Liste de courses — semaine du ${formatDate(lundi)}`)
      const lines = Object.entries(coursesGroups).map(([cat, items]) =>
        `${cat}:\n${items.map(i => `  • ${i.name} — ${i.manque} ${i.unit}`).join('\n')}`
      ).join('\n\n')
      body = encodeURIComponent(`Liste de courses — semaine du ${formatDate(lundi)}\n\n${lines}\n\nEnvoyé depuis Ma Cuisine 🍳`)
    }

    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  // ── Recettes filtrées pour le picker ───────────────────────────────────────

  const filteredRecipes = recipes.filter(r =>
    !pickerSearch || r.title.toLowerCase().includes(pickerSearch.toLowerCase())
  )

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Chargement...</div>

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── En-tête semaine ── */}
      <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={() => setWeekOffset(w => w - 1)}
          style={{ background: 'none', border: '0.5px solid #ddd', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '14px' }}>‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: '500' }}>
            {weekOffset === 0 ? 'Cette semaine' : weekOffset === 1 ? 'Semaine prochaine' : weekOffset === -1 ? 'Semaine dernière' : `Semaine du ${formatDate(lundi)}`}
          </div>
          <div style={{ fontSize: '12px', color: '#888' }}>{formatDate(lundi)} → {formatDate(new Date(lundi.getTime() + 6 * 86400000))}</div>
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)}
          style={{ background: 'none', border: '0.5px solid #ddd', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '14px' }}>›</button>
        {weekOffset !== 0 && (
          <button onClick={() => setWeekOffset(0)}
            style={{ background: 'none', border: '0.5px solid #1D9E75', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', color: '#1D9E75' }}>Aujourd'hui</button>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: '#666' }}>👥</label>
            <select value={persons} onChange={e => setPersons(parseInt(e.target.value))}
              style={{ padding: '5px 8px', border: '0.5px solid #ddd', borderRadius: '6px', fontSize: '12px' }}>
              {[1,2,3,4,6,8].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button onClick={() => setShowCourses(s => !s)}
            style={{ padding: '6px 10px', fontSize: '12px', border: '0.5px solid #ddd', borderRadius: '8px', cursor: 'pointer', background: showCourses ? '#E1F5EE' : 'white', color: showCourses ? '#0F6E56' : '#555' }}>
            🛒 Courses
          </button>
          <button onClick={() => shareByEmail('planning')}
            style={{ padding: '6px 10px', fontSize: '12px', border: '0.5px solid #ddd', borderRadius: '8px', cursor: 'pointer', background: 'white' }}>
            ✉️ Partager
          </button>
          <button onClick={() => printPlanning(plan, recipes, lundi)}
            style={{ padding: '6px 10px', fontSize: '12px', border: '0.5px solid #ddd', borderRadius: '8px', cursor: 'pointer', background: 'white' }}>
            🖨️ Imprimer
          </button>
        </div>
        {saving && <span style={{ fontSize: '11px', color: '#1D9E75' }}>↻ Sauvegarde…</span>}
      </div>

      {/* ── Grille planning ── */}
      <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
        {/* En-tête colonnes */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px repeat(3, 1fr)', borderBottom: '0.5px solid #e0e0e0', background: '#fafaf8' }}>
          <div style={{ padding: '10px 12px', fontSize: '11px', color: '#aaa' }} />
          {REPAS.map(repas => (
            <div key={repas} style={{ padding: '10px 12px', fontSize: '12px', fontWeight: '500', color: '#555', textAlign: 'center', borderLeft: '0.5px solid #e0e0e0' }}>
              {REPAS_ICON[repas]} {repas}
            </div>
          ))}
        </div>

        {/* Lignes jours */}
        {JOURS.map((jour, ji) => {
          const date = new Date(lundi); date.setDate(date.getDate() + ji)
          const isToday = new Date().toDateString() === date.toDateString()
          return (
            <div key={jour} style={{ display: 'grid', gridTemplateColumns: '90px repeat(3, 1fr)', borderBottom: ji < 6 ? '0.5px solid #e0e0e0' : 'none' }}>
              {/* Libellé jour */}
              <div style={{ padding: '12px', background: isToday ? '#E1F5EE' : '#fafaf8', borderRight: '0.5px solid #e0e0e0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: isToday ? '600' : '500', color: isToday ? '#0F6E56' : '#333' }}>{jour}</div>
                <div style={{ fontSize: '11px', color: '#aaa' }}>{formatDate(date)}</div>
              </div>

              {/* Slots repas */}
              {REPAS.map(repas => {
                const slot    = plan[ji]?.[repas]
                const recipe  = slot ? recipeMap[slot.recipe_id] : null
                const isDragOver = dragOver?.jourIndex === ji && dragOver?.repas === repas
                const isDragSrc  = dragSource?.jourIndex === ji && dragSource?.repas === repas

                return (
                  <div
                    key={repas}
                    onDragOver={e => handleDragOver(e, ji, repas)}
                    onDrop={e => handleDrop(e, ji, repas)}
                    style={{
                      borderLeft: '0.5px solid #e0e0e0', padding: '8px',
                      minHeight: '70px', position: 'relative',
                      background: isDragOver ? '#E1F5EE' : isDragSrc ? '#f0fdf4' : 'white',
                      transition: 'background 0.15s',
                    }}
                  >
                    {recipe ? (
                      <div
                        draggable
                        onDragStart={e => handleDragStart(e, ji, repas)}
                        onDragEnd={handleDragEnd}
                        style={{
                          background: '#f5f5f0', borderRadius: '8px', padding: '7px 8px',
                          cursor: 'grab', opacity: isDragSrc ? 0.4 : 1,
                          display: 'flex', alignItems: 'flex-start', gap: '6px',
                        }}
                      >
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>{recipe.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', fontWeight: '500', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{recipe.title}</div>
                          <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>{recipe.time} min</div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); removeSlot(ji, repas) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '14px', padding: 0, lineHeight: 1, flexShrink: 0 }}
                        >×</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setShowRecipePicker({ jourIndex: ji, repas }); setPickerSearch('') }}
                        style={{
                          width: '100%', height: '100%', minHeight: '52px',
                          background: 'none', border: '1px dashed #e0e0e0', borderRadius: '8px',
                          cursor: 'pointer', color: '#ccc', fontSize: '18px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'border-color 0.15s, color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#1D9E75'; e.currentTarget.style.color = '#1D9E75' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.color = '#ccc' }}
                      >+</button>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* ── Liste de courses du planning ── */}
      {showCourses && (
        <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>🛒 Courses de la semaine</div>
              <div style={{ fontSize: '12px', color: '#888' }}>{plannedRecipes.length} recette{plannedRecipes.length > 1 ? 's' : ''} planifiée{plannedRecipes.length > 1 ? 's' : ''} · {persons} personne{persons > 1 ? 's' : ''}</div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => shareByEmail('courses')}
                style={{ padding: '6px 10px', fontSize: '12px', border: '0.5px solid #ddd', borderRadius: '8px', cursor: 'pointer', background: 'white' }}>✉️ Partager</button>
              <button onClick={() => printCourses(coursesList, lundi)}
                style={{ padding: '6px 10px', fontSize: '12px', border: '0.5px solid #ddd', borderRadius: '8px', cursor: 'pointer', background: 'white' }}>🖨️ Imprimer</button>
            </div>
          </div>

          {plannedRecipes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '13px' }}>Aucune recette planifiée cette semaine.</div>
          ) : (
            <>
              {aAcheter.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#333', marginBottom: '10px' }}>À acheter ({aAcheter.length})</div>
                  {Object.entries(coursesGroups).map(([cat, items]) => {
                    const cs = CAT_STYLE[cat] || CAT_STYLE['Autres']
                    return (
                      <div key={cat} style={{ marginBottom: '12px' }}>
                        <span style={{ padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '500', background: cs.bg, color: cs.color }}>{cat}</span>
                        <div style={{ border: '0.5px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', marginTop: '6px' }}>
                          {items.map(item => (
                            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderBottom: '0.5px solid #f0f0ec', fontSize: '13px' }}>
                              <div style={{ flex: 1 }}>{item.name}</div>
                              <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '500', background: '#FCEBEB', color: '#791F1F' }}>{item.manque} {item.unit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {dejaDispo.length > 0 && (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#3B6D11', marginBottom: '8px' }}>✓ Déjà en stock ({dejaDispo.length})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {dejaDispo.map(item => (
                      <span key={item.name} style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '12px', background: '#EAF3DE', color: '#3B6D11' }}>{item.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Modal picker de recette ── */}
      {showRecipePicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', width: '100%', maxWidth: '480px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Choisir une recette</div>
                <div style={{ fontSize: '12px', color: '#888' }}>
                  {JOURS[showRecipePicker.jourIndex]} · {REPAS_ICON[showRecipePicker.repas]} {showRecipePicker.repas}
                </div>
              </div>
              <button onClick={() => setShowRecipePicker(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#aaa' }}>✕</button>
            </div>
            <input
              autoFocus
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              placeholder="Rechercher…"
              style={{ padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', marginBottom: '10px' }}
            />
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredRecipes.map(r => (
                <div key={r.id}
                  onClick={() => assignRecipe(showRecipePicker.jourIndex, showRecipePicker.repas, r.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '0.5px solid #e0e0e0', borderRadius: '10px', cursor: 'pointer', background: 'white' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#1D9E75'; e.currentTarget.style.background = '#E1F5EE' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.background = 'white' }}
                >
                  {r.photo_url
                    ? <img src={r.photo_url} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                    : <div style={{ width: '40px', height: '40px', background: '#f5f5f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>{r.emoji}</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{r.title}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>{r.time} min · {r.servings} pers.</div>
                  </div>
                </div>
              ))}
              {filteredRecipes.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '13px' }}>Aucune recette trouvée</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
