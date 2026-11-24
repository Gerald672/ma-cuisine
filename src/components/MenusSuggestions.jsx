import { useState } from 'react'
import { supabase } from '../lib/supabase'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const REPAS = ['Petit-dejeuner', 'Diner', 'Souper']
const REPAS_LABEL = { 'Petit-dejeuner': '☕ Petit-déj.', 'Diner': '🍽 Dîner', 'Souper': '🌙 Souper' }
const PART = { 'Petit-dejeuner': 0.2, 'Diner': 0.4, 'Souper': 0.4 }   // part de l'objectif du jour
const A_EXCLURE = ['dessert', 'sauce', 'aperitif', 'viennoiserie', 'accompagnement', 'entree']
const NB_MENUS = 7

const card = { background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '12px' }
const btnP = { background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }
const btnO = { background: 'white', color: '#1D9E75', border: '0.5px solid #1D9E75', borderRadius: '8px', padding: '7px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }
const btnG = { background: 'white', color: '#555', border: '0.5px solid #ddd', borderRadius: '8px', padding: '7px 12px', fontSize: '12px', cursor: 'pointer' }

function aleatoire(liste) { return liste[Math.floor(Math.random() * liste.length)] }

export default function MenusSuggestions({ user, recipes, nutOf, objectifCal, lundi, wKey, plan, reloadPlan, weekOffset, setWeekOffset }) {
  const [cible, setCible]     = useState(objectifCal || 2000)
  const [slots, setSlots]     = useState({ 'Petit-dejeuner': false, 'Diner': true, 'Souper': true })
  const [menus, setMenus]     = useState([])
  const [valider, setValider] = useState(null)   // { type: 'menu'|'recette', menuIdx, repas, recette }
  const [jourSel, setJourSel] = useState(null)
  const [repasSel, setRepasSel] = useState('Diner')
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState('')

  const slotsActifs = REPAS.filter(function(r) { return slots[r] })
  const partTotale = slotsActifs.reduce(function(s, r) { return s + PART[r] }, 0)
  const cibleJour = Math.round((parseInt(cible, 10) || 0) * partTotale)

  // Recettes exploitables : avec une nutrition connue (par portion)
  const utilisables = recipes.map(function(r) { return { r: r, n: nutOf(r) } }).filter(function(x) { return x.n && x.n.calories > 0 })

  function candidats(repas) {
    var liste
    if (repas === 'Petit-dejeuner') {
      liste = utilisables.filter(function(x) { return (x.r.cats || []).includes('viennoiserie') || x.n.calories <= 450 })
    } else {
      liste = utilisables.filter(function(x) { return x.n.calories >= 250 && !(x.r.cats || []).some(function(c) { return A_EXCLURE.includes(c) }) })
      if (liste.length < 4) liste = utilisables.filter(function(x) { return x.n.calories >= 200 && !(x.r.cats || []).some(function(c) { return c === 'dessert' || c === 'sauce' || c === 'viennoiserie' }) })
    }
    return liste
  }

  // Un menu = une recette par repas choisi, dont le total s'approche de l'objectif
  function composerMenu(usage) {
    var best = null
    for (var essai = 0; essai < 300; essai++) {
      var choix = {}
      var ids = []
      var ok = true
      for (var i = 0; i < slotsActifs.length; i++) {
        var rep = slotsActifs[i]
        var c = candidats(rep).filter(function(x) { return ids.indexOf(x.r.id) === -1 })
        if (!c.length) { ok = false; break }
        var pick = aleatoire(c)
        choix[rep] = pick
        ids.push(pick.r.id)
      }
      if (!ok) return null
      var total = 0
      var ecartRepas = 0
      var reuse = 0
      slotsActifs.forEach(function(rep) {
        var k = choix[rep].n.calories
        total += k
        ecartRepas += Math.abs(k - (parseInt(cible, 10) || 0) * PART[rep])
        reuse += usage[choix[rep].r.id] || 0
      })
      var score = Math.abs(total - cibleJour) / Math.max(cibleJour, 1) + 0.3 * ecartRepas / Math.max(cibleJour, 1) + 0.25 * reuse
      if (!best || score < best.score) best = { score: score, choix: choix }
    }
    return best ? best.choix : null
  }

  function totaux(menu) {
    var t = { calories: 0, proteines: 0, glucides: 0, lipides: 0 }
    Object.keys(menu).forEach(function(rep) {
      var n = menu[rep].n
      t.calories += n.calories || 0
      t.proteines += n.proteines || 0
      t.glucides += n.glucides || 0
      t.lipides += n.lipides || 0
    })
    return t
  }

  function generer() {
    setMsg('')
    if (!slotsActifs.length) { setMsg('Choisis au moins un repas à planifier.'); return }
    if (!(cibleJour > 0)) { setMsg("Indique ton objectif de calories par jour."); return }
    var usage = {}
    var res = []
    for (var m = 0; m < NB_MENUS; m++) {
      var menu = composerMenu(usage)
      if (!menu) { setMsg("Pas assez de recettes avec des valeurs nutritionnelles pour composer des menus (il en faut au moins " + (slotsActifs.length + 1) + ")."); setMenus([]); return }
      Object.keys(menu).forEach(function(rep) { usage[menu[rep].r.id] = (usage[menu[rep].r.id] || 0) + 1 })
      res.push(menu)
    }
    setMenus(res)
  }

  function autreProposition(idx) {
    var usage = {}
    menus.forEach(function(mn, i) {
      if (i === idx) return
      Object.keys(mn).forEach(function(rep) { usage[mn[rep].r.id] = (usage[mn[rep].r.id] || 0) + 1 })
    })
    var nouveau = composerMenu(usage)
    if (nouveau) setMenus(function(prev) { return prev.map(function(x, i) { return i === idx ? nouveau : x }) })
  }

  // ---- Enregistrement dans le planning
  async function ajouterAuPlanning(jourIndex, repas, recipeId) {
    var { data: ex, error: e1 } = await supabase.from('meal_plan').select('id')
      .eq('user_id', user.id).eq('week_start', wKey).eq('jour_index', jourIndex).eq('repas', repas).maybeSingle()
    if (e1) throw new Error(e1.message)
    var slotId = ex ? ex.id : null
    if (!slotId) {
      var { data: cree, error: e2 } = await supabase.from('meal_plan').insert({
        user_id: user.id, week_start: wKey, jour_index: jourIndex, repas: repas, convives: 2, invites: []
      }).select().single()
      if (e2) throw new Error(e2.message)
      slotId = cree.id
    }
    var { data: deja } = await supabase.from('meal_plan_recipes').select('id, recipe_id').eq('meal_plan_id', slotId)
    if ((deja || []).some(function(d) { return d.recipe_id === recipeId })) return false
    var { error: e3 } = await supabase.from('meal_plan_recipes').insert({ meal_plan_id: slotId, recipe_id: recipeId, position: (deja || []).length })
    if (e3) throw new Error(e3.message)
    return true
  }

  function ouvrirMenu(idx) {
    setValider({ type: 'menu', menuIdx: idx })
    setJourSel(null)
  }
  function ouvrirRecette(idx, repas) {
    setValider({ type: 'recette', menuIdx: idx, repas: repas })
    setJourSel(null)
    setRepasSel(repas)
  }

  async function confirmer() {
    if (jourSel === null || !valider) return
    setSaving(true)
    try {
      var menu = menus[valider.menuIdx]
      var n = 0
      if (valider.type === 'menu') {
        for (var i = 0; i < slotsActifs.length; i++) {
          var rep = slotsActifs[i]
          if (menu[rep] && await ajouterAuPlanning(jourSel, rep, menu[rep].r.id)) n++
        }
      } else if (await ajouterAuPlanning(jourSel, repasSel, menu[valider.repas].r.id)) n++
      await reloadPlan()
      setMsg(n > 0 ? '✓ Ajouté au planning : ' + JOURS[jourSel] + (valider.type === 'recette' ? ' · ' + REPAS_LABEL[repasSel] : ' (' + n + ' repas)') : 'Déjà dans le planning pour ce jour.')
      setValider(null)
    } catch (e) {
      setMsg('Erreur : ' + e.message)
    }
    setSaving(false)
  }

  function dateJour(i) {
    var d = new Date(lundi)
    d.setDate(d.getDate() + i)
    return d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })
  }
  function occupe(i, repas) {
    var s = plan[i] && plan[i][repas]
    return s && (s.recipes || []).length > 0
  }

  var chip = function(on) {
    return { padding: '6px 12px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer', border: '0.5px solid ' + (on ? '#1D9E75' : '#e0e0e0'), background: on ? '#E1F5EE' : 'white', color: on ? '#0F6E56' : '#666', fontWeight: on ? '500' : '400' }
  }

  return (
    <div>
      {msg && (
        <div style={{ background: msg.indexOf('✓') === 0 ? '#E1F5EE' : '#FAEEDA', border: '0.5px solid ' + (msg.indexOf('✓') === 0 ? '#5DCAA5' : '#EF9F27'), borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#333', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>x</button>
        </div>
      )}

      {/* Réglages */}
      <div style={card}>
        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '2px' }}>Suggestions de menus</div>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
          Composés avec tes recettes et leurs valeurs nutritionnelles, pour s'approcher de ton objectif. Valide un menu ou une recette : je te demande le jour et le repas, puis je l'ajoute au Planning.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '12px', color: '#666' }}>Objectif du jour</label>
          <input type="number" value={cible} onChange={e => setCible(e.target.value)} min="800" max="5000" step="50"
            style={{ width: '90px', padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', background: '#fafaf8', textAlign: 'right' }} />
          <span style={{ fontSize: '12px', color: '#888' }}>kcal {objectifCal ? '(calculé depuis ton profil : ' + objectifCal + ')' : ''}</span>
        </div>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>Repas à planifier</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {REPAS.map(function(r) {
            return <button key={r} onClick={() => setSlots(function(s) { return { ...s, [r]: !s[r] } })} style={chip(slots[r])}>{slots[r] ? '✓ ' : ''}{REPAS_LABEL[r]}</button>
          })}
        </div>
        <div style={{ fontSize: '11px', color: '#999', marginBottom: '12px' }}>
          Les repas choisis couvrent {Math.round(partTotale * 100)} % de l'objectif ({cibleJour} kcal) ; le reste est pour le petit-déjeuner et les collations.
        </div>
        <button onClick={generer} style={btnP}>{menus.length ? '🔄 Tout régénérer' : '✨ Proposer des menus'}</button>
        <span style={{ fontSize: '11px', color: '#aaa', marginLeft: '10px' }}>{utilisables.length} recette(s) avec valeurs nutritionnelles</span>
      </div>

      {/* Navigation semaine : le planning visé */}
      {menus.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 2px 10px', fontSize: '12px', color: '#666' }}>
          <span>Ajout au planning de la semaine du <strong>{lundi.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })}</strong></span>
          <span>
            <button onClick={() => setWeekOffset(weekOffset - 1)} style={{ ...btnG, padding: '4px 10px' }}>‹</button>{' '}
            <button onClick={() => setWeekOffset(weekOffset + 1)} style={{ ...btnG, padding: '4px 10px' }}>›</button>
          </span>
        </div>
      )}

      {/* Menus proposés */}
      {menus.map(function(menu, idx) {
        var t = totaux(menu)
        var ecart = t.calories - cibleJour
        var bon = Math.abs(ecart) <= cibleJour * 0.1
        return (
          <div key={idx} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>Menu {idx + 1}</div>
              <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '500', background: bon ? '#E1F5EE' : '#FAEEDA', color: bon ? '#0F6E56' : '#854F0B' }}>
                {Math.round(t.calories)} kcal {bon ? '✓' : (ecart > 0 ? '(+' + Math.round(ecart) + ')' : '(' + Math.round(ecart) + ')')}
              </span>
            </div>
            {slotsActifs.map(function(rep) {
              var x = menu[rep]
              if (!x) return null
              return (
                <div key={rep} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderTop: '0.5px solid #f0f0ec' }}>
                  <div style={{ fontSize: '20px' }}>{x.r.emoji || '🍽'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', color: '#888' }}>{REPAS_LABEL[rep]}</div>
                    <div style={{ fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.r.title}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>{Math.round(x.n.calories)} kcal · P {Math.round(x.n.proteines || 0)} g · G {Math.round(x.n.glucides || 0)} g · L {Math.round(x.n.lipides || 0)} g</div>
                  </div>
                  <button onClick={() => ouvrirRecette(idx, rep)} style={btnG}>+ Planning</button>
                </div>
              )
            })}
            <div style={{ fontSize: '11px', color: '#888', margin: '8px 0 10px' }}>
              Total : P {Math.round(t.proteines)} g · G {Math.round(t.glucides)} g · L {Math.round(t.lipides)} g
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => ouvrirMenu(idx)} style={{ ...btnP, flex: 1 }}>✓ Valider ce menu</button>
              <button onClick={() => autreProposition(idx)} style={btnO}>🔄 Autre</button>
            </div>
          </div>
        )
      })}

      {/* Choix du jour (et du repas) */}
      {valider && menus[valider.menuIdx] && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>
              {valider.type === 'menu' ? 'Pour quel jour ce menu ?' : 'Pour quel jour et quel repas ?'}
            </div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
              {valider.type === 'menu'
                ? slotsActifs.map(function(rep) { return REPAS_LABEL[rep] + ' : ' + menus[valider.menuIdx][rep].r.title }).join('  ·  ')
                : menus[valider.menuIdx][valider.repas].r.title}
            </div>

            {valider.type === 'recette' && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {REPAS.map(function(r) { return <button key={r} onClick={() => setRepasSel(r)} style={chip(repasSel === r)}>{REPAS_LABEL[r]}</button> })}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px', marginBottom: '14px' }}>
              {JOURS.map(function(j, i) {
                var rempli = valider.type === 'menu' ? slotsActifs.some(function(r) { return occupe(i, r) }) : occupe(i, repasSel)
                var on = jourSel === i
                return (
                  <button key={j} onClick={() => setJourSel(i)} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer', textAlign: 'left',
                    border: '0.5px solid ' + (on ? '#1D9E75' : '#e0e0e0'), background: on ? '#E1F5EE' : 'white', color: on ? '#0F6E56' : '#333', fontWeight: on ? '600' : '400'
                  }}>
                    <span>{j} <span style={{ fontSize: '12px', color: '#999', fontWeight: '400' }}>{dateJour(i)}</span></span>
                    {rempli && <span style={{ fontSize: '11px', color: '#854F0B', background: '#FAEEDA', padding: '2px 8px', borderRadius: '8px' }}>déjà prévu</span>}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: '11px', color: '#999', marginBottom: '12px' }}>Si le repas est déjà prévu ce jour-là, la recette est ajoutée à côté de l'existant.</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={confirmer} disabled={jourSel === null || saving} style={{ ...btnP, flex: 1, opacity: jourSel === null ? 0.5 : 1 }}>{saving ? 'Enregistrement...' : 'Ajouter au planning'}</button>
              <button onClick={() => setValider(null)} style={btnG}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
