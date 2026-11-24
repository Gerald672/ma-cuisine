import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import BarcodeScanner from '../components/BarcodeScanner'

const COULEURS = { rouge: 'Rouge', blanc: 'Blanc', rose: 'Rosé', bulles: 'Effervescent', doux: 'Doux / liquoreux' }
const COULEUR_STYLE = {
  rouge:  { bg: '#FBEAF0', color: '#72243E', dot: '#9B2C4B' },
  blanc:  { bg: '#FAF3D4', color: '#7A5B0B', dot: '#D9B84A' },
  rose:   { bg: '#FDECEF', color: '#B03A5B', dot: '#EE8FA8' },
  bulles: { bg: '#E6F1FB', color: '#185FA5', dot: '#7FB5E6' },
  doux:   { bg: '#FAEEDA', color: '#854F0B', dot: '#E0A03A' },
}
const FORM_VIDE = {
  nom: '', producteur: '', millesime: '', couleur: 'rouge', region: '', pays: '', cepages: '',
  casier: '', quantite: 1, garde: '', prix: '', note: '', commentaire: '', barcode: '', vivino_url: '', vivino_note: null,
}

const inputStyle = { width: '100%', padding: '9px 12px', border: '0.5px solid #DDE2D6', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#F6F8F2', boxSizing: 'border-box' }
const labelStyle = { fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }
const btnPrimary = { background: '#2F6B4A', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }
const btnOutline = { background: 'white', color: '#2F6B4A', border: '0.5px solid #2F6B4A', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }
const btnGhost = { background: 'white', color: '#555', border: '0.5px solid #ddd', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', cursor: 'pointer' }
const cardStyle = { background: 'white', border: '0.5px solid #DDE2D6', borderRadius: '12px', padding: '1rem', marginBottom: '12px' }

function casierCompare(a, b) {
  return String(a).localeCompare(String(b), 'fr', { numeric: true, sensitivity: 'base' })
}

// Texte simple avec **gras** et listes, sans HTML injecté
function MiniMd({ text }) {
  var lines = String(text || '').split('\n')
  return (
    <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#333' }}>
      {lines.map(function(l, i) {
        if (!l.trim()) return null
        var puce = /^\s*([-•*]|\d+[.)])\s+/.test(l)
        var clean = l.replace(/^\s*([-•*]|\d+[.)])\s+/, '').replace(/^#{1,4}\s/, '')
        var parts = clean.split('**')
        return (
          <div key={i} style={{ paddingLeft: puce ? '14px' : 0, textIndent: puce ? '-10px' : 0, marginBottom: '4px' }}>
            {puce ? '• ' : ''}
            {parts.map(function(p, j) { return j % 2 === 1 ? <strong key={j}>{p}</strong> : <span key={j}>{p}</span> })}
          </div>
        )
      })}
    </div>
  )
}

// Redimensionne la photo pour rester sous la limite d'envoi
function photoEnBase64(file) {
  return new Promise(function(resolve, reject) {
    var url = URL.createObjectURL(file)
    var img = new Image()
    img.onload = function() {
      var max = 1200
      var ratio = Math.min(1, max / Math.max(img.width, img.height))
      var canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1])
    }
    img.onerror = function() { URL.revokeObjectURL(url); reject(new Error('Photo illisible')) }
    img.src = url
  })
}

function couleurDe(s) {
  var t = String(s || '').toLowerCase()
  if (t.includes('rosé') || t.includes('rose')) return 'rose'
  if (/spark|mousseux|effervescent|champagne|bulles|crémant|cremant|prosecco/.test(t)) return 'bulles'
  if (/dessert|fortified|doux|liquoreux|porto/.test(t)) return 'doux'
  if (t.includes('white') || t.includes('blanc')) return 'blanc'
  return 'rouge'
}

// Recherche d'un code-barres sur Open Food Facts (certains vins y sont)
async function chercherOFF(code) {
  try {
    var resp = await fetch('https://world.openfoodfacts.org/api/v2/product/' + code + '?fields=product_name,product_name_fr,brands,categories,countries')
    if (!resp.ok) return null
    var data = await resp.json()
    if (data.status === 0 || !data.product) return null
    var p = data.product
    var nom = (p.product_name_fr || p.product_name || '').trim()
    if (!nom) return null
    var an = nom.match(/\b(19|20)\d{2}\b/)
    return {
      nom: nom,
      producteur: (p.brands || '').split(',')[0].trim(),
      millesime: an ? an[0] : '',
      pays: (p.countries || '').split(',')[0].replace(/^[a-z]{2}:/, '').trim(),
      couleur: couleurDe(nom + ' ' + (p.categories || '')),
    }
  } catch (e) {
    return null
  }
}

// Import CSV (export Vivino, Excel en CSV) ou JSON
const ALIAS = {
  nom: ['nom', 'name', 'wine name', 'wine', 'vin'],
  producteur: ['producteur', 'winery', 'domaine', 'producer'],
  millesime: ['millesime', 'millésime', 'vintage', 'année', 'annee', 'year'],
  region: ['region', 'région'],
  pays: ['pays', 'country'],
  couleur: ['couleur', 'wine type', 'type', 'color', 'colour'],
  cepages: ['cepages', 'cépages', 'grapes', 'grape'],
  casier: ['casier', 'emplacement', 'location', 'rack', 'bin'],
  quantite: ['quantite', 'quantité', 'quantity', 'bottles', 'user cellar count', 'cellar count', 'bouteilles', 'count'],
  note: ['note', 'ma note', 'your rating', 'my rating', 'rating'],
  commentaire: ['commentaire', 'your review', 'review', 'notes', 'note perso'],
  vivino_note: ['vivino_note', 'average rating', 'vivino rating'],
  vivino_url: ['vivino_url', 'link to wine', 'link', 'url'],
  garde: ['garde', 'drinking window', 'à boire avant'],
  prix: ['prix', 'price', 'personal price'],
}

function parseCsv(texte) {
  var premiere = texte.split('\n')[0] || ''
  var sep = ';'
  if ((premiere.match(/,/g) || []).length > (premiere.match(/;/g) || []).length) sep = ','
  if ((premiere.match(/\t/g) || []).length > (premiere.match(/,|;/g) || []).length) sep = '\t'
  var rows = []
  var row = []
  var cur = ''
  var q = false
  for (var i = 0; i < texte.length; i++) {
    var c = texte[i]
    if (q) {
      if (c === '"' && texte[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === sep) { row.push(cur); cur = '' }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
    else if (c !== '\r') cur += c
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  if (rows.length < 2) return []
  var heads = rows[0].map(function(h) { return h.replace(/^﻿/, '').trim().toLowerCase() })
  return rows.slice(1).filter(function(r) { return r.some(function(x) { return x.trim() }) }).map(function(r) {
    var o = {}
    heads.forEach(function(h, k) { o[h] = (r[k] || '').trim() })
    return o
  })
}

function versVins(brutes) {
  var out = []
  brutes.forEach(function(brut) {
    var low = {}
    Object.keys(brut).forEach(function(k) { low[String(k).trim().toLowerCase()] = brut[k] == null ? '' : String(brut[k]).trim() })
    var d = {}
    Object.keys(ALIAS).forEach(function(champ) {
      for (var i = 0; i < ALIAS[champ].length; i++) {
        if (low[ALIAS[champ][i]]) { d[champ] = low[ALIAS[champ][i]]; break }
      }
    })
    if (!d.nom) return
    var qte = parseInt(d.quantite, 10)
    var note = parseFloat(String(d.note || '').replace(',', '.'))
    var vnote = parseFloat(String(d.vivino_note || '').replace(',', '.'))
    out.push({
      nom: d.nom, producteur: d.producteur || null, millesime: d.millesime || null,
      couleur: COULEURS[d.couleur] ? d.couleur : couleurDe(d.couleur),
      region: d.region || null, pays: d.pays || null, cepages: d.cepages || null, casier: d.casier || null,
      quantite: isNaN(qte) ? 1 : Math.max(0, qte), garde: d.garde || null, prix: d.prix || null,
      note: isNaN(note) ? null : note, commentaire: d.commentaire || null,
      vivino_url: d.vivino_url || null, vivino_note: isNaN(vnote) ? null : vnote,
    })
  })
  return out
}

export default function CavePage() {
  const { user } = useAuth()
  const [wines, setWines]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('cave')
  const [search, setSearch]     = useState('')
  const [fColor, setFColor]     = useState('')
  const [fCasier, setFCasier]   = useState('')
  const [showDone, setShowDone] = useState(false)
  const [scanMode, setScanMode] = useState(null)
  const [msg, setMsg]           = useState('')
  const [form, setForm]         = useState(null)
  const [formId, setFormId]     = useState(null)
  const [ficheId, setFicheId]   = useState(null)
  const [mvts, setMvts]         = useState([])
  const [busy, setBusy]         = useState('')
  const [answer, setAnswer]     = useState('')
  const [repas, setRepas]       = useState('')
  const [accordMode, setAccordMode] = useState('repas')
  const [accordVinId, setAccordVinId] = useState('')
  const [accordVinTxt, setAccordVinTxt] = useState('')
  const [question, setQuestion] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const photoRef = useRef(null)
  const importRef = useRef(null)
  const msgTimer = useRef(null)

  useEffect(function() { load() }, [])

  function toast(t) {
    setMsg(t)
    clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(function() { setMsg('') }, 4000)
  }

  async function load() {
    var { data, error } = await supabase.from('wines').select('*').order('nom')
    if (error) toast('Erreur de chargement : ' + error.message)
    setWines(data || [])
    setLoading(false)
  }

  async function callAI(body) {
    var { data: sess } = await supabase.auth.getSession()
    var token = sess && sess.session ? sess.session.access_token : ''
    var resp = await fetch('/api/wine-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    })
    var d = {}
    try { d = await resp.json() } catch (e) {}
    if (!resp.ok) throw new Error(d.erreur || 'Erreur ' + resp.status)
    return d
  }

  // ---------- Quantités
  async function changeQty(w, delta, libelle) {
    var q = Math.max(0, (w.quantite || 0) + delta)
    if (q === (w.quantite || 0)) return w.quantite || 0
    var { error } = await supabase.from('wines').update({ quantite: q, updated_at: new Date().toISOString() }).eq('id', w.id)
    if (error) { toast('Erreur : ' + error.message); return w.quantite || 0 }
    await supabase.from('wine_movements').insert({ user_id: user.id, wine_id: w.id, delta: q - (w.quantite || 0), libelle: libelle })
    setWines(function(prev) { return prev.map(function(x) { return x.id === w.id ? { ...x, quantite: q } : x }) })
    return q
  }

  async function quickQty(w, delta) {
    var q = await changeQty(w, delta, delta < 0 ? 'bue' : 'ajout')
    if (delta < 0) toast(q > 0 ? 'Santé ! Il en reste ' + q + '.' : 'Dernière bouteille — retrouve-la dans « Bouteilles finies ».')
    if (ficheId === w.id) loadMvts(w.id)
  }

  async function loadMvts(id) {
    var { data } = await supabase.from('wine_movements').select('*').eq('wine_id', id).order('created_at', { ascending: false }).limit(15)
    setMvts(data || [])
  }

  // ---------- Scan
  async function handleBarcode(code) {
    var mode = scanMode
    setScanMode(null)
    var known = wines.find(function(w) { return w.barcode === code })
    if (mode === 'out') {
      if (!known) { toast('Cette bouteille (' + code + ') n’est pas dans ta cave.'); return }
      if (!known.quantite) { toast(known.nom + ' : plus aucune bouteille en cave.'); return }
      var qo = await changeQty(known, -1, 'bue (scan)')
      toast('Santé ! ' + known.nom + ' : il en reste ' + qo + '.')
      return
    }
    if (known) {
      var qi = await changeQty(known, 1, 'entrée (scan)')
      toast(known.nom + ' : +1 (maintenant ' + qi + ')')
      return
    }
    toast('Code ' + code + ' — recherche du vin...')
    var found = await chercherOFF(code)
    openForm({ ...FORM_VIDE, ...(found || {}), barcode: code })
    toast(found ? 'Vin trouvé — vérifie, indique le casier, puis ajoute.' : 'Vin inconnu : prends l’étiquette en photo ou saisis-le.')
  }

  // ---------- Formulaire
  function openForm(draft, id) {
    setForm(draft)
    setFormId(id || null)
  }
  function closeForm() { setForm(null); setFormId(null) }
  function setField(k, v) { setForm(function(f) { return { ...f, [k]: v } }) }

  function remplir(d) {
    setForm(function(f) {
      var n = { ...f }
      ;['nom', 'producteur', 'millesime', 'region', 'pays', 'cepages', 'garde'].forEach(function(k) {
        if (d[k] && !String(n[k] || '').trim()) n[k] = d[k]
      })
      if (d.couleur && COULEURS[d.couleur]) n.couleur = d.couleur
      return n
    })
  }

  async function completer() {
    if (!form.nom.trim()) { toast('Écris d’abord le nom du vin.'); return }
    setBusy('completer')
    try { remplir(await callAI({ action: 'completer', vin: form })); toast('Complété — vérifie les infos.') }
    catch (e) { toast(e.message) }
    setBusy('')
  }

  async function lireEtiquette(file) {
    if (!file) return
    setBusy('photo')
    try {
      var b64 = await photoEnBase64(file)
      var d = await callAI({ action: 'etiquette', image: b64 })
      remplir(d)
      toast('Étiquette lue — vérifie et indique le casier.')
    } catch (e) { toast(e.message) }
    setBusy('')
  }

  async function saveForm() {
    if (!form.nom.trim()) { toast('Il faut au moins le nom du vin.'); return }
    var qte = Math.max(0, parseInt(form.quantite, 10) || 0)
    var note = parseFloat(String(form.note).replace(',', '.'))
    var row = {
      nom: form.nom.trim(), producteur: form.producteur || null, millesime: form.millesime || null,
      couleur: COULEURS[form.couleur] ? form.couleur : 'rouge', region: form.region || null, pays: form.pays || null,
      cepages: form.cepages || null, casier: form.casier ? form.casier.trim() : null, quantite: qte,
      garde: form.garde || null, prix: form.prix || null, note: isNaN(note) ? null : note,
      commentaire: form.commentaire || null, barcode: form.barcode || null,
      vivino_url: form.vivino_url || null, vivino_note: form.vivino_note || null,
      updated_at: new Date().toISOString(),
    }
    setBusy('save')
    if (formId) {
      var ancien = wines.find(function(w) { return w.id === formId })
      var { error } = await supabase.from('wines').update(row).eq('id', formId)
      if (error) { toast('Erreur : ' + error.message); setBusy(''); return }
      if (ancien && ancien.quantite !== qte) {
        await supabase.from('wine_movements').insert({ user_id: user.id, wine_id: formId, delta: qte - ancien.quantite, libelle: 'correction' })
      }
    } else {
      var { data, error: err2 } = await supabase.from('wines').insert({ ...row, user_id: user.id }).select().single()
      if (err2) { toast('Erreur : ' + err2.message); setBusy(''); return }
      if (qte > 0) await supabase.from('wine_movements').insert({ user_id: user.id, wine_id: data.id, delta: qte, libelle: 'entrée' })
    }
    setBusy('')
    closeForm()
    await load()
    toast('Enregistré.')
  }

  async function deleteWine(id) {
    var { error } = await supabase.from('wines').delete().eq('id', id)
    if (error) { toast('Erreur : ' + error.message); return }
    setFicheId(null)
    setConfirmDel(false)
    setWines(function(prev) { return prev.filter(function(w) { return w.id !== id }) })
  }

  // ---------- Import
  async function importFile(file) {
    if (!file) return
    setBusy('import')
    try {
      var texte = await file.text()
      var brut
      if (file.name.toLowerCase().endsWith('.json') || texte.trim().startsWith('[') || texte.trim().startsWith('{')) {
        var j = JSON.parse(texte)
        if (!Array.isArray(j)) j = j.vins || j.wines || Object.values(j)
        brut = j.filter(function(x) { return x && typeof x === 'object' })
      } else {
        brut = parseCsv(texte)
      }
      var vins = versVins(brut).map(function(v) { return { ...v, user_id: user.id } })
      if (!vins.length) { toast('Aucun vin reconnu dans ce fichier.'); setBusy(''); return }
      for (var i = 0; i < vins.length; i += 100) {
        var { error } = await supabase.from('wines').insert(vins.slice(i, i + 100))
        if (error) throw new Error(error.message)
      }
      await load()
      toast(vins.length + ' vin(s) importé(s).')
    } catch (e) { toast('Import impossible : ' + e.message) }
    setBusy('')
  }

  // ---------- Claude (fiche / accords / questions)
  async function demander(body, key) {
    setBusy(key)
    setAnswer('')
    try {
      var d = await callAI({ action: 'demander', cave: wines, ...body })
      setAnswer(d.texte || 'Pas de réponse.')
    } catch (e) { setAnswer(e.message) }
    setBusy('')
  }

  // ---------- Liste filtrée
  const casiers = useMemo(function() {
    var set = {}
    wines.forEach(function(w) { set[w.casier || 'Sans casier'] = true })
    return Object.keys(set).sort(casierCompare)
  }, [wines])

  const groupes = useMemo(function() {
    var q = search.trim().toLowerCase()
    var g = {}
    wines.forEach(function(w) {
      var cas = w.casier || 'Sans casier'
      var txt = [w.nom, w.producteur, w.region, w.pays, w.cepages, w.casier, w.millesime, w.commentaire].filter(Boolean).join(' ').toLowerCase()
      var ok = (showDone || (w.quantite || 0) > 0) && (!fColor || w.couleur === fColor) && (!fCasier || cas === fCasier) && (!q || txt.includes(q))
      if (ok) { if (!g[cas]) g[cas] = []; g[cas].push(w) }
    })
    return Object.keys(g).sort(casierCompare).map(function(k) { return [k, g[k]] })
  }, [wines, search, fColor, fCasier, showDone])

  const total = wines.reduce(function(s, w) { return s + (w.quantite || 0) }, 0)
  const fiche = wines.find(function(w) { return w.id === ficheId })
  const enCave = wines.filter(function(w) { return (w.quantite || 0) > 0 })
  const casiersConnus = Array.from(new Set(wines.map(function(w) { return w.casier }).filter(Boolean))).sort(casierCompare)

  function ouvrirFiche(w) {
    setFicheId(w.id)
    setAnswer('')
    setConfirmDel(false)
    loadMvts(w.id)
  }

  function lienVivino(w) {
    if (w.vivino_url) return w.vivino_url
    return 'https://www.vivino.com/search/wines?q=' + encodeURIComponent([w.nom, w.producteur, w.millesime].filter(Boolean).join(' '))
  }

  async function copierNote(w) {
    var t = [w.note ? 'Note : ' + w.note + '/5' : '', w.commentaire || ''].filter(Boolean).join('\n')
    if (!t) { toast('Mets d’abord ta note ou un commentaire (Modifier).'); return }
    try { await navigator.clipboard.writeText(t); toast('Copié — colle-le dans ton avis Vivino.') }
    catch (e) { toast('Copie impossible sur cet appareil.') }
  }

  const chip = function(on) {
    return {
      padding: '5px 12px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
      border: '0.5px solid ' + (on ? '#2F6B4A' : '#DDE2D6'), background: on ? '#E3EDE2' : 'white',
      color: on ? '#1F4A33' : '#666', fontWeight: on ? '500' : '400',
    }
  }

  return (
    <div>
      {scanMode && <BarcodeScanner onResult={handleBarcode} onClose={() => setScanMode(null)} />}

      {msg && (
        <div style={{ background: '#E3EDE2', border: '0.5px solid #9DC2A8', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#143626', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '16px' }}>x</button>
        </div>
      )}

      {/* Sous-onglets */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {[['cave', 'Ma cave'], ['accords', 'Accords'], ['questions', 'Questions']].map(function(t) {
          return (
            <button key={t[0]} onClick={() => { setTab(t[0]); setAnswer('') }} style={chip(tab === t[0])}>{t[1]}</button>
          )
        })}
      </div>

      {/* ===== MA CAVE ===== */}
      {tab === 'cave' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Chercher un vin, un casier, une région..."
              style={{ ...inputStyle, flex: 1, minWidth: '180px', width: 'auto' }} />
            {search && <button onClick={() => setSearch('')} style={{ ...btnGhost, padding: '9px 12px' }}>Effacer</button>}
            <button onClick={() => setScanMode('in')} style={btnOutline}>📷 Scanner (entrée)</button>
            <button onClick={() => setScanMode('out')} style={btnGhost}>📷 Scanner (j’en bois une)</button>
            <button onClick={() => openForm({ ...FORM_VIDE })} style={btnPrimary}>+ Ajouter</button>
          </div>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setFColor('')} style={chip(fColor === '')}>Tous</button>
            {Object.keys(COULEURS).map(function(k) {
              return <button key={k} onClick={() => setFColor(k)} style={chip(fColor === k)}>{COULEURS[k]}</button>
            })}
            <button onClick={() => setShowDone(!showDone)} style={chip(showDone)}>Bouteilles finies</button>
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#888' }}>{total} bouteille{total > 1 ? 's' : ''}</span>
          </div>
          {casiers.length > 1 && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <button onClick={() => setFCasier('')} style={chip(fCasier === '')}>Tous les casiers</button>
              {casiers.map(function(c) { return <button key={c} onClick={() => setFCasier(c)} style={chip(fCasier === c)}>{c}</button> })}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Chargement...</div>
          ) : wines.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', color: '#666', fontSize: '13px', lineHeight: 1.7 }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🍷</div>
              <div style={{ fontWeight: '500', marginBottom: '6px' }}>Ta cave est vide</div>
              Scanne le code-barres d’une bouteille, ou touche « + Ajouter » (tu peux photographier l’étiquette).<br />
              <button onClick={() => importRef.current && importRef.current.click()} disabled={busy === 'import'} style={{ ...btnGhost, marginTop: '12px' }}>
                {busy === 'import' ? 'Import...' : 'Importer un fichier (CSV Vivino / JSON)'}
              </button>
            </div>
          ) : groupes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '13px' }}>Aucun vin ne correspond.</div>
          ) : (
            groupes.map(function(g) {
              var n = g[1].reduce(function(s, w) { return s + (w.quantite || 0) }, 0)
              return (
                <div key={g[0]} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '500', color: '#888', padding: '0 4px 6px' }}>
                    <span>Casier {g[0]}</span><span>{n} btl</span>
                  </div>
                  <div style={{ background: 'white', border: '0.5px solid #DDE2D6', borderRadius: '12px', overflow: 'hidden' }}>
                    {g[1].map(function(w, i) {
                      var cs = COULEUR_STYLE[w.couleur] || COULEUR_STYLE.rouge
                      return (
                        <div key={w.id} onClick={() => ouvrirFiche(w)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', cursor: 'pointer', borderTop: i ? '0.5px solid #E9ECE3' : 'none', opacity: w.quantite ? 1 : 0.5 }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: cs.dot, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.nom} {w.millesime || ''}</div>
                            <div style={{ fontSize: '11px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {[w.producteur, w.region, w.cepages].filter(Boolean).join(' · ') || ' '}
                            </div>
                          </div>
                          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button onClick={() => quickQty(w, -1)} aria-label="Une bouteille de moins"
                              style={{ width: '28px', height: '28px', borderRadius: '50%', border: '0.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>−</button>
                            <span style={{ minWidth: '18px', textAlign: 'center', fontSize: '14px', fontWeight: '500' }}>{w.quantite || 0}</span>
                            <button onClick={() => quickQty(w, 1)} aria-label="Une bouteille de plus"
                              style={{ width: '28px', height: '28px', borderRadius: '50%', border: '0.5px solid #2F6B4A', background: '#E3EDE2', color: '#1F4A33', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>+</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}

          {wines.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <button onClick={() => importRef.current && importRef.current.click()} disabled={busy === 'import'} style={{ ...btnGhost, fontSize: '12px' }}>
                {busy === 'import' ? 'Import...' : 'Importer un fichier (CSV Vivino / JSON)'}
              </button>
            </div>
          )}
          <input ref={importRef} type="file" accept=".csv,.json,text/csv,application/json" style={{ display: 'none' }}
            onChange={e => { importFile(e.target.files[0]); e.target.value = '' }} />
        </div>
      )}

      {/* ===== ACCORDS ===== */}
      {tab === 'accords' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <button onClick={() => { setAccordMode('repas'); setAnswer('') }} style={chip(accordMode === 'repas')}>J’ai un repas</button>
            <button onClick={() => { setAccordMode('vin'); setAnswer('') }} style={chip(accordMode === 'vin')}>J’ai un vin</button>
          </div>
          {accordMode === 'repas' ? (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Quel vin ouvrir ?</div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Décris le repas, je cherche dans ta cave.</div>
              <textarea value={repas} onChange={e => setRepas(e.target.value)} rows={3} placeholder="Ex. fondue moitié-moitié, rôti de porc aux pruneaux..."
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              <button disabled={busy === 'accord' || !repas.trim()} onClick={() => demander({ genre: 'pour_repas', repas: repas }, 'accord')}
                style={{ ...btnPrimary, marginTop: '10px', width: '100%', opacity: !repas.trim() ? 0.5 : 1 }}>
                {busy === 'accord' ? 'Réflexion...' : 'Trouver le vin'}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Quel repas avec ce vin ?</div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Choisis une bouteille ou écris le nom d’un vin.</div>
              <select value={accordVinId} onChange={e => setAccordVinId(e.target.value)} style={inputStyle}>
                <option value="">— Choisir dans ma cave —</option>
                {enCave.map(function(w) { return <option key={w.id} value={w.id}>{w.nom} {w.millesime || ''} (casier {w.casier || '?'})</option> })}
              </select>
              <input value={accordVinTxt} onChange={e => setAccordVinTxt(e.target.value)} placeholder="...ou un autre vin" style={{ ...inputStyle, marginTop: '8px' }} />
              <button disabled={busy === 'accord' || (!accordVinId && !accordVinTxt.trim())}
                onClick={() => demander(accordVinTxt.trim() ? { genre: 'repas', vinTexte: accordVinTxt } : { genre: 'repas', vin: wines.find(function(w) { return w.id === accordVinId }) }, 'accord')}
                style={{ ...btnPrimary, marginTop: '10px', width: '100%', opacity: (!accordVinId && !accordVinTxt.trim()) ? 0.5 : 1 }}>
                {busy === 'accord' ? 'Réflexion...' : 'Proposer des repas'}
              </button>
            </div>
          )}
          {(answer || busy === 'accord') && (
            <div style={{ marginTop: '12px', background: '#F6F8F2', border: '0.5px solid #DDE2D6', borderRadius: '8px', padding: '12px' }}>
              {busy === 'accord' ? <span style={{ fontSize: '13px', color: '#888' }}>Réflexion... (jusqu’à une minute si Claude cherche sur internet)</span> : <MiniMd text={answer} />}
            </div>
          )}
        </div>
      )}

      {/* ===== QUESTIONS ===== */}
      {tab === 'questions' && (
        <div style={cardStyle}>
          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Une question sur le vin</div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Cépages, vins semblables, régions, garde, prix... Claude cherche sur internet si besoin.</div>
          <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={3} placeholder="Ex. Quels cépages dans un Dézaley ? Quels vins ressemblent à un Cornalin ?"
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          <button disabled={busy === 'question' || !question.trim()} onClick={() => demander({ genre: 'question', question: question }, 'question')}
            style={{ ...btnPrimary, marginTop: '10px', width: '100%', opacity: !question.trim() ? 0.5 : 1 }}>
            {busy === 'question' ? 'Réflexion...' : 'Demander'}
          </button>
          {(answer || busy === 'question') && (
            <div style={{ marginTop: '12px', background: '#F6F8F2', border: '0.5px solid #DDE2D6', borderRadius: '8px', padding: '12px' }}>
              {busy === 'question' ? <span style={{ fontSize: '13px', color: '#888' }}>Réflexion... (jusqu’à une minute si Claude cherche sur internet)</span> : <MiniMd text={answer} />}
            </div>
          )}
        </div>
      )}

      {/* ===== FICHE DU VIN ===== */}
      {fiche && !form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '500', margin: 0 }}>{fiche.nom} {fiche.millesime || ''}</h3>
              <button onClick={() => setFicheId(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>x</button>
            </div>
            <div style={{ margin: '8px 0 12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '500', background: (COULEUR_STYLE[fiche.couleur] || COULEUR_STYLE.rouge).bg, color: (COULEUR_STYLE[fiche.couleur] || COULEUR_STYLE.rouge).color }}>{COULEURS[fiche.couleur]}</span>
              <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '500', background: '#E6F1FB', color: '#185FA5' }}>Casier {fiche.casier || '?'}</span>
              {fiche.vivino_note && <span style={{ fontSize: '12px', color: '#854F0B' }}>★ {Number(fiche.vivino_note).toFixed(1)} Vivino</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: '13px', marginBottom: '12px' }}>
              {[['Producteur', fiche.producteur], ['Région', [fiche.region, fiche.pays].filter(Boolean).join(', ')], ['Cépages', fiche.cepages],
                ['À boire avant', fiche.garde], ['Ma note', fiche.note ? fiche.note + ' / 5' : ''], ['Prix', fiche.prix], ['Notes', fiche.commentaire],
                ['Code-barres', fiche.barcode]].filter(function(r) { return r[1] }).map(function(r) {
                return [<div key={r[0]} style={{ color: '#888' }}>{r[0]}</div>, <div key={r[0] + 'v'}>{r[1]}</div>]
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <button onClick={() => quickQty(fiche, -1)} style={{ ...btnGhost, flex: 1 }}>− J’en bois une</button>
              <span style={{ fontSize: '16px', fontWeight: '500', minWidth: '24px', textAlign: 'center' }}>{fiche.quantite || 0}</span>
              <button onClick={() => quickQty(fiche, 1)} style={btnOutline}>+ 1</button>
            </div>

            <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>Demander à Claude</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {[['cepages', 'Cépages & style'], ['repas', 'Avec quel repas ?'], ['semblables', 'Vins semblables']].map(function(b) {
                return <button key={b[0]} disabled={busy === 'fiche'} onClick={() => demander({ genre: b[0], vin: fiche }, 'fiche')} style={{ ...btnGhost, fontSize: '12px', padding: '7px 10px' }}>{b[1]}</button>
              })}
            </div>
            {(answer || busy === 'fiche') && (
              <div style={{ background: '#F6F8F2', border: '0.5px solid #DDE2D6', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                {busy === 'fiche' ? <span style={{ fontSize: '13px', color: '#888' }}>Réflexion...</span> : <MiniMd text={answer} />}
              </div>
            )}

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <a href={lienVivino(fiche)} target="_blank" rel="noopener noreferrer" style={{ ...btnGhost, fontSize: '12px', padding: '7px 10px', textDecoration: 'none' }}>{fiche.vivino_url ? 'Ouvrir sur Vivino' : 'Chercher sur Vivino'}</a>
              <button onClick={() => copierNote(fiche)} style={{ ...btnGhost, fontSize: '12px', padding: '7px 10px' }}>Copier ma note pour Vivino</button>
            </div>

            {mvts.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#888', marginBottom: '4px' }}>Historique</div>
                {mvts.map(function(m) {
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', padding: '2px 0' }}>
                      <span>{new Date(m.created_at).toLocaleDateString('fr-CH')} · {m.libelle}</span>
                      <span style={{ fontWeight: '500' }}>{m.delta > 0 ? '+' : ''}{m.delta}</span>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => openForm({ ...FORM_VIDE, ...fiche, millesime: fiche.millesime || '', note: fiche.note == null ? '' : String(fiche.note) }, fiche.id)} style={{ ...btnPrimary, flex: 1 }}>Modifier</button>
              {confirmDel
                ? <button onClick={() => deleteWine(fiche.id)} style={{ ...btnGhost, color: 'white', background: '#E24B4A', border: 'none' }}>Confirmer</button>
                : <button onClick={() => setConfirmDel(true)} style={{ ...btnGhost, color: '#E24B4A', borderColor: '#E24B4A' }}>Supprimer</button>}
            </div>
          </div>
        </div>
      )}

      {/* ===== FORMULAIRE ===== */}
      {form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '500', marginBottom: '12px' }}>{formId ? 'Modifier le vin' : 'Ajouter un vin'}</h3>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <button onClick={() => photoRef.current && photoRef.current.click()} disabled={busy === 'photo'} style={{ ...btnOutline, fontSize: '12px', padding: '7px 10px' }}>
                {busy === 'photo' ? 'Lecture...' : '📷 Photo de l’étiquette'}
              </button>
              <button onClick={completer} disabled={busy === 'completer'} style={{ ...btnGhost, fontSize: '12px', padding: '7px 10px' }}>
                {busy === 'completer' ? 'Je cherche...' : '✨ Compléter avec Claude'}
              </button>
              <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={e => { lireEtiquette(e.target.files[0]); e.target.value = '' }} />
            </div>
            {form.barcode && <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', fontFamily: 'monospace' }}>Code-barres : {form.barcode}</div>}

            <div style={{ marginBottom: '10px' }}>
              <label style={labelStyle}>Nom du vin *</label>
              <input value={form.nom} onChange={e => setField('nom', e.target.value)} placeholder="Ex. Dôle Blanche, Château X..." style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={labelStyle}>Casier</label>
                <input value={form.casier || ''} onChange={e => setField('casier', e.target.value)} list="cave-casiers" placeholder="Ex. A3" style={inputStyle} />
                <datalist id="cave-casiers">{casiersConnus.map(function(c) { return <option key={c} value={c} /> })}</datalist>
              </div>
              <div>
                <label style={labelStyle}>Bouteilles</label>
                <input type="number" min="0" value={form.quantite} onChange={e => setField('quantite', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Millésime</label>
                <input value={form.millesime || ''} onChange={e => setField('millesime', e.target.value)} placeholder="2021" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Couleur</label>
                <select value={form.couleur} onChange={e => setField('couleur', e.target.value)} style={inputStyle}>
                  {Object.keys(COULEURS).map(function(k) { return <option key={k} value={k}>{COULEURS[k]}</option> })}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={labelStyle}>Producteur</label>
              <input value={form.producteur || ''} onChange={e => setField('producteur', e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={labelStyle}>Région</label>
                <input value={form.region || ''} onChange={e => setField('region', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Pays</label>
                <input value={form.pays || ''} onChange={e => setField('pays', e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={labelStyle}>Cépages</label>
              <input value={form.cepages || ''} onChange={e => setField('cepages', e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={labelStyle}>À boire avant</label>
                <input value={form.garde || ''} onChange={e => setField('garde', e.target.value)} placeholder="2030" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Prix</label>
                <input value={form.prix || ''} onChange={e => setField('prix', e.target.value)} placeholder="CHF" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Ma note /5</label>
                <select value={form.note == null ? '' : String(form.note)} onChange={e => setField('note', e.target.value)} style={inputStyle}>
                  <option value="">—</option>
                  {['5', '4.5', '4', '3.5', '3', '2.5', '2', '1.5', '1'].map(function(n) { return <option key={n} value={n}>{n}</option> })}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Notes perso</label>
              <textarea value={form.commentaire || ''} onChange={e => setField('commentaire', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={saveForm} disabled={busy === 'save'} style={{ ...btnPrimary, flex: 1 }}>{busy === 'save' ? 'Enregistrement...' : (formId ? 'Enregistrer' : 'Ajouter à la cave')}</button>
              <button onClick={closeForm} style={btnGhost}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
