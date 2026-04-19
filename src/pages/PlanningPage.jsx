import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const REPAS = ['Petit-dejeuner', 'Diner', 'Souper']
const REPAS_LABEL = { 'Petit-dejeuner': 'Petit-dejeuner', 'Diner': 'Diner', 'Souper': 'Souper' }
const REPAS_ICON  = { 'Petit-dejeuner': 'cafe', 'Diner': 'assiette', 'Souper': 'lune' }
const REPAS_EMOJI = { 'Petit-dejeuner': 'Petit-dejeuner', 'Diner': 'Diner', 'Souper': 'Souper' }

const CAT_STYLE = {
  'Epicerie':          { bg: '#E6F1FB', color: '#185FA5' },
  'Frais':             { bg: '#EAF3DE', color: '#3B6D11' },
  'Fruits legumes':    { bg: '#E1F5EE', color: '#085041' },
  'Produits laitiers': { bg: '#FAEEDA', color: '#854F0B' },
  'Viande poisson':    { bg: '#FAECE7', color: '#712B13' },
  'Autres':            { bg: '#f0f0ec', color: '#666' },
}

const ING_CATS = {
  'farine': 'Epicerie', 'sucre': 'Epicerie', 'riz': 'Epicerie', 'pates': 'Epicerie',
  'huile': 'Epicerie', 'bouillon': 'Epicerie',
  'lait': 'Produits laitiers', 'beurre': 'Produits laitiers', 'creme': 'Produits laitiers',
  'fromage': 'Produits laitiers', 'parmesan': 'Produits laitiers', 'gruyere': 'Produits laitiers',
  'oeuf': 'Frais', 'menthe': 'Frais', 'basilic': 'Frais', 'thym': 'Frais', 'persil': 'Frais',
  'champignon': 'Fruits legumes', 'oignon': 'Fruits legumes', 'ail': 'Fruits legumes',
  'tomate': 'Fruits legumes', 'carotte': 'Fruits legumes', 'pomme': 'Fruits legumes',
  'poulet': 'Viande poisson', 'boeuf': 'Viande poisson', 'saumon': 'Viande poisson',
}

function getCat(name) {
  const lower = (name || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const [key, cat] of Object.entries(ING_CATS)) {
    if (lower.includes(key)) return cat
  }
  return 'Autres'
}


function getSemaineFromDate(dateStr) {
  if (!dateStr) return null
  // Parser la date sans conversion timezone (YYYY-MM-DD)
  var parts = dateStr.split('-')
  if (parts.length !== 3) return null
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  var day = d.getDay() || 7 // 1=lundi, 7=dimanche
  d.setDate(d.getDate() - day + 1)
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

function getLundi(offset) {
  var d = new Date()
  var day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1 + (offset || 0) * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(date) {
  return date.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })
}

function weekKey(lundi) {
  return lundi.getFullYear() + '-' +
    String(lundi.getMonth() + 1).padStart(2, '0') + '-' +
    String(lundi.getDate()).padStart(2, '0')
}

// plan structure:
// {
//   jourIndex: {
//     repas: {
//       id: uuid,           // meal_plan row id
//       convives: number,
//       invites: string[],
//       recipes: [{ id: uuid, recipe_id: uuid, position: number }]
//     }
//   }
// }

export default function PlanningPage() {
  const { user } = useAuth()
  const [recipes, setRecipes]         = useState([])
  const [stock, setStock]             = useState([])
  const [plan, setPlan]               = useState({})
  const [weekOffset, setWeekOffset]   = useState(0)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [showCourses, setShowCourses] = useState(false)

  // Picker de recette
  const [picker, setPicker]           = useState(null) // { jourIndex, repas }
  const [pickerSearch, setPickerSearch] = useState('')

  // Invites
  const [showInvites, setShowInvites] = useState(null) // { jourIndex, repas }
  const [inviteInput, setInviteInput] = useState('')

  // Carnet d'invites - 3 onglets
  const [showCarnet, setShowCarnet]         = useState(false)
  const [carnetOnglet, setCarnetOnglet]     = useState('invites') // 'invites' | 'invitations' | 'restaurants'
  const [carnet, setCarnet]                 = useState([])
  const [carnetSearch, setCarnetSearch]     = useState('')

  // Invitations recues
  const [invitations, setInvitations]       = useState([])
  const [showFormInvit, setShowFormInvit]   = useState(false)
  const [editInvit, setEditInvit]           = useState(null)
  const [formInvit, setFormInvit]           = useState({ hote: '', date: '', menu: '', notes: '', jour_index: '', repas: '' })

  // Restaurants
  const [restaurants, setRestaurants]       = useState([])
  const [showFormResto, setShowFormResto]   = useState(false)
  const [editResto, setEditResto]           = useState(null)
  const [formResto, setFormResto]           = useState({ nom: '', adresse: '', date: '', menu: '', prix: '', note: 0, avis: '', jour_index: '', repas: '' })
  const [restoSearch, setRestoSearch]       = useState('')

  // Plat libre (sans recette)
  const [showPlatLibre, setShowPlatLibre] = useState(null) // { jourIndex, repas }
  const [platLibreInput, setPlatLibreInput] = useState('')

  // Drag & drop copie
  const [dragSrc, setDragSrc] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  // Shopping list
  const [shoppingIds, setShoppingIds] = useState(new Set()) // meal_plan ids ajoutes aux courses

  const lundi = getLundi(weekOffset)
  const wKey  = weekKey(lundi)

  useEffect(() => { loadAll() }, [user])
  useEffect(() => { loadPlan() }, [wKey, user])
  useEffect(() => { if (showCarnet) loadCarnet() }, [showCarnet, user])
  useEffect(() => { loadInvitations(); loadRestaurants() }, [wKey, user])
  useEffect(() => { loadInvitations(); loadRestaurants() }, [user])
  useEffect(() => { loadShoppingList() }, [user])

  async function loadAll() {
    var [r, s] = await Promise.all([
      supabase.from('recipes').select('*').eq('user_id', user.id),
      supabase.from('stock').select('*').eq('user_id', user.id)
    ])
    setRecipes(r.data || [])
    setStock(s.data || [])
    setLoading(false)
  }

  async function loadPlan() {
    // Charger les slots (convives, invites) et les recipes du slot
    var { data: slots } = await supabase
      .from('meal_plan')
      .select('*, meal_plan_recipes(*)')
      .eq('user_id', user.id)
      .eq('week_start', wKey)

    var p = {}
    for (var slot of (slots || [])) {
      if (!p[slot.jour_index]) p[slot.jour_index] = {}
      p[slot.jour_index][slot.repas] = {
        id: slot.id,
        convives: slot.convives || 2,
        invites: slot.invites || [],
        recipes: (slot.meal_plan_recipes || []).sort(function(a, b) { return a.position - b.position })
      }
    }
    setPlan(p)
  }

  async function loadCarnet() {
    // Charger tous les slots avec invites non vides + leurs recettes
    var { data: slots } = await supabase
      .from('meal_plan')
      .select('*, meal_plan_recipes(*)')
      .eq('user_id', user.id)
      .not('invites', 'eq', '{}')
      .order('week_start', { ascending: false })

    var personMap = {}
    for (var slot of (slots || [])) {
      if (!slot.invites || !slot.invites.length) continue
      for (var invite of slot.invites) {
        if (!personMap[invite]) personMap[invite] = []
        personMap[invite].push({
          date: slot.week_start,
          jour: JOURS[slot.jour_index],
          repas: slot.repas,
          recipe_ids: (slot.meal_plan_recipes || []).map(function(r) { return r.recipe_id }),
          notes: (slot.meal_plan_recipes || []).filter(function(r) { return r.note }).map(function(r) { return '* ' + r.note })
        })
      }
    }
    setCarnet(Object.entries(personMap).map(function(e) { return { name: e[0], repas: e[1] } }))
  }

  async function loadShoppingList() {
    var { data } = await supabase.from('shopping_list').select('meal_plan_id').eq('user_id', user.id)
    setShoppingIds(new Set((data || []).map(function(r) { return r.meal_plan_id })))
  }

  async function addSlotToShopping(jourIndex, repas) {
    var slot = plan[jourIndex]?.[repas]
    if (!slot) return
    var { error } = await supabase.from('shopping_list').upsert({
      user_id: user.id,
      meal_plan_id: slot.id
    }, { onConflict: 'user_id,meal_plan_id' })
    if (!error) setShoppingIds(function(s) { var n = new Set(s); n.add(slot.id); return n })
  }

  async function removeSlotFromShopping(slotId) {
    await supabase.from('shopping_list').delete().eq('user_id', user.id).eq('meal_plan_id', slotId)
    setShoppingIds(function(s) { var n = new Set(s); n.delete(slotId); return n })
  }

  async function addWeekToShopping() {
    var toAdd = []
    for (var ji = 0; ji < 7; ji++) {
      for (var repas of REPAS) {
        var slot = plan[ji]?.[repas]
        if (slot && slot.recipes && slot.recipes.length > 0) toAdd.push(slot.id)
      }
    }
    if (toAdd.length === 0) return
    var rows = toAdd.map(function(id) { return { user_id: user.id, meal_plan_id: id } })
    await supabase.from('shopping_list').upsert(rows, { onConflict: 'user_id,meal_plan_id' })
    setShoppingIds(function(s) { var n = new Set(s); toAdd.forEach(function(id) { n.add(id) }); return n })
  }

  async function loadInvitations() {
    var { data } = await supabase.from('invitations_recues').select('*').eq('user_id', user.id).order('date', { ascending: false })
    setInvitations(data || [])
  }

  async function saveInvitation() {
    if (!formInvit.hote.trim() || !formInvit.date) return
    var payload = { user_id: user.id, hote: formInvit.hote, date: formInvit.date, menu: formInvit.menu, notes: formInvit.notes, jour_index: formInvit.jour_index !== '' ? parseInt(formInvit.jour_index) : null, repas: formInvit.repas || null, semaine: getSemaineFromDate(formInvit.date) || wKey }
    if (editInvit) {
      await supabase.from('invitations_recues').update(payload).eq('id', editInvit.id)
    } else {
      await supabase.from('invitations_recues').insert(payload)
    }
    setShowFormInvit(false); setEditInvit(null); setFormInvit({ hote: '', date: '', menu: '', notes: '', jour_index: '', repas: '' })
    loadInvitations()
  }

  async function deleteInvitation(id) {
    await supabase.from('invitations_recues').delete().eq('id', id)
    loadInvitations()
  }

  async function loadRestaurants() {
    var { data } = await supabase.from('restaurants').select('*').eq('user_id', user.id).order('date', { ascending: false })
    setRestaurants(data || [])
  }

  async function saveRestaurant() {
    if (!formResto.nom.trim()) return
    var payload = { user_id: user.id, nom: formResto.nom, adresse: formResto.adresse, date: formResto.date || null, menu: formResto.menu, prix: parseFloat(formResto.prix) || null, note: formResto.note || 0, avis: formResto.avis, jour_index: formResto.jour_index !== '' ? parseInt(formResto.jour_index) : null, repas: formResto.repas || null, semaine: getSemaineFromDate(formResto.date) || wKey }
    if (editResto) {
      await supabase.from('restaurants').update(payload).eq('id', editResto.id)
    } else {
      await supabase.from('restaurants').insert(payload)
    }
    setShowFormResto(false); setEditResto(null); setFormResto({ nom: '', adresse: '', date: '', menu: '', prix: '', note: 0, avis: '', jour_index: '', repas: '' })
    loadRestaurants()
  }

  async function deleteRestaurant(id) {
    await supabase.from('restaurants').delete().eq('id', id)
    loadRestaurants()
  }

  var recipeMap = {}
  recipes.forEach(function(r) { recipeMap[r.id] = r })

  // -- Gestion slot -------------------------------------------------------------

  async function ensureSlot(jourIndex, repas) {
    // Retourne l'id du slot, le cree si inexistant
    var existing = plan[jourIndex]?.[repas]
    if (existing) return existing.id
    var { data } = await supabase.from('meal_plan').insert({
      user_id: user.id,
      week_start: wKey,
      jour_index: jourIndex,
      repas: repas,
      convives: 2,
      invites: []
    }).select().single()
    return data.id
  }

  async function addRecipeToSlot(jourIndex, repas, recipeId) {
    setSaving(true)
    var slotId = await ensureSlot(jourIndex, repas)
    var existing = plan[jourIndex]?.[repas]
    var position = existing ? (existing.recipes || []).length : 0
    await supabase.from('meal_plan_recipes').insert({
      meal_plan_id: slotId,
      recipe_id: recipeId,
      position: position
    })
    await loadPlan()
    setSaving(false)
    setPicker(null)
    setPickerSearch('')
  }

  async function removeRecipeFromSlot(jourIndex, repas, mprId) {
    await supabase.from('meal_plan_recipes').delete().eq('id', mprId)
    // Si plus de recettes dans le slot, supprimer le slot
    var slot = plan[jourIndex]?.[repas]
    if (slot && slot.recipes.length <= 1) {
      await supabase.from('meal_plan').delete().eq('id', slot.id)
    }
    await loadPlan()
  }

  async function addPlatLibre(jourIndex, repas, nom) {
    if (!nom.trim()) return
    setSaving(true)
    var slotId = await ensureSlot(jourIndex, repas)
    var existing = plan[jourIndex]?.[repas]
    var position = existing ? (existing.recipes || []).length : 0
    // On stocke les plats libres comme des meal_plan_recipes sans recipe_id mais avec note
    await supabase.from('meal_plan_recipes').insert({
      meal_plan_id: slotId,
      recipe_id: null,
      position: position,
      note: nom.trim()
    })
    await loadPlan()
    setSaving(false)
    setShowPlatLibre(null)
    setPlatLibreInput('')
  }

  async function copySlot(srcJourIndex, srcRepas, dstJourIndex, dstRepas) {
    if (srcJourIndex === dstJourIndex && srcRepas === dstRepas) return
    var srcSlot = plan[srcJourIndex]?.[srcRepas]
    if (!srcSlot || srcSlot.recipes.length === 0) return
    setSaving(true)
    var dstSlotId = await ensureSlot(dstJourIndex, dstRepas)
    var dstSlot = plan[dstJourIndex]?.[dstRepas]
    var startPos = dstSlot ? dstSlot.recipes.length : 0
    for (var i = 0; i < srcSlot.recipes.length; i++) {
      var sr = srcSlot.recipes[i]
      await supabase.from('meal_plan_recipes').insert({
        meal_plan_id: dstSlotId,
        recipe_id: sr.recipe_id || null,
        note: sr.note || null,
        position: startPos + i
      })
    }
    await loadPlan()
    setSaving(false)
  }

  async function updateConvives(jourIndex, repas, val) {
    var slot = plan[jourIndex]?.[repas]
    if (!slot) return
    await supabase.from('meal_plan').update({ convives: val }).eq('id', slot.id)
    await loadPlan()
  }

  async function addInvite(jourIndex, repas, name) {
    if (!name.trim()) return
    var slot = plan[jourIndex]?.[repas]
    if (!slot) return
    var newList = [...(slot.invites || []), name.trim()]
    await supabase.from('meal_plan').update({ invites: newList }).eq('id', slot.id)
    setInviteInput('')
    await loadPlan()
  }

  async function removeInvite(jourIndex, repas, name) {
    var slot = plan[jourIndex]?.[repas]
    if (!slot) return
    var newList = (slot.invites || []).filter(function(i) { return i !== name })
    await supabase.from('meal_plan').update({ invites: newList }).eq('id', slot.id)
    await loadPlan()
  }

  // -- Courses depuis le planning (avec convives par repas) ------------------

  var needed = {}
  for (var ji = 0; ji < 7; ji++) {
    for (var repas of REPAS) {
      var slot = plan[ji]?.[repas]
      if (!slot) continue
      var convives = slot.convives || 2
      for (var slotRecipe of (slot.recipes || [])) {
        var recipe = recipeMap[slotRecipe.recipe_id]
        if (!recipe) continue
        var base = recipe.servings || 2
        var ratio = convives / base
        for (var ing of (recipe.ingredients || [])) {
          var key = ing.name
          if (!needed[key]) needed[key] = { name: ing.name, qty: 0, unit: ing.unit }
          needed[key].qty += (ing.qty || 0) * ratio
        }
      }
    }
  }

  var coursesList = Object.values(needed).map(function(item) {
    var inStock = stock.find(function(s) { return s.name.toLowerCase() === item.name.toLowerCase() })
    var stockQty = inStock ? inStock.qty : 0
    var manque = Math.max(0, item.qty - stockQty)
    return Object.assign({}, item, {
      inStock: stockQty,
      manque: Math.ceil(manque * 10) / 10,
      enStock: manque <= 0,
      cat: getCat(item.name)
    })
  })

  var aAcheter  = coursesList.filter(function(i) { return !i.enStock })
  var dejaDispo = coursesList.filter(function(i) { return i.enStock })
  var coursesGroups = {}
  aAcheter.forEach(function(item) {
    if (!coursesGroups[item.cat]) coursesGroups[item.cat] = []
    coursesGroups[item.cat].push(item)
  })

  var totalRecipeCount = 0
  for (var ji2 = 0; ji2 < 7; ji2++) {
    for (var r2 of REPAS) {
      totalRecipeCount += (plan[ji2]?.[r2]?.recipes || []).length
    }
  }

  var filteredRecipes = recipes.filter(function(r) {
    return !pickerSearch || r.title.toLowerCase().includes(pickerSearch.toLowerCase())
  })

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Chargement...</div>

  // Invitations et restaurants de la semaine affichee
  var invitSemaine = invitations.filter(function(inv) {
    return inv.semaine === wKey && inv.jour_index !== null && inv.jour_index !== undefined && inv.repas
  })
  var restoSemaine = restaurants.filter(function(r) {
    return r.semaine === wKey && r.jour_index !== null && r.jour_index !== undefined && r.repas
  })

  var S = {
    btn: { background: 'none', border: '0.5px solid #ddd', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' },
    tag: { padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: '#f0f0ec', color: '#666', display: 'inline-flex', alignItems: 'center', gap: '3px' }
  }

  return (
    <div>

      {/* En-tete semaine */}
      <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={function() { setWeekOffset(function(w) { return w - 1 }) }} style={S.btn}>&#8249;</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: '500' }}>
            {weekOffset === 0 ? 'Cette semaine' : weekOffset === 1 ? 'Semaine prochaine' : weekOffset === -1 ? 'Semaine derniere' : 'Semaine du ' + formatDate(lundi)}
          </div>
          <div style={{ fontSize: '12px', color: '#888' }}>{formatDate(lundi)} - {formatDate(new Date(lundi.getTime() + 6 * 86400000))}</div>
        </div>
        <button onClick={function() { setWeekOffset(function(w) { return w + 1 }) }} style={S.btn}>&#8250;</button>
        {weekOffset !== 0 && (
          <button onClick={function() { setWeekOffset(0) }} style={{ ...S.btn, border: '0.5px solid #1D9E75', color: '#1D9E75' }}>Auj.</button>
        )}
        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto', flexWrap: 'wrap' }}>

          <button onClick={function() { setShowCarnet(true) }}
            style={{ ...S.btn }}>
            Carnet invitations
          </button>
          <button onClick={addWeekToShopping}
            style={{ ...S.btn, background: '#E1F5EE', color: '#0F6E56', border: '0.5px solid #1D9E75', fontWeight: '500' }}>
            + Courses semaine
          </button>
        </div>
        {saving && <span style={{ fontSize: '11px', color: '#1D9E75' }}>Sauvegarde...</span>}
      </div>

      {/* Grille planning */}
      <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
        {/* En-tete colonnes */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(3, 1fr)', borderBottom: '0.5px solid #e0e0e0', background: '#fafaf8' }}>
          <div />
          {REPAS.map(function(repas) {
            return (
              <div key={repas} style={{ padding: '10px 8px', fontSize: '12px', fontWeight: '500', color: '#555', textAlign: 'center', borderLeft: '0.5px solid #e0e0e0' }}>
                {repas}
              </div>
            )
          })}
        </div>

        {/* Lignes jours */}
        {JOURS.map(function(jour, ji) {
          var date = new Date(lundi); date.setDate(date.getDate() + ji)
          var isToday = new Date().toDateString() === date.toDateString()
          return (
            <div key={jour} style={{ display: 'grid', gridTemplateColumns: '80px repeat(3, 1fr)', borderBottom: ji < 6 ? '0.5px solid #e0e0e0' : 'none' }}>
              {/* Libelle jour */}
              <div style={{ padding: '10px 8px', background: isToday ? '#E1F5EE' : '#fafaf8', borderRight: '0.5px solid #e0e0e0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: isToday ? '600' : '500', color: isToday ? '#0F6E56' : '#333' }}>{jour}</div>
                <div style={{ fontSize: '10px', color: '#aaa' }}>{formatDate(date)}</div>
              </div>

              {/* Slots repas */}
              {REPAS.map(function(repas) {
                var slot = plan[ji]?.[repas]
                var slotRecipes = slot ? slot.recipes : []
                var convives = slot ? slot.convives : 2
                var invites = slot ? (slot.invites || []) : []

                var isDragOver = dragOver && dragOver.jourIndex === ji && dragOver.repas === repas
                var isDragSrc  = dragSrc  && dragSrc.jourIndex  === ji && dragSrc.repas  === repas
                var hasInvit = invitSemaine.some(function(inv) { return parseInt(inv.jour_index) === ji && inv.repas === repas })
                var hasResto = restoSemaine.some(function(r) { return parseInt(r.jour_index) === ji && r.repas === repas })
                var hasExternal = hasInvit || hasResto

                return (
                  <div key={repas}
                    draggable={slotRecipes.length > 0}
                    onDragStart={function() { setDragSrc({ jourIndex: ji, repas: repas }) }}
                    onDragEnd={function() { setDragSrc(null); setDragOver(null) }}
                    onDragOver={function(e) { e.preventDefault(); setDragOver({ jourIndex: ji, repas: repas }) }}
                    onDrop={function(e) {
                      e.preventDefault()
                      if (dragSrc) copySlot(dragSrc.jourIndex, dragSrc.repas, ji, repas)
                      setDragSrc(null); setDragOver(null)
                    }}
                    style={{ borderLeft: '0.5px solid #e0e0e0', padding: '6px', minHeight: '80px', display: 'flex', flexDirection: 'column', gap: '4px', opacity: isDragSrc ? 0.5 : 1, background: isDragOver ? '#E1F5EE' : 'white', transition: 'background 0.15s' }}>

                    {/* Recettes et plats libres dans le slot */}
                    {slotRecipes.map(function(sr) {
                      var r = sr.recipe_id ? recipeMap[sr.recipe_id] : null
                      // Plat libre (pas de recipe_id, juste une note)
                      if (!r && sr.note) {
                        return (
                          <div key={sr.id} style={{ background: '#f0fdf4', border: '0.5px solid #bbf7d0', borderRadius: '6px', padding: '5px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '12px', flexShrink: 0 }}>*</span>
                            <div style={{ flex: 1, minWidth: 0, fontSize: '10px', fontWeight: '500' }}>{sr.note}</div>
                            <button onClick={function() { removeRecipeFromSlot(ji, repas, sr.id) }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '12px', padding: 0, lineHeight: 1, flexShrink: 0 }}>x</button>
                          </div>
                        )
                      }
                      if (!r) return null
                      return (
                        <div key={sr.id} style={{ background: '#f5f5f0', borderRadius: '6px', padding: '5px 7px', display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                          <span style={{ fontSize: '14px', flexShrink: 0 }}>{r.emoji}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '10px', fontWeight: '500', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.title}</div>
                            <div style={{ fontSize: '9px', color: '#aaa' }}>{r.time} min</div>
                          </div>
                          <button onClick={function() { removeRecipeFromSlot(ji, repas, sr.id) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '12px', padding: 0, lineHeight: 1, flexShrink: 0 }}>x</button>
                        </div>
                      )
                    })}

                    {/* Entrees invitations */}
                    {invitSemaine.filter(function(inv) { return parseInt(inv.jour_index) === ji && inv.repas === repas }).map(function(inv) {
                      return (
                        <div key={inv.id}
                          onClick={function() { setCarnetOnglet('invitations'); setShowCarnet(true) }}
                          style={{ background: '#EFF6FF', border: '0.5px solid #93C5FD', borderRadius: '6px', padding: '5px 7px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                          <span style={{ fontSize: '12px', flexShrink: 0 }}>🏠</span>
                          <div style={{ flex: 1, minWidth: 0, fontSize: '10px', fontWeight: '500', color: '#1D4ED8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Invite chez {inv.hote}
                          </div>
                        </div>
                      )
                    })}

                    {/* Entrees restaurants */}
                    {restoSemaine.filter(function(r) { return parseInt(r.jour_index) === ji && r.repas === repas }).map(function(r) {
                      return (
                        <div key={r.id}
                          onClick={function() { setCarnetOnglet('restaurants'); setShowCarnet(true) }}
                          style={{ background: '#F5F3FF', border: '0.5px solid #C4B5FD', borderRadius: '6px', padding: '5px 7px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                          <span style={{ fontSize: '12px', flexShrink: 0 }}>🍽️</span>
                          <div style={{ flex: 1, minWidth: 0, fontSize: '10px', fontWeight: '500', color: '#6D28D9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.nom}
                          </div>
                        </div>
                      )
                    })}

                    {/* Bouton ajouter recette */}
                    {!hasExternal && <button
                      onClick={function() { setPicker({ jourIndex: ji, repas: repas }); setPickerSearch('') }}
                      style={{ width: '100%', border: '1px dashed #ddd', borderRadius: '6px', background: 'none', cursor: 'pointer', color: '#ccc', fontSize: '12px', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}
                      onMouseEnter={function(e) { e.currentTarget.style.borderColor = '#1D9E75'; e.currentTarget.style.color = '#1D9E75' }}
                      onMouseLeave={function(e) { e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#ccc' }}
                    >
                      + {slotRecipes.length === 0 ? 'Ajouter' : 'Ajouter plat'}
                    </button>}

                    {/* Bouton plat libre */}
                    {!hasExternal && <button
                      onClick={function() { setShowPlatLibre({ jourIndex: ji, repas: repas }); setPlatLibreInput('') }}
                      style={{ width: '100%', border: '1px dashed #bbf7d0', borderRadius: '6px', background: 'none', cursor: 'pointer', color: '#86efac', fontSize: '11px', padding: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}
                      onMouseEnter={function(e) { e.currentTarget.style.borderColor = '#1D9E75'; e.currentTarget.style.color = '#1D9E75' }}
                      onMouseLeave={function(e) { e.currentTarget.style.borderColor = '#bbf7d0'; e.currentTarget.style.color = '#86efac' }}
                    >
                      + Plat libre
                    </button>}

                    {/* Convives + invites (visible si slot existe) */}
                    {slot && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        {/* Convives */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <button onClick={function() { updateConvives(ji, repas, Math.max(1, convives - 1)) }}
                            style={{ background: 'none', border: '0.5px solid #ddd', borderRadius: '4px', width: '16px', height: '16px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, color: '#666' }}>-</button>
                          <span style={{ fontSize: '10px', color: '#1D9E75', fontWeight: '600', minWidth: '20px', textAlign: 'center' }}>Pers. {convives}</span>
                          <button onClick={function() { updateConvives(ji, repas, convives + 1) }}
                            style={{ background: 'none', border: '0.5px solid #ddd', borderRadius: '4px', width: '16px', height: '16px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, color: '#666' }}>+</button>
                        </div>
                        {/* Bouton invites */}
                        <button
                          onClick={function() { setShowInvites({ jourIndex: ji, repas: repas }); setInviteInput('') }}
                          style={{ background: 'none', border: '0.5px solid #ddd', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', cursor: 'pointer', color: invites.length > 0 ? '#1D9E75' : '#aaa' }}
                        >
                          {invites.length > 0 ? invites.length + ' invite' + (invites.length > 1 ? 's' : '') : '+ Invites'}
                        </button>
                        {/* Bouton courses */}
                        {slot.recipes && slot.recipes.length > 0 && (
                          <button
                            onClick={function() { shoppingIds.has(slot.id) ? removeSlotFromShopping(slot.id) : addSlotToShopping(ji, repas) }}
                            style={{ background: shoppingIds.has(slot.id) ? '#E1F5EE' : 'none', border: '0.5px solid ' + (shoppingIds.has(slot.id) ? '#1D9E75' : '#ddd'), borderRadius: '4px', padding: '1px 5px', fontSize: '10px', cursor: 'pointer', color: shoppingIds.has(slot.id) ? '#0F6E56' : '#aaa', fontWeight: shoppingIds.has(slot.id) ? '600' : '400' }}
                          >
                            {shoppingIds.has(slot.id) ? '✓ Courses' : '+ Courses'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Courses */}
      {showCourses && (
        <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>Courses de la semaine</div>
              <div style={{ fontSize: '12px', color: '#888' }}>{totalRecipeCount} plat(s) planifie(s) - quantites adaptees par repas</div>
            </div>
          </div>

          {totalRecipeCount === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '13px' }}>Aucune recette planifiee cette semaine.</div>
          ) : (
            <>
              {aAcheter.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '10px' }}>A acheter ({aAcheter.length})</div>
                  {Object.entries(coursesGroups).map(function(entry) {
                    var cat = entry[0], items = entry[1]
                    var cs = CAT_STYLE[cat] || CAT_STYLE['Autres']
                    return (
                      <div key={cat} style={{ marginBottom: '10px' }}>
                        <span style={{ padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '500', background: cs.bg, color: cs.color }}>{cat}</span>
                        <div style={{ border: '0.5px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', marginTop: '5px' }}>
                          {items.map(function(item) {
                            return (
                              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 12px', borderBottom: '0.5px solid #f0f0ec', fontSize: '13px' }}>
                                <div style={{ flex: 1 }}>{item.name}</div>
                                <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '500', background: '#FCEBEB', color: '#791F1F' }}>{item.manque} {item.unit}</span>
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
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#3B6D11', marginBottom: '6px' }}>Deja en stock</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {dejaDispo.map(function(item) {
                      return <span key={item.name} style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: '#EAF3DE', color: '#3B6D11' }}>{item.name}</span>
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal picker de recette */}
      {picker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', width: '100%', maxWidth: '480px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Ajouter une recette</div>
                <div style={{ fontSize: '12px', color: '#888' }}>
                  {JOURS[picker.jourIndex]} - {picker.repas}
                </div>
              </div>
              <button onClick={function() { setPicker(null) }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#aaa' }}>x</button>
            </div>
            <input
              autoFocus
              value={pickerSearch}
              onChange={function(e) { setPickerSearch(e.target.value) }}
              placeholder="Rechercher..."
              style={{ padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', marginBottom: '10px' }}
            />
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredRecipes.map(function(r) {
                return (
                  <div key={r.id}
                    onClick={function() { addRecipeToSlot(picker.jourIndex, picker.repas, r.id) }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '0.5px solid #e0e0e0', borderRadius: '10px', cursor: 'pointer', background: 'white' }}
                    onMouseEnter={function(e) { e.currentTarget.style.borderColor = '#1D9E75'; e.currentTarget.style.background = '#E1F5EE' }}
                    onMouseLeave={function(e) { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.background = 'white' }}
                  >
                    {r.photo_url
                      ? <img src={r.photo_url} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                      : <div style={{ width: '40px', height: '40px', background: '#f5f5f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>{r.emoji}</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500' }}>{r.title}</div>
                      <div style={{ fontSize: '11px', color: '#888' }}>{r.time} min - base {r.servings} pers.</div>
                    </div>
                  </div>
                )
              })}
              {filteredRecipes.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '13px' }}>Aucune recette trouvee</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal invites */}
      {showInvites && (function() {
        var slot = plan[showInvites.jourIndex]?.[showInvites.repas]
        var invites = slot ? (slot.invites || []) : []
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '380px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>Invites</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    {JOURS[showInvites.jourIndex]} - {showInvites.repas}
                  </div>
                </div>
                <button onClick={function() { setShowInvites(null) }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#aaa' }}>x</button>
              </div>

              {/* Liste invites */}
              {invites.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', padding: '12px' }}>Aucun invite pour ce repas</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                  {invites.map(function(name) {
                    return (
                      <span key={name} style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '12px', background: '#E1F5EE', color: '#0F6E56', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {name}
                        <button onClick={function() { removeInvite(showInvites.jourIndex, showInvites.repas, name) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 0, lineHeight: 1, fontSize: '13px' }}>x</button>
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Ajouter un invite */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  autoFocus
                  value={inviteInput}
                  onChange={function(e) { setInviteInput(e.target.value) }}
                  onKeyDown={function(e) { if (e.key === 'Enter') addInvite(showInvites.jourIndex, showInvites.repas, inviteInput) }}
                  placeholder="Prenom de l'invite..."
                  style={{ flex: 1, padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
                />
                <button onClick={function() { addInvite(showInvites.jourIndex, showInvites.repas, inviteInput) }}
                  style={{ padding: '8px 12px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal plat libre */}
      {showPlatLibre && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Ajouter un plat libre</div>
                <div style={{ fontSize: '12px', color: '#888' }}>
                  {JOURS[showPlatLibre.jourIndex]} - {showPlatLibre.repas}
                </div>
              </div>
              <button onClick={function() { setShowPlatLibre(null) }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#aaa' }}>x</button>
            </div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
              Pour un accompagnement ou plat simple sans recette (frites, salade, pain...).
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                autoFocus
                value={platLibreInput}
                onChange={function(e) { setPlatLibreInput(e.target.value) }}
                onKeyDown={function(e) { if (e.key === 'Enter') addPlatLibre(showPlatLibre.jourIndex, showPlatLibre.repas, platLibreInput) }}
                placeholder="Ex: Frites, Salade verte, Pain..."
                style={{ flex: 1, padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
              />
              <button onClick={function() { addPlatLibre(showPlatLibre.jourIndex, showPlatLibre.repas, platLibreInput) }}
                style={{ padding: '8px 12px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Carnet - 3 onglets */}
      {showCarnet && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 50, padding: '1rem', overflowY: 'auto' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '600px', marginTop: '1rem', marginBottom: '1rem' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: '500' }}>Carnet invitations culinaire</div>
              <button onClick={function() { setShowCarnet(false); setShowFormInvit(false); setShowFormResto(false) }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#aaa' }}>x</button>
            </div>

            {/* Onglets */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#f5f5f0', borderRadius: '10px', padding: '4px' }}>
              {[
                { id: 'invites', label: 'Mes invites', emoji: 'Invites' },
                { id: 'invitations', label: 'Invitations recues', emoji: 'Invitations' },
                { id: 'restaurants', label: 'Restaurants', emoji: 'Restaurants' },
              ].map(function(tab) {
                return (
                  <button key={tab.id} onClick={function() { setCarnetOnglet(tab.id); setShowFormInvit(false); setShowFormResto(false) }}
                    style={{ flex: 1, padding: '7px 4px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: carnetOnglet === tab.id ? '600' : '400', background: carnetOnglet === tab.id ? 'white' : 'transparent', color: carnetOnglet === tab.id ? '#0F6E56' : '#888', boxShadow: carnetOnglet === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Onglet 1 : Mes invites */}
            {carnetOnglet === 'invites' && (
              <div>
                <input value={carnetSearch} onChange={function(e) { setCarnetSearch(e.target.value) }}
                  placeholder="Rechercher un invite..."
                  style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' }} />
                {carnet.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '13px' }}>
                    Ajoutez des invites sur les repas du planning pour les voir ici.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {carnet.filter(function(p) { return !carnetSearch || p.name.toLowerCase().includes(carnetSearch.toLowerCase()) })
                      .sort(function(a, b) { return a.name.localeCompare(b.name) })
                      .map(function(person) {
                        return (
                          <div key={person.name} style={{ border: '0.5px solid #e0e0e0', borderRadius: '10px', overflow: 'hidden' }}>
                            <div style={{ padding: '10px 14px', background: '#fafaf8', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '0.5px solid #e0e0e0' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1D9E75', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600', flexShrink: 0 }}>
                                {person.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: '500' }}>{person.name}</div>
                                <div style={{ fontSize: '11px', color: '#888' }}>{person.repas.length} repas partage{person.repas.length > 1 ? 's' : ''}</div>
                              </div>
                            </div>
                            <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {person.repas.map(function(r, idx) {
                                var recipeNames = r.recipe_ids.map(function(rid) {
                                  if (!rid) return null
                                  return recipeMap[rid] ? recipeMap[rid].emoji + ' ' + recipeMap[rid].title : null
                                }).filter(Boolean)
                                var menu = r.notes ? [...recipeNames, ...r.notes] : recipeNames
                                return (
                                  <div key={idx} style={{ fontSize: '12px', color: '#555' }}>
                                    <span style={{ fontWeight: '500', color: '#333' }}>{r.jour} {r.date} - {r.repas}</span>
                                    <div style={{ marginTop: '2px', color: '#888', fontSize: '11px' }}>
                                      {menu.length > 0 ? menu.join(', ') : <span style={{ fontStyle: 'italic', color: '#ccc' }}>Menu non renseigne</span>}
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
              </div>
            )}

            {/* Onglet 2 : Invitations recues */}
            {carnetOnglet === 'invitations' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                  <button onClick={function() { setShowFormInvit(true); setEditInvit(null); setFormInvit({ hote: '', date: '', menu: '', notes: '', jour_index: '', repas: '' }) }}
                    style={{ padding: '7px 14px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                    + Ajouter
                  </button>
                </div>

                {showFormInvit && (
                  <div style={{ background: '#fafaf8', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '0.5px solid #e0e0e0' }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '10px' }}>{editInvit ? 'Modifier' : 'Nouvelle invitation'}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>Chez qui</label>
                        <input value={formInvit.hote} onChange={function(e) { setFormInvit(function(f) { return { ...f, hote: e.target.value } }) }}
                          placeholder="Prenom ou nom" style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>Date</label>
                        <input type="date" value={formInvit.date} onChange={function(e) {
                          var dateStr = e.target.value
                          var jourAuto = ''
                          if (dateStr) {
                            var parts = dateStr.split('-')
                            var d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]))
                            jourAuto = String((d.getDay() + 6) % 7) // 0=lundi, 6=dimanche
                          }
                          setFormInvit(function(f) { return { ...f, date: dateStr, jour_index: jourAuto } })
                        }}
                          style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>Jour (planning)</label>
                        <select value={formInvit.jour_index} onChange={function(e) { setFormInvit(function(f) { return { ...f, jour_index: e.target.value } }) }}
                          style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}>
                          <option value="">-- Choisir --</option>
                          {JOURS.map(function(j, i) { return <option key={i} value={i}>{j}</option> })}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>Repas</label>
                        <select value={formInvit.repas} onChange={function(e) { setFormInvit(function(f) { return { ...f, repas: e.target.value } }) }}
                          style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}>
                          <option value="">-- Choisir --</option>
                          {REPAS.map(function(r) { return <option key={r} value={r}>{r}</option> })}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>Menu servi</label>
                      <input value={formInvit.menu} onChange={function(e) { setFormInvit(function(f) { return { ...f, menu: e.target.value } }) }}
                        placeholder="Ex: Fondue savoyarde, tarte aux pommes..." style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>Notes</label>
                      <input value={formInvit.notes} onChange={function(e) { setFormInvit(function(f) { return { ...f, notes: e.target.value } }) }}
                        placeholder="Impressions, idees a retenir..." style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={function() { setShowFormInvit(false); setEditInvit(null) }} style={{ padding: '7px 14px', background: 'none', border: '0.5px solid #ddd', borderRadius: '7px', fontSize: '13px', cursor: 'pointer' }}>Annuler</button>
                      <button onClick={saveInvitation} style={{ padding: '7px 14px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '7px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>Enregistrer</button>
                    </div>
                  </div>
                )}

                {invitations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '13px' }}>Aucune invitation enregistree.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {invitations.map(function(inv) {
                      return (
                        <div key={inv.id} style={{ border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '12px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <div style={{ fontSize: '13px', fontWeight: '500' }}>Chez {inv.hote}</div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={function() { setEditInvit(inv); setFormInvit({ hote: inv.hote, date: inv.date, menu: inv.menu || '', notes: inv.notes || '' }); setShowFormInvit(true) }}
                                style={{ fontSize: '11px', padding: '3px 8px', border: '0.5px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: 'white', color: '#555' }}>Editer</button>
                              <button onClick={function() { deleteInvitation(inv.id) }}
                                style={{ fontSize: '11px', padding: '3px 8px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: '#FCEBEB', color: '#791F1F' }}>x</button>
                            </div>
                          </div>
                          {inv.date && <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>{new Date(inv.date).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
                          {inv.menu && <div style={{ fontSize: '12px', color: '#555', marginBottom: '2px' }}>Menu : {inv.menu}</div>}
                          {inv.notes && <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>{inv.notes}</div>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Onglet 3 : Restaurants */}
            {carnetOnglet === 'restaurants' && (
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input value={restoSearch} onChange={function(e) { setRestoSearch(e.target.value) }}
                    placeholder="Rechercher un restaurant..."
                    style={{ flex: 1, padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
                  <button onClick={function() { setShowFormResto(true); setEditResto(null); setFormResto({ nom: '', adresse: '', date: '', menu: '', prix: '', note: 0, avis: '', jour_index: '', repas: '' }) }}
                    style={{ padding: '7px 14px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                    + Ajouter
                  </button>
                </div>

                {showFormResto && (
                  <div style={{ background: '#fafaf8', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '0.5px solid #e0e0e0' }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '10px' }}>{editResto ? 'Modifier' : 'Nouveau restaurant'}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>Nom du restaurant</label>
                        <input value={formResto.nom} onChange={function(e) { setFormResto(function(f) { return { ...f, nom: e.target.value } }) }}
                          placeholder="Ex: Le Petit Bistrot" style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>Date</label>
                        <input type="date" value={formResto.date} onChange={function(e) {
                          var dateStr = e.target.value
                          var jourAuto = ''
                          if (dateStr) {
                            var parts = dateStr.split('-')
                            var d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]))
                            jourAuto = String((d.getDay() + 6) % 7)
                          }
                          setFormResto(function(f) { return { ...f, date: dateStr, jour_index: jourAuto } })
                        }}
                          style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>Adresse</label>
                      <input value={formResto.adresse} onChange={function(e) { setFormResto(function(f) { return { ...f, adresse: e.target.value } }) }}
                        placeholder="Rue, ville..." style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>Jour (planning)</label>
                        <select value={formResto.jour_index} onChange={function(e) { setFormResto(function(f) { return { ...f, jour_index: e.target.value } }) }}
                          style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}>
                          <option value="">-- Choisir --</option>
                          {JOURS.map(function(j, i) { return <option key={i} value={i}>{j}</option> })}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>Repas</label>
                        <select value={formResto.repas} onChange={function(e) { setFormResto(function(f) { return { ...f, repas: e.target.value } }) }}
                          style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}>
                          <option value="">-- Choisir --</option>
                          {REPAS.map(function(r) { return <option key={r} value={r}>{r}</option> })}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>Ce que j'ai mange</label>
                      <input value={formResto.menu} onChange={function(e) { setFormResto(function(f) { return { ...f, menu: e.target.value } }) }}
                        placeholder="Ex: Entrecote, tiramisu..." style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>Prix du repas</label>
                        <input type="number" step="0.5" value={formResto.prix} onChange={function(e) { setFormResto(function(f) { return { ...f, prix: e.target.value } }) }}
                          placeholder="45.00" style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>Note (1-5)</label>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                          {[1,2,3,4,5].map(function(n) {
                            return (
                              <span key={n} onClick={function() { setFormResto(function(f) { return { ...f, note: n } }) }}
                                style={{ fontSize: '20px', cursor: 'pointer', color: n <= formResto.note ? '#F59E0B' : '#E5E7EB' }}>
                                &#9733;
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>Avis / Notes</label>
                      <input value={formResto.avis} onChange={function(e) { setFormResto(function(f) { return { ...f, avis: e.target.value } }) }}
                        placeholder="Ambiance, service, a retenir..." style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={function() { setShowFormResto(false); setEditResto(null) }} style={{ padding: '7px 14px', background: 'none', border: '0.5px solid #ddd', borderRadius: '7px', fontSize: '13px', cursor: 'pointer' }}>Annuler</button>
                      <button onClick={saveRestaurant} style={{ padding: '7px 14px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '7px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>Enregistrer</button>
                    </div>
                  </div>
                )}

                {restaurants.filter(function(r) { return !restoSearch || r.nom.toLowerCase().includes(restoSearch.toLowerCase()) || (r.adresse || '').toLowerCase().includes(restoSearch.toLowerCase()) }).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '13px' }}>Aucun restaurant enregistre.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {restaurants.filter(function(r) { return !restoSearch || r.nom.toLowerCase().includes(restoSearch.toLowerCase()) || (r.adresse || '').toLowerCase().includes(restoSearch.toLowerCase()) }).map(function(r) {
                      return (
                        <div key={r.id} style={{ border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '12px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: '500' }}>{r.nom}</div>
                              {r.note > 0 && (
                                <div style={{ fontSize: '13px', color: '#F59E0B' }}>
                                  {'★'.repeat(r.note)}{'☆'.repeat(5 - r.note)}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {r.prix && <span style={{ fontSize: '12px', fontWeight: '500', color: '#0F6E56' }}>{r.prix} CHF</span>}
                              <button onClick={function() { setEditResto(r); setFormResto({ nom: r.nom, adresse: r.adresse || '', date: r.date || '', menu: r.menu || '', prix: r.prix || '', note: r.note || 0, avis: r.avis || '' }); setShowFormResto(true) }}
                                style={{ fontSize: '11px', padding: '3px 8px', border: '0.5px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: 'white', color: '#555' }}>Editer</button>
                              <button onClick={function() { deleteRestaurant(r.id) }}
                                style={{ fontSize: '11px', padding: '3px 8px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: '#FCEBEB', color: '#791F1F' }}>x</button>
                            </div>
                          </div>
                          {r.adresse && <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>{r.adresse}</div>}
                          {r.date && <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>{new Date(r.date).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
                          {r.menu && <div style={{ fontSize: '12px', color: '#555', marginBottom: '2px' }}>Menu : {r.menu}</div>}
                          {r.avis && <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>{r.avis}</div>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
