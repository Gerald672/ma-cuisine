import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// --- Constantes ---------------------------------------------------------------

const FILTRES = ['Toutes', 'Végan', 'Végétarien', 'Rapide', 'Économique', 'Dessert', 'Plat principal', 'Accompagnement', 'Air Fryer', 'Apéritif', 'Entrée', 'Healthy', 'Viennoiserie', 'Thermomix', 'Sauce', 'Sans gluten']
const CATEGORIES = ['vegan', 'vegetarien', 'rapide', 'economique', 'dessert', 'plat', 'entree', 'soupe', 'accompagnement', 'airfryer', 'aperitif', 'healthy', 'viennoiserie', 'thermomix', 'sauce', 'sansgluten']
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
  vegan:          { label: 'Végan',         bg: '#EAF3DE', color: '#3B6D11' },
  vegetarien:     { label: 'Végétarien',    bg: '#EAF3DE', color: '#3B6D11' },
  rapide:         { label: 'Rapide',        bg: '#E6F1FB', color: '#185FA5' },
  economique:     { label: 'Éco.',          bg: '#FAEEDA', color: '#854F0B' },
  dessert:        { label: 'Dessert',       bg: '#EEEDFE', color: '#3C3489' },
  plat:           { label: 'Plat',          bg: '#E1F5EE', color: '#085041' },
  entree:         { label: 'Entrée',        bg: '#FAECE7', color: '#712B13' },
  soupe:          { label: 'Soupe',         bg: '#E6F1FB', color: '#0C447C' },
  accompagnement: { label: 'Accomp.',       bg: '#F0FDF4', color: '#166534' },
  airfryer:       { label: 'Air Fryer',     bg: '#FFF7ED', color: '#C2410C' },
  aperitif:       { label: 'Apéritif',      bg: '#FDF4FF', color: '#7E22CE' },
  healthy:        { label: 'Healthy',       bg: '#ECFDF5', color: '#065F46' },
  viennoiserie:   { label: 'Viennoiserie',  bg: '#FFFBEB', color: '#92400E' },
  thermomix:      { label: 'Thermomix',     bg: '#EFF6FF', color: '#1D4ED8' },
  sauce:          { label: 'Sauce',         bg: '#FFF1F2', color: '#9F1239' },
  sansgluten:     { label: 'Sans gluten',   bg: '#F7FEE7', color: '#3F6212' },
}

const EMPTY_FORM = {
  title: '', source: '', url: '', emoji: '🍳',
  time_prep: '', time_cook: '', time: '',
  cost: '', cats: [], tags: [], servings: 4,
  ingredients: [], steps: [], notes: '',
  photo_url: '', nutrition: null,
  rating: 0, cook_count: 0
}


// --- Composant etoiles --------------------------------------------------------

function Stars({ value, onChange, size }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1,2,3,4,5].map(n => (
        <span
          key={n}
          onClick={onChange ? () => onChange(n === value ? 0 : n) : undefined}
          onMouseEnter={onChange ? () => setHover(n) : undefined}
          onMouseLeave={onChange ? () => setHover(0) : undefined}
          style={{
            fontSize: size || '16px',
            cursor: onChange ? 'pointer' : 'default',
            color: n <= (hover || value) ? '#F59E0B' : '#E5E7EB',
            transition: 'color 0.1s',
            userSelect: 'none'
          }}
        >&#9733;</span>
      ))}
    </div>
  )
}


function formatTime(minutes) {
  if (!minutes || minutes <= 0) return ''
  if (minutes < 60) return minutes + ' min'
  var h = Math.floor(minutes / 60)
  var m = minutes % 60
  return m > 0 ? h + 'h' + (m < 10 ? '0' : '') + m : h + 'h'
}

// --- Utilitaires --------------------------------------------------------------

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
 * Calcule le coût d'une recette depuis la priceMap.
 * Retourne null si aucun ingrédient valorisable.
 */
function computeCost(ingredients, priceMap) {
  if (!ingredients?.length || !priceMap) return null
  let total = 0, matched = 0
  for (const ing of ingredients) {
    const key = ing.name?.trim().toLowerCase()
    if (!key) continue
    const entry = priceMap[key]
    if (!entry) continue
    const qty = parseFloat(ing.qty) || 0
    total += qty * entry.price_per_unit
    matched++
  }
  return matched > 0 ? parseFloat(total.toFixed(2)) : null
}


// --- Nutrition ---

function computeNutrition(ingredients, nutMap, baseServings, currentServings) {
  if (!ingredients || !ingredients.length || !nutMap) return null
  var ratio = (baseServings && currentServings) ? currentServings / baseServings : 1
  var cal = 0, prot = 0, gluc = 0, lip = 0, fib = 0, sel = 0, matched = 0
  for (var k = 0; k < ingredients.length; k++) {
    var ing = ingredients[k]
    var key = (ing.name || '').trim().toLowerCase()
    var entry = nutMap[key]
    if (!entry) continue
    var qty = parseFloat(ing.qty || 0) * ratio
    var factor = 0
    if (entry.unit_ref === 'unite') {
      factor = qty
    } else if (ing.unit === 'kg') {
      factor = qty * 1000 / 100
    } else if (ing.unit === 'L') {
      factor = qty * 1000 / 100
    } else {
      factor = qty / 100
    }
    cal  += (entry.calories  || 0) * factor
    prot += (entry.proteines || 0) * factor
    gluc += (entry.glucides  || 0) * factor
    lip  += (entry.lipides   || 0) * factor
    fib  += (entry.fibres    || 0) * factor
    sel  += (entry.sel       || 0) * factor
    matched++
  }
  if (matched === 0) return null
  return {
    calories:  Math.round(cal),
    proteines: parseFloat(prot.toFixed(1)),
    glucides:  parseFloat(gluc.toFixed(1)),
    lipides:   parseFloat(lip.toFixed(1)),
    fibres:    parseFloat(fib.toFixed(1)),
    sel:       parseFloat(sel.toFixed(2)),
  }
}

function printRecipe(recipe, scaledIngredients, convives, nutrition) {
  var ings = (scaledIngredients && scaledIngredients.length ? scaledIngredients : recipe.ingredients || [])
  var ingRows = ings.map(function(i) {
    return '<li style="padding:4px 0;border-bottom:1px solid #f0f0ec;font-size:13px">' + i.qty + ' ' + i.unit + ' ' + i.name + '</li>'
  }).join('')
  var stepRows = (recipe.steps || []).map(function(s, i) {
    return '<li style="padding:6px 0;font-size:13px"><b style="color:#1D9E75">' + (i+1) + '.</b> ' + s + '</li>'
  }).join('')
  var photo = recipe.photo_url
    ? '<img src="' + recipe.photo_url + '" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;margin-bottom:16px;display:block">'
    : ''
  var metaParts = []
  if (recipe.time) metaParts.push(recipe.time + ' min')
  if (convives) metaParts.push(convives + ' pers.')
  if (recipe.cost > 0) metaParts.push('~' + recipe.cost + ' CHF')
  if (recipe.source) metaParts.push(recipe.source)
  var meta = metaParts.join(' - ')
  var nutHtml = ''
  if (nutrition) {
    nutHtml = '<h2>Nutrition / portion</h2>'
      + '<table style="border-collapse:collapse;font-size:12px;width:100%">'
      + '<tr style="background:#f5f5f0">'
      + '<td style="padding:6px 10px;font-weight:600">Calories</td>'
      + '<td style="padding:6px 10px;text-align:right;font-weight:600;color:#1D9E75">' + nutrition.calories + ' kcal</td>'
      + '<td style="padding:6px 10px">Proteines</td>'
      + '<td style="padding:6px 10px;text-align:right">' + nutrition.proteines + ' g</td>'
      + '</tr><tr>'
      + '<td style="padding:6px 10px">Glucides</td>'
      + '<td style="padding:6px 10px;text-align:right">' + nutrition.glucides + ' g</td>'
      + '<td style="padding:6px 10px">Lipides</td>'
      + '<td style="padding:6px 10px;text-align:right">' + nutrition.lipides + ' g</td>'
      + '</tr>'
      + (nutrition.fibres != null ? '<tr style="background:#f5f5f0"><td style="padding:6px 10px">Fibres</td><td style="padding:6px 10px;text-align:right">' + nutrition.fibres + ' g</td><td style="padding:6px 10px">Sel</td><td style="padding:6px 10px;text-align:right">' + nutrition.sel + ' g</td></tr>' : '')
      + '</table>'
  }
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + recipe.title + '</title>'
    + '<style>body{font-family:system-ui,sans-serif;padding:32px;max-width:680px;margin:0 auto}'
    + 'h1{font-size:22px;margin:0 0 6px}.meta{color:#888;font-size:12px;margin-bottom:20px}'
    + 'h2{font-size:14px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:0.04em;margin:20px 0 8px}'
    + 'ul,ol{margin:0;padding:0;list-style:none}table{border-collapse:collapse;width:100%;margin-bottom:12px}'
    + '.notes{background:#FAEEDA;border-radius:8px;padding:10px 14px;font-size:13px;color:#633806;margin-top:16px}'
    + '@media print{button{display:none}}</style></head><body>'
    + photo
    + '<h1>' + (recipe.emoji || '') + ' ' + recipe.title + '</h1>'
    + '<p class="meta">' + meta + '</p>'
    + (ingRows ? '<h2>Ingredients</h2><ul>' + ingRows + '</ul>' : '')
    + nutHtml
    + (stepRows ? '<h2>Preparation</h2><ol>' + stepRows + '</ol>' : '')
    + (recipe.notes ? '<div class="notes"><b>Notes :</b> ' + recipe.notes + '</div>' : '')
    + '<br><button onclick="window.print()" style="padding:8px 16px;background:#1D9E75;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px">Imprimer</button>'
    + '</body></html>'
  var w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
}

function shareRecipeByEmail(recipe, scaledIngredients, convives, nutrition) {
  var ings = (scaledIngredients && scaledIngredients.length ? scaledIngredients : recipe.ingredients || [])
    .map(function(i) { return '  - ' + i.qty + ' ' + i.unit + ' ' + i.name }).join('\n')
  var steps = (recipe.steps || []).map(function(s, i) { return '  ' + (i+1) + '. ' + s }).join('\n')
  var metaParts = []
  if (recipe.time) metaParts.push(recipe.time + ' min')
  if (convives) metaParts.push(convives + ' pers.')
  if (recipe.cost > 0) metaParts.push('~' + recipe.cost + ' CHF')
  var meta = metaParts.join(' - ')
  var nutPart = ''
  if (nutrition) {
    nutPart = 'NUTRITION (par portion)\n'
      + '  Calories: ' + nutrition.calories + ' kcal  |  '
      + 'Proteines: ' + nutrition.proteines + 'g  |  '
      + 'Glucides: ' + nutrition.glucides + 'g  |  '
      + 'Lipides: ' + nutrition.lipides + 'g'
      + (nutrition.fibres != null ? '  |  Fibres: ' + nutrition.fibres + 'g' : '')
      + (nutrition.sel != null ? '  |  Sel: ' + nutrition.sel + 'g' : '')
      + '\n\n'
  }
  var bodyText = (recipe.emoji || '') + ' ' + recipe.title + '\n' + meta + '\n\n'
    + (ings ? 'INGREDIENTS\n' + ings + '\n\n' : '')
    + nutPart
    + (steps ? 'PREPARATION\n' + steps + '\n\n' : '')
    + (recipe.notes ? 'NOTES\n' + recipe.notes + '\n\n' : '')
    + (recipe.url ? 'Source : ' + recipe.url + '\n' : '')
    + '\nEnvoye depuis Ma Cuisine'
  var subject = encodeURIComponent('Recette : ' + recipe.title)
  var body = encodeURIComponent(bodyText)
  window.location.href = 'mailto:?subject=' + subject + '&body=' + body
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

// --- TagsInput ----------------------------------------------------------------

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

// --- PhotoUpload --------------------------------------------------------------

function PhotoUpload({ currentUrl, onUploaded, userId }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(currentUrl || '')
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

  function handleDrop(e) { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }

  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '6px' }}>Photo de la recette</label>
      {preview ? (
        <div style={{ position: 'relative', marginBottom: '6px' }}>
          <img src={preview} alt="Preview" style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '10px', border: '0.5px solid #e0e0e0', display: 'block' }} onError={() => setPreview('')} />
          <button type="button" onClick={() => { setPreview(''); onUploaded('') }}
            style={{ position: 'absolute', top: '7px', right: '7px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      ) : (
        <div onDragOver={e => e.preventDefault()} onDrop={handleDrop} onClick={() => inputRef.current?.click()}
          style={{ border: '1px dashed #ccc', borderRadius: '10px', padding: '22px', textAlign: 'center', cursor: 'pointer', background: '#fafaf8', fontSize: '12px', color: '#aaa', lineHeight: '1.6' }}>
          {uploading ? '⏳ Upload en cours…' : <><span style={{ fontSize: '20px', display: 'block', marginBottom: '4px' }}>📷</span>Cliquer ou glisser une photo ici</>}
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
        </div>
      )}
    </div>
  )
}

// --- PriceBaseModal -----------------------------------------------------------
// Affiche les prix de la BDD (source Migros/Coop/Rapport Agricole) et permet
// des corrections locales par l'utilisateur.

function PriceBaseModal({ userId, onClose, onPricesUpdated }) {
  const [prices, setPrices]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [filterQ, setFilterQ]     = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editPrice, setEditPrice] = useState('')
  const [saving, setSaving]       = useState(false)

  useEffect(() => { loadPrices() }, [])

  async function loadPrices() {
    setLoading(true)
    const { data } = await supabase
      .from('ingredient_prices')
      .select('*')
      .eq('user_id', userId)
      .order('name')
    setPrices(data || [])
    setLoading(false)
  }

  async function updatePrice(id, newVal) {
    const val = parseFloat(newVal)
    if (isNaN(val) || val < 0) return
    setSaving(true)
    await supabase.from('ingredient_prices')
      .update({ price_per_unit: val, updated_at: new Date().toISOString() })
      .eq('id', id)
    setEditingId(null)
    await loadPrices()
    await onPricesUpdated()
    setSaving(false)
  }

  async function resetPrice(p) {
    // "Réinitialiser" = remettre le prix de la source (on stocke original_price si disponible,
    // sinon on indique à l'utilisateur qu'il faut relancer le seed SQL)
    if (!window.confirm(`Réinitialiser "${p.name}" à la valeur source ?`)) return
    if (p.original_price) {
      await supabase.from('ingredient_prices')
        .update({ price_per_unit: p.original_price, updated_at: new Date().toISOString() })
        .eq('id', p.id)
      await loadPrices()
      await onPricesUpdated()
    } else {
      alert('Valeur source non disponible. Relance le seed SQL pour restaurer tous les prix.')
    }
  }

  const displayed = prices.filter(p =>
    !filterQ || p.name.includes(filterQ.toLowerCase())
  )

  const S = { input: { padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#fafaf8', boxSizing: 'border-box' } }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 70, padding: '1rem', overflowY: 'auto' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '560px', marginTop: '1rem', marginBottom: '1rem' }}>

        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '500', margin: 0 }}>💰 Base de prix des ingrédients</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#aaa' }}>✕</button>
        </div>
        <p style={{ fontSize: '12px', color: '#888', marginBottom: '1rem', lineHeight: '1.5' }}>
          Prix en CHF par unité de référence, issus des catalogues <strong>Migros</strong>, <strong>Coop</strong> et du <strong>Rapport Agricole Suisse 2023</strong>.
          Tu peux corriger un prix si ta réalité d'achat est différente — le coût de toutes tes recettes sera recalculé automatiquement.
        </p>

        {/* Recherche */}
        <input
          value={filterQ}
          onChange={e => setFilterQ(e.target.value)}
          placeholder="🔍 Filtrer un ingrédient…"
          style={{ ...S.input, width: '100%', marginBottom: '10px' }}
        />

        {/* Compteur */}
        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '8px' }}>
          {displayed.length} ingrédient{displayed.length !== 1 ? 's' : ''} {filterQ ? 'trouvé·s' : 'au total'}
        </div>

        {/* Liste */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '13px' }}>Chargement…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
            {displayed.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: editingId === p.id ? '#F0FDF4' : '#fafaf8', borderRadius: '8px', border: '0.5px solid ' + (editingId === p.id ? '#5DCAA5' : '#f0f0ec'), transition: 'background 0.15s' }}>
                {/* Nom */}
                <span style={{ flex: 1, fontSize: '13px', fontWeight: '500', color: '#333', textTransform: 'capitalize', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>

                {editingId === p.id ? (
                  <>
                    <input
                      type="number" step="0.00001" min="0"
                      defaultValue={p.price_per_unit}
                      onChange={e => setEditPrice(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') updatePrice(p.id, editPrice || p.price_per_unit); if (e.key === 'Escape') setEditingId(null) }}
                      autoFocus
                      style={{ width: '90px', ...S.input, border: '0.5px solid #1D9E75' }}
                    />
                    <span style={{ fontSize: '11px', color: '#888', flexShrink: 0 }}>CHF / {p.unit}</span>
                    <button onClick={() => updatePrice(p.id, editPrice || p.price_per_unit)} disabled={saving}
                      style={{ padding: '4px 10px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}>✓</button>
                    <button onClick={() => setEditingId(null)}
                      style={{ padding: '4px 8px', background: 'none', border: '0.5px solid #ddd', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#888', flexShrink: 0 }}>✕</button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '13px', color: '#1D9E75', fontWeight: '500', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{p.price_per_unit} CHF</span>
                    <span style={{ fontSize: '11px', color: '#aaa', flexShrink: 0 }}>/ {p.unit}</span>
                    {p.source && <span style={{ fontSize: '10px', color: '#ccc', flexShrink: 0, display: 'none' }} title={p.source}>ℹ</span>}
                    <button onClick={() => { setEditingId(p.id); setEditPrice(String(p.price_per_unit)) }}
                      style={{ padding: '4px 10px', background: 'none', border: '0.5px solid #ddd', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#555', flexShrink: 0 }}>✏️</button>
                  </>
                )}
              </div>
            ))}
            {displayed.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '13px' }}>
                Aucun ingrédient trouvé pour « {filterQ} »
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '0.5px solid #f0f0ec', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', background: 'none', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

// --- Composant principal ------------------------------------------------------

export default function BibliothequePage() {
  const { user } = useAuth()
  const [recipes, setRecipes]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [filtre, setFiltre]               = useState('Toutes')
  const [sortKey, setSortKey]             = useState('alpha_asc')
  const [activeTagFilter, setActiveTagFilter] = useState(null)
  const [showImport, setShowImport]       = useState(false)
  const [showEdit, setShowEdit]           = useState(false)
  const [showDetail, setShowDetail]       = useState(null)
  const [showPriceBase, setShowPriceBase] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [importUrl, setImportUrl]         = useState('')
  const [importing, setImporting]         = useState(false)
  const [importError, setImportError]     = useState('')
  const [form, setForm]                   = useState(EMPTY_FORM)
  const [editingId, setEditingId]         = useState(null)
  const [saving, setSaving]               = useState(false)
  const [detailServings, setDetailServings] = useState(4)
  const [priceMap, setPriceMap]           = useState({})
  const [nutMap, setNutMap]               = useState({})
  const [stockPerimes, setStockPerimes]   = useState([])

  useEffect(() => { loadRecipes(); loadPriceMap(); loadNutMap(); loadStockPerimes() }, [user])

  // -- Chargement -------------------------------------------------------------

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
    return map
  }

  // -- Recalcul de toutes les recettes après changement de prix ---------------

  async function loadNutMap() {
    const { data } = await supabase.from('ingredient_nutrition').select('*')
    const map = {}
    for (const row of (data || [])) map[row.name.toLowerCase()] = row
    setNutMap(map)
  }

  async function loadStockPerimes() {
    var today = new Date(); today.setHours(0,0,0,0)
    var in7 = new Date(today.getTime() + 7 * 86400000)
    var dateStr = in7.toISOString().slice(0, 10)
    var { data } = await supabase
      .from('stock')
      .select('name, peremption')
      .eq('user_id', user.id)
      .not('peremption', 'is', null)
      .lte('peremption', dateStr)
    setStockPerimes((data || []).map(function(s) {
      var days = Math.round((new Date(s.peremption) - today) / 86400000)
      return { name: s.name, days }
    }))
  }

  async function onPricesUpdated() {
    const freshMap = await loadPriceMap()
    const { data: recipeData } = await supabase.from('recipes').select('id, ingredients, cost').eq('user_id', user.id)
    for (const r of (recipeData || [])) {
      const computed = computeCost(r.ingredients || [], freshMap)
      if (computed !== null && Math.abs(computed - (r.cost || 0)) > 0.005) {
        await supabase.from('recipes').update({ cost: computed }).eq('id', r.id)
      }
    }
    await loadRecipes()
  }

  // -- Import URL -------------------------------------------------------------

  async function importFromUrl() {
    if (!importUrl.trim()) return
    setImporting(true); setImportError('')
    try {
      const resp = await fetch('/api/import-recipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: importUrl }) })
      if (!resp.ok) throw new Error()
      const recipe = await resp.json()
      setForm({ title: recipe.title || '', source: recipe.source || '', url: importUrl, emoji: recipe.emoji || '🍳', time: recipe.time || 30, cost: recipe.cost || 0, cats: recipe.cats || [], tags: recipe.tags || [], servings: recipe.servings || 4, ingredients: recipe.ingredients || [], steps: recipe.steps || [], notes: recipe.notes || '', photo_url: recipe.photo_url || '', nutrition: recipe.nutrition || null })
      setShowImport(false); setEditingId(null); setShowEdit(true)
    } catch { setImportError('Impossible d\'analyser cette URL. Tu peux saisir la recette manuellement.') }
    setImporting(false)
  }

  // -- Sauvegarde -------------------------------------------------------------

  async function saveRecipe() {
    if (!form.title.trim()) return
    setSaving(true)
    const autoCost = computeCost(form.ingredients, priceMap)
    const payload = {
      user_id: user.id, title: form.title, source: form.source, url: form.url, emoji: form.emoji,
      time_prep: parseInt(form.time_prep) || null, time_cook: parseInt(form.time_cook) || null,
      time: (parseInt(form.time_prep) || 0) + (parseInt(form.time_cook) || 0) || parseInt(form.time) || 30,
      cost: autoCost !== null ? autoCost : (parseFloat(form.cost) || 0),
      cats: form.cats, tags: form.tags, servings: parseInt(form.servings) || 4,
      ingredients: form.ingredients, steps: form.steps, notes: form.notes, nutrition: form.nutrition || null,
      photo_url: form.photo_url || '', rating: form.rating || 0, cook_count: form.cook_count || 0
    }
    if (editingId) await supabase.from('recipes').update(payload).eq('id', editingId)
    else await supabase.from('recipes').insert(payload)
    setSaving(false); setShowEdit(false); setForm(EMPTY_FORM); setEditingId(null)
    loadRecipes()
  }

  // -- Suppression ------------------------------------------------------------

  async function deleteRecipe(id) {
    await supabase.from('recipes').delete().eq('id', id)
    setConfirmDelete(null); setShowDetail(null); loadRecipes()
  }

  async function rateRecipe(id, rating) {
    await supabase.from('recipes').update({ rating }).eq('id', id)
    setShowDetail(d => d ? { ...d, rating } : d)
    setRecipes(rs => rs.map(r => r.id === id ? { ...r, rating } : r))
  }

  async function cookRecipe(id, delta) {
    const recipe = recipes.find(r => r.id === id)
    if (!recipe) return
    const newCount = Math.max(0, (recipe.cook_count || 0) + delta)
    await supabase.from('recipes').update({ cook_count: newCount }).eq('id', id)
    setShowDetail(d => d ? { ...d, cook_count: newCount } : d)
    setRecipes(rs => rs.map(r => r.id === id ? { ...r, cook_count: newCount } : r))
  }

  // -- Helpers formulaire -----------------------------------------------------

  function openEdit(recipe) {
    setEditingId(recipe.id)
    setForm({ title: recipe.title || '', source: recipe.source || '', url: recipe.url || '', emoji: recipe.emoji || '🍳', time_prep: recipe.time_prep || '', time_cook: recipe.time_cook || '', time: recipe.time || 30, cost: recipe.cost || 0, cats: recipe.cats || [], tags: recipe.tags || [], servings: recipe.servings || 4, ingredients: recipe.ingredients || [], steps: recipe.steps || [], notes: recipe.notes || '', photo_url: recipe.photo_url || '', nutrition: recipe.nutrition || null, rating: recipe.rating || 0, cook_count: recipe.cook_count || 0 })
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

  // -- Données dérivées -------------------------------------------------------

  const allFreeTags = [...new Set(recipes.flatMap(r => r.tags || []))].sort()

  const filteredAndSorted = sortRecipes(
    recipes.filter(r => {
      const matchSearch = r.title.toLowerCase().includes(search.toLowerCase())
      const key = filtre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(' principal', '').replace(' fryer', 'fryer').replace(' gluten', 'gluten').replace(/\s+/g, '')
      const matchFiltre = filtre === 'Toutes' || (r.cats || []).includes(key)
      const matchTag = !activeTagFilter || (r.tags || []).includes(activeTagFilter)
      return matchSearch && matchFiltre && matchTag
    }),
    sortKey
  )

  const scaledIngredients = showDetail
    ? scaleIngredients(showDetail.ingredients || [], showDetail.servings || 4, detailServings)
    : []

  // Coût recalculé pour le détail (sur les quantités adaptées aux convives)
  const autoCostDetail = scaledIngredients.length ? computeCost(scaledIngredients, priceMap) : null

  // Coût recalculé en temps réel dans le formulaire
  const autoCostForm = computeCost(form.ingredients, priceMap)

  const nutritionDetail = showDetail
    ? ((showDetail.nutrition && showDetail.nutrition.calories)
        ? showDetail.nutrition
        : computeNutrition(scaledIngredients, nutMap, showDetail.servings || 4, detailServings))
    : null

  // -- Styles partagés --------------------------------------------------------

  const S = { input: { width: '100%', padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', background: '#fafaf8', color: 'inherit' } }
  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 50, padding: '1rem', overflowY: 'auto' }
  const modalBox = { background: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px', marginTop: '1rem', marginBottom: '1rem', overflow: 'hidden' }

  // -- Rendu ------------------------------------------------------------------

  return (
    <div>

      {/* -- Alerte ingredients perimés -- */}
      {stockPerimes.length > 0 && (
        <div style={{ background: '#FAEEDA', border: '0.5px solid #EF9F27', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#854F0B', marginBottom: '2px' }}>
              Ingredients a utiliser en priorite
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
              {stockPerimes.map(function(s) {
                var urgent = s.days < 0 || s.days <= 3
                return (
                  <span key={s.name}
                    onClick={function() { setSearch(s.name) }}
                    style={{ padding: '2px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', background: urgent ? '#FCEBEB' : '#FAEEDA', color: urgent ? '#791F1F' : '#854F0B', border: '0.5px solid ' + (urgent ? '#E24B4A' : '#EF9F27') }}
                    title="Cliquer pour filtrer les recettes"
                  >
                    {s.name} {s.days < 0 ? '(perime)' : '(' + s.days + 'j)'}
                  </span>
                )
              })}
            </div>
            <div style={{ fontSize: '11px', color: '#854F0B', marginTop: '4px', opacity: 0.7 }}>
              Clique sur un ingredient pour voir les recettes qui l'utilisent
            </div>
          </div>
        </div>
      )}

      {/* -- Barre actions -- */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '160px', position: 'relative' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une recette..."
            style={{ width: '100%', padding: '10px 14px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#fafaf8', boxSizing: 'border-box' }} />
          <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#aaa' }}>
            {filteredAndSorted.length}/{recipes.length}
          </span>
        </div>
        <button onClick={() => setShowPriceBase(true)}
          style={{ background: 'white', color: '#854F0B', border: '0.5px solid #D4A259', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>💰 Prix</button>
        <button onClick={() => { setShowImport(true); setImportError(''); setImportUrl('') }}
          style={{ background: 'white', color: '#1D9E75', border: '0.5px solid #1D9E75', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>🔗 Importer URL</button>
        <button onClick={openNew}
          style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>+ Nouvelle</button>
      </div>

      {/* -- Filtres catégories + sélecteur de tri -- */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'center' }}>
        {FILTRES.map(f => (
          <button key={f} onClick={() => setFiltre(f)} style={{
            padding: '5px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
            border: '0.5px solid ' + (filtre === f ? '#5DCAA5' : '#e0e0e0'),
            background: filtre === f ? '#E1F5EE' : 'white',
            color: filtre === f ? '#0F6E56' : '#888', fontWeight: filtre === f ? '500' : '400'
          }}>{f}</button>
        ))}
        <select value={sortKey} onChange={e => setSortKey(e.target.value)}
          style={{ marginLeft: 'auto', padding: '5px 10px', borderRadius: '8px', border: '0.5px solid #e0e0e0', fontSize: '12px', background: 'white', color: '#555', outline: 'none', cursor: 'pointer' }}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* -- Tags libres -- */}
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
          {activeTagFilter && <button onClick={() => setActiveTagFilter(null)} style={{ fontSize: '11px', color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>effacer</button>}
        </div>
      )}
      {allFreeTags.length === 0 && <div style={{ marginBottom: '16px' }} />}

      {/* -- Grille -- */}
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
              {r.photo_url
                ? <img src={r.photo_url} alt={r.title} style={{ width: '100%', height: '110px', objectFit: 'cover', display: 'block' }} onError={e => e.target.style.display = 'none'} />
                : <div style={{ height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', background: '#fafaf8' }}>{r.emoji}</div>
              }
              <div style={{ padding: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>{r.title}</div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {(r.cats || []).slice(0, 2).map(cat => TAG[cat] && (
                    <span key={cat} style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '500', background: TAG[cat].bg, color: TAG[cat].color }}>{TAG[cat].label}</span>
                  ))}
                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', background: '#f0f0ec', color: '#888' }}>{formatTime(r.time)}</span>
                  {r.cost > 0 && <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', background: '#FAEEDA', color: '#854F0B' }}>~{r.cost} CHF</span>}
                  {r.servings > 0 && <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', background: '#f0f0ec', color: '#888' }}>👥 {r.servings}</span>}
                </div>
                {(r.tags || []).length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '5px' }}>
                    {r.tags.map(t => <span key={t} style={{ padding: '1px 7px', borderRadius: '10px', fontSize: '10px', background: '#F0F0EC', color: '#666', border: '0.5px solid #e0e0e0' }}>#{t}</span>)}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  {r.rating > 0 && <Stars value={r.rating} size="13px" />}
                  {r.cook_count > 0 && <span style={{ fontSize: '10px', color: '#aaa' }}>cuisine {r.cook_count}x</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -- Modal Import URL -- */}
      {showImport && (
        <div style={{ ...overlay, alignItems: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '480px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '6px' }}>Importer une recette par URL</h3>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '1rem' }}>L'IA lit la page et extrait automatiquement tous les détails.</p>
            <input value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="https://..." style={{ ...S.input, marginBottom: '8px' }} />
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

      {/* -- Modal Détail -- */}
      {showDetail && (
        <div style={overlay}>
          <div style={modalBox}>
            {/* Bannière photo */}
            {showDetail.photo_url ? (
              <div style={{ position: 'relative' }}>
                <img src={showDetail.photo_url} alt={showDetail.title} style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} />
                <button onClick={() => setShowDetail(null)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.45)', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', background: '#fafaf8', borderBottom: '0.5px solid #f0f0ec' }}>
                <span style={{ fontSize: '36px' }}>{showDetail.emoji}</span>
                <button onClick={() => setShowDetail(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#aaa' }}>✕</button>
              </div>
            )}

            <div style={{ padding: '1.25rem 1.5rem' }}>
              {/* Titre + méta */}
              <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '0.5px solid #f0f0ec' }}>
                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>{showDetail.title}</div>
                {showDetail.source && <div style={{ fontSize: '12px', color: '#1D9E75', marginBottom: '6px' }}>{showDetail.source}</div>}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(showDetail.cats || []).map(cat => TAG[cat] && (
                    <span key={cat} style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '500', background: TAG[cat].bg, color: TAG[cat].color }}>{TAG[cat].label}</span>
                  ))}
                  {showDetail.time_prep > 0 && <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: '#f0f0ec', color: '#888' }}>Prep. {formatTime(showDetail.time_prep)}</span>}
                  {showDetail.time_cook > 0 && <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: '#f0f0ec', color: '#888' }}>Cuisson {formatTime(showDetail.time_cook)}</span>}
                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: '#f0f0ec', color: '#888' }}>Total {formatTime(showDetail.time)}</span>
                  {autoCostDetail !== null
                    ? <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: '#E1F5EE', color: '#0F6E56', fontWeight: '500' }}>~{autoCostDetail} CHF <span style={{ fontWeight: '400', opacity: 0.7 }}>calculé</span></span>
                    : showDetail.cost > 0 && <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: '#FAEEDA', color: '#854F0B' }}>~{showDetail.cost} CHF</span>
                  }
                </div>
                {(showDetail.tags || []).length > 0 && (
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {showDetail.tags.map(t => <span key={t} style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: '#F0F0EC', color: '#555', border: '0.5px solid #ddd' }}>#{t}</span>)}
                  </div>
                )}
              </div>

              {/* Notation et compteur */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#fafaf8', borderRadius: '10px', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Stars value={showDetail.rating || 0} onChange={rating => rateRecipe(showDetail.id, rating)} size="20px" />
                  {showDetail.rating > 0 && <span style={{ fontSize: '11px', color: '#aaa' }}>{['','Pas top','Bof','Bien','Tres bien','Excellent !'][showDetail.rating]}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#888' }}>
                    Cuisine {showDetail.cook_count || 0} fois
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {(showDetail.cook_count || 0) > 0 && (
                      <button onClick={() => cookRecipe(showDetail.id, -1)}
                        style={{ width: '24px', height: '24px', background: 'none', color: '#aaa', border: '0.5px solid #ddd', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                    )}
                    <button onClick={() => cookRecipe(showDetail.id, +1)}
                      style={{ padding: '5px 10px', background: '#E1F5EE', color: '#0F6E56', border: '0.5px solid #5DCAA5', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>
                      + J'ai cuisine
                    </button>
                  </div>
                </div>
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

              {/* Ingrédients avec prix unitaires */}
              {scaledIngredients.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>Ingrédients</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {scaledIngredients.map((ing, i) => {
                      const entry = priceMap[ing.name?.toLowerCase()]
                      const linePrice = entry ? parseFloat((parseFloat(ing.qty || 0) * entry.price_per_unit).toFixed(2)) : null
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: '#fafaf8', borderRadius: '8px', fontSize: '13px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1D9E75', flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0 }}>{ing.qty} {ing.unit} {ing.name}</span>
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

              {nutritionDetail && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                    Nutrition <span style={{ fontWeight: '400', textTransform: 'none' }}>/ portion</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    {[
                      { label: 'Calories',  value: nutritionDetail.calories,  unit: 'kcal', hi: true },
                      { label: 'Proteines', value: nutritionDetail.proteines, unit: 'g' },
                      { label: 'Glucides',  value: nutritionDetail.glucides,  unit: 'g' },
                      { label: 'Lipides',   value: nutritionDetail.lipides,   unit: 'g' },
                      nutritionDetail.fibres != null ? { label: 'Fibres', value: nutritionDetail.fibres, unit: 'g' } : null,
                      nutritionDetail.sel    != null ? { label: 'Sel',    value: nutritionDetail.sel,    unit: 'g' } : null,
                    ].filter(Boolean).map(item => (
                      <div key={item.label} style={{ background: item.hi ? '#E1F5EE' : '#fafaf8', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>{item.label}</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: item.hi ? '#0F6E56' : '#333' }}>{item.value}</div>
                        <div style={{ fontSize: '10px', color: '#aaa' }}>{item.unit}</div>
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

              {/* Notation et compteur */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#fafaf8', borderRadius: '10px', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#666' }}>Note :</span>
                  <Stars value={showDetail.rating || 0} onChange={rating => rateRecipe(showDetail.id, rating)} size="22px" />
                  {showDetail.rating > 0 && <span style={{ fontSize: '11px', color: '#aaa' }}>{['','Pas top','Bof','Bien','Tres bien','Excellent !'][showDetail.rating]}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {showDetail.cook_count > 0 && <span style={{ fontSize: '12px', color: '#888' }}>Cuisine {showDetail.cook_count} fois</span>}
                  <button onClick={() => cookRecipe(showDetail.id)}
                    style={{ padding: '6px 12px', background: '#E1F5EE', color: '#0F6E56', border: '0.5px solid #5DCAA5', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>
                    + J'ai cuisine cette recette
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '0.5px solid #f0f0ec', flexWrap: 'wrap' }}>
                <button onClick={() => setConfirmDelete(showDetail)} style={{ background: 'none', border: '0.5px solid #E24B4A', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer', color: '#E24B4A' }}>Supprimer</button>
                <button onClick={() => shareRecipeByEmail(showDetail, scaledIngredients, detailServings, nutritionDetail)} style={{ background: 'none', border: '0.5px solid #ddd', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer', color: '#555' }}>✉️ Partager</button>
                <button onClick={() => printRecipe(showDetail, scaledIngredients, detailServings, nutritionDetail)} style={{ background: 'none', border: '0.5px solid #ddd', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer', color: '#555' }}>🖨️ Imprimer</button>
                <button onClick={() => openEdit(showDetail)} style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>✏️ Modifier</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -- Modal Édition -- */}
      {showEdit && (
        <div style={overlay}>
          <div style={{ ...modalBox, padding: '1.5rem' }}>
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
            <PhotoUpload currentUrl={form.photo_url} userId={user.id} onUploaded={url => setForm(f => ({ ...f, photo_url: url }))} />

            {/* Nom */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Nom de la recette *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex : Tarte tatin aux pommes" style={S.input} />
            </div>

            {/* Source + URL */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Source</label>
                <input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="Ex : Marmiton" style={S.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>URL originale</label>
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." style={S.input} />
              </div>
            </div>

            {/* Temps prep + cuisson + Coût + Personnes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Prep. (min)</label>
                <input type="number" value={form.time_prep} onChange={e => setForm(f => ({ ...f, time_prep: e.target.value }))} placeholder="15" style={S.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Cuisson (min)</label>
                <input type="number" value={form.time_cook} onChange={e => setForm(f => ({ ...f, time_cook: e.target.value }))} placeholder="30" style={S.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>
                  Coût (CHF)
                  {autoCostForm !== null && <span style={{ color: '#1D9E75', marginLeft: '4px', fontWeight: '400' }}>↻ auto</span>}
                </label>
                <input
                  type="number"
                  value={autoCostForm !== null ? autoCostForm : form.cost}
                  readOnly={autoCostForm !== null}
                  onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                  placeholder="12"
                  style={{ ...S.input, background: autoCostForm !== null ? '#E1F5EE' : '#fafaf8', color: autoCostForm !== null ? '#0F6E56' : 'inherit' }}
                />
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

            {/* Tags */}
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
                const entry = priceMap[ing.name?.trim().toLowerCase()]
                const linePrice = entry && ing.qty ? parseFloat((parseFloat(ing.qty) * entry.price_per_unit).toFixed(2)) : null
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr auto', gap: '6px', marginBottom: '6px', alignItems: 'start' }}>
                    <input value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)} placeholder="Ingrédient" style={S.input} />
                    <input type="number" value={ing.qty} onChange={e => updateIngredient(i, 'qty', e.target.value)} placeholder="Qté" style={S.input} />
                    <div>
                      <select value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)} style={S.input}>{UNITES.map(u => <option key={u}>{u}</option>)}</select>
                      {linePrice !== null && <div style={{ fontSize: '10px', color: '#854F0B', textAlign: 'center', marginTop: '2px' }}>~{linePrice} CHF</div>}
                    </div>
                    <button onClick={() => removeIngredient(i)} style={{ background: 'none', border: 'none', color: '#E24B4A', cursor: 'pointer', fontSize: '16px', paddingTop: '6px' }}>✕</button>
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
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Notes personnelles / conseils</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Conseils, variantes, astuces personnelles..." rows={3} style={{ ...S.input, resize: 'vertical' }} />
            </div>

            {/* Nutrition */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: '#666' }}>
                  Nutrition par portion <span style={{ fontWeight: '400', color: '#aaa' }}>(optionnel)</span>
                </label>
                {form.nutrition && form.nutrition.calories && (
                  <button type="button" onClick={() => setForm(f => ({ ...f, nutrition: null }))}
                    style={{ fontSize: '11px', color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                    Effacer
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                {[
                  { key: 'calories',  label: 'Calories (kcal)', placeholder: '350' },
                  { key: 'proteines', label: 'Proteines (g)',    placeholder: '12'  },
                  { key: 'glucides',  label: 'Glucides (g)',     placeholder: '45'  },
                  { key: 'lipides',   label: 'Lipides (g)',      placeholder: '8'   },
                  { key: 'fibres',    label: 'Fibres (g)',       placeholder: '3'   },
                  { key: 'sel',       label: 'Sel (g)',          placeholder: '0.5' },
                ].map(field => (
                  <div key={field.key}>
                    <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '2px' }}>{field.label}</label>
                    <input
                      type="number" step="0.1" min="0"
                      value={(form.nutrition && form.nutrition[field.key] != null) ? form.nutrition[field.key] : ''}
                      onChange={e => {
                        const val = e.target.value === '' ? null : parseFloat(e.target.value)
                        setForm(f => ({ ...f, nutrition: { ...(f.nutrition || {}), [field.key]: val } }))
                      }}
                      placeholder={field.placeholder}
                      style={{ ...S.input, padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '10px', color: '#bbb', marginTop: '4px' }}>
                Rempli automatiquement lors de l'import. Laisse vide pour le calcul auto.
              </p>
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

      {/* -- Modal Confirmation suppression -- */}
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

      {/* -- Modal Base de prix -- */}
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
