import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// --- Constantes ---------------------------------------------------------------

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const REPAS = ['Petit-dejeuner', 'Diner', 'Souper']
const REPAS_LABEL = { 'Petit-dejeuner': '☕ Petit-déj.', 'Diner': '🍽 Dîner', 'Souper': '🌙 Souper' }

const SPORTS = [
  'Sédentaire (peu ou pas d\'exercice)',
  'Légèrement actif (1-3j/semaine)',
  'Modérément actif (3-5j/semaine)',
  'Très actif (6-7j/semaine)',
  'Extrêmement actif (sport intensif)'
]

const SPORT_FACTOR = [1.2, 1.375, 1.55, 1.725, 1.9]

// Calcul TDEE (Total Daily Energy Expenditure)
// Formule Mifflin-St Jeor pour homme (on peut affiner plus tard)
function calcTDEE(poids, sport) {
  if (!poids || !sport) return null
  const bmr = 10 * poids + 500 // Simplification : on n'a pas la taille/âge
  const factor = SPORT_FACTOR[SPORTS.indexOf(sport)] || 1.55
  return Math.round(bmr * factor)
}

// Calcul objectif calorique pour perte de poids
function calcObjectifCal(tdee, poidsActuel, poidsCible, dateCible) {
  if (!tdee || !poidsActuel || !poidsCible || !dateCible) return tdee
  const jours = Math.max(1, Math.round((new Date(dateCible) - new Date()) / 86400000))
  const kgAPerdreTot = poidsActuel - poidsCible
  if (kgAPerdreTot <= 0) return tdee
  // 1kg de graisse ≈ 7700 kcal
  const deficitTotal = kgAPerdreTot * 7700
  const deficitJour = Math.round(deficitTotal / jours)
  // Maximum -500 kcal/jour pour rester sain
  const deficit = Math.min(deficitJour, 500)
  return Math.max(1200, tdee - deficit)
}

function getLundi(offset) {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1 + (offset || 0) * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

function weekKey(lundi) {
  return lundi.getFullYear() + '-' +
    String(lundi.getMonth() + 1).padStart(2, '0') + '-' +
    String(lundi.getDate()).padStart(2, '0')
}

function formatDate(date) {
  return date.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })
}

// --- Mini camembert SVG -------------------------------------------------------

function PieChart({ data, size = 120 }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div style={{ width: size, height: size, borderRadius: '50%', background: '#f0f0ec' }} />
  let cumul = 0
  const slices = []
  const cx = size / 2, cy = size / 2, r = size / 2 - 4

  for (const d of data) {
    const pct = d.value / total
    const startAngle = cumul * 2 * Math.PI - Math.PI / 2
    const endAngle = (cumul + pct) * 2 * Math.PI - Math.PI / 2
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const large = pct > 0.5 ? 1 : 0
    slices.push(
      <path key={d.label}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
        fill={d.color} />
    )
    cumul += pct
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices}
      <circle cx={cx} cy={cy} r={r * 0.55} fill="white" />
    </svg>
  )
}

// --- Courbe de poids SVG -------------------------------------------------------

function WeightChart({ logs, poidsActuel, poidsCible }) {
  if (!logs || logs.length === 0) return (
    <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '13px' }}>
      Aucune donnée pour l'instant
    </div>
  )

  const sorted = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date))
  const vals = sorted.map(l => l.poids)
  const allVals = [...vals, poidsCible].filter(Boolean)
  const minV = Math.min(...allVals) - 1
  const maxV = Math.max(...allVals) + 1
  const W = 400, H = 140, PAD = 30

  function x(i) { return PAD + (i / Math.max(sorted.length - 1, 1)) * (W - PAD * 2) }
  function y(v) { return H - PAD - ((v - minV) / (maxV - minV)) * (H - PAD * 1.5) }

  // Ligne de tendance (régression linéaire simple)
  const n = sorted.length
  let sx = 0, sy = 0, sxy = 0, sxx = 0
  for (let i = 0; i < n; i++) { sx += i; sy += vals[i]; sxy += i * vals[i]; sxx += i * i }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1)
  const intercept = (sy - slope * sx) / n
  const tx0 = x(0), ty0 = y(intercept)
  const tx1 = x(n - 1), ty1 = y(intercept + slope * (n - 1))

  const points = sorted.map((l, i) => `${x(i)},${y(l.poids)}`).join(' ')

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W }}>
        {/* Grille */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const yv = H - PAD - t * (H - PAD * 1.5)
          const val = (minV + t * (maxV - minV)).toFixed(1)
          return (
            <g key={t}>
              <line x1={PAD} y1={yv} x2={W - PAD} y2={yv} stroke="#f0f0ec" strokeWidth="1" />
              <text x={PAD - 4} y={yv + 4} fontSize="9" fill="#bbb" textAnchor="end">{val}</text>
            </g>
          )
        })}
        {/* Ligne cible */}
        {poidsCible && (
          <line x1={PAD} y1={y(poidsCible)} x2={W - PAD} y2={y(poidsCible)}
            stroke="#1D9E75" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
        )}
        {/* Tendance */}
        {n > 1 && <line x1={tx0} y1={ty0} x2={tx1} y2={ty1} stroke="#EF9F27" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.7" />}
        {/* Courbe */}
        <polyline points={points} fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinejoin="round" />
        {/* Points */}
        {sorted.map((l, i) => (
          <g key={l.id}>
            <circle cx={x(i)} cy={y(l.poids)} r="4" fill="white" stroke="#1D9E75" strokeWidth="2" />
            <text x={x(i)} y={y(l.poids) - 8} fontSize="9" fill="#555" textAnchor="middle">{l.poids}</text>
          </g>
        ))}
        {/* Dates */}
        {sorted.filter((_, i) => i === 0 || i === sorted.length - 1 || sorted.length < 6).map((l, i) => (
          <text key={l.id + 'd'} x={x(i)} y={H - 4} fontSize="8" fill="#bbb" textAnchor="middle">
            {new Date(l.date).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })}
          </text>
        ))}
      </svg>
    </div>
  )
}

// --- Composant principal -------------------------------------------------------

export default function NutritionPage() {
  const { user } = useAuth()
  const [onglet, setOnglet] = useState('semaine')
  const [goals, setGoals]   = useState(null)
  const [weightLogs, setWeightLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  // Formulaire profil
  const [formGoals, setFormGoals] = useState({
    poids_actuel: '', poids_cible: '', date_cible: '', sport: SPORTS[2]
  })

  // Saisie poids
  const [newPoids, setNewPoids]   = useState('')
  const [newDate, setNewDate]     = useState(new Date().toISOString().slice(0, 10))
  const [newNote, setNewNote]     = useState('')

  // Planning nutrition
  const [weekOffset, setWeekOffset] = useState(0)
  const [plan, setPlan]             = useState({})
  const [recipes, setRecipes]       = useState([])
  const [nutMap, setNutMap]         = useState({})
  const [planLoading, setPlanLoading] = useState(true)

  const lundi = getLundi(weekOffset)
  const wKey  = weekKey(lundi)

  useEffect(() => {
    loadGoals()
    loadWeightLogs()
    loadNutMap()
    loadRecipes()
  }, [user])

  useEffect(() => { loadPlan() }, [wKey, user])

  async function loadGoals() {
    const { data } = await supabase.from('user_nutrition_goals').select('*').eq('user_id', user.id).single()
    if (data) {
      setGoals(data)
      setFormGoals({
        poids_actuel: data.poids_actuel || '',
        poids_cible:  data.poids_cible  || '',
        date_cible:   data.date_cible   || '',
        sport:        data.sport        || SPORTS[2]
      })
    }
    setLoading(false)
  }

  async function loadWeightLogs() {
    const { data } = await supabase.from('user_weight_log').select('*').eq('user_id', user.id).order('date', { ascending: true })
    setWeightLogs(data || [])
  }

  async function loadNutMap() {
    const { data } = await supabase.from('ingredient_nutrition').select('name, calories, proteines, glucides, lipides, fibres, sel, unit_ref, weight_per_unit')
    const map = {}
    for (const row of (data || [])) map[row.name.toLowerCase()] = row
    setNutMap(map)
  }

  async function loadRecipes() {
    const { data } = await supabase.from('recipes').select('id, title, ingredients, servings, nutrition').eq('user_id', user.id)
    setRecipes(data || [])
  }

  async function loadPlan() {
    setPlanLoading(true)
    const { data: slots } = await supabase
      .from('meal_plan')
      .select('*, meal_plan_recipes(*)')
      .eq('user_id', user.id)
      .eq('week_start', wKey)
    const p = {}
    for (const slot of (slots || [])) {
      if (!p[slot.jour_index]) p[slot.jour_index] = {}
      p[slot.jour_index][slot.repas] = {
        id: slot.id,
        convives: slot.convives || 2,
        cooked: slot.cooked || false,
        recipes: (slot.meal_plan_recipes || []).sort((a, b) => a.position - b.position)
      }
    }
    setPlan(p)
    setPlanLoading(false)
  }

  async function saveGoals() {
    setSaving(true)
    const payload = {
      user_id: user.id,
      poids_actuel: parseFloat(formGoals.poids_actuel) || null,
      poids_cible:  parseFloat(formGoals.poids_cible)  || null,
      date_cible:   formGoals.date_cible || null,
      sport:        formGoals.sport,
      updated_at:   new Date().toISOString()
    }
    if (goals) {
      await supabase.from('user_nutrition_goals').update(payload).eq('user_id', user.id)
    } else {
      await supabase.from('user_nutrition_goals').insert(payload)
    }
    await loadGoals()
    setSaving(false)
  }

  async function addWeightLog() {
    if (!newPoids) return
    await supabase.from('user_weight_log').insert({
      user_id: user.id,
      poids: parseFloat(newPoids),
      date: newDate,
      note: newNote || null
    })
    setNewPoids(''); setNewNote('')
    await loadWeightLogs()
  }

  async function deleteWeightLog(id) {
    await supabase.from('user_weight_log').delete().eq('id', id)
    await loadWeightLogs()
  }

  // --- Calcul nutrition depuis le planning ------------------------------------

  function computeNutritionIngredients(ingredients, servings) {
    if (!ingredients || !ingredients.length) return null
    const s = servings || 1
    let cal = 0, prot = 0, gluc = 0, lip = 0, fib = 0, matched = 0
    for (const ing of ingredients) {
      const key = (ing.name || '').trim().toLowerCase()
      const entry = nutMap[key]
      if (!entry) continue
      const qty = parseFloat(ing.qty || 0)
      const unit = (ing.unit || '').toLowerCase()
      let factor = 0
      if (unit === 'unite(s)' || unit === 'unité(s)') {
        factor = entry.weight_per_unit ? (qty * entry.weight_per_unit) / 100 : entry.unit_ref === 'unite' ? qty : qty / 100
      } else if (unit === 'kg') { factor = qty * 10
      } else if (unit === 'l') { factor = qty * 10
      } else if (unit === 'sachet(s)') { factor = (qty * 5) / 100
      } else if (unit === 'c. à soupe') { factor = (qty * 15) / 100
      } else if (unit === 'c. à café') { factor = (qty * 5) / 100
      } else { factor = qty / 100 }
      cal  += (entry.calories  || 0) * factor
      prot += (entry.proteines || 0) * factor
      gluc += (entry.glucides  || 0) * factor
      lip  += (entry.lipides   || 0) * factor
      fib  += (entry.fibres    || 0) * factor
      matched++
    }
    if (matched === 0) return null
    return { calories: Math.round(cal / s), proteines: parseFloat((prot / s).toFixed(1)), glucides: parseFloat((gluc / s).toFixed(1)), lipides: parseFloat((lip / s).toFixed(1)) }
  }

  const recipeMap = {}
  recipes.forEach(r => { recipeMap[r.id] = r })

  // Nutrition par jour et par repas
  const nutritionSemaine = {}
  let totalCal = 0, totalProt = 0, totalGluc = 0, totalLip = 0, totalFib = 0, joursAvecDonnees = 0

  for (let ji = 0; ji < 7; ji++) {
    nutritionSemaine[ji] = {}
    for (const repas of REPAS) {
      const slot = plan[ji]?.[repas]
      if (!slot) continue
      let slotCal = 0, slotProt = 0, slotGluc = 0, slotLip = 0, slotFib = 0, hasData = false

      for (const sr of (slot.recipes || [])) {
        if (sr.recipe_id) {
          // Recette liée
          const recipe = recipeMap[sr.recipe_id]
          if (!recipe) continue
          const convives = slot.convives || 2
          const ratio = convives / (recipe.servings || 2)
          // Priorité : valeur importée, sinon calcul
          const nut = recipe.nutrition?.calories
            ? recipe.nutrition
            : computeNutritionIngredients(recipe.ingredients, recipe.servings)
          if (nut) {
            slotCal  += (nut.calories  || 0) * ratio
            slotProt += (nut.proteines || 0) * ratio
            slotGluc += (nut.glucides  || 0) * ratio
            slotLip  += (nut.lipides   || 0) * ratio
            slotFib  += (nut.fibres    || 0) * ratio
            hasData = true
          }
        } else if (sr.note) {
          // Plat libre → pas de données nutritionnelles disponibles
          hasData = false
        }
      }

      if (hasData) {
        nutritionSemaine[ji][repas] = {
          calories: Math.round(slotCal),
          proteines: parseFloat(slotProt.toFixed(1)),
          glucides: parseFloat(slotGluc.toFixed(1)),
          lipides: parseFloat(slotLip.toFixed(1)),
          fibres: parseFloat(slotFib.toFixed(1))
        }
      }
    }

    // Total jour
    const jourNut = Object.values(nutritionSemaine[ji])
    if (jourNut.length > 0) {
      const jourCal = jourNut.reduce((s, n) => s + n.calories, 0)
      totalCal  += jourCal
      totalProt += jourNut.reduce((s, n) => s + n.proteines, 0)
      totalGluc += jourNut.reduce((s, n) => s + n.glucides, 0)
      totalLip  += jourNut.reduce((s, n) => s + n.lipides, 0)
      totalFib  += jourNut.reduce((s, n) => s + (n.fibres || 0), 0)
      if (jourCal > 0) joursAvecDonnees++
    }
  }

  const moyenneCal  = joursAvecDonnees > 0 ? Math.round(totalCal / joursAvecDonnees) : 0
  const moyenneProt = joursAvecDonnees > 0 ? parseFloat((totalProt / joursAvecDonnees).toFixed(1)) : 0
  const moyenneGluc = joursAvecDonnees > 0 ? parseFloat((totalGluc / joursAvecDonnees).toFixed(1)) : 0
  const moyenneLip  = joursAvecDonnees > 0 ? parseFloat((totalLip  / joursAvecDonnees).toFixed(1)) : 0
  const moyenneFib  = joursAvecDonnees > 0 ? parseFloat((totalFib  / joursAvecDonnees).toFixed(1)) : 0

  // TDEE et objectif
  const lastWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].poids : goals?.poids_actuel
  const tdee = calcTDEE(lastWeight, goals?.sport)
  const objectifCal = calcObjectifCal(tdee, lastWeight, goals?.poids_cible, goals?.date_cible)

  // Jours restants
  const joursRestants = goals?.date_cible
    ? Math.max(0, Math.round((new Date(goals.date_cible) - new Date()) / 86400000))
    : null
  const kgRestants = lastWeight && goals?.poids_cible ? Math.max(0, lastWeight - goals.poids_cible) : null

  // Dernier poids enregistré
  const dernierPoids = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null

  // Conseils
  function getConseils() {
    const conseils = []
    if (!objectifCal || !moyenneCal) return conseils
    const ecart = moyenneCal - objectifCal
    if (ecart > 200) conseils.push({ type: 'warning', txt: `Tu consommes en moyenne ${ecart} kcal de trop par jour. Réduis les portions ou les matières grasses.` })
    else if (ecart < -200) conseils.push({ type: 'ok', txt: `Bon travail ! Tu es en dessous de ton objectif de ${Math.abs(ecart)} kcal/jour.` })
    else conseils.push({ type: 'ok', txt: 'Tes apports caloriques sont bien alignés avec ton objectif !' })
    if (moyenneProt < 1.2 * (lastWeight || 80)) conseils.push({ type: 'warning', txt: `Apport en protéines insuffisant (${moyenneProt}g/j). Vise ${Math.round(1.2 * (lastWeight || 80))}g pour préserver ta masse musculaire.` })
    if (moyenneLip > 80) conseils.push({ type: 'info', txt: `Apport en lipides élevé (${moyenneLip}g/j). Privilégie les bonnes graisses (avocat, noix, huile d'olive).` })
    if (moyenneFib < 25) conseils.push({ type: 'info', txt: `Apport en fibres insuffisant (${moyenneFib}g/j). Vise 25-30g/j avec légumes, légumineuses et céréales complètes.` })
    if (joursRestants !== null && kgRestants !== null) {
      const rythme = kgRestants / (joursRestants / 7 || 1)
      if (rythme > 1) conseils.push({ type: 'warning', txt: `L'objectif est ambitieux (${rythme.toFixed(1)}kg/semaine). Un rythme sain est de 0.5-1kg/semaine.` })
    }
    return conseils
  }

  const S = {
    input: { width: '100%', padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', background: '#fafaf8' },
    card: { background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' },
    label: { fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' },
    stat: { background: '#fafaf8', borderRadius: '10px', padding: '10px 14px', textAlign: 'center' },
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>Chargement...</div>

  return (
    <div>
      {/* En-tête */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '2px' }}>Nutrition & Santé</div>
        <div style={{ fontSize: '12px', color: '#888' }}>
          {dernierPoids ? `Dernier poids : ${dernierPoids.poids} kg le ${new Date(dernierPoids.date).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })}` : 'Commence par saisir ton profil'}
        </div>
      </div>

      {/* Résumé objectif */}
      {goals?.poids_cible && (
        <div style={{ background: 'linear-gradient(135deg, #E1F5EE 0%, #f0faf5 100%)', border: '0.5px solid #5DCAA5', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#0F6E56', marginBottom: '2px' }}>
              Objectif : {goals.poids_cible} kg
              {goals.date_cible && ` d'ici le ${new Date(goals.date_cible).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })}`}
            </div>
            <div style={{ fontSize: '12px', color: '#3B6D11' }}>
              {kgRestants > 0 ? `${kgRestants.toFixed(1)} kg restants` : '🎉 Objectif atteint !'}
              {joursRestants !== null && kgRestants > 0 && ` · ${joursRestants} jours`}
            </div>
          </div>
          {objectifCal && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: '#0F6E56' }}>{objectifCal}</div>
              <div style={{ fontSize: '11px', color: '#3B6D11' }}>kcal/jour objectif</div>
            </div>
          )}
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '4px', background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '4px', marginBottom: '1rem' }}>
        {[
          { id: 'semaine', label: '📊 Semaine' },
          { id: 'poids',   label: '⚖️ Poids' },
          { id: 'profil',  label: '👤 Profil' },
          { id: 'conseils',label: '💡 Conseils' },
        ].map(o => (
          <button key={o.id} onClick={() => setOnglet(o.id)} style={{
            flex: 1, padding: '7px 4px', border: 'none', borderRadius: '7px', fontSize: '12px', cursor: 'pointer',
            background: onglet === o.id ? '#E1F5EE' : 'transparent',
            color: onglet === o.id ? '#0F6E56' : '#888',
            fontWeight: onglet === o.id ? '500' : '400'
          }}>{o.label}</button>
        ))}
      </div>

      {/* ── Onglet Semaine ──────────────────────────────────────────────────── */}
      {onglet === 'semaine' && (
        <div>
          {/* Navigation semaine */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <button onClick={() => setWeekOffset(w => w - 1)} style={{ padding: '6px 12px', border: '0.5px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '13px' }}>← Préc.</button>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#555' }}>
              {formatDate(lundi)} – {formatDate(new Date(lundi.getTime() + 6 * 86400000))}
              {weekOffset === 0 && <span style={{ fontSize: '11px', color: '#1D9E75', marginLeft: '6px' }}>Cette semaine</span>}
            </div>
            <button onClick={() => setWeekOffset(w => w + 1)} style={{ padding: '6px 12px', border: '0.5px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '13px' }}>Suiv. →</button>
          </div>

          {/* Récap hebdo */}
          {joursAvecDonnees > 0 && (
            <div style={S.card}>
              <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '12px' }}>
                Moyenne journalière <span style={{ fontWeight: '400', color: '#888', fontSize: '12px' }}>({joursAvecDonnees} jour{joursAvecDonnees > 1 ? 's' : ''} avec données)</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <PieChart size={100} data={[
                  { label: 'Glucides nets', value: Math.max(0, moyenneGluc - moyenneFib) * 4, color: '#60C8E8' },
                  { label: 'Fibres',        value: moyenneFib  * 2, color: '#34A87A' },
                  { label: 'Protéines',     value: moyenneProt * 4, color: '#1D9E75' },
                  { label: 'Lipides',       value: moyenneLip  * 9, color: '#EF9F27' },
                ]} />
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div style={{ ...S.stat, background: '#E1F5EE' }}>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#0F6E56' }}>{moyenneCal}</div>
                    <div style={{ fontSize: '10px', color: '#3B6D11' }}>kcal/jour</div>
                    {objectifCal && <div style={{ fontSize: '10px', color: moyenneCal > objectifCal ? '#E24B4A' : '#1D9E75', marginTop: '2px' }}>
                      objectif {objectifCal} {moyenneCal > objectifCal ? '▲' : '✓'}
                    </div>}
                  </div>
                  <div style={S.stat}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1D9E75' }}>{moyenneProt}g</div>
                    <div style={{ fontSize: '10px', color: '#888' }}>protéines</div>
                  </div>
                  <div style={S.stat}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#60C8E8' }}>{moyenneGluc}g</div>
                    <div style={{ fontSize: '10px', color: '#888' }}>glucides</div>
                  </div>
                  <div style={S.stat}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#EF9F27' }}>{moyenneLip}g</div>
                    <div style={{ fontSize: '10px', color: '#888' }}>lipides</div>
                  </div>
                  <div style={{ ...S.stat, gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#34A87A' }}>{moyenneFib}g</div>
                    <div style={{ fontSize: '10px', color: '#888' }}>fibres <span style={{ color: '#bbb' }}>(recommandé : 25-30g/j)</span></div>
                  </div>
                </div>
              </div>
              {/* Légende camembert */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '11px', color: '#666', flexWrap: 'wrap' }}>
                {[
                  { color: '#60C8E8', label: 'Glucides nets', val: Math.max(0, moyenneGluc - moyenneFib), kcal: 4 },
                  { color: '#34A87A', label: 'Fibres',        val: moyenneFib,  kcal: 2 },
                  { color: '#1D9E75', label: 'Protéines',     val: moyenneProt, kcal: 4 },
                  { color: '#EF9F27', label: 'Lipides',       val: moyenneLip,  kcal: 9 },
                ].map(m => {
                  const pct = moyenneCal > 0 ? Math.round(m.val * m.kcal / moyenneCal * 100) : 0
                  return (
                    <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                      {m.label} {pct}%
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Détail par jour */}
          {planLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '13px' }}>Chargement du planning...</div>
          ) : (
            <div>
              {JOURS.map((jour, ji) => {
                const jourNut = nutritionSemaine[ji]
                const jourCal = Object.values(jourNut).reduce((s, n) => s + n.calories, 0)
                const hasSlots = REPAS.some(r => plan[ji]?.[r])
                if (!hasSlots) return null
                return (
                  <div key={ji} style={S.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '500' }}>
                        {jour} <span style={{ fontSize: '11px', color: '#888', fontWeight: '400' }}>
                          {formatDate(new Date(lundi.getTime() + ji * 86400000))}
                        </span>
                      </div>
                      {jourCal > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: objectifCal && jourCal > objectifCal ? '#E24B4A' : '#1D9E75' }}>{jourCal} kcal</span>
                          {objectifCal && (
                            <div style={{ width: '60px', height: '6px', background: '#f0f0ec', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: Math.min(100, jourCal / objectifCal * 100) + '%', background: jourCal > objectifCal ? '#E24B4A' : '#1D9E75', borderRadius: '3px' }} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {REPAS.map(repas => {
                      const slot = plan[ji]?.[repas]
                      if (!slot) return null
                      const nut = jourNut[repas]
                      return (
                        <div key={repas} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderTop: '0.5px solid #f5f5f0', fontSize: '12px' }}>
                          <span style={{ color: '#888', minWidth: '70px' }}>{REPAS_LABEL[repas]}</span>
                          <div style={{ flex: 1, color: '#555' }}>
                            {slot.recipes.map(sr => sr.recipe_id ? (recipeMap[sr.recipe_id]?.title || '') : (sr.note || 'Plat libre')).filter(Boolean).join(', ')}
                          </div>
                          {nut ? (
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                              <span style={{ padding: '1px 6px', borderRadius: '6px', background: '#E1F5EE', color: '#0F6E56', fontWeight: '500' }}>{nut.calories} kcal</span>
                              <span style={{ padding: '1px 6px', borderRadius: '6px', background: '#f0f0ec', color: '#666' }}>{nut.proteines}g prot</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '10px', color: '#bbb', fontStyle: 'italic' }}>pas de données</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              {!JOURS.some((_, ji) => REPAS.some(r => plan[ji]?.[r])) && (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📅</div>
                  <div style={{ fontSize: '13px' }}>Aucun repas planifié cette semaine</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Onglet Poids ────────────────────────────────────────────────────── */}
      {onglet === 'poids' && (
        <div>
          {/* Saisie poids */}
          <div style={S.card}>
            <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '10px' }}>Enregistrer mon poids</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <label style={S.label}>Poids (kg)</label>
                <input type="number" step="0.1" min="30" max="300" value={newPoids} onChange={e => setNewPoids(e.target.value)}
                  placeholder="85.0" style={S.input} />
              </div>
              <div>
                <label style={S.label}>Date</label>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={S.input} />
              </div>
            </div>
            <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Note optionnelle..." style={{ ...S.input, marginBottom: '8px' }} />
            <button onClick={addWeightLog} disabled={!newPoids}
              style={{ width: '100%', padding: '9px', background: newPoids ? '#1D9E75' : '#ddd', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: newPoids ? 'pointer' : 'default', fontWeight: '500' }}>
              Enregistrer
            </button>
          </div>

          {/* Courbe */}
          {weightLogs.length > 0 && (
            <div style={S.card}>
              <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '10px' }}>
                Courbe de poids
                <span style={{ fontSize: '11px', color: '#888', fontWeight: '400', marginLeft: '6px' }}>— tendance en orange</span>
              </div>
              <WeightChart logs={weightLogs} poidsActuel={goals?.poids_actuel} poidsCible={goals?.poids_cible} />
              {goals?.poids_cible && (
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '16px', height: '2px', background: '#1D9E75' }} />
                    Poids
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '16px', height: '2px', background: '#1D9E75', opacity: 0.4 }} />
                    Objectif ({goals.poids_cible} kg)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '16px', height: '2px', background: '#EF9F27' }} />
                    Tendance
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Historique */}
          {weightLogs.length > 0 && (
            <div style={S.card}>
              <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '10px' }}>Historique</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {[...weightLogs].reverse().map((log, i) => {
                  const prev = weightLogs[weightLogs.length - 1 - i - 1]
                  const diff = prev ? parseFloat((log.poids - prev.poids).toFixed(1)) : null
                  return (
                    <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '0.5px solid #f5f5f0' }}>
                      <div style={{ fontSize: '12px', color: '#888', minWidth: '90px' }}>
                        {new Date(log.date).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </div>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#333' }}>{log.poids} kg</div>
                      {diff !== null && (
                        <span style={{ fontSize: '11px', color: diff < 0 ? '#1D9E75' : diff > 0 ? '#E24B4A' : '#aaa', fontWeight: '500' }}>
                          {diff > 0 ? '+' : ''}{diff} kg
                        </span>
                      )}
                      {log.note && <span style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', flex: 1 }}>{log.note}</span>}
                      <button onClick={() => deleteWeightLog(log.id)}
                        style={{ background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', fontSize: '14px', padding: 0, marginLeft: 'auto' }}>✕</button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Onglet Profil ───────────────────────────────────────────────────── */}
      {onglet === 'profil' && (
        <div style={S.card}>
          <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '12px' }}>Mon profil nutritionnel</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={S.label}>Poids actuel (kg)</label>
              <input type="number" step="0.1" value={formGoals.poids_actuel}
                onChange={e => setFormGoals(f => ({ ...f, poids_actuel: e.target.value }))}
                placeholder="85" style={S.input} />
            </div>
            <div>
              <label style={S.label}>Poids cible (kg)</label>
              <input type="number" step="0.1" value={formGoals.poids_cible}
                onChange={e => setFormGoals(f => ({ ...f, poids_cible: e.target.value }))}
                placeholder="80" style={S.input} />
            </div>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={S.label}>Date cible</label>
            <input type="date" value={formGoals.date_cible}
              onChange={e => setFormGoals(f => ({ ...f, date_cible: e.target.value }))}
              style={S.input} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={S.label}>Niveau d'activité physique</label>
            <select value={formGoals.sport} onChange={e => setFormGoals(f => ({ ...f, sport: e.target.value }))} style={S.input}>
              {SPORTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Estimation TDEE */}
          {formGoals.poids_actuel && (
            <div style={{ background: '#f5faf8', border: '0.5px solid #b8e8d8', borderRadius: '10px', padding: '12px', marginBottom: '14px', fontSize: '12px' }}>
              <div style={{ fontWeight: '500', color: '#0F6E56', marginBottom: '4px' }}>Estimation de tes besoins</div>
              <div style={{ color: '#555' }}>
                TDEE : ~{calcTDEE(parseFloat(formGoals.poids_actuel), formGoals.sport)} kcal/jour
                {formGoals.poids_cible && formGoals.date_cible && (
                  <> · Objectif : ~{calcObjectifCal(
                    calcTDEE(parseFloat(formGoals.poids_actuel), formGoals.sport),
                    parseFloat(formGoals.poids_actuel),
                    parseFloat(formGoals.poids_cible),
                    formGoals.date_cible
                  )} kcal/jour</>
                )}
              </div>
              <div style={{ color: '#888', marginTop: '4px', fontSize: '11px' }}>
                Note : estimation basée sur le poids uniquement (formule simplifiée). Pour plus de précision, consulte un nutritionniste.
              </div>
            </div>
          )}

          <button onClick={saveGoals} disabled={saving}
            style={{ width: '100%', padding: '10px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Enregistrement...' : 'Enregistrer le profil'}
          </button>
        </div>
      )}

      {/* ── Onglet Conseils ─────────────────────────────────────────────────── */}
      {onglet === 'conseils' && (
        <div>
          {!goals?.poids_cible ? (
            <div style={{ ...S.card, textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>👤</div>
              <div style={{ fontSize: '13px', color: '#888' }}>Complète ton profil pour recevoir des conseils personnalisés</div>
              <button onClick={() => setOnglet('profil')} style={{ marginTop: '12px', padding: '8px 16px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                Compléter le profil
              </button>
            </div>
          ) : (
            <div>
              {/* Bilan */}
              <div style={S.card}>
                <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '10px' }}>Bilan de la semaine</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div style={S.stat}>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>{moyenneCal || '–'}</div>
                    <div style={{ fontSize: '10px', color: '#888' }}>kcal moy./jour</div>
                  </div>
                  <div style={S.stat}>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1D9E75' }}>{objectifCal || '–'}</div>
                    <div style={{ fontSize: '10px', color: '#888' }}>kcal objectif</div>
                  </div>
                  <div style={{ ...S.stat, background: moyenneCal && objectifCal ? (moyenneCal > objectifCal ? '#FCEBEB' : '#E1F5EE') : '#f5f5f0' }}>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: moyenneCal && objectifCal ? (moyenneCal > objectifCal ? '#E24B4A' : '#1D9E75') : '#aaa' }}>
                      {moyenneCal && objectifCal ? (moyenneCal > objectifCal ? '+' : '') + (moyenneCal - objectifCal) : '–'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#888' }}>écart kcal</div>
                  </div>
                </div>
              </div>

              {/* Conseils */}
              <div style={S.card}>
                <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '10px' }}>Recommandations</div>
                {getConseils().length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', padding: '1rem' }}>
                    Pas assez de données cette semaine pour générer des conseils.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {getConseils().map((c, i) => (
                      <div key={i} style={{
                        padding: '10px 12px', borderRadius: '8px', fontSize: '13px', lineHeight: 1.5,
                        background: c.type === 'warning' ? '#FAEEDA' : c.type === 'ok' ? '#E1F5EE' : '#E6F1FB',
                        color: c.type === 'warning' ? '#633806' : c.type === 'ok' ? '#0F6E56' : '#185FA5',
                        borderLeft: '3px solid ' + (c.type === 'warning' ? '#EF9F27' : c.type === 'ok' ? '#1D9E75' : '#4A90D9')
                      }}>
                        {c.type === 'warning' ? '⚠️ ' : c.type === 'ok' ? '✅ ' : 'ℹ️ '}{c.txt}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Projection */}
              {kgRestants > 0 && joursRestants > 0 && tdee && (
                <div style={S.card}>
                  <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '10px' }}>Projection</div>
                  <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.6 }}>
                    Pour perdre <strong>{kgRestants.toFixed(1)} kg</strong> en <strong>{joursRestants} jours</strong>, tu dois maintenir un déficit de <strong>{tdee - objectifCal} kcal/jour</strong>.
                    {moyenneCal > 0 && (
                      <> À ton rythme actuel ({moyenneCal} kcal/j), tu perdrais environ <strong>{((tdee - moyenneCal) * joursRestants / 7700).toFixed(1)} kg</strong> d'ici là.</>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
