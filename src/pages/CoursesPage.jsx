import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

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
  'citron': 'Fruits & légumes', 'orange': 'Fruits & légumes',
  'courgette': 'Fruits & légumes', 'épinard': 'Fruits & légumes', 'banane': 'Fruits & légumes',
  'poulet': 'Viande & poisson', 'bœuf': 'Viande & poisson', 'saumon': 'Viande & poisson', 'lardon': 'Viande & poisson',
}

function getCat(name) {
  const lower = (name || '').toLowerCase()
  for (const [key, cat] of Object.entries(ING_CATS)) {
    if (lower.includes(key)) return cat
  }
  return 'Autres'
}

// ── Impression PDF ────────────────────────────────────────────────────────────

function printCourses(groups, aAcheter, dejaDispo, recipeNames) {
  const sections = Object.entries(groups).map(([cat, items]) => `
    <div style="margin-bottom:18px">
      <div style="font-weight:600;font-size:13px;color:#555;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em">${cat}</div>
      ${items.map(i => `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #f0f0ec">
          <span style="width:16px;height:16px;border:1.5px solid #ccc;display:inline-block;border-radius:3px;flex-shrink:0"></span>
          <span style="flex:1;font-size:13px">${i.name}</span>
          <span style="font-size:12px;color:#666;font-weight:500">${i.manque} ${i.unit}</span>
        </div>`).join('')}
    </div>`).join('')

  const dispo = dejaDispo.length > 0 ? `
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e0e0e0">
      <div style="font-size:12px;color:#3B6D11;font-weight:600;margin-bottom:8px">✓ DÉJÀ EN STOCK</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${dejaDispo.map(i => `<span style="padding:3px 10px;border-radius:10px;font-size:12px;background:#EAF3DE;color:#3B6D11">${i.name}</span>`).join('')}
      </div>
    </div>` : ''

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Liste de courses</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 32px; max-width: 640px; margin: 0 auto; color: #333 }
    h2 { margin: 0 0 4px; font-size: 20px }
    .meta { color: #888; font-size: 13px; margin-bottom: 8px }
    .recipes { color: #555; font-size: 12px; margin-bottom: 24px; padding: 8px 12px; background: #f5f5f0; border-radius: 8px }
    @media print { button { display: none } body { padding: 16px } }
  </style>
  </head><body>
    <h2>🛒 Liste de courses</h2>
    <p class="meta">${aAcheter.length} article${aAcheter.length > 1 ? 's' : ''} à acheter</p>
    ${recipeNames.length > 0 ? `<p class="recipes">Recettes : ${recipeNames.join(', ')}</p>` : ''}
    ${sections}
    ${dispo}
    <br>
    <button onclick="window.print()" style="padding:8px 16px;background:#1D9E75;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px">🖨️ Imprimer</button>
  </body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
}

// ── Partage email ─────────────────────────────────────────────────────────────

function shareByEmail(groups, aAcheter, recipeNames) {
  const subject = encodeURIComponent('Liste de courses 🛒')
  const recipesPart = recipeNames.length > 0 ? `Recettes : ${recipeNames.join(', ')}\n\n` : ''
  const lines = Object.entries(groups).map(([cat, items]) =>
    `${cat} :\n${items.map(i => `  • ${i.name} — ${i.manque} ${i.unit}`).join('\n')}`
  ).join('\n\n')
  const body = encodeURIComponent(`Liste de courses\n\n${recipesPart}${lines}\n\nEnvoyé depuis Ma Cuisine 🍳`)
  window.location.href = `mailto:?subject=${subject}&body=${body}`
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CoursesPage() {
  const { user } = useAuth()
  const [recipes, setRecipes]   = useState([])
  const [stock, setStock]       = useState([])
  const [selected, setSelected] = useState(new Set())
  const [persons, setPersons]   = useState(2)
  const [checked, setChecked]   = useState(new Set())
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('recipes').select('*').eq('user_id', user.id),
      supabase.from('stock').select('*').eq('user_id', user.id)
    ]).then(([{ data: r }, { data: s }]) => {
      setRecipes(r || [])
      setStock(s || [])
      setLoading(false)
    })
  }, [user])

  function toggleRecipe(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
    setChecked(new Set())
  }

  function toggleCheck(name) {
    setChecked(c => { const n = new Set(c); n.has(name) ? n.delete(name) : n.add(name); return n })
  }

  const factor = persons / 2

  const needed = {}
  recipes.filter(r => selected.has(r.id)).forEach(r => {
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
  const done = aAcheter.filter(i => checked.has(i.name)).length
  const pct  = aAcheter.length > 0 ? Math.round(done / aAcheter.length * 100) : 0

  const groups = {}
  aAcheter.forEach(item => {
    if (!groups[item.cat]) groups[item.cat] = []
    groups[item.cat].push(item)
  })

  const selectedRecipes = recipes.filter(r => selected.has(r.id))
  const recipeNames = selectedRecipes.map(r => r.title)

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Chargement...</div>

  return (
    <div>
      {/* Sélection des recettes */}
      <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Choisir les recettes</div>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>La liste sera calculée selon ton stock actuel.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '8px', marginBottom: '12px' }}>
          {recipes.map(r => (
            <div key={r.id} onClick={() => toggleRecipe(r.id)} style={{
              border: '0.5px solid ' + (selected.has(r.id) ? '#1D9E75' : '#e0e0e0'),
              borderRadius: '10px', padding: '10px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
              background: selected.has(r.id) ? '#E1F5EE' : 'white'
            }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: '0.5px solid ' + (selected.has(r.id) ? '#1D9E75' : '#ddd'), background: selected.has(r.id) ? '#1D9E75' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '11px' }}>
                {selected.has(r.id) ? '✓' : ''}
              </div>
              <div style={{ fontSize: '20px' }}>{r.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>{r.time} min</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: '#666' }}>Personnes :</label>
          <select value={persons} onChange={e => setPersons(parseInt(e.target.value))}
            style={{ padding: '6px 10px', border: '0.5px solid #ddd', borderRadius: '6px', fontSize: '13px' }}>
            {[1,2,3,4,6,8].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {selected.size === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          <div style={{ fontSize: '40px', marginBottom: '1rem' }}>🛒</div>
          <p style={{ fontWeight: '500' }}>Sélectionne une ou plusieurs recettes ci-dessus</p>
          <p style={{ fontSize: '12px', marginTop: '4px' }}>La liste de courses apparaîtra ici.</p>
        </div>
      ) : (
        <>
          {aAcheter.length > 0 && (
            <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>
                  À acheter <span style={{ fontSize: '13px', fontWeight: '400', color: '#888' }}>({done}/{aAcheter.length})</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button onClick={() => setChecked(new Set(aAcheter.map(i => i.name)))}
                    style={{ padding: '4px 10px', fontSize: '12px', border: '0.5px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: 'white' }}>Tout cocher</button>
                  <button onClick={() => setChecked(new Set())}
                    style={{ padding: '4px 10px', fontSize: '12px', border: '0.5px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: 'white' }}>Décocher</button>
                  <button onClick={() => shareByEmail(groups, aAcheter, recipeNames)}
                    style={{ padding: '4px 10px', fontSize: '12px', border: '0.5px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: 'white' }}>✉️ Partager</button>
                  <button onClick={() => printCourses(groups, aAcheter, dejaDispo, recipeNames)}
                    style={{ padding: '4px 10px', fontSize: '12px', border: '0.5px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: 'white' }}>🖨️ Imprimer</button>
                </div>
              </div>

              <div style={{ height: '8px', background: '#f0f0ec', borderRadius: '4px', marginBottom: '16px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pct + '%', background: '#1D9E75', borderRadius: '4px', transition: 'width 0.3s' }} />
              </div>

              {Object.entries(groups).map(([cat, items]) => {
                const cs = CAT_STYLE[cat] || CAT_STYLE['Autres']
                return (
                  <div key={cat} style={{ marginBottom: '16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '500', background: cs.bg, color: cs.color }}>{cat}</span>
                    <div style={{ border: '0.5px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', marginTop: '6px' }}>
                      {items.map(item => {
                        const isChecked = checked.has(item.name)
                        return (
                          <div key={item.name} onClick={() => toggleCheck(item.name)} style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                            borderBottom: '0.5px solid #f0f0ec', cursor: 'pointer',
                            opacity: isChecked ? 0.45 : 1, textDecoration: isChecked ? 'line-through' : 'none', background: 'white'
                          }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0, border: '0.5px solid ' + (isChecked ? '#1D9E75' : '#ddd'), background: isChecked ? '#1D9E75' : '#fafaf8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '11px' }}>
                              {isChecked ? '✓' : ''}
                            </div>
                            <div style={{ flex: 1, fontSize: '13px' }}>{item.name}</div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '500', background: '#FCEBEB', color: '#791F1F' }}>
                                {item.manque} {item.unit}
                              </span>
                              {item.inStock > 0 && <span style={{ fontSize: '11px', color: '#888' }}>({item.inStock} en stock)</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {dejaDispo.length > 0 && (
            <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#3B6D11', marginBottom: '10px' }}>Déjà disponible en stock</div>
              {dejaDispo.map(item => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '0.5px solid #f0f0ec' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#3B6D11', flexShrink: 0 }}>✓</div>
                  <div style={{ flex: 1, fontSize: '13px' }}>{item.name}</div>
                  <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '500', background: '#EAF3DE', color: '#3B6D11' }}>{item.inStock} {item.unit}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
