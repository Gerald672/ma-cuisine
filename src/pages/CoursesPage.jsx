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
  'citron': 'Fruits & légumes', 'orange': 'Fruits & légumes', 'pamplemousse': 'Fruits & légumes',
  'courgette': 'Fruits & légumes', 'épinard': 'Fruits & légumes', 'banane': 'Fruits & légumes',
  'poulet': 'Viande & poisson', 'bœuf': 'Viande & poisson', 'saumon': 'Viande & poisson', 'lardon': 'Viande & poisson',
}

function getCat(name) {
  const lower = name.toLowerCase()
  for (const [key, cat] of Object.entries(ING_CATS)) {
    if (lower.includes(key)) return cat
  }
  return 'Autres'
}

export default function CoursesPage() {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState([])
  const [stock, setStock] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [persons, setPersons] = useState(2)
  const [checked, setChecked] = useState(new Set())
  const [loading, setLoading] = useState(true)

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
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
    setChecked(new Set())
  }

  function toggleCheck(name) {
    setChecked(c => {
      const n = new Set(c)
      n.has(name) ? n.delete(name) : n.add(name)
      return n
    })
  }

  const factor = persons / 2

  // Calculer les besoins totaux
  const needed = {}
  recipes.filter(r => selected.has(r.id)).forEach(r => {
    (r.ingredients || []).forEach(ing => {
      if (!needed[ing.name]) needed[ing.name] = { name: ing.name, qty: 0, unit: ing.unit }
      needed[ing.name].qty += (ing.qty || 0) * factor
    })
  })

  // Comparer avec le stock
  const coursesList = Object.values(needed).map(item => {
    const inStock = stock.find(s => s.name.toLowerCase() === item.name.toLowerCase())
    const stockQty = inStock ? inStock.qty : 0
    const manque = Math.max(0, item.qty - stockQty)
    return {
      ...item,
      inStock: stockQty,
      manque: Math.ceil(manque),
      enStock: manque <= 0,
      cat: getCat(item.name)
    }
  })

  const aAcheter = coursesList.filter(i => !i.enStock)
  const dejaDispo = coursesList.filter(i => i.enStock)
  const done = aAcheter.filter(i => checked.has(i.name)).length
  const pct = aAcheter.length > 0 ? Math.round(done / aAcheter.length * 100) : 0

  // Grouper par catégorie
  const groups = {}
  aAcheter.forEach(item => {
    if (!groups[item.cat]) groups[item.cat] = []
    groups[item.cat].push(item)
  })

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
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                border: '0.5px solid ' + (selected.has(r.id) ? '#1D9E75' : '#ddd'),
                background: selected.has(r.id) ? '#1D9E75' : 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: '11px'
              }}>{selected.has(r.id) ? '✓' : ''}</div>
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
          <select value={persons} onChange={e => setPersons(parseInt(e.target.value))} style={{
            padding: '6px 10px', border: '0.5px solid #ddd', borderRadius: '6px', fontSize: '13px'
          }}>
            {[1, 2, 3, 4, 6, 8].map(n => <option key={n} value={n}>{n}</option>)}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>
                  À acheter <span style={{ fontSize: '13px', fontWeight: '400', color: '#888' }}>({done}/{aAcheter.length})</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setChecked(new Set(aAcheter.map(i => i.name)))} style={{ padding: '4px 10px', fontSize: '12px', border: '0.5px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: 'white' }}>Tout cocher</button>
                  <button onClick={() => setChecked(new Set())} style={{ padding: '4px 10px', fontSize: '12px', border: '0.5px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: 'white' }}>Décocher</button>
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
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 12px', borderBottom: '0.5px solid #f0f0ec',
                            cursor: 'pointer', opacity: isChecked ? 0.45 : 1,
                            textDecoration: isChecked ? 'line-through' : 'none',
                            background: 'white'
                          }}>
                            <div style={{
                              width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                              border: '0.5px solid ' + (isChecked ? '#1D9E75' : '#ddd'),
                              background: isChecked ? '#1D9E75' : '#fafaf8',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white', fontSize: '11px'
                            }}>{isChecked ? '✓' : ''}</div>
                            <div style={{ flex: 1, fontSize: '13px' }}>{item.name}</div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '500', background: '#FCEBEB', color: '#791F1F' }}>
                                {item.manque} {item.unit}
                              </span>
                              {item.inStock > 0 && (
                                <span style={{ fontSize: '11px', color: '#888' }}>({item.inStock} en stock)</span>
                              )}
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
