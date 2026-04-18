import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const PRIX_FR = [
  ['farine', 0.00085, 'g'], ['farine complete', 0.00120, 'g'],
  ['sucre', 0.00090, 'g'], ['sucre roux', 0.00130, 'g'],
  ['beurre', 0.01200, 'g'], ['beurre doux', 0.01200, 'g'],
  ['lait', 0.00110, 'ml'], ['lait entier', 0.00120, 'ml'],
  ['creme', 0.00320, 'ml'], ['creme fraiche', 0.00350, 'ml'],
  ['creme liquide', 0.00300, 'ml'], ['yaourt nature', 0.00280, 'g'],
  ['fromage blanc', 0.00300, 'g'], ['mascarpone', 0.00750, 'g'],
  ['gruyere', 0.01400, 'g'], ['emmental', 0.01200, 'g'],
  ['parmesan', 0.02200, 'g'], ['mozzarella', 0.01000, 'g'],
  ['oeuf', 0.28, 'unite(s)'], ['oeufs', 0.28, 'unite(s)'],
  ['poulet', 0.00850, 'g'], ['blanc de poulet', 0.01400, 'g'],
  ['boeuf', 0.02200, 'g'], ['boeuf hache', 0.01400, 'g'],
  ['veau', 0.02800, 'g'], ['porc', 0.01100, 'g'],
  ['lardons', 0.01100, 'g'], ['jambon', 0.01600, 'g'],
  ['saumon', 0.02800, 'g'], ['thon en boite', 0.01200, 'g'],
  ['oignon', 0.00100, 'g'], ['oignons', 0.00100, 'g'],
  ['ail', 0.00500, 'g'], ['carotte', 0.00090, 'g'],
  ['carottes', 0.00090, 'g'], ['pomme de terre', 0.00070, 'g'],
  ['pommes de terre', 0.00070, 'g'], ['courgette', 0.00160, 'g'],
  ['tomate', 0.00180, 'g'], ['tomates', 0.00180, 'g'],
  ['epinards', 0.00250, 'g'], ['brocoli', 0.00180, 'g'],
  ['champignons', 0.00500, 'g'], ['avocat', 0.90, 'unite(s)'],
  ['poivron', 0.00230, 'g'], ['pomme', 0.00170, 'g'],
  ['banane', 0.00140, 'g'], ['citron', 0.40, 'unite(s)'],
  ['fraise', 0.00800, 'g'], ['fraises', 0.00800, 'g'],
  ['huile', 0.00280, 'ml'], ['vinaigre', 0.00180, 'ml'],
  ['moutarde', 0.00500, 'g'], ['sauce soja', 0.00400, 'ml'],
  ['chocolat noir', 0.01500, 'g'], ['cacao en poudre', 0.01800, 'g'],
  ['miel', 0.00800, 'g'], ['levure chimique', 0.02000, 'g'],
  ['sel', 0.00030, 'g'], ['poivre', 0.01200, 'g'],
  ['thym', 0.02000, 'g'], ['basilic', 0.05000, 'g'],
  ['persil', 0.03500, 'g'], ['bouillon de legumes', 0.00120, 'ml'],
  ['bouillon de poulet', 0.00150, 'ml'],
  ['pates', 0.00160, 'g'], ['riz', 0.00160, 'g'],
  ['riz basmati', 0.00220, 'g'], ['couscous', 0.00180, 'g'],
  ['quinoa', 0.00550, 'g'], ['lentilles', 0.00220, 'g'],
  ['amandes', 0.01400, 'g'], ['noix', 0.01200, 'g'],
  ['lait de coco', 0.00320, 'ml'], ['pain', 0.00380, 'g'],
  ['maizena', 0.00280, 'g'],
]

function calculerCout(ing, factor, priceMap, overrides) {
  const key = ing.name?.toLowerCase()
  if (!key) return 0
  const qty = parseFloat(ing.qty || 0) * factor
  if (isNaN(qty)) return 0
  const price = overrides[ing.name] !== undefined
    ? overrides[ing.name]
    : priceMap[key]?.price_per_unit ?? 0
  return qty * price
}

function displayPrice(ing, priceMap, overrides, sym) {
  const key = ing.name?.toLowerCase()
  const raw = overrides[ing.name] !== undefined
    ? overrides[ing.name]
    : priceMap[key]?.price_per_unit ?? 1
  if (ing.unit === 'g')  return { value: raw * 1000, label: sym + '/kg' }
  if (ing.unit === 'ml') return { value: raw * 1000, label: sym + '/L' }
  return { value: raw, label: sym + '/unite' }
}

function parseDisplayPrice(displayVal, unit) {
  const v = parseFloat(displayVal) || 0
  if (unit === 'g' || unit === 'ml') return v / 1000
  return v
}

export default function BudgetPage() {
  const { user } = useAuth()
  const [recipes, setRecipes]         = useState([])
  const [selected, setSelected]       = useState(new Set())
  const [persons, setPersons]         = useState(2)
  const [budgetMax, setBudgetMax]     = useState(30)
  const [overrides, setOverrides]     = useState({})
  const [priceMap, setPriceMap]       = useState({})
  const [loading, setLoading]         = useState(true)
  const [showPrixDB, setShowPrixDB]   = useState(false)
  const [prixSearch, setPrixSearch]   = useState('')
  const [savingPrice, setSavingPrice] = useState(null)
  const [currency, setCurrency]       = useState('CHF')
  const [rates, setRates]             = useState({ CHF_EUR: 0.95, EUR_CHF: 1.053 })
  const [loadingRates, setLoadingRates] = useState(false)
  const [seedingPrices, setSeedingPrices] = useState(false)

  useEffect(() => { loadAll() }, [user])

  async function loadAll() {
    setLoading(true)
    const [{ data: recipeData }, { data: priceData }, { data: prefData }] = await Promise.all([
      supabase.from('recipes').select('*').eq('user_id', user.id),
      supabase.from('ingredient_prices').select('*').eq('user_id', user.id),
      supabase.from('user_preferences').select('currency').eq('user_id', user.id).single()
    ])
    setRecipes(recipeData || [])
    const map = {}
    for (const row of (priceData || [])) map[row.name.toLowerCase()] = row
    setPriceMap(map)
    if (prefData && prefData.currency) setCurrency(prefData.currency)
    fetchRates()
    setLoading(false)
  }

  async function fetchRates() {
    setLoadingRates(true)
    try {
      const resp = await fetch('/api/exchange-rate')
      if (resp.ok) { const d = await resp.json(); setRates(d) }
    } catch (e) {}
    setLoadingRates(false)
  }

  async function loadPriceMap() {
    const { data } = await supabase.from('ingredient_prices').select('*').eq('user_id', user.id)
    const map = {}
    for (const row of (data || [])) map[row.name.toLowerCase()] = row
    setPriceMap(map)
    return map
  }

  async function saveCurrencyPref(cur) {
    setCurrency(cur)
    const { data: ex } = await supabase
      .from('user_preferences').select('id').eq('user_id', user.id).single()
    if (ex) {
      await supabase.from('user_preferences').update({ currency: cur }).eq('user_id', user.id)
    } else {
      await supabase.from('user_preferences').insert({ user_id: user.id, currency: cur })
    }
  }

  async function seedFrenchPrices() {
    if (!window.confirm('Initialiser les prix francais (Carrefour/Leclerc 2024) ? Les prix existants seront ecrases.')) return
    setSeedingPrices(true)
    await saveCurrencyPref('EUR')
    for (const [name, price, unit] of PRIX_FR) {
      const { data: ex } = await supabase
        .from('ingredient_prices').select('id').eq('user_id', user.id).eq('name', name).single()
      if (ex) {
        await supabase.from('ingredient_prices')
          .update({ price_per_unit: price, unit, source: 'Carrefour/Leclerc 2024' }).eq('id', ex.id)
      } else {
        await supabase.from('ingredient_prices')
          .insert({ user_id: user.id, name, price_per_unit: price, unit, source: 'Carrefour/Leclerc 2024' })
      }
    }
    await loadAll()
    setSeedingPrices(false)
    alert('Prix francais initialises ! Devise passee en EUR.')
  }

  function toDisplay(amount) {
    return currency === 'EUR' ? amount * rates.CHF_EUR : amount
  }

  const sym = currency === 'EUR' ? 'EUR' : 'CHF'

  async function handlePriceChange(ing, displayVal) {
    const newPricePerUnit = parseDisplayPrice(displayVal, ing.unit)
    const ingKey = ing.name.toLowerCase()
    setOverrides(prev => ({ ...prev, [ing.name]: newPricePerUnit }))
    setSavingPrice(ing.name)
    const existing = priceMap[ingKey]
    if (existing) {
      await supabase.from('ingredient_prices')
        .update({ price_per_unit: newPricePerUnit, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await supabase.from('ingredient_prices').insert({
        user_id: user.id, name: ingKey,
        price_per_unit: newPricePerUnit, unit: ing.unit, source: 'Saisie manuelle'
      })
    }
    const freshMap = await loadPriceMap()
    const { data: allRecipes } = await supabase
      .from('recipes').select('id, ingredients, cost').eq('user_id', user.id)
    for (const r of (allRecipes || [])) {
      const newCost = (r.ingredients || []).reduce((sum, i) => {
        const k = i.name?.toLowerCase()
        const p = freshMap[k]?.price_per_unit ?? 0
        return sum + (parseFloat(i.qty || 0) * p)
      }, 0)
      const rounded = parseFloat(newCost.toFixed(2))
      if (Math.abs(rounded - (r.cost || 0)) > 0.005) {
        await supabase.from('recipes').update({ cost: rounded }).eq('id', r.id)
      }
    }
    const { data: freshRecipes } = await supabase.from('recipes').select('*').eq('user_id', user.id)
    setRecipes(freshRecipes || [])
    setSavingPrice(null)
  }

  function toggleRecipe(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const factor = persons / 2
  const selectedRecipes = recipes.filter(r => selected.has(r.id))
  const grandTotal = selectedRecipes.reduce((sum, r) =>
    sum + (r.ingredients || []).reduce((s, ing) =>
      s + calculerCout(ing, factor, priceMap, overrides), 0), 0)
  const perPerson = persons > 0 ? grandTotal / persons : 0
  const reste     = budgetMax - grandTotal
  const pct       = Math.min(100, Math.round(grandTotal / budgetMax * 100))
  const fillColor = pct < 80 ? '#1D9E75' : pct < 100 ? '#BA7517' : '#E24B4A'

  const allPrices = Object.values(priceMap).map(p => ({
    ...p, displayed: overrides[p.name] !== undefined ? overrides[p.name] : p.price_per_unit
  }))
  const filteredPrix = allPrices.filter(p =>
    !prixSearch || p.name.toLowerCase().includes(prixSearch.toLowerCase())
  )

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Chargement...</div>

  return (
    <div>
      <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ fontSize: '14px', fontWeight: '500' }}>Simuler le cout d'un repas</div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {loadingRates && <span style={{ fontSize: '10px', color: '#aaa' }}>...</span>}
            {['CHF', 'EUR'].map(c => (
              <button key={c} onClick={() => saveCurrencyPref(c)} style={{
                padding: '3px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                fontWeight: currency === c ? '600' : '400',
                border: '0.5px solid ' + (currency === c ? '#1D9E75' : '#ddd'),
                background: currency === c ? '#E1F5EE' : 'white',
                color: currency === c ? '#0F6E56' : '#888'
              }}>{c}</button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
          Prix en {sym}. Modifiables ligne par ligne.
          {currency === 'EUR' && <span style={{ marginLeft: '6px' }}>Taux : 1 EUR = {(1 / rates.CHF_EUR).toFixed(3)} CHF</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', marginBottom: '12px' }}>
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

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: '#666' }}>Personnes :</label>
            <select value={persons} onChange={e => setPersons(parseInt(e.target.value))}
              style={{ padding: '6px 10px', border: '0.5px solid #ddd', borderRadius: '6px', fontSize: '13px' }}>
              {[1,2,3,4,6,8].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: '#666' }}>Budget max ({sym}) :</label>
            <input type="number" value={budgetMax} onChange={e => setBudgetMax(parseFloat(e.target.value) || 30)}
              style={{ width: '75px', padding: '6px 10px', border: '0.5px solid #ddd', borderRadius: '6px', fontSize: '13px' }} />
          </div>
          <button onClick={() => setShowPrixDB(!showPrixDB)}
            style={{ padding: '6px 12px', fontSize: '12px', border: '0.5px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: 'white' }}>
            {showPrixDB ? 'Masquer' : 'Voir'} la base de prix ({allPrices.length})
          </button>
        </div>
      </div>

      {showPrixDB && (
        <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>Base de prix — {sym}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Modifications sauvegardees automatiquement</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input value={prixSearch} onChange={e => setPrixSearch(e.target.value)} placeholder="Rechercher..."
                style={{ padding: '7px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', width: '160px', outline: 'none' }} />
              <button onClick={seedFrenchPrices} disabled={seedingPrices}
                style={{ padding: '7px 12px', fontSize: '12px', border: '0.5px solid #ddd', borderRadius: '8px', cursor: 'pointer', background: 'white', color: '#555', whiteSpace: 'nowrap' }}>
                {seedingPrices ? '...' : 'Init. prix FR'}
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Ingredient', 'Prix unitaire', 'Unite', 'Source'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', fontSize: '11px', fontWeight: '500', color: '#888', textAlign: 'left', borderBottom: '0.5px solid #e0e0e0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPrix.sort((a,b) => a.name.localeCompare(b.name, 'fr')).map(p => {
                  const dispUnit = p.unit === 'g' ? sym + '/kg' : p.unit === 'ml' ? sym + '/L' : sym + '/unite'
                  const dispVal  = p.unit === 'g' || p.unit === 'ml' ? p.displayed * 1000 : p.displayed
                  const isModified = overrides[p.name] !== undefined
                  return (
                    <tr key={p.id} style={{ borderBottom: '0.5px solid #f5f5f2' }}>
                      <td style={{ padding: '8px 10px', fontWeight: '500', textTransform: 'capitalize' }}>
                        {p.name}
                        {isModified && <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '6px', fontSize: '10px', background: '#FAEEDA', color: '#854F0B' }}>modifie</span>}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input type="number" step="0.01" defaultValue={dispVal.toFixed(2)}
                            onBlur={e => handlePriceChange({ name: p.name, unit: p.unit }, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { handlePriceChange({ name: p.name, unit: p.unit }, e.target.value); e.target.blur() } }}
                            style={{ width: '75px', padding: '3px 6px', border: '0.5px solid #ddd', borderRadius: '5px', fontSize: '12px', textAlign: 'right', outline: 'none', background: isModified ? '#FFFBF0' : '#fafaf8' }}
                          />
                          {savingPrice === p.name && <span style={{ fontSize: '10px', color: '#1D9E75' }}>...</span>}
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px', color: '#888', fontSize: '12px' }}>{dispUnit}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '10px', background: '#E6F1FB', color: '#185FA5' }}>
                          {p.source || (currency === 'EUR' ? 'Base FR' : 'Base CH')}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <>
          <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>Recapitulatif</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
              {[
                { label: 'Cout total estime',  value: toDisplay(grandTotal).toFixed(2) + ' ' + sym },
                { label: 'Cout par personne',  value: toDisplay(perPerson).toFixed(2) + ' ' + sym },
                { label: 'Budget restant', value: (reste >= 0 ? '+' : '') + toDisplay(reste).toFixed(2) + ' ' + sym, color: reste >= 0 ? '#0F6E56' : '#A32D2D' },
                { label: 'Recettes', value: selected.size + ' recette' + (selected.size > 1 ? 's' : '') },
              ].map(item => (
                <div key={item.label} style={{ background: '#fafaf8', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>{item.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: '500', color: item.color || 'inherit' }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', marginBottom: '4px' }}>
              <span>0 {sym}</span><span>{budgetMax} {sym}</span>
            </div>
            <div style={{ height: '10px', background: '#f0f0ec', borderRadius: '5px', overflow: 'hidden', marginBottom: '6px' }}>
              <div style={{ height: '100%', width: pct + '%', background: fillColor, borderRadius: '5px', transition: 'width 0.4s' }} />
            </div>
            <div style={{ fontSize: '12px', color: fillColor }}>
              {pct < 80
                ? 'Dans le budget — il reste ' + toDisplay(reste).toFixed(2) + ' ' + sym
                : pct < 100 ? 'Attention, tu approches de ton budget !'
                : 'Budget depasse de ' + toDisplay(Math.abs(reste)).toFixed(2) + ' ' + sym}
            </div>
          </div>

          {selectedRecipes.map(r => {
            const recipeTotal = (r.ingredients || []).reduce((s, ing) =>
              s + calculerCout(ing, factor, priceMap, overrides), 0)
            return (
              <div key={r.id} style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
                <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '0.5px solid #e0e0e0' }}>
                  <div style={{ fontSize: '28px' }}>{r.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>{r.title}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{persons} personne{persons > 1 ? 's' : ''} · {r.time} min</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: '500', color: '#0F6E56' }}>{toDisplay(recipeTotal).toFixed(2)} {sym}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>{toDisplay(recipeTotal / persons).toFixed(2)} {sym}/pers.</div>
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Ingredient', 'Quantite', 'Prix unitaire', 'Cout'].map(h => (
                        <th key={h} style={{ padding: '7px 1.25rem', fontSize: '11px', fontWeight: '500', color: '#888', textAlign: h === 'Cout' || h === 'Prix unitaire' ? 'right' : 'left', borderBottom: '0.5px solid #e0e0e0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(r.ingredients || []).map((ing, i) => {
                      const cost = calculerCout(ing, factor, priceMap, overrides)
                      const { value: dispVal, label: dispUnit } = displayPrice(ing, priceMap, overrides, sym)
                      const fromDB   = !!priceMap[ing.name?.toLowerCase()]
                      const isOverrid = overrides[ing.name] !== undefined
                      const unknown  = !fromDB && !isOverrid
                      return (
                        <tr key={i} style={{ borderBottom: '0.5px solid #f5f5f2', background: unknown ? '#FFFBF0' : 'white' }}>
                          <td style={{ padding: '9px 1.25rem', fontSize: '13px' }}>
                            {ing.name}
                            {fromDB && !isOverrid && <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '6px', fontSize: '10px', background: '#E6F1FB', color: '#185FA5' }}>{currency === 'EUR' ? 'base FR' : 'base CH'}</span>}
                            {isOverrid && <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '6px', fontSize: '10px', background: '#FAEEDA', color: '#854F0B' }}>modifie</span>}
                            {unknown && <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '6px', fontSize: '10px', background: '#FEF2F2', color: '#991B1B' }}>prix inconnu</span>}
                          </td>
                          <td style={{ padding: '9px 1.25rem', fontSize: '12px', color: '#888' }}>
                            {parseFloat(ing.qty || 0) * factor} {ing.unit}
                          </td>
                          <td style={{ padding: '9px 1.25rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                              <input type="number" step="0.01" defaultValue={dispVal.toFixed(2)}
                                onBlur={e => handlePriceChange(ing, e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { handlePriceChange(ing, e.target.value); e.target.blur() } }}
                                style={{ width: '65px', padding: '3px 6px', border: '0.5px solid ' + (unknown ? '#FCA5A5' : '#ddd'), borderRadius: '5px', fontSize: '12px', textAlign: 'right', outline: 'none', background: isOverrid ? '#FFFBF0' : '#fafaf8' }}
                              />
                              <span style={{ fontSize: '10px', color: '#888' }}>{dispUnit}</span>
                              {savingPrice === ing.name && <span style={{ fontSize: '10px', color: '#1D9E75' }}>...</span>}
                            </div>
                          </td>
                          <td style={{ padding: '9px 1.25rem', textAlign: 'right', fontWeight: '500', fontSize: '13px', color: unknown ? '#aaa' : 'inherit' }}>
                            {toDisplay(cost).toFixed(2)} {sym}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#fafaf8' }}>
                      <td colSpan="3" style={{ padding: '10px 1.25rem', fontWeight: '500', fontSize: '13px' }}>Total recette</td>
                      <td style={{ padding: '10px 1.25rem', textAlign: 'right', fontSize: '18px', fontWeight: '500', color: '#0F6E56' }}>{toDisplay(recipeTotal).toFixed(2)} {sym}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          })}
        </>
      )}

      {selected.size === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          <div style={{ fontSize: '40px', marginBottom: '1rem' }}>💰</div>
          <p style={{ fontWeight: '500' }}>Selectionne une ou plusieurs recettes ci-dessus</p>
          <p style={{ fontSize: '12px', marginTop: '4px' }}>Le calcul du cout apparaitra ici.</p>
        </div>
      )}
    </div>
  )
}
