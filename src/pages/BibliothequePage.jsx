import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// ─── Constantes ───────────────────────────────────────────────────────────────

const FILTRES = ['Toutes', 'Végan', 'Végétarien', 'Rapide', 'Économique', 'Dessert', 'Plat principal']
const CATEGORIES = ['vegan', 'vegetarien', 'rapide', 'economique', 'dessert', 'plat', 'entree', 'soupe']
const UNITES = ['g', 'kg', 'ml', 'L', 'unité(s)', 'sachet(s)', 'boîte(s)', 'c. à soupe', 'c. à café', 'pincée']
const EMOJIS = ['🍳','🍰','🥗','🍝','🥘','🍲','🥧','🧁','🍜','🥞','🫕','🥩','🐟','🍵']

const SORT_OPTIONS = [
  { value: 'date_desc',  label: '📅 Plus récentes' },
  { value: 'date_asc',   label: '📅 Plus anciennes' },
  { value: 'alpha_asc',  label: '🔤 A → Z' },
  { value: 'alpha_desc', label: '🔤 Z → A' },
  { value: 'time_asc',   label: '⏱ Les plus rapides' },
  { value: 'cost_asc',   label: '💰 Les moins chères' },
]

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
  cats: [], tags: [], servings: 4,
  ingredients: [], steps: [], notes: '',
  photo_url: ''   // ← URL publique Supabase Storage (ou URL externe)
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function scaleIngredients(ingredients, baseServings, currentServings) {
  if (!baseServings || baseServings === 0 || baseServings === currentServings) return ingredients
  const ratio = currentServings / baseServings
  return ingredients.map(ing => {
    const qty = parseFloat(ing.qty)
    if (isNaN(qty)) return ing
    const scaled = qty * ratio
    return { ...ing, qty: Number.isInteger(scaled) ? scaled : parseFloat(scaled.toFixed(1)) }
  })
}

function normalizeTag(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Calcule le coût estimé d'une recette à partir de la base de prix.
 * Fait du mieux possible avec les données disponibles (unités, qté).
 * Retourne null si aucun ingrédient ne peut être valorisé.
 */
function computeCostFromPrices(ingredients, priceMap) {
  if (!ingredients || ingredients.length === 0 || !priceMap) return null
  let total = 0
  let matched = 0
  for (const ing of ingredients) {
    const key = ing.name?.trim().toLowerCase()
    if (!key) continue
    const entry = priceMap[key]
    if (!entry) continue
    const qty = parseFloat(ing.qty) || 0
    // Prix stocké : price_per_unit (CHF par unité de référence)
    total += qty * entry.price_per_unit
    matched++
  }
  return matched > 0 ? parseFloat(total.toFixed(2)) : null
}

function sortRecipes(recipes, sortKey) {
  const arr = [...recipes]
  switch (sortKey) {
    case 'date_asc':   return arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    case 'alpha_asc':  return arr.sort((a, b) => a.title.localeCompare(b.title, 'fr'))
    case 'alpha_desc': return arr.sort((a, b) => b.title.localeCompare(a.title, 'fr'))
    case 'time_asc':   return arr.sort((a, b) => (a.time || 999) - (b.time || 999))
    case 'cost_asc':   return arr.sort((a, b) => (a.cost || 999) - (b.cost || 999))
    default:           return arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function TagsInput({ tags = [], onChange }) {
  const [input, setInput] = useState('')
  function commit() {
    const t = normalizeTag(input)
    if (t && !tags.includes(t)) onChange([...tags, t])
    setInput('')
  }
  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() }
    if (e.key === 'Backspace' && input === '' && tags.length > 0) onChange(tags.slice(0, -1))
  }
  return (
    <div onClick={() => document.getElementById('tag-free-input')?.focus()}
      style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center', padding: '6px 10px', border: '0.5px solid #ddd', borderRadius: '8px', background: '#fafaf8', minHeight: '36px', cursor: 'text' }}>
      {tags.map((t, i) => (
        <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '500', background: '#F0F0EC', color: '#555', border: '0.5px solid #ddd' }}>
          #{t}
          <button type="button" onClick={e => { e.stopPropagation(); onChange(tags.filter((_, idx) => idx !== i)) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 0, lineHeight: 1, fontSize: '13px' }}>×</button>
        </span>
      ))}
      <input id="tag-free-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} onBlur={commit}
        placeholder={tags.length === 0 ? 'grand-mère, été, coup de cœur…' : ''}
        style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', minWidth: '120px', flex: 1, padding: '1px 2px', color: 'inherit' }} />
    </div>
  )
}

/**
 * Composant upload photo : drag & drop ou clic, upload vers Supabase Storage.
 * Affiche la preview et retourne l'URL publique via onUploaded(url).
 */
function PhotoUpload({ currentUrl, onUploaded, userId }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(currentUrl || '')
  const [urlInput, setUrlInput] = useState('')
  const [mode, setMode] = useState('upload') // 'upload' | 'url'
  const inputRef = useRef()

  useEffect(() => { setPreview(currentUrl || '') }, [currentUrl])

  async function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `recipes/${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('recipe-photos').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('recipe-photos').getPublicUrl(path)
      setPreview(data.publicUrl)
      onUploaded(data.publicUrl)
    }
    setUploading(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }

  function handleUrlSubmit() {
    const url = urlInput.trim()
    if (url) { setPreview(url); onUploaded(url) }
  }

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <label style={{ fontSize: '12px', color: '#666' }}>Photo de la recette</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={() => setMode('upload')} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', border: '0.5px solid ' + (mode === 'upload' ? '#1D9E75' : '#ddd'), background: mode === 'upload' ? '#E1F5EE' : 'white', color: mode === 'upload' ? '#0F6E56' : '#888', cursor: 'pointer' }}>📁 Fichier</button>
          <button type="button" onClick={() => setMode('url')} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', border: '0.5px solid ' + (mode === 'url' ? '#1D9E75' : '#ddd'), background: mode === 'url' ? '#E1F5EE' : 'white', color: mode === 'url' ? '#0F6E56' : '#888', cursor: 'pointer' }}>🔗 URL</button>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <img src={preview} alt="Preview" style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '10px', border: '0.5px solid #e0e0e0' }} onError={() => setPreview('')} />
          <button type="button" onClick={() => { setPreview(''); onUploaded('') }}
            style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}

      {mode === 'upload' ? (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{ border: '1px dashed #ccc', borderRadius: '10px', padding: '20px', textAlign: 'center', cursor: 'pointer', background: '#fafaf8', fontSize: '12px', color: '#aaa' }}>
          {uploading ? '⏳ Upload en cours...' : '📷 Cliquer ou glisser une photo ici'}
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '6px' }}>
          <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://..." onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
            style={{ flex: 1, padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#fafaf8' }} />
          <button type="button" onClick={handleUrlSubmit} style={{ padding: '8px 12px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>OK</button>
        </div>
      )}
    </div>
  )
}

// ─── Modal Base de Prix ───────────────────────────────────────────────────────
// Table Supabase : ingredient_prices (id, user_id, name, price_per_unit, unit, updated_at)

function PriceBaseModal({ userId, onClose, onPricesUpdated }) {
  const [prices, setPrices] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newUnit, setNewUnit] = useState('g')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editPrice, setEditPrice] = useState('')

  useEffect(() => { loadPrices() }, [])

  async function loadPrices() {
    setLoading(true)
    const { data } = await supabase.from('ingredient_prices').select('*').eq('user_id', userId).order('name')
    setPrices(data || [])
    setLoading(false)
  }

  async function addPrice() {
    if (!newName.trim() || !newPrice) return
    setSaving(true)
    await supabase.from('ingredient_prices').insert({
      user_id: userId,
      name: newName.trim().toLowerCase(),
      price_per_unit: parseFloat(newPrice),
      unit: newUnit
    })
    setNewName(''); setNewPrice(''); setNewUnit('g')
    await loadPrices()
    onPricesUpdated()
    setSaving(false)
  }

  async function updatePrice(id, price) {
    await supabase.from('ingredient_prices').update({ price_per_unit: parseFloat(price), updated_at: new Date().toISOString() }).eq('id', id)
    setEditingId(null)
    await loadPrices()
    onPricesUpdated()
  }

  async function deletePrice(id) {
    await supabase.from('ingredient_prices').delete().eq('id', id)
    await loadPrices()
    onPricesUpdated()
  }

  const S = { input: { padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#fafaf8', width: '100%', boxSizing: 'border-box' } }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 70, padding: '1rem', overflowY: 'auto' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '520px', marginTop: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '500', margin: 0 }}>💰 Base de prix des ingrédients</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#aaa' }}>✕</button>
        </div>

        <p style={{ fontSize: '12px', color: '#888', marginBottom: '1rem', lineHeight: '1.5' }}>
          Le prix est exprimé <strong>par unité de référence</strong> (ex : CHF par gramme, par ml, par unité…).
          Il est utilisé pour calculer automatiquement le coût des recettes.
        </p>

        {/* Formulaire d'ajout */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.8fr auto', gap: '6px', marginBottom: '1rem', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>Ingrédient</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="farine, beurre…" style={S.input}
              onKeyDown={e => e.key === 'Enter' && addPrice()} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>Prix (CHF)</label>
            <input type="number" step="0.001" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="0.005" style={S.input}
              onKeyDown={e => e.key === 'Enter' && addPrice()} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>/ unité</label>
            <select value={newUnit} onChange={e => setNewUnit(e.target.value)} style={S.input}>
              {UNITES.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <button onClick={addPrice} disabled={saving || !newName.trim() || !newPrice}
            style={{ padding: '7px 12px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', opacity: saving ? 0.7 : 1, whiteSpace: 'nowrap', alignSelf: 'flex-end' }}>
            + Ajouter
          </button>
        </div>

        {/* Liste */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: '#aaa', fontSize: '13px' }}>Chargement…</div>
        ) : prices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: '#aaa', fontSize: '13px' }}>Aucun prix enregistré encore.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '320px', overflowY: 'auto' }}>
            {prices.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#fafaf8', borderRadius: '8px', border: '0.5px solid #f0f0ec' }}>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: '500', color: '#333', textTransform: 'capitalize' }}>{p.name}</span>
                {editingId === p.id ? (
                  <>
                    <input type="number" step="0.001" defaultValue={p.price_per_unit} ref={r => r && (r._val = p.price_per_unit)}
                      onChange={e => setEditPrice(e.target.value)}
                      style={{ width: '80px', padding: '4px 8px', border: '0.5px solid #1D9E75', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
                      onKeyDown={e => e.key === 'Enter' && updatePrice(p.id, editPrice || p.price_per_unit)} />
                    <span style={{ fontSize: '11px', color: '#888' }}>/ {p.unit}</span>
                    <button onClick={() => updatePrice(p.id, editPrice || p.price_per_unit)}
                      style={{ padding: '4px 10px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>✓</button>
                    <button onClick={() => setEditingId(null)}
                      style={{ padding: '4px 8px', background: 'none', border: '0.5px solid #ddd', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#888' }}>✕</button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '13px', color: '#1D9E75', fontWeight: '500', fontVariantNumeric: 'tabular-nums' }}>{p.price_per_unit} CHF</span>
                    <span style={{ fontSize: '11px', color: '#888' }}>/ {p.unit}</span>
                    <button onClick={() => { setEditingId(p.id); setEditPrice(String(p.price_per_unit)) }}
                      style={{ padding: '4px 10px', background: 'none', border: '0.5px solid #ddd', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#555' }}>✏️</button>
                    <button onClick={() => deletePrice(p.id)}
                      style={{ padding: '4px 8px', background: 'none', border: '0.5px solid #FCEBEB', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#E24B4A' }}>🗑</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '0.5px solid #f0f0ec', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'none', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function BibliothequePage() {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtre, setFiltre] = useState('Toutes')
  const [sortKey, setSortKey] = useState('date_desc')
  const [activeTagFilter, setActiveTagFilter] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [showPriceBase, setShowPriceBase] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [detailServings, setDetailServings] = useState(4)
  const [priceMap, setPriceMap] = useState({}) // { 'farine': { price_per_unit, unit }, ... }

  useEffect(() => { loadRecipes(); loadPriceMap() }, [user])

  async function loadRecipes() {
    setLoading(true)
    const { data } = await supabase.from('recipes').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setRecipes(data || [])
    setLoading(false)
  }

  async function loadPriceMap() {
    const { data } = await supabase.from('ingredient_prices').select('*').eq('user_id', user.id)
    const map = {}
    for (const row of (data || [])) map[row.name.toLowerCase()] = row
    setPriceMap(map)
  }

  // Quand la base de prix change → recalculer le cost de toutes les recettes en BDD
  async function onPricesUpdated() {
    await loadPriceMap()
    // Recharger le priceMap frais pour recalcul
    const { data: priceData } = await supabase.from('ingredient_prices').select('*').eq('user_id', user.id)
    const map = {}
    for (const row of (priceData || [])) map[row.name.toLowerCase()] = row

    const { data: recipeData } = await supabase.from('recipes').select('id, ingredients, cost').eq('user_id', user.id)
    for (const r of (recipeData || [])) {
      const computed = computeCostFromPrices(r.ingredients || [], map)
      if (computed !== null && computed !== r.cost) {
        await supabase.from('recipes').update({ cost: computed }).eq('id', r.id)
      }
    }
    await loadRecipes()
  }

  async function importFromUrl() {
    if (!importUrl.trim()) return
    setImporting(true); setImportError('')
    try {
      const resp = await fetch('/api/import-recipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: importUrl }) })
      if (!resp.ok) throw new Error('Erreur serveur')
      const recipe = await resp.json()
      setForm({ title: recipe.title || '', source: recipe.source || '', url: importUrl, emoji: recipe.emoji || '🍳', time: recipe.time || 30, cost: recipe.cost || 10, cats: recipe.cats || [], tags: recipe.tags || [], servings: recipe.servings || 4, ingredients: recipe.ingredients || [], steps: recipe.steps || [], notes: recipe.notes || '', photo_url: recipe.photo_url || '' })
      setShowImport(false); setEditingId(null); setShowEdit(true)
    } catch (e) { setImportError('Impossible d\'analyser cette URL. Tu peux saisir la recette manuellement.') }
    setImporting(false)
  }

  async function saveRecipe() {
    if (!form.title.trim()) return
    setSaving(true)
    // Calculer le coût automatiquement si possible, sinon garder la saisie manuelle
    const autoCost = computeCostFromPrices(form.ingredients, priceMap)
    const payload = {
      user_id: user.id, title: form.title, source: form.source, url: form.url, emoji: form.emoji,
      time: parseInt(form.time) || 30,
      cost: autoCost !== null ? autoCost : (parseFloat(form.cost) || 0),
      cats: form.cats, tags: form.tags, servings: parseInt(form.servings) || 4,
      ingredients: form.ingredients, steps: form.steps, notes: form.notes,
      photo_url: form.photo_url || ''
    }
    if (editingId) await supabase.from('recipes').update(payload).eq('id', editingId)
    else await supabase.from('recipes').insert(payload)
    setSaving(false); setShowEdit(false); setForm(EMPTY_FORM); setEditingId(null)
    loadRecipes()
  }

  async function deleteRecipe(id) {
    await supabase.from('recipes').delete().eq('id', id)
    setConfirmDelete(null); setShowDetail(null); loadRecipes()
  }

  function openEdit(recipe) {
    setEditingId(recipe.id)
    setForm({ title: recipe.title || '', source: recipe.source || '', url: recipe.url || '', emoji: recipe.emoji || '🍳', time: recipe.time || 30, cost: recipe.cost || 0, cats: recipe.cats || [], tags: recipe.tags || [], servings: recipe.servings || 4, ingredients: recipe.ingredients || [], steps: recipe.steps || [], notes: recipe.notes || '', photo_url: recipe.photo_url || '' })
    setShowDetail(null); setShowEdit(true)
  }

  function openNew() { setEditingId(null); setForm(EMPTY_FORM); setShowImport(false); setShowEdit(true) }
  function openDetail(recipe) { setShowDetail(recipe); setDetailServings(recipe.servings || 4) }

  function addIngredient() { setForm(f => ({ ...f, ingredients: [...f.ingredients, { name: '', qty: '', unit: 'g' }] })) }
  function updateIngredient(i, key, val) { setForm(f => { const ings = [...f.ingredients]; ings[i] = { ...ings[i], [key]: val }; return { ...f, ingredients: ings } }) }
  function removeIngredient(i) { setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) })) }

  function addStep() { setForm(f => ({ ...f, steps: [...f.steps, ''] })) }
  function updateStep(i, val) { setForm(f => { const steps = [...f.steps]; steps[i] = val; return { ...f, steps } }) }
  function removeStep(i) { setForm(f => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) })) }
  function toggleCat(cat) { setForm(f => ({ ...f, cats: f.cats.includes(cat) ? f.cats.filter(c => c !== cat) : [...f.cats, cat] })) }

  const allFreeTags = [...new Set(recipes.flatMap(r => r.tags || []))].sort()

  const filteredAndSorted = sortRecipes(
    recipes.filter(r => {
      const matchSearch = r.title.toLowerCase().includes(search.toLowerCase())
      const key = filtre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(' principal', '').replace(' ', '')
      const matchFiltre = filtre === 'Toutes' || (r.cats || []).includes(key)
      const matchTag = !activeTagFilter || (r.tags || []).includes(activeTagFilter)
      return matchSearch && matchFiltre && matchTag
    }),
    sortKey
  )

  const scaledIngredients = showDetail ? scaleIngredients(showDetail.ingredients || [], showDetail.servings || 4, detailServings) : []
  const autoCostDetail = showDetail ? computeCostFromPrices(showDetail.ingredients || [], priceMap) : null

  const S = { input: { width: '100%', padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', background: '#fafaf8', color: 'inherit' } }
  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 50, padding: '1rem', overflowY: 'auto' }
  const modalBox = { background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '560px', marginTop: '1rem', marginBottom: '1rem' }

  return (
    <div>
      {/* ── Barre actions ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une recette..."
          style={{ flex: 1, minWidth: '160px', padding: '10px 14px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#fafaf8' }} />
        <button onClick={() => setShowPriceBase(true)}
          style={{ background: 'white', color: '#854F0B', border: '0.5px solid #D4A259', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>💰 Prix</button>
        <button onClick={() => { setShowImport(true); setImportError(''); setImportUrl('') }}
          style={{ background: 'white', color: '#1D9E75', border: '0.5px solid #1D9E75', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>🔗 Importer URL</button>
        <button onClick={openNew}
          style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>+ Nouvelle</button>
      </div>

      {/* ── Filtres catégories + tri ── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'center' }}>
        {FILTRES.map(f => (
          <button key={f} onClick={() => setFiltre(f)} style={{
            padding: '5px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
            border: '0.5px solid ' + (filtre === f ? '#5DCAA5' : '#e0e0e0'),
            background: filtre === f ? '#E1F5EE' : 'white',
            color: filtre === f ? '#0F6E56' : '#888', fontWeight: filtre === f ? '500' : '400'
          }}>{f}</button>
        ))}
        {/* Sélecteur de tri — aligné à droite */}
        <select value={sortKey} onChange={e => setSortKey(e.target.value)}
          style={{ marginLeft: 'auto', padding: '5px 10px', borderRadius: '8px', border: '0.5px solid #e0e0e0', fontSize: '12px', background: 'white', color: '#555', outline: 'none', cursor: 'pointer' }}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* ── Filtres tags libres ── */}
      {allFreeTags.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#bbb', flexShrink: 0 }}>Tags :</span>
          {allFreeTags.map(tag => (
            <button key={tag} onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)} style={{
              padding: '3px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
              border: '0.5px solid ' + (activeTagFilter === tag ? '#888' : '#e0e0e0'),
              background: activeTagFilter === tag ? '#F0F0EC' : 'white',
              color: activeTagFilter === tag ? '#333' : '#999', fontWeight: activeTagFilter === tag ? '500' : '400'
            }}>#{tag}</button>
          ))}
          {activeTagFilter && (
            <button onClick={() => setActiveTagFilter(null)} style={{ fontSize: '11px', color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>effacer</button>
          )}
        </div>
      )}
      {allFreeTags.length === 0 && <div style={{ marginBottom: '16px' }} />}

      {/* ── Grille ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Chargement...</div>
      ) : filteredAndSorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🍽</div>
          <p style={{ fontWeight: '500' }}>Aucune recette trouvée</p>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>Importe une URL ou crée ta première recette !</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {filteredAndSorted.map(r => (
            <div key={r.id} onClick={() => openDetail(r)}
              style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#5DCAA5'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e0e0e0'}>
              {/* Vignette : photo réelle ou emoji */}
              {r.photo_url ? (
                <img src={r.photo_url} alt={r.title} style={{ width: '100%', height: '110px', objectFit: 'cover', display: 'block' }} onError={e => e.target.style.display = 'none'} />
              ) : (
                <div style={{ height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', background: '#fafaf8' }}>{r.emoji}</div>
              )}
              <div style={{ padding: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>{r.title}</div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {(r.cats || []).slice(0, 2).map(cat => TAG[cat] && (
                    <span key={cat} style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '500', background: TAG[cat].bg, color: TAG[cat].color }}>{TAG[cat].label}</span>
                  ))}
                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', background: '#f0f0ec', color: '#888' }}>{r.time} min</span>
                  {r.cost > 0 && <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', background: '#FAEEDA', color: '#854F0B' }}>~{r.cost} CHF</span>}
                  {r.servings > 0 && <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', background: '#f0f0ec', color: '#888' }}>👥 {r.servings}</span>}
                </div>
                {(r.tags || []).length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '5px' }}>
                    {r.tags.map(t => <span key={t} style={{ padding: '1px 7px', borderRadius: '10px', fontSize: '10px', background: '#F0F0EC', color: '#666', border: '0.5px solid #e0e0e0' }}>#{t}</span>)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Import URL ── */}
      {showImport && (
        <div style={{ ...overlay, alignItems: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '480px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '6px' }}>Importer une recette par URL</h3>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '1rem' }}>L'IA lit la page et extrait automatiquement tous les détails. Tu pourras tout vérifier et corriger avant d'enregistrer.</p>
            <input value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="https://actu.marieclaire.fr/cuisine/..." style={{ ...S.input, marginBottom: '8px' }} />
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

      {/* ── Modal Détail ── */}
      {showDetail && (
        <div style={overlay}>
          <div style={{ ...modalBox, padding: 0, overflow: 'hidden' }}>
            {/* Photo header */}
            {showDetail.photo_url ? (
              <div style={{ position: 'relative' }}>
                <img src={showDetail.photo_url} alt={showDetail.title} style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} />
                <button onClick={() => setShowDetail(null)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.45)', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            ) : (
              <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', background: '#fafaf8', borderBottom: '0.5px solid #f0f0ec' }}>
                <span style={{ fontSize: '36px' }}>{showDetail.emoji}</span>
                <button onClick={() => setShowDetail(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#aaa' }}>✕</button>
              </div>
            )}

            <div style={{ padding: '1.25rem 1.5rem' }}>
              {/* En-tête info */}
              <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '0.5px solid #f0f0ec' }}>
                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>{showDetail.title}</div>
                {showDetail.source && <div style={{ fontSize: '12px', color: '#1D9E75', marginBottom: '6px' }}>{showDetail.source}</div>}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(showDetail.cats || []).map(cat => TAG[cat] && (
                    <span key={cat} style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '500', background: TAG[cat].bg, color: TAG[cat].color }}>{TAG[cat].label}</span>
                  ))}
                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: '#f0f0ec', color: '#888' }}>{showDetail.time} min</span>
                  {showDetail.cost > 0 && (
                    <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: '#FAEEDA', color: '#854F0B' }}>
                      ~{showDetail.cost} CHF {autoCostDetail !== null && autoCostDetail !== showDetail.cost ? '(calculé)' : ''}
                    </span>
                  )}
                </div>
                {(showDetail.tags || []).length > 0 && (
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {showDetail.tags.map(t => <span key={t} style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: '#F0F0EC', color: '#555', border: '0.5px solid #ddd' }}>#{t}</span>)}
                  </div>
                )}
              </div>

              {/* Sélecteur convives */}
              {(showDetail.servings || 0) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem', padding: '8px 12px', background: '#FAFAF8', borderRadius: '10px', border: '0.5px solid #e8e8e4' }}>
                  <span style={{ fontSize: '13px', color: '#666' }}>👥 Convives :</span>
                  <button onClick={() => setDetailServings(s => Math.max(1, s - 1))} style={{ width: '26px', height: '26px', borderRadius: '50%', border: '0.5px solid #ccc', background: 'white', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', flexShrink: 0 }}>−</button>
                  <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: '600', fontSize: '14px', color: '#1D9E75' }}>{detailServings}</span>
                  <button onClick={() => setDetailServings(s => s + 1)} style={{ width: '26px', height: '26px', borderRadius: '50%', border: '0.5px solid #ccc', background: 'white', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', flexShrink: 0 }}>+</button>
                  {detailServings !== showDetail.servings && (
                    <>
                      <button onClick={() => setDetailServings(showDetail.servings)} style={{ fontSize: '11px', color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>reset ({showDetail.servings})</button>
                      <span style={{ fontSize: '11px', color: '#1D9E75', marginLeft: 'auto' }}>Quantités adaptées ✓</span>
                    </>
                  )}
                </div>
              )}

              {/* Ingrédients */}
              {scaledIngredients.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>Ingrédients</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {scaledIngredients.map((ing, i) => {
                      const priceEntry = priceMap[ing.name?.toLowerCase()]
                      const linePrice = priceEntry ? parseFloat((parseFloat(ing.qty) * priceEntry.price_per_unit).toFixed(2)) : null
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: '#fafaf8', borderRadius: '8px', fontSize: '13px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1D9E75', flexShrink: 0 }} />
                          <span style={{ flex: 1 }}>{ing.qty} {ing.unit} {ing.name}</span>
                          {linePrice !== null && <span style={{ fontSize: '10px', color: '#854F0B', flexShrink: 0 }}>{linePrice} CHF</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Étapes */}
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
                <a href={showDetail.url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#1D9E75', display: 'block', marginBottom: '1rem', wordBreak: 'break-all' }}>🔗 Voir la recette originale</a>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '0.5px solid #f0f0ec' }}>
                <button onClick={() => setConfirmDelete(showDetail)} style={{ background: 'none', border: '0.5px solid #E24B4A', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer', color: '#E24B4A' }}>Supprimer</button>
                <button onClick={() => openEdit(showDetail)} style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>✏️ Modifier</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Édition ── */}
      {showEdit && (
        <div style={overlay}>
          <div style={modalBox}>
            <h3 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '1.25rem' }}>
              {editingId ? '✏️ Modifier la recette' : '+ Nouvelle recette'}
            </h3>

            {/* Emoji */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Emoji</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))} style={{ fontSize: '20px', padding: '4px 8px', borderRadius: '8px', cursor: 'pointer', border: '0.5px solid ' + (form.emoji === e ? '#1D9E75' : '#ddd'), background: form.emoji === e ? '#E1F5EE' : 'white' }}>{e}</button>
                ))}
              </div>
            </div>

            {/* Photo */}
            <PhotoUpload
              currentUrl={form.photo_url}
              userId={user.id}
              onUploaded={url => setForm(f => ({ ...f, photo_url: url }))}
            />

            {/* Nom */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Nom de la recette *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex : Tarte tatin aux pommes" style={S.input} />
            </div>

            {/* Source + URL */}
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

            {/* Temps · Coût · Personnes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Temps (min)</label>
                <input type="number" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} placeholder="45" style={S.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>
                  Coût (CHF)
                  {computeCostFromPrices(form.ingredients, priceMap) !== null && (
                    <span style={{ color: '#1D9E75', marginLeft: '4px', fontWeight: '400' }}>↻ auto</span>
                  )}
                </label>
                <input type="number" value={computeCostFromPrices(form.ingredients, priceMap) ?? form.cost}
                  readOnly={computeCostFromPrices(form.ingredients, priceMap) !== null}
                  onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="12"
                  style={{ ...S.input, background: computeCostFromPrices(form.ingredients, priceMap) !== null ? '#E1F5EE' : '#fafaf8', color: computeCostFromPrices(form.ingredients, priceMap) !== null ? '#0F6E56' : 'inherit' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Pour X personnes</label>
                <input type="number" min="1" max="50" value={form.servings} onChange={e => setForm(f => ({ ...f, servings: e.target.value }))} placeholder="4" style={S.input} />
              </div>
            </div>

            {/* Catégories */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Catégories</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => toggleCat(cat)} style={{ padding: '4px 12px', borderRadius: '14px', fontSize: '12px', cursor: 'pointer', border: '0.5px solid ' + (form.cats.includes(cat) ? '#5DCAA5' : '#ddd'), background: form.cats.includes(cat) ? '#E1F5EE' : 'white', color: form.cats.includes(cat) ? '#0F6E56' : '#888' }}>{cat}</button>
                ))}
              </div>
            </div>

            {/* Tags libres */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
                Tags personnalisés <span style={{ color: '#bbb', fontWeight: '400' }}>Entrée ou , pour valider</span>
              </label>
              <TagsInput tags={form.tags} onChange={tags => setForm(f => ({ ...f, tags }))} />
            </div>

            {/* Ingrédients */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: '#666' }}>Ingrédients</label>
                <button onClick={addIngredient} style={{ fontSize: '12px', color: '#1D9E75', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>+ Ajouter</button>
              </div>
              {form.ingredients.map((ing, i) => {
                const priceEntry = priceMap[ing.name?.trim().toLowerCase()]
                const linePrice = priceEntry && ing.qty ? parseFloat((parseFloat(ing.qty) * priceEntry.price_per_unit).toFixed(2)) : null
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr auto', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                    <input value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)} placeholder="Ingrédient" style={S.input} />
                    <input type="number" value={ing.qty} onChange={e => updateIngredient(i, 'qty', e.target.value)} placeholder="Qté" style={S.input} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <select value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)} style={S.input}>
                        {UNITES.map(u => <option key={u}>{u}</option>)}
                      </select>
                      {linePrice !== null && <span style={{ fontSize: '10px', color: '#854F0B', textAlign: 'center' }}>~{linePrice} CHF</span>}
                    </div>
                    <button onClick={() => removeIngredient(i)} style={{ background: 'none', border: 'none', color: '#E24B4A', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                  </div>
                )
              })}
              {form.ingredients.length === 0 && <div style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>Aucun ingrédient — clique sur "+ Ajouter"</div>}
            </div>

            {/* Étapes */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: '#666' }}>Étapes de préparation</label>
                <button onClick={addStep} style={{ fontSize: '12px', color: '#1D9E75', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>+ Ajouter</button>
              </div>
              {form.steps.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'flex-start' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#E1F5EE', color: '#0F6E56', fontSize: '11px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '8px' }}>{i + 1}</div>
                  <textarea value={step} onChange={e => updateStep(i, e.target.value)} placeholder={`Étape ${i + 1}...`} rows={2} style={{ ...S.input, resize: 'vertical', flex: 1 }} />
                  <button onClick={() => removeStep(i)} style={{ background: 'none', border: 'none', color: '#E24B4A', cursor: 'pointer', fontSize: '16px', paddingTop: '8px' }}>✕</button>
                </div>
              ))}
              {form.steps.length === 0 && <div style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>Aucune étape — clique sur "+ Ajouter"</div>}
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Notes personnelles / conseils</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Conseils, variantes, astuces personnelles..." rows={3} style={{ ...S.input, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '0.5px solid #f0f0ec' }}>
              <button onClick={() => { setShowEdit(false); setForm(EMPTY_FORM); setEditingId(null) }} style={{ background: 'none', border: '0.5px solid #ddd', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', cursor: 'pointer' }}>Annuler</button>
              <button onClick={saveRecipe} disabled={saving || !form.title.trim()} style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmation suppression ── */}
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

      {/* ── Modal Base de prix ── */}
      {showPriceBase && (
        <PriceBaseModal
          userId={user.id}
          onClose={() => setShowPriceBase(false)}
          onPricesUpdated={onPricesUpdated}
        />
      )}
    </div>
  )
}
