import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const FILTRES = ['Toutes', 'Végan', 'Végétarien', 'Rapide', 'Économique', 'Dessert', 'Plat principal']
const CATEGORIES = ['vegan', 'vegetarien', 'rapide', 'economique', 'dessert', 'plat', 'entree', 'soupe']
const UNITES = ['g', 'kg', 'ml', 'L', 'unité(s)', 'sachet(s)', 'boîte(s)', 'c. à soupe', 'c. à café', 'pincée']
const EMOJIS = ['🍳','🍰','🥗','🍝','🥘','🍲','🥧','🧁','🍜','🥞','🫕','🥩','🐟','🍵']

const TAG = {
  vegan:       { label: 'Végan',       bg: '#EAF3DE', color: '#3B6D11' },
  vegetarien:  { label: 'Végétarien',  bg: '#EAF3DE', color: '#3B6D11' },
  rapide:      { label: 'Rapide',      bg: '#E6F1FB', color: '#185FA5' },
  economique:  { label: 'Éco.',        bg: '#FAEEDA', color: '#854F0B' },
  dessert:     { label: 'Dessert',     bg: '#EEEDFE', color: '#3C3489' },
  plat:        { label: 'Plat',        bg: '#E1F5EE', color: '#085041' },
  entree:      { label: 'Entrée',      bg: '#FAECE7', color: '#712B13' },
  soupe:       { label: 'Soupe',       bg: '#E6F1FB', color: '#0C447C' },
}

const EMPTY_FORM = {
  title: '', source: '', url: '', emoji: '🍳', time: '', cost: '',
  cats: [], ingredients: [], steps: [], notes: ''
}

export default function BibliothequePage() {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtre, setFiltre] = useState('Toutes')
  const [showImport, setShowImport] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadRecipes() }, [user])

  async function loadRecipes() {
    setLoading(true)
    const { data } = await supabase.from('recipes').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setRecipes(data || [])
    setLoading(false)
  }

  async function importFromUrl() {
    if (!importUrl.trim()) return
    setImporting(true)
    setImportError('')
    try {
      const resp = await fetch('/api/import-recipe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: importUrl })
})
const recipe = await resp.json()
      })
      
      const recipe = JSON.parse(clean)
      setForm({
        title: recipe.title || '',
        source: recipe.source || '',
        url: importUrl,
        emoji: recipe.emoji || '🍳',
        time: recipe.time || 30,
        cost: recipe.cost || 10,
        cats: recipe.cats || [],
        ingredients: recipe.ingredients || [],
        steps: recipe.steps || [],
        notes: recipe.notes || ''
      })
      setShowImport(false)
      setEditingId(null)
      setShowEdit(true)
    } catch (e) {
      setImportError('Impossible d\'analyser cette URL. Tu peux saisir la recette manuellement.')
    }
    setImporting(false)
  }

  async function saveRecipe() {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      user_id: user.id,
      title: form.title,
      source: form.source,
      url: form.url,
      emoji: form.emoji,
      time: parseInt(form.time) || 30,
      cost: parseFloat(form.cost) || 0,
      cats: form.cats,
      ingredients: form.ingredients,
      steps: form.steps,
      notes: form.notes
    }
    if (editingId) {
      await supabase.from('recipes').update(payload).eq('id', editingId)
    } else {
      await supabase.from('recipes').insert(payload)
    }
    setSaving(false)
    setShowEdit(false)
    setForm(EMPTY_FORM)
    setEditingId(null)
    loadRecipes()
  }

  async function deleteRecipe(id) {
    await supabase.from('recipes').delete().eq('id', id)
    setConfirmDelete(null)
    setShowDetail(null)
    loadRecipes()
  }

  function openEdit(recipe) {
    setEditingId(recipe.id)
    setForm({
      title: recipe.title || '',
      source: recipe.source || '',
      url: recipe.url || '',
      emoji: recipe.emoji || '🍳',
      time: recipe.time || 30,
      cost: recipe.cost || 0,
      cats: recipe.cats || [],
      ingredients: recipe.ingredients || [],
      steps: recipe.steps || [],
      notes: recipe.notes || ''
    })
    setShowDetail(null)
    setShowEdit(true)
  }

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowImport(false)
    setShowEdit(true)
  }

  function addIngredient() { setForm(f => ({ ...f, ingredients: [...f.ingredients, { name: '', qty: '', unit: 'g' }] })) }
  function updateIngredient(i, key, val) {
    setForm(f => { const ings = [...f.ingredients]; ings[i] = { ...ings[i], [key]: val }; return { ...f, ingredients: ings } })
  }
  function removeIngredient(i) { setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) })) }

  function addStep() { setForm(f => ({ ...f, steps: [...f.steps, ''] })) }
  function updateStep(i, val) {
    setForm(f => { const steps = [...f.steps]; steps[i] = val; return { ...f, steps } })
  }
  function removeStep(i) { setForm(f => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) })) }

  function toggleCat(cat) {
    setForm(f => ({ ...f, cats: f.cats.includes(cat) ? f.cats.filter(c => c !== cat) : [...f.cats, cat] }))
  }

  const filteredRecipes = recipes.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase())
    const key = filtre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(' principal', '').replace(' ', '')
    const matchFiltre = filtre === 'Toutes' || (r.cats || []).includes(key)
    return matchSearch && matchFiltre
  })

  const S = { input: { width: '100%', padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', background: '#fafaf8', color: 'inherit' } }
  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 50, padding: '1rem', overflowY: 'auto' }
  const modalBox = { background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '560px', marginTop: '1rem', marginBottom: '1rem' }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une recette..."
          style={{ flex: 1, minWidth: '160px', padding: '10px 14px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#fafaf8' }} />
        <button onClick={() => { setShowImport(true); setImportError(''); setImportUrl('') }}
          style={{ background: 'white', color: '#1D9E75', border: '0.5px solid #1D9E75', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>🔗 Importer URL</button>
        <button onClick={openNew}
          style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>+ Nouvelle</button>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {FILTRES.map(f => (
          <button key={f} onClick={() => setFiltre(f)} style={{
            padding: '5px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
            border: '0.5px solid ' + (filtre === f ? '#5DCAA5' : '#e0e0e0'),
            background: filtre === f ? '#E1F5EE' : 'white',
            color: filtre === f ? '#0F6E56' : '#888', fontWeight: filtre === f ? '500' : '400'
          }}>{f}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Chargement...</div>
      ) : filteredRecipes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🍽</div>
          <p style={{ fontWeight: '500' }}>Aucune recette trouvée</p>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>Importe une URL ou crée ta première recette !</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {filteredRecipes.map(r => (
            <div key={r.id} onClick={() => setShowDetail(r)}
              style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#5DCAA5'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e0e0e0'}>
              <div style={{ height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', background: '#fafaf8' }}>{r.emoji}</div>
              <div style={{ padding: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>{r.title}</div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {(r.cats || []).slice(0, 2).map(cat => TAG[cat] && (
                    <span key={cat} style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '500', background: TAG[cat].bg, color: TAG[cat].color }}>{TAG[cat].label}</span>
                  ))}
                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', background: '#f0f0ec', color: '#888' }}>{r.time} min</span>
                  {r.cost > 0 && <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', background: '#FAEEDA', color: '#854F0B' }}>~{r.cost} CHF</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Import URL */}
      {showImport && (
        <div style={{ ...overlay, alignItems: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '480px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '6px' }}>Importer une recette par URL</h3>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '1rem' }}>L'IA lit la page et extrait automatiquement tous les détails. Tu pourras tout vérifier et corriger avant d'enregistrer.</p>
            <input value={importUrl} onChange={e => setImportUrl(e.target.value)}
              placeholder="https://actu.marieclaire.fr/cuisine/..." style={{ ...S.input, marginBottom: '8px' }} />
            {importError && <div style={{ background: '#FCEBEB', color: '#791F1F', padding: '10px', borderRadius: '8px', fontSize: '13px', marginBottom: '8px' }}>{importError}</div>}
            <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '1rem' }}>Compatible : Marie Claire, Marmiton, 750g, Cuisine Actuelle, et la plupart des sites de recettes.</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowImport(false)} style={{ background: 'none', border: '0.5px solid #ddd', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>Annuler</button>
              <button onClick={openNew} style={{ background: 'none', border: '0.5px solid #1D9E75', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer', color: '#1D9E75' }}>Saisie manuelle</button>
              <button onClick={importFromUrl} disabled={importing || !importUrl.trim()} style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', opacity: importing ? 0.7 : 1 }}>
                {importing ? '⏳ Analyse...' : 'Analyser'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Détail */}
      {showDetail && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '0.5px solid #f0f0ec' }}>
              <div style={{ fontSize: '40px' }}>{showDetail.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>{showDetail.title}</div>
                {showDetail.source && <div style={{ fontSize: '12px', color: '#1D9E75', marginBottom: '6px' }}>{showDetail.source}</div>}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(showDetail.cats || []).map(cat => TAG[cat] && (
                    <span key={cat} style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '500', background: TAG[cat].bg, color: TAG[cat].color }}>{TAG[cat].label}</span>
                  ))}
                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: '#f0f0ec', color: '#888' }}>{showDetail.time} min</span>
                  {showDetail.cost > 0 && <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: '#FAEEDA', color: '#854F0B' }}>~{showDetail.cost} CHF</span>}
                </div>
              </div>
              <button onClick={() => setShowDetail(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#aaa' }}>✕</button>
            </div>

            {(showDetail.ingredients || []).length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>Ingrédients</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {showDetail.ingredients.map((ing, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: '#fafaf8', borderRadius: '8px', fontSize: '13px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1D9E75', flexShrink: 0 }} />
                      {ing.qty} {ing.unit} {ing.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(showDetail.steps || []).length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>Préparation</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {showDetail.steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', fontSize: '13px', lineHeight: '1.5' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#E1F5EE', color: '#0F6E56', fontSize: '11px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>{i + 1}</div>
                      <div>{step}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showDetail.notes && (
              <div style={{ background: '#FAEEDA', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#633806', marginBottom: '1rem' }}>
                <strong>Notes :</strong> {showDetail.notes}
              </div>
            )}

            {showDetail.url && (
              <a href={showDetail.url} target="_blank" rel="noreferrer"
                style={{ fontSize: '12px', color: '#1D9E75', display: 'block', marginBottom: '1rem', wordBreak: 'break-all' }}>
                🔗 Voir la recette originale
              </a>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '0.5px solid #f0f0ec' }}>
              <button onClick={() => setConfirmDelete(showDetail)} style={{ background: 'none', border: '0.5px solid #E24B4A', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer', color: '#E24B4A' }}>Supprimer</button>
              <button onClick={() => openEdit(showDetail)} style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>✏️ Modifier</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Édition complète */}
      {showEdit && (
        <div style={overlay}>
          <div style={modalBox}>
            <h3 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '1.25rem' }}>
              {editingId ? '✏️ Modifier la recette' : '+ Nouvelle recette'}
            </h3>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Emoji</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))} style={{
                    fontSize: '20px', padding: '4px 8px', borderRadius: '8px', cursor: 'pointer',
                    border: '0.5px solid ' + (form.emoji === e ? '#1D9E75' : '#ddd'),
                    background: form.emoji === e ? '#E1F5EE' : 'white'
                  }}>{e}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Nom de la recette *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex : Tarte tatin aux pommes" style={S.input} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Source (site)</label>
                <input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="Ex : Marmiton" style={S.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>URL originale</label>
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." style={S.input} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Temps (minutes)</label>
                <input type="number" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} placeholder="45" style={S.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Coût estimé (CHF)</label>
                <input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="12" style={S.input} />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Catégories</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => toggleCat(cat)} style={{
                    padding: '4px 12px', borderRadius: '14px', fontSize: '12px', cursor: 'pointer',
                    border: '0.5px solid ' + (form.cats.includes(cat) ? '#5DCAA5' : '#ddd'),
                    background: form.cats.includes(cat) ? '#E1F5EE' : 'white',
                    color: form.cats.includes(cat) ? '#0F6E56' : '#888'
                  }}>{cat}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: '#666' }}>Ingrédients</label>
                <button onClick={addIngredient} style={{ fontSize: '12px', color: '#1D9E75', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>+ Ajouter</button>
              </div>
              {form.ingredients.map((ing, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr auto', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                  <input value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)} placeholder="Ingrédient" style={S.input} />
                  <input type="number" value={ing.qty} onChange={e => updateIngredient(i, 'qty', e.target.value)} placeholder="Qté" style={S.input} />
                  <select value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)} style={S.input}>
                    {UNITES.map(u => <option key={u}>{u}</option>)}
                  </select>
                  <button onClick={() => removeIngredient(i)} style={{ background: 'none', border: 'none', color: '#E24B4A', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                </div>
              ))}
              {form.ingredients.length === 0 && <div style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>Aucun ingrédient — clique sur "+ Ajouter"</div>}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: '#666' }}>Étapes de préparation</label>
                <button onClick={addStep} style={{ fontSize: '12px', color: '#1D9E75', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>+ Ajouter</button>
              </div>
              {form.steps.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'flex-start' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#E1F5EE', color: '#0F6E56', fontSize: '11px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '8px' }}>{i + 1}</div>
                  <textarea value={step} onChange={e => updateStep(i, e.target.value)} placeholder={`Étape ${i + 1}...`} rows={2}
                    style={{ ...S.input, resize: 'vertical', flex: 1 }} />
                  <button onClick={() => removeStep(i)} style={{ background: 'none', border: 'none', color: '#E24B4A', cursor: 'pointer', fontSize: '16px', paddingTop: '8px' }}>✕</button>
                </div>
              ))}
              {form.steps.length === 0 && <div style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>Aucune étape — clique sur "+ Ajouter"</div>}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Notes personnelles / conseils</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Conseils, variantes, astuces personnelles..." rows={3}
                style={{ ...S.input, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '0.5px solid #f0f0ec' }}>
              <button onClick={() => { setShowEdit(false); setForm(EMPTY_FORM); setEditingId(null) }}
                style={{ background: 'none', border: '0.5px solid #ddd', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', cursor: 'pointer' }}>Annuler</button>
              <button onClick={saveRecipe} disabled={saving || !form.title.trim()} style={{
                background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px',
                padding: '9px 18px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', opacity: saving ? 0.7 : 1
              }}>{saving ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation suppression */}
      {confirmDelete && (
        <div style={{ ...overlay, alignItems: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🗑</div>
            <h3 style={{ fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>Supprimer cette recette ?</h3>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '1.5rem' }}>« {confirmDelete.title} » sera définitivement supprimée.</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ background: 'none', border: '0.5px solid #ddd', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}>Annuler</button>
              <button onClick={() => deleteRecipe(confirmDelete.id)} style={{ background: '#E24B4A', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
