import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { PRIX_DB, calculerCout } from '../lib/prixDB'

export default function BudgetPage() {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [persons, setPersons] = useState(2)
  const [budgetMax, setBudgetMax] = useState(30)
  const [customPrices, setCustomPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [showPrixDB, setShowPrixDB] = useState(false)
  const [prixSearch, setPrixSearch] = useState('')

  useEffect(() => {
    supabase.from('recipes').select('*').eq('user_id', user.id)
      .then(({ data }) => { setRecipes(data || []); setLoading(false) })
  }, [user])

  function toggleRecipe(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const factor = persons / 2

  const selectedRecipes = recipes.filter(r => selected.has(r.id))
  const grandTotal = selectedRecipes.reduce((sum, r) => {
    return sum + (r.ingredients || []).reduce((s, ing) => s + calculerCout(ing, factor, customPrices), 0)
  }, 0)

  const perPerson = persons > 0 ? grandTotal / persons : 0
  const reste = budgetMax - grandTotal
  const pct = Math.min(100, Math.round(grandTotal / budgetMax * 100))
  const fillColor = pct < 80 ? '#1D9E75' : pct < 100 ? '#BA7517' : '#E24B4A'

  const filteredPrix = PRIX_DB.filter(p =>
    p.nom.toLowerCase().includes(prixSearch.toLowerCase()) ||
    p.cat.toLowerCase().includes(prixSearch.toLowerCase())
  )

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Chargement...</div>

  return (
    <div>
      {/* Sélection */}
      <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Simuler le coût d'un repas</div>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
          Prix pré-chargés depuis la base Migros/Coop Suisse — avril 2026. Modifiables à tout moment.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', marginBottom: '12px' }}>
          {recipes.map(r => (
            <div key={r.id} onClick={() => toggleRecipe(r.id)} style={{
              border: '0.5px solid ' + (selected.has(r.id) ? '#1D9E75' : '#e0e0e0'),
              borderRadius: '10px', padding: '10px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
              background: selected.has(r.id) ? '#E1F5EE' : 'white'
            }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: '0.5px solid ' + (selected.has(r.id) ? '#1D9E75' : '#ddd'), background: selected.has(r.id) ? '#1D9E75' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '11px' }}>{selected.has(r.id) ? '✓' : ''}</div>
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
            <select value={persons} onChange={e => setPersons(parseInt(e.target.value))} style={{ padding: '6px 10px', border: '0.5px solid #ddd', borderRadius: '6px', fontSize: '13px' }}>
              {[1, 2, 3, 4, 6, 8].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: '#666' }}>Budget max (CHF) :</label>
            <input type="number" value={budgetMax} onChange={e => setBudgetMax(parseFloat(e.target.value) || 30)}
              style={{ width: '75px', padding: '6px 10px', border: '0.5px solid #ddd', borderRadius: '6px', fontSize: '13px' }} />
          </div>
          <button onClick={() => setShowPrixDB(!showPrixDB)} style={{ padding: '6px 12px', fontSize: '12px', border: '0.5px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: 'white' }}>
            {showPrixDB ? 'Masquer' : 'Voir'} la base de prix
          </button>
        </div>
      </div>

      {/* Base de prix */}
      {showPrixDB && (
        <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>Base de prix Suisse 2026</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Sources : Migros, Coop, Rapport Agricole Suisse</div>
            </div>
            <input value={prixSearch} onChange={e => setPrixSearch(e.target.value)} placeholder="Rechercher..."
              style={{ padding: '7px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', width: '160px' }} />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Ingrédient', 'Catégorie', 'Prix moyen', 'Unité', 'Source'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', fontSize: '11px', fontWeight: '500', color: '#888', textAlign: 'left', borderBottom: '0.5px solid #e0e0e0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPrix.map(p => (
                  <tr key={p.nom}>
                    <td style={{ padding: '8px 10px', fontWeight: '500' }}>{p.nom}</td>
                    <td style={{ padding: '8px 10px' }}><span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', background: '#f0f0ec', color: '#666' }}>{p.cat}</span></td>
                    <td style={{ padding: '8px 10px', fontWeight: '500', color: '#0F6E56' }}>{p.prix.toFixed(2)} CHF</td>
                    <td style={{ padding: '8px 10px', color: '#888', fontSize: '12px' }}>{p.unite}</td>
                    <td style={{ padding: '8px 10px' }}><span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '10px', background: '#E6F1FB', color: '#185FA5' }}>{p.source}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Récapitulatif budget */}
      {selected.size > 0 && (
        <>
          <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>Récapitulatif</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
              {[
                { label: 'Coût total estimé', value: grandTotal.toFixed(2) + ' CHF' },
                { label: 'Coût par personne', value: perPerson.toFixed(2) + ' CHF' },
                { label: 'Budget restant', value: (reste >= 0 ? '+' : '') + reste.toFixed(2) + ' CHF', color: reste >= 0 ? '#0F6E56' : '#A32D2D' },
                { label: 'Recettes', value: selected.size + ' recette' + (selected.size > 1 ? 's' : '') },
              ].map(item => (
                <div key={item.label} style={{ background: '#fafaf8', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>{item.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: '500', color: item.color || 'inherit' }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', marginBottom: '4px' }}>
              <span>0 CHF</span><span>{budgetMax} CHF</span>
            </div>
            <div style={{ height: '10px', background: '#f0f0ec', borderRadius: '5px', overflow: 'hidden', marginBottom: '6px' }}>
              <div style={{ height: '100%', width: pct + '%', background: fillColor, borderRadius: '5px', transition: 'width 0.4s' }} />
            </div>
            <div style={{ fontSize: '12px', color: fillColor }}>
              {pct < 80 ? `Dans le budget — il reste ${reste.toFixed(2)} CHF`
                : pct < 100 ? 'Attention, tu approches de ton budget !'
                : `Budget dépassé de ${Math.abs(reste).toFixed(2)} CHF`}
            </div>
          </div>

          {/* Détail par recette */}
          {selectedRecipes.map(r => {
            const recipeTotal = (r.ingredients || []).reduce((s, ing) => s + calculerCout(ing, factor, customPrices), 0)
            return (
              <div key={r.id} style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
                <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '0.5px solid #e0e0e0' }}>
                  <div style={{ fontSize: '28px' }}>{r.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>{r.title}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{persons} personne{persons > 1 ? 's' : ''} · {r.time} min</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: '500', color: '#0F6E56' }}>{recipeTotal.toFixed(2)} CHF</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>{(recipeTotal / persons).toFixed(2)} CHF/pers.</div>
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Ingrédient', 'Quantité', 'Prix unitaire', 'Coût'].map(h => (
                        <th key={h} style={{ padding: '7px 1.25rem', fontSize: '11px', fontWeight: '500', color: '#888', textAlign: h === 'Coût' || h === 'Prix unitaire' ? 'right' : 'left', borderBottom: '0.5px solid #e0e0e0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(r.ingredients || []).map((ing, i) => {
                      const cost = calculerCout(ing, factor, customPrices)
                      const fromDB = PRIX_DB.find(p => p.nom.toLowerCase() === ing.name.toLowerCase())
                      const priceLabel = ing.unit === 'g' ? 'CHF/kg' : ing.unit === 'ml' ? 'CHF/L' : 'CHF/unité'
                      const currentPrice = customPrices[ing.name] ?? (fromDB ? fromDB.prix : 1)
                      return (
                        <tr key={i} style={{ borderBottom: '0.5px solid #f5f5f2' }}>
                          <td style={{ padding: '9px 1.25rem', fontSize: '13px' }}>
                            {ing.name}
                            {fromDB && !customPrices[ing.name] && (
                              <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '6px', fontSize: '10px', background: '#E6F1FB', color: '#185FA5' }}>base CH</span>
                            )}
                          </td>
                          <td style={{ padding: '9px 1.25rem', fontSize: '12px', color: '#888' }}>{(ing.qty || 0) * factor} {ing.unit}</td>
                          <td style={{ padding: '9px 1.25rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                              <input type="number" step="0.01" defaultValue={currentPrice.toFixed(2)}
                                onBlur={e => setCustomPrices(p => ({ ...p, [ing.name]: parseFloat(e.target.value) || 0 }))}
                                style={{ width: '65px', padding: '3px 6px', border: '0.5px solid #ddd', borderRadius: '5px', fontSize: '12px', textAlign: 'right' }}
                              />
                              <span style={{ fontSize: '10px', color: '#888' }}>{priceLabel}</span>
                            </div>
                          </td>
                          <td style={{ padding: '9px 1.25rem', textAlign: 'right', fontWeight: '500', fontSize: '13px' }}>{cost.toFixed(2)} CHF</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#fafaf8' }}>
                      <td colSpan="3" style={{ padding: '10px 1.25rem', fontWeight: '500', fontSize: '13px' }}>Total recette</td>
                      <td style={{ padding: '10px 1.25rem', textAlign: 'right', fontSize: '18px', fontWeight: '500', color: '#0F6E56' }}>{recipeTotal.toFixed(2)} CHF</td>
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
          <p style={{ fontWeight: '500' }}>Sélectionne une ou plusieurs recettes ci-dessus</p>
          <p style={{ fontSize: '12px', marginTop: '4px' }}>Le calcul du coût apparaîtra ici.</p>
        </div>
      )}
    </div>
  )
}
