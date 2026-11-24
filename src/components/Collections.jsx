import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SECTIONS = ['Apéro', 'Entrée', 'Plat', 'Accompagnement', 'Dessert', 'Boisson', 'Autre']
const EMOJIS = ['🎄', '🥂', '🎂', '🍽️', '🎃', '🐣', '🔥', '🌞']
const PRESETS = [
  { nom: 'Noël', emoji: '🎄' }, { nom: 'Nouvel an', emoji: '🥂' }, { nom: 'Anniversaire', emoji: '🎂' }, { nom: 'Pâques', emoji: '🐣' },
]

const card = { background: 'white', border: '0.5px solid #DDE2D6', borderRadius: '12px', padding: '1rem', marginBottom: '10px' }
const btnP = { background: '#2F6B4A', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }
const btnG = { background: 'white', color: '#555', border: '0.5px solid #ddd', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', cursor: 'pointer' }
const inputS = { width: '100%', padding: '9px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#F6F8F2', boxSizing: 'border-box' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: '1rem' }
const box = { background: 'white', borderRadius: '16px', padding: '1.25rem', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }

function sectionAuto(recipe) {
  var c = recipe.cats || []
  if (c.includes('aperitif')) return 'Apéro'
  if (c.includes('entree') || c.includes('soupe')) return 'Entrée'
  if (c.includes('accompagnement')) return 'Accompagnement'
  if (c.includes('dessert') || c.includes('viennoiserie')) return 'Dessert'
  if (c.includes('sauce')) return 'Autre'
  return 'Plat'
}

function joursRestants(dateStr) {
  if (!dateStr) return null
  var p = dateStr.split('-')
  var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10))
  var t = new Date(); t.setHours(0, 0, 0, 0)
  return Math.round((d - t) / 86400000)
}

function dateLisible(dateStr) {
  if (!dateStr) return ''
  var p = dateStr.split('-')
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })
}

function labelJours(n) {
  if (n === null) return ''
  if (n === 0) return "C'est aujourd'hui !"
  if (n === 1) return 'Demain'
  if (n > 1) return 'dans ' + n + ' jours'
  return 'passé'
}

// Charge collections + éléments
function useCollections(user) {
  const [cols, setCols]   = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur]   = useState('')

  async function reload() {
    var a = await supabase.from('recipe_collections').select('*').order('date_evenement', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true })
    var b = await supabase.from('recipe_collection_items').select('*').order('position', { ascending: true })
    if (a.error || b.error) setErreur((a.error || b.error).message)
    else setErreur('')
    setCols(a.data || [])
    setItems(b.data || [])
    setLoading(false)
  }
  useEffect(function() { reload() }, [user])
  return { cols: cols, items: items, loading: loading, erreur: erreur, reload: reload }
}

// ---- Formulaire collection (création / modification)
function FormCollection({ user, init, onClose, onSaved }) {
  const [nom, setNom]     = useState(init ? init.nom : '')
  const [emoji, setEmoji] = useState(init ? init.emoji : '🎄')
  const [date, setDate]   = useState(init && init.date_evenement ? init.date_evenement : '')
  const [convives, setConvives] = useState(init && init.convives ? String(init.convives) : '')
  const [notes, setNotes] = useState(init && init.notes ? init.notes : '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!nom.trim()) { setErr('Donne un nom à la collection.'); return }
    setSaving(true)
    var row = { nom: nom.trim(), emoji: emoji, date_evenement: date || null, convives: parseInt(convives, 10) || null, notes: notes || null }
    var res = init
      ? await supabase.from('recipe_collections').update(row).eq('id', init.id).select().single()
      : await supabase.from('recipe_collections').insert({ ...row, user_id: user.id }).select().single()
    setSaving(false)
    if (res.error) { setErr('Erreur : ' + res.error.message); return }
    onSaved(res.data)
  }

  return (
    <div style={overlay}>
      <div style={box}>
        <h3 style={{ fontSize: '15px', fontWeight: '500', marginBottom: '12px' }}>{init ? 'Modifier la collection' : 'Nouvelle collection'}</h3>
        {!init && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {PRESETS.map(function(p) {
              return <button key={p.nom} onClick={() => { setNom(p.nom); setEmoji(p.emoji) }} style={btnG}>{p.emoji} {p.nom}</button>
            })}
          </div>
        )}
        <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Nom</label>
        <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex. Noël 2026" style={{ ...inputS, marginBottom: '10px' }} />
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {EMOJIS.map(function(e) {
            return <button key={e} onClick={() => setEmoji(e)} style={{ width: '38px', height: '38px', borderRadius: '10px', fontSize: '20px', cursor: 'pointer', border: '0.5px solid ' + (emoji === e ? '#2F6B4A' : '#DDE2D6'), background: emoji === e ? '#E3EDE2' : 'white' }}>{e}</button>
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Date (facultatif)</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputS} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Convives</label>
            <input type="number" min="1" value={convives} onChange={e => setConvives(e.target.value)} placeholder="8" style={inputS} />
          </div>
        </div>
        <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Ex. allergies, idées de boissons..." style={{ ...inputS, resize: 'vertical', fontFamily: 'inherit', marginBottom: '12px' }} />
        {err && <div style={{ background: '#FCEBEB', color: '#791F1F', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '10px' }}>{err}</div>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={save} disabled={saving} style={{ ...btnP, flex: 1 }}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
          <button onClick={onClose} style={btnG}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

// ---- Sélecteur de recettes à ajouter
function Picker({ user, col, recipes, deja, onClose, onAdded }) {
  const [q, setQ]       = useState('')
  const [sel, setSel]   = useState({})
  const [section, setSection] = useState('auto')
  const [saving, setSaving]   = useState(false)
  const [err, setErr] = useState('')

  var dispo = recipes.filter(function(r) { return !deja.includes(r.id) && r.title.toLowerCase().includes(q.trim().toLowerCase()) })
  var n = Object.keys(sel).filter(function(k) { return sel[k] }).length

  async function ajouter() {
    setSaving(true)
    var ids = Object.keys(sel).filter(function(k) { return sel[k] })
    var rows = ids.map(function(id, i) {
      var r = recipes.find(function(x) { return x.id === id })
      return { user_id: user.id, collection_id: col.id, recipe_id: id, section: section === 'auto' ? sectionAuto(r) : section, position: deja.length + i }
    })
    var res = await supabase.from('recipe_collection_items').insert(rows)
    setSaving(false)
    if (res.error) { setErr('Erreur : ' + res.error.message); return }
    onAdded()
  }

  return (
    <div style={overlay}>
      <div style={{ ...box, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '500', marginBottom: '10px' }}>Ajouter à « {col.nom} »</h3>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher une recette..." style={{ ...inputS, marginBottom: '8px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', color: '#666' }}>Rubrique</span>
          <select value={section} onChange={e => setSection(e.target.value)} style={{ ...inputS, width: 'auto', flex: 1 }}>
            <option value="auto">Automatique (selon la catégorie)</option>
            {SECTIONS.map(function(s) { return <option key={s} value={s}>{s}</option> })}
          </select>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '45vh', border: '0.5px solid #E9ECE3', borderRadius: '10px', marginBottom: '10px' }}>
          {dispo.length === 0 && <div style={{ padding: '1rem', textAlign: 'center', fontSize: '12px', color: '#aaa' }}>Aucune recette à ajouter.</div>}
          {dispo.map(function(r) {
            return (
              <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderTop: '0.5px solid #EEF1EA', cursor: 'pointer', background: sel[r.id] ? '#E3EDE2' : 'white' }}>
                <input type="checkbox" checked={!!sel[r.id]} onChange={() => setSel(function(s) { return { ...s, [r.id]: !s[r.id] } })} style={{ width: '18px', height: '18px' }} />
                <span style={{ fontSize: '18px' }}>{r.emoji || '🍳'}</span>
                <span style={{ fontSize: '13px', flex: 1 }}>{r.title}</span>
              </label>
            )
          })}
        </div>
        {err && <div style={{ background: '#FCEBEB', color: '#791F1F', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '10px' }}>{err}</div>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={ajouter} disabled={n === 0 || saving} style={{ ...btnP, flex: 1, opacity: n === 0 ? 0.5 : 1 }}>{saving ? 'Ajout...' : 'Ajouter (' + n + ')'}</button>
          <button onClick={onClose} style={btnG}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

// ---- Vue principale : liste des collections puis détail
export default function CollectionsView({ user, recipes, onOpenRecipe }) {
  const { cols, items, loading, erreur, reload } = useCollections(user)
  const [openId, setOpenId]   = useState(null)
  const [form, setForm]       = useState(null)      // null | 'new' | collection
  const [picker, setPicker]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [msg, setMsg]         = useState('')

  var recipeMap = {}
  recipes.forEach(function(r) { recipeMap[r.id] = r })
  var col = cols.find(function(c) { return c.id === openId })

  async function supprimerCollection() {
    var res = await supabase.from('recipe_collections').delete().eq('id', col.id)
    if (res.error) { setMsg('Erreur : ' + res.error.message); return }
    setConfirmDel(false); setOpenId(null); reload()
  }
  async function retirer(itemId) {
    await supabase.from('recipe_collection_items').delete().eq('id', itemId)
    reload()
  }
  async function changerSection(itemId, section) {
    await supabase.from('recipe_collection_items').update({ section: section }).eq('id', itemId)
    reload()
  }
  async function copierMenu(c, its) {
    var lignes = [c.emoji + ' ' + c.nom + (c.date_evenement ? ' — ' + dateLisible(c.date_evenement) : '')]
    SECTIONS.forEach(function(s) {
      var l = its.filter(function(i) { return i.section === s && recipeMap[i.recipe_id] })
      if (l.length) {
        lignes.push('')
        lignes.push(s + ' :')
        l.forEach(function(i) { lignes.push('- ' + recipeMap[i.recipe_id].title) })
      }
    })
    try { await navigator.clipboard.writeText(lignes.join('\n')); setMsg('Menu copié : tu peux le coller dans un message.') }
    catch (e) { setMsg('Copie impossible sur cet appareil.') }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Chargement...</div>

  var msgBox = msg ? (
    <div style={{ background: '#E3EDE2', border: '0.5px solid #9DC2A8', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#143626', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
      <span>{msg}</span><button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>x</button>
    </div>
  ) : null
  var errBox = erreur ? (
    <div style={{ background: '#FCEBEB', color: '#791F1F', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>
      Les collections ne sont pas encore activées ({erreur}). Exécute d'abord le fichier supabase-collections.sql dans Supabase.
    </div>
  ) : null

  // ===== Détail d'une collection
  if (col) {
    var its = items.filter(function(i) { return i.collection_id === col.id && recipeMap[i.recipe_id] })
    var cout = its.reduce(function(s, i) { return s + (parseFloat(recipeMap[i.recipe_id].cost) || 0) }, 0)
    var jr = joursRestants(col.date_evenement)
    return (
      <div>
        {msgBox}
        <button onClick={() => setOpenId(null)} style={{ ...btnG, marginBottom: '10px' }}>‹ Collections</button>
        <div style={{ ...card, background: '#E3EDE2', borderColor: '#9DC2A8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '34px' }}>{col.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '17px', fontWeight: '600', color: '#143626' }}>{col.nom}</div>
              <div style={{ fontSize: '12px', color: '#3B6D11' }}>
                {col.date_evenement ? dateLisible(col.date_evenement) + (jr !== null && jr >= 0 ? ' · ' + labelJours(jr) : '') : 'Sans date'}
                {col.convives ? ' · ' + col.convives + ' convives' : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '12px', color: '#143626' }}>
            <span><strong>{its.length}</strong> recette{its.length > 1 ? 's' : ''}</span>
            {cout > 0 && <span>≈ <strong>{Math.round(cout)} CHF</strong> (indicatif)</span>}
          </div>
          {col.notes && <div style={{ fontSize: '12px', color: '#3B6D11', marginTop: '8px' }}>{col.notes}</div>}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <button onClick={() => setPicker(true)} style={btnP}>+ Ajouter des recettes</button>
          <button onClick={() => copierMenu(col, its)} disabled={!its.length} style={btnG}>📋 Copier le menu</button>
          <button onClick={() => setForm(col)} style={btnG}>✏️ Modifier</button>
          {confirmDel
            ? <button onClick={supprimerCollection} style={{ ...btnG, background: '#E24B4A', color: 'white', border: 'none' }}>Confirmer la suppression</button>
            : <button onClick={() => setConfirmDel(true)} style={{ ...btnG, color: '#E24B4A', borderColor: '#E24B4A' }}>Supprimer</button>}
        </div>

        {its.length === 0 && (
          <div style={{ ...card, textAlign: 'center', color: '#888', fontSize: '13px' }}>Aucune recette pour l'instant. Touche « + Ajouter des recettes ».</div>
        )}
        {SECTIONS.map(function(s) {
          var l = its.filter(function(i) { return i.section === s })
          if (!l.length) return null
          return (
            <div key={s} style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#888', padding: '0 4px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s} ({l.length})</div>
              <div style={{ background: 'white', border: '0.5px solid #DDE2D6', borderRadius: '12px', overflow: 'hidden' }}>
                {l.map(function(i, k) {
                  var r = recipeMap[i.recipe_id]
                  return (
                    <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderTop: k ? '0.5px solid #E9ECE3' : 'none' }}>
                      <div onClick={() => onOpenRecipe(r)} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, cursor: 'pointer' }}>
                        <span style={{ fontSize: '22px' }}>{r.emoji || '🍳'}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                          <div style={{ fontSize: '11px', color: '#888' }}>{r.time ? r.time + ' min' : ''}{r.cost > 0 ? ' · ~' + r.cost + ' CHF' : ''}</div>
                        </div>
                      </div>
                      <select value={i.section} onChange={e => changerSection(i.id, e.target.value)} aria-label="Rubrique"
                        style={{ padding: '5px 6px', border: '0.5px solid #DDE2D6', borderRadius: '8px', fontSize: '11px', background: 'white', color: '#666', maxWidth: '96px' }}>
                        {SECTIONS.map(function(x) { return <option key={x} value={x}>{x}</option> })}
                      </select>
                      <button onClick={() => retirer(i.id)} aria-label="Retirer de la collection" style={{ background: 'none', border: 'none', color: '#bbb', fontSize: '18px', cursor: 'pointer', padding: '0 4px' }}>×</button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {picker && <Picker user={user} col={col} recipes={recipes} deja={items.filter(function(i) { return i.collection_id === col.id }).map(function(i) { return i.recipe_id })}
          onClose={() => setPicker(false)} onAdded={() => { setPicker(false); reload() }} />}
        {form && form !== 'new' && <FormCollection user={user} init={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload() }} />}
      </div>
    )
  }

  // ===== Liste des collections
  return (
    <div>
      {msgBox}
      {errBox}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#888' }}>Regroupe les recettes d'un événement : Noël, un anniversaire, un repas de fête...</div>
        <button onClick={() => setForm('new')} style={{ ...btnP, flexShrink: 0, marginLeft: '10px' }}>+ Nouvelle</button>
      </div>
      {cols.length === 0 && !erreur && (
        <div style={{ ...card, textAlign: 'center', color: '#666', fontSize: '13px', lineHeight: 1.7 }}>
          <div style={{ fontSize: '32px', marginBottom: '6px' }}>🎄</div>
          Aucune collection pour l'instant.<br />Crée « Noël » et ajoute-y les recettes que tu prévois.
        </div>
      )}
      {cols.map(function(c) {
        var its = items.filter(function(i) { return i.collection_id === c.id && recipeMap[i.recipe_id] })
        var jr = joursRestants(c.date_evenement)
        return (
          <div key={c.id} onClick={() => { setOpenId(c.id); setConfirmDel(false) }} style={{ ...card, display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <div style={{ fontSize: '30px' }}>{c.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: '600' }}>{c.nom}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>
                {its.length} recette{its.length > 1 ? 's' : ''}{c.date_evenement ? ' · ' + dateLisible(c.date_evenement) : ''}
              </div>
            </div>
            {jr !== null && jr >= 0 && <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '500', background: '#E3EDE2', color: '#1F4A33', whiteSpace: 'nowrap' }}>{jr === 0 ? "Aujourd'hui" : 'J-' + jr}</span>}
            <span style={{ color: '#ccc', fontSize: '18px' }}>›</span>
          </div>
        )
      })}
      {form === 'new' && <FormCollection user={user} init={null} onClose={() => setForm(null)} onSaved={(nouvelle) => { setForm(null); reload(); setOpenId(nouvelle.id) }} />}
    </div>
  )
}

// ---- Fenêtre « Ajouter cette recette à une collection » (depuis la fiche d'une recette)
export function AddToCollectionModal({ user, recipe, onClose }) {
  const { cols, items, loading, erreur, reload } = useCollections(user)
  const [form, setForm] = useState(false)
  const [msg, setMsg]   = useState('')

  async function basculer(c) {
    var ex = items.find(function(i) { return i.collection_id === c.id && i.recipe_id === recipe.id })
    var res = ex
      ? await supabase.from('recipe_collection_items').delete().eq('id', ex.id)
      : await supabase.from('recipe_collection_items').insert({ user_id: user.id, collection_id: c.id, recipe_id: recipe.id, section: sectionAuto(recipe), position: items.filter(function(i) { return i.collection_id === c.id }).length })
    if (res.error) { setMsg('Erreur : ' + res.error.message); return }
    setMsg(ex ? 'Retirée de « ' + c.nom + ' ».' : 'Ajoutée à « ' + c.nom + ' ».')
    reload()
  }

  return (
    <div style={overlay}>
      <div style={box}>
        <h3 style={{ fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>Ajouter à une collection</h3>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>{recipe.emoji || '🍳'} {recipe.title}</div>
        {erreur && <div style={{ background: '#FCEBEB', color: '#791F1F', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '10px' }}>Collections non activées : exécute supabase-collections.sql dans Supabase.</div>}
        {msg && <div style={{ background: '#E3EDE2', color: '#143626', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '10px' }}>{msg}</div>}
        {loading ? <div style={{ color: '#888', fontSize: '13px' }}>Chargement...</div> : (
          <div style={{ marginBottom: '12px' }}>
            {cols.length === 0 && !erreur && <div style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>Aucune collection : crées-en une.</div>}
            {cols.map(function(c) {
              var dedans = items.some(function(i) { return i.collection_id === c.id && i.recipe_id === recipe.id })
              return (
                <button key={c.id} onClick={() => basculer(c)} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: '6px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', border: '0.5px solid ' + (dedans ? '#2F6B4A' : '#DDE2D6'), background: dedans ? '#E3EDE2' : 'white' }}>
                  <span style={{ fontSize: '20px' }}>{c.emoji}</span>
                  <span style={{ flex: 1 }}>{c.nom}</span>
                  <span style={{ color: '#1F4A33', fontWeight: '600' }}>{dedans ? '✓' : '+'}</span>
                </button>
              )
            })}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setForm(true)} style={{ ...btnG, flex: 1 }}>+ Nouvelle collection</button>
          <button onClick={onClose} style={btnP}>Terminé</button>
        </div>
        {form && <FormCollection user={user} init={null} onClose={() => setForm(false)} onSaved={() => { setForm(false); reload() }} />}
      </div>
    </div>
  )
}
