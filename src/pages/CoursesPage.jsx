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

function getPeremptionDays(dateStr) {
  if (!dateStr) return null
  var today = new Date(); today.setHours(0,0,0,0)
  return Math.round((new Date(dateStr) - today) / 86400000)
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
  const [checkedNeutral, setCheckedNeutral] = useState(new Set())
  const [stockFaibleAction, setStockFaibleAction] = useState(null) // item du stock faible cliqué
  const [stockFaibleStep, setStockFaibleStep]     = useState('choice') // 'choice' | 'form'
  const [stockFaibleQty, setStockFaibleQty]       = useState('')
  const [stockFaibleSeuil, setStockFaibleSeuil]   = useState('')
  const [stockFaiblePeremption, setStockFaiblePeremption] = useState('')
  const [planningSlots, setPlanningSlots]     = useState([]) // slots ajoutes depuis le planning
  const [checkedPlanning, setCheckedPlanning] = useState(new Set()) // items coches dans la liste planning
  const [loadingPlanning, setLoadingPlanning] = useState(true)
  const [recipeSearch, setRecipeSearch]   = useState('')
  const [generalItems, setGeneralItems]   = useState([])
  const [generalInput, setGeneralInput]   = useState('')
  const [checkedGeneral, setCheckedGeneral] = useState(new Set())

  useEffect(() => {
    Promise.all([
      supabase.from('recipes').select('*').eq('user_id', user.id),
      supabase.from('stock').select('*').eq('user_id', user.id),
      supabase.from('general_shopping_list').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    ]).then(([{ data: r }, { data: s }, { data: g }]) => {
      setRecipes(r || [])
      setStock(s || [])
      setGeneralItems((g || []).map(function(i) { return { id: i.id, name: i.name } }))
      setLoading(false)
    })
    loadPlanningList()
  }, [user])

  async function loadPlanningList() {
    setLoadingPlanning(true)
    // Charger les slots ajoutes + leurs recettes + convives
    const { data: shData } = await supabase
      .from('shopping_list')
      .select('meal_plan_id, meal_plan(*, meal_plan_recipes(*))')
      .eq('user_id', user.id)

    const { data: recipeData } = await supabase
      .from('recipes').select('*').eq('user_id', user.id)

    const rMap = {}
    for (const r of (recipeData || [])) rMap[r.id] = r

    const slots = (shData || []).map(function(sh) {
      const mp = sh.meal_plan
      if (!mp) return null
      return {
        id: sh.meal_plan_id,
        jour_index: mp.jour_index,
        repas: mp.repas,
        convives: mp.convives || 2,
        recipes: (mp.meal_plan_recipes || []).map(function(mpr) {
          return rMap[mpr.recipe_id] || null
        }).filter(Boolean)
      }
    }).filter(Boolean)

    setPlanningSlots(slots)
    setLoadingPlanning(false)
  }

  async function removeFromPlanningList(slotId) {
    await supabase.from('shopping_list').delete().eq('user_id', user.id).eq('meal_plan_id', slotId)
    setPlanningSlots(function(s) { return s.filter(function(sl) { return sl.id !== slotId }) })
  }

  async function clearPlanningList() {
    await supabase.from('shopping_list').delete().eq('user_id', user.id)
    setPlanningSlots([])
    setCheckedPlanning(new Set())
  }

  async function addGeneralItem(name) {
    const { data } = await supabase.from('general_shopping_list').insert({ user_id: user.id, name }).select().single()
    if (data) setGeneralItems(function(items) { return [...items, { id: data.id, name: data.name }] })
  }

  async function removeGeneralItem(id) {
    await supabase.from('general_shopping_list').delete().eq('id', id)
    setGeneralItems(function(items) { return items.filter(function(i) { return i.id !== id }) })
  }

  async function clearCheckedGeneral() {
    // Supprimer tous les articles coches
    var toDelete = generalItems.filter(function(item) { return checkedGeneral.has(item.id) })
    for (var item of toDelete) {
      await supabase.from('general_shopping_list').delete().eq('id', item.id)
    }
    setGeneralItems(function(items) { return items.filter(function(i) { return !checkedGeneral.has(i.id) }) })
    setCheckedGeneral(new Set())
  }

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

  // Ingredients sous le seuil (stock faible ou epuise), non deja dans la liste recettes

  // Calcul des ingredients depuis les slots du planning
  const { data: stockData } = { data: stock } // deja charge
  const planningNeeded = {}
  for (const slot of planningSlots) {
    const convives = slot.convives || 2
    for (const recipe of slot.recipes) {
      const base = recipe.servings || 2
      const ratio = convives / base
      for (const ing of (recipe.ingredients || [])) {
        const key = ing.name
        if (!planningNeeded[key]) planningNeeded[key] = { name: ing.name, qty: 0, unit: ing.unit }
        planningNeeded[key].qty += (ing.qty || 0) * ratio
      }
    }
  }

  const planningList = Object.values(planningNeeded).map(function(item) {
    const inStock = stock.find(function(s) { return s.name.toLowerCase() === item.name.toLowerCase() })
    const stockQty = inStock ? inStock.qty : 0
    const manque = Math.max(0, item.qty - stockQty)
    return { ...item, inStock: stockQty, manque: Math.ceil(manque * 10) / 10, enStock: manque <= 0, cat: getCat(item.name) }
  }).sort(function(a, b) { return a.name.localeCompare(b.name, 'fr') })

  const planningAacheter = planningList.filter(function(i) { return !i.enStock && !checkedPlanning.has(i.name) })
  const planningDispo = planningList.filter(function(i) { return i.enStock })
  const planningGroups = {}
  planningAacheter.forEach(function(item) {
    if (!planningGroups[item.cat]) planningGroups[item.cat] = []
    planningGroups[item.cat].push(item)
  })

  const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  const REPAS_LABELS = { 'Petit-dejeuner': 'Petit-dejeuner', 'Diner': 'Diner', 'Souper': 'Souper' }

  const stockFaible = stock.filter(s => {
    if (s.seuil > 0 && s.qty <= s.seuil) return true
    if (s.peremption) {
      var days = getPeremptionDays(s.peremption)
      if (days !== null && days <= 7) return true
    }
    return false
  })

  function toggleNeutral(name) {
    setCheckedNeutral(c => { const n = new Set(c); n.has(name) ? n.delete(name) : n.add(name); return n })
  }

  async function handleStockFaibleAchete(item) {
    const newQty   = parseFloat(stockFaibleQty)   || 0
    const newSeuil = parseFloat(stockFaibleSeuil) || 0
    await supabase.from('stock')
      .update({ qty: newQty, seuil: newSeuil, peremption: stockFaiblePeremption || null })
      .eq('user_id', user.id)
      .eq('name', item.name)
    setStock(s => s.map(i => i.name === item.name ? { ...i, qty: newQty, seuil: newSeuil, peremption: stockFaiblePeremption || null } : i))
    setCheckedNeutral(c => { const n = new Set(c); n.delete(item.name); return n })
    setStockFaibleAction(null)
    setStockFaibleStep('choice')
    setStockFaibleQty(''); setStockFaibleSeuil(''); setStockFaiblePeremption('')
  }

  async function handleStockFaibleSupprimer(item) {
    await supabase.from('stock')
      .delete()
      .eq('user_id', user.id)
      .eq('name', item.name)
    setStock(s => s.filter(i => i.name !== item.name))
    setStockFaibleAction(null)
    setStockFaibleStep('choice')
    setStockFaibleQty(''); setStockFaibleSeuil(''); setStockFaiblePeremption('')
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Chargement...</div>

  return (
    <div>

      {/* Popup action stock faible */}
      {stockFaibleAction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '340px' }}>
            <div style={{ fontSize: '22px', textAlign: 'center', marginBottom: '8px' }}>🛒</div>
            <div style={{ fontSize: '15px', fontWeight: '500', textAlign: 'center', marginBottom: '4px' }}>{stockFaibleAction.name}</div>
            <div style={{ fontSize: '12px', color: '#888', textAlign: 'center', marginBottom: '1.25rem' }}>
              Stock actuel : {stockFaibleAction.qty} {stockFaibleAction.unit}
              {stockFaibleAction.seuil > 0 && <span> · Seuil : {stockFaibleAction.seuil} {stockFaibleAction.unit}</span>}
            </div>

            {stockFaibleStep === 'choice' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => setStockFaibleStep('form')}
                  style={{ padding: '10px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                  ✅ Je l&apos;ai acheté — mettre à jour le stock
                </button>
                <button
                  onClick={() => handleStockFaibleSupprimer(stockFaibleAction)}
                  style={{ padding: '10px', background: '#FCEBEB', color: '#791F1F', border: '0.5px solid #F5C0C0', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                  🗑 Supprimer définitivement du stock
                </button>
                <button
                  onClick={() => { setStockFaibleAction(null); setStockFaibleStep('choice') }}
                  style={{ padding: '10px', background: 'none', color: '#888', border: '0.5px solid #ddd', borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}>
                  Annuler
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '3px' }}>Quantité achetée ({stockFaibleAction.unit})</label>
                    <input
                      type="number" min="0" step="0.1"
                      value={stockFaibleQty}
                      onChange={e => setStockFaibleQty(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '3px' }}>Seuil d&apos;alerte ({stockFaibleAction.unit})</label>
                    <input
                      type="number" min="0" step="0.1"
                      value={stockFaibleSeuil}
                      onChange={e => setStockFaibleSeuil(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '3px' }}>Date de péremption <span style={{ color: '#bbb' }}>(optionnel)</span></label>
                  <input
                    type="date"
                    value={stockFaiblePeremption}
                    onChange={e => setStockFaiblePeremption(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    onClick={() => setStockFaibleStep('choice')}
                    style={{ flex: 1, padding: '10px', background: 'none', color: '#888', border: '0.5px solid #ddd', borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}>
                    ← Retour
                  </button>
                  <button
                    onClick={() => handleStockFaibleAchete(stockFaibleAction)}
                    disabled={!stockFaibleQty}
                    style={{ flex: 2, padding: '10px', background: !stockFaibleQty ? '#ccc' : '#1D9E75', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', cursor: stockFaibleQty ? 'pointer' : 'default', fontWeight: '500' }}>
                    Enregistrer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Liste depuis le planning */}
      {!loadingPlanning && planningSlots.length > 0 && (
        <div style={{ background: 'white', border: '0.5px solid #1D9E75', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#0F6E56' }}>
                Courses du planning
              </div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                {planningSlots.length} repas · {planningAacheter.length} article(s) a acheter
              </div>
            </div>
            <button onClick={clearPlanningList}
              style={{ padding: '5px 12px', fontSize: '12px', border: '0.5px solid #E24B4A', borderRadius: '6px', cursor: 'pointer', background: 'white', color: '#E24B4A' }}>
              Tout vider
            </button>
          </div>

          {/* Repas inclus */}
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {planningSlots.map(function(slot) {
              return (
                <div key={slot.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px 3px 10px', borderRadius: '10px', background: '#E1F5EE', border: '0.5px solid #5DCAA5', fontSize: '11px', color: '#0F6E56' }}>
                  <span>{JOURS[slot.jour_index]} {slot.repas} ({slot.convives} pers.)</span>
                  <button onClick={function() { removeFromPlanningList(slot.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5DCAA5', fontSize: '12px', padding: 0, lineHeight: 1 }}>x</button>
                </div>
              )
            })}
          </div>

          {/* Liste ingredients */}
          {planningAacheter.length === 0 && planningDispo.length > 0 && (
            <div style={{ fontSize: '13px', color: '#1D9E75', textAlign: 'center', padding: '8px' }}>
              Tout est deja en stock !
            </div>
          )}

          {Object.entries(planningGroups).map(function(entry) {
            var cat = entry[0], items = entry[1]
            var cs = CAT_STYLE[cat] || CAT_STYLE['Autres']
            return (
              <div key={cat} style={{ marginBottom: '10px' }}>
                <span style={{ padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '500', background: cs.bg, color: cs.color }}>{cat}</span>
                <div style={{ border: '0.5px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', marginTop: '5px' }}>
                  {items.map(function(item) {
                    return (
                      <div key={item.name}
                        onClick={function() { setCheckedPlanning(function(c) { var n = new Set(c); n.has(item.name) ? n.delete(item.name) : n.add(item.name); return n }) }}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderBottom: '0.5px solid #f0f0ec', cursor: 'pointer', background: 'white' }}>
                        <div style={{ width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0, border: '0.5px solid #ddd', background: '#fafaf8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '11px' }}></div>
                        <div style={{ flex: 1, fontSize: '13px' }}>{item.name}</div>
                        <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '500', background: '#FCEBEB', color: '#791F1F' }}>
                          {item.manque} {item.unit}
                        </span>
                        {item.inStock > 0 && <span style={{ fontSize: '11px', color: '#888' }}>({item.inStock} en stock)</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {planningDispo.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: '500', color: '#3B6D11', marginBottom: '5px' }}>Deja en stock</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {planningDispo.map(function(item) {
                  return <span key={item.name} style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: '#EAF3DE', color: '#3B6D11' }}>{item.name}</span>
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grille 2 colonnes : stock faible + liste generale */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', alignItems: 'start' }}>

        {/* Stock faible */}
        <div style={{ background: 'white', border: '0.5px solid #EF9F27', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#854F0B' }}>
                Stock faible
              </div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                {stockFaible.length === 0 ? 'Tout est OK' : stockFaible.filter(i => !checkedNeutral.has(i.name)).length + ' article(s) a racheter'}
              </div>
            </div>
            {stockFaible.length > 0 && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setCheckedNeutral(new Set(stockFaible.map(i => i.name)))}
                style={{ padding: '4px 10px', fontSize: '12px', border: '0.5px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: 'white' }}>Tout cocher</button>
              <button onClick={() => setCheckedNeutral(new Set())}
                style={{ padding: '4px 10px', fontSize: '12px', border: '0.5px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: 'white' }}>Decocher</button>
            </div>
            )}
          </div>

          <div style={{ border: '0.5px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
            {stockFaible.map(item => {
              const isChecked = checkedNeutral.has(item.name)
              const manqueNeutral = Math.max(0, item.seuil - item.qty)
              const etat = item.qty === 0 ? { label: 'Épuisé', bg: '#FCEBEB', color: '#791F1F' } : { label: 'Faible', bg: '#FAEEDA', color: '#854F0B' }
              const catStyle = CAT_STYLE[item.cat] || CAT_STYLE['Autres']
              return (
                <div key={item.name} onClick={() => { setStockFaibleAction(item); setStockFaibleStep('choice'); setStockFaibleQty(String(item.seuil > 0 ? item.seuil * 2 : 1)); setStockFaibleSeuil(String(item.seuil || '')); setStockFaiblePeremption('') }} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                  borderBottom: '0.5px solid #f0f0ec', cursor: 'pointer',
                  opacity: isChecked ? 0.45 : 1, textDecoration: isChecked ? 'line-through' : 'none', background: 'white'
                }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0, border: '0.5px solid ' + (isChecked ? '#1D9E75' : '#EF9F27'), background: isChecked ? '#1D9E75' : '#FFFBF0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '11px' }}>
                    {isChecked ? '✓' : ''}
                  </div>
                  <div style={{ flex: 1, fontSize: '13px', fontWeight: '500' }}>{item.name}</div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '500', background: etat.bg, color: etat.color }}>{etat.label}</span>
                    {item.peremption && (function() {
                      var days = getPeremptionDays(item.peremption)
                      if (days === null) return null
                      var bg = days < 0 ? '#FCEBEB' : days <= 3 ? '#FCEBEB' : '#FAEEDA'
                      var color = days < 0 ? '#791F1F' : days <= 3 ? '#791F1F' : '#854F0B'
                      var label = days < 0 ? 'Perime' : 'Exp. ' + days + 'j'
                      return <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '500', background: bg, color: color }}>{label}</span>
                    })()}
                    <span style={{ padding: '2px 6px', borderRadius: '6px', fontSize: '10px', background: catStyle.bg, color: catStyle.color }}>{item.cat}</span>
                  </div>
                </div>
              )
            })}
          </div>
          {stockFaible.length === 0 && (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#ccc', fontSize: '13px' }}>
              Aucune alerte en ce moment
            </div>
          )}
        </div>

        {/* Liste generale hors cuisine */}
        <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <div style={{ fontSize: '14px', fontWeight: '500' }}>Liste generale</div>
{checkedGeneral.size > 0 && (
              <button onClick={() => {
                saveGeneralItems(generalItems.filter(function(item, idx) { return !checkedGeneral.has(item + idx) }))
                setCheckedGeneral(new Set())
              }} style={{ fontSize: '12px', color: '#E24B4A', background: 'none', border: 'none', cursor: 'pointer' }}>
                Supprimer coches
              </button>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
            Achats ponctuels hors cuisine.
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            <input
              value={generalInput}
              onChange={e => setGeneralInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && generalInput.trim()) {
                  addGeneralItem(generalInput.trim())
                  setGeneralInput('')
                }
              }}
              placeholder="Colle, ampoule..."
              style={{ flex: 1, padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
            />
            <button onClick={() => {
              if (generalInput.trim()) {
                addGeneralItem(generalInput.trim())
                setGeneralInput('')
              }
            }} style={{ padding: '7px 12px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>+</button>
          </div>
          {generalItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#ccc', fontSize: '12px' }}>
              Aucun article
            </div>
          ) : (
            <div style={{ border: '0.5px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
              {generalItems.map(function(item) {
                const isChecked = checkedGeneral.has(item.id)
                return (
                  <div key={item.id}
                    onClick={() => removeGeneralItem(item.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderBottom: '0.5px solid #f0f0ec', cursor: 'pointer', background: 'white' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0, border: '0.5px solid #ddd', background: '#fafaf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                    </div>
                    <div style={{ flex: 1, fontSize: '13px' }}>{item.name}</div>
                    <button onClick={e => { e.stopPropagation(); removeGeneralItem(item.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '15px', padding: 0 }}>×</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sélection des recettes */}
      <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ fontSize: '14px', fontWeight: '500' }}>Choisir les recettes</div>
          <span style={{ fontSize: '12px', color: '#aaa' }}>{recipes.length} recettes</span>
        </div>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>La liste sera calculée selon ton stock actuel.</div>
        <input
          value={recipeSearch}
          onChange={e => setRecipeSearch(e.target.value)}
          placeholder="Rechercher une recette..."
          style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#fafaf8', boxSizing: 'border-box', marginBottom: '10px' }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '8px', marginBottom: '12px' }}>
          {[...recipes].filter(r => !recipeSearch || r.title.toLowerCase().includes(recipeSearch.toLowerCase())).sort((a, b) => a.title.localeCompare(b.title, 'fr')).map(r => (
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
