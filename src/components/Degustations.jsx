import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Journal des vins dégustés hors cave (restaurant, amis, voyage...) : même fiche qu'un vin de la cave + le lieu.
const COULEURS = { rouge: 'Rouge', blanc: 'Blanc', rose: 'Rosé', bulles: 'Effervescent', doux: 'Doux / liquoreux' }
const DOT = { rouge: '#9B2C4B', blanc: '#D9B84A', rose: '#EE8FA8', bulles: '#7FB5E6', doux: '#E0A03A' }
const aujourdhui = function() {
  var d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
const VIDE = function() {
  return { nom: '', producteur: '', millesime: '', couleur: 'rouge', region: '', pays: '', cepages: '', lieu: '', date_degustation: aujourdhui(), prix: '', note: '', commentaire: '' }
}

const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #DDE2D6', borderRadius: '10px', fontSize: '14px', outline: 'none', background: '#F6F8F2', boxSizing: 'border-box' }
const labelStyle = { fontSize: '12px', color: '#6B6556', display: 'block', marginBottom: '4px' }
const btnPrimary = { background: '#2F6B4A', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 16px', fontSize: '13px', fontWeight: '600' }
const btnOutline = { background: 'white', color: '#2F6B4A', border: '1px solid #2F6B4A', borderRadius: '10px', padding: '9px 14px', fontSize: '13px', fontWeight: '600' }
const btnGhost = { background: 'white', color: '#555', border: '1px solid #ddd', borderRadius: '10px', padding: '9px 14px', fontSize: '13px' }

function dateFr(s) {
  if (!s) return ''
  var p = String(s).split('-')
  return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : s
}
function etoiles(n) {
  var v = parseFloat(n)
  if (!v) return ''
  var plein = Math.floor(v)
  return '★'.repeat(plein) + (v - plein >= 0.5 ? '½' : '')
}

export default function Degustations({ user, lireEtiquette, versCave, toast }) {
  const [liste, setListe] = useState([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState('')
  const [search, setSearch] = useState('')
  const [fLieu, setFLieu] = useState('')
  const [fColor, setFColor] = useState('')
  const [form, setForm] = useState(null)
  const [formId, setFormId] = useState(null)
  const [busy, setBusy] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const photoRef = useRef(null)

  useEffect(function() { charger() }, [])

  async function charger() {
    var { data, error } = await supabase.from('wine_tastings').select('*').order('date_degustation', { ascending: false }).order('created_at', { ascending: false })
    if (error) {
      setErreur(/wine_tastings|schema cache|does not exist/i.test(error.message)
        ? 'Les dégustations ne sont pas encore activées. Exécute d’abord le fichier supabase-degustations.sql dans Supabase (SQL Editor).'
        : 'Erreur de chargement : ' + error.message)
    } else setErreur('')
    setListe(data || [])
    setLoading(false)
  }

  const lieux = useMemo(function() {
    var c = {}
    liste.forEach(function(d) { if (d.lieu) c[d.lieu] = (c[d.lieu] || 0) + 1 })
    return Object.keys(c).sort(function(a, b) { return c[b] - c[a] })
  }, [liste])

  const filtre = useMemo(function() {
    var q = search.trim().toLowerCase()
    return liste.filter(function(d) {
      var txt = [d.nom, d.producteur, d.region, d.pays, d.cepages, d.lieu, d.millesime, d.commentaire].filter(Boolean).join(' ').toLowerCase()
      return (!fLieu || d.lieu === fLieu) && (!fColor || d.couleur === fColor) && (!q || txt.includes(q))
    })
  }, [liste, search, fLieu, fColor])

  function ouvrir(d) {
    setConfirmDel(false)
    if (d) { setFormId(d.id); setForm({ ...VIDE(), ...d, note: d.note == null ? '' : String(d.note) }) }
    else { setFormId(null); setForm(VIDE()) }
  }
  function setField(k, v) { setForm(function(f) { return { ...f, [k]: v } }) }

  async function lirePhoto(file) {
    if (!file) return
    setBusy('photo')
    try {
      var d = await lireEtiquette(file)
      setForm(function(f) {
        var n = { ...f }
        ;['nom', 'producteur', 'millesime', 'region', 'pays', 'cepages'].forEach(function(k) { if (d[k] && !String(n[k] || '').trim()) n[k] = d[k] })
        if (d.couleur && COULEURS[d.couleur]) n.couleur = d.couleur
        return n
      })
      toast('Étiquette lue — vérifie et indique le lieu.')
    } catch (e) { toast(e.message) }
    setBusy('')
  }

  async function enregistrer() {
    if (!form.nom.trim()) { toast('Il faut au moins le nom du vin.'); return }
    var note = parseFloat(String(form.note).replace(',', '.'))
    var row = {
      nom: form.nom.trim(), producteur: form.producteur || null, millesime: form.millesime || null,
      couleur: COULEURS[form.couleur] ? form.couleur : 'rouge', region: form.region || null, pays: form.pays || null,
      cepages: form.cepages || null, lieu: (form.lieu || '').trim() || null, date_degustation: form.date_degustation || aujourdhui(),
      prix: form.prix || null, note: isNaN(note) ? null : note, commentaire: form.commentaire || null,
    }
    var res = formId
      ? await supabase.from('wine_tastings').update(row).eq('id', formId)
      : await supabase.from('wine_tastings').insert({ ...row, user_id: user.id })
    if (res.error) { toast('Erreur : ' + res.error.message); return }
    setForm(null); setFormId(null)
    toast(formId ? 'Dégustation modifiée.' : 'Dégustation enregistrée.')
    charger()
  }

  async function supprimer() {
    var { error } = await supabase.from('wine_tastings').delete().eq('id', formId)
    if (error) { toast('Erreur : ' + error.message); return }
    setForm(null); setFormId(null); toast('Supprimée.'); charger()
  }

  function ajouterCave() {
    var f = form
    versCave({ nom: f.nom, producteur: f.producteur, millesime: f.millesime, couleur: f.couleur, region: f.region, pays: f.pays, cepages: f.cepages, prix: '', note: f.note, commentaire: f.commentaire })
    setForm(null); setFormId(null)
  }

  const chip = function(on) {
    return { padding: '5px 12px', borderRadius: '16px', fontSize: '12px', whiteSpace: 'nowrap', border: '1px solid ' + (on ? '#2F6B4A' : '#DDE2D6'), background: on ? '#E3EDE2' : 'white', color: on ? '#1F4A33' : '#666', fontWeight: on ? '600' : '400' }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#888', fontSize: '13px' }}>Chargement...</div>

  return (
    <div>
      {erreur && <div style={{ background: '#FCEBEB', border: '1px solid #f3c6c6', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#791F1F', marginBottom: '12px' }}>{erreur}</div>}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." style={{ ...inputStyle, flex: 1 }} />
        <button onClick={() => ouvrir(null)} style={btnPrimary}>+ Ajouter</button>
      </div>

      {(lieux.length > 0 || liste.length > 0) && (
        <div className="mc-scroll" style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '2px' }}>
          <button onClick={() => { setFLieu(''); setFColor('') }} style={chip(!fLieu && !fColor)}>Tous ({liste.length})</button>
          {Object.keys(COULEURS).filter(function(c) { return liste.some(function(d) { return d.couleur === c }) }).map(function(c) {
            return <button key={c} onClick={() => setFColor(fColor === c ? '' : c)} style={chip(fColor === c)}>{COULEURS[c]}</button>
          })}
          {lieux.map(function(l) {
            return <button key={l} onClick={() => setFLieu(fLieu === l ? '' : l)} style={chip(fLieu === l)}>📍 {l}</button>
          })}
        </div>
      )}

      {filtre.length === 0 && !erreur && (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#8A8576', fontSize: '14px', lineHeight: 1.6 }}>
          {liste.length === 0
            ? <>Aucun vin noté pour l’instant.<br />Au restaurant, prends l’étiquette en photo et garde un souvenir de la soirée.</>
            : 'Aucun résultat.'}
        </div>
      )}

      {filtre.map(function(d) {
        var sous = [d.producteur, d.millesime, d.region].filter(Boolean).join(' · ')
        return (
          <div key={d.id} onClick={() => ouvrir(d)} style={{ background: '#FCFDFA', border: '1px solid #DDE2D6', borderRadius: '16px', padding: '12px 14px', marginBottom: '10px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: DOT[d.couleur] || '#999', marginTop: '6px', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '16px', lineHeight: 1.25, color: '#2A2118' }}>{d.nom}</div>
              {sous && <div style={{ fontSize: '12px', color: '#6B6556', marginTop: '2px' }}>{sous}</div>}
              <div style={{ fontSize: '12px', color: '#8A8576', marginTop: '6px' }}>
                {d.lieu ? '📍 ' + d.lieu + ' — ' : ''}{dateFr(d.date_degustation)}
              </div>
              {d.commentaire && <div style={{ fontSize: '12px', color: '#555', marginTop: '6px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{d.commentaire}</div>}
            </div>
            {d.note != null && <div style={{ color: '#C98A3A', fontSize: '14px', whiteSpace: 'nowrap' }}>{etoiles(d.note)}</div>}
          </div>
        )
      })}

      {form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(42,33,24,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }}>
          <div style={{ background: '#FCFDFA', borderRadius: '24px', padding: '1.5rem', width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '19px', marginBottom: '12px' }}>{formId ? 'Modifier la dégustation' : 'Un vin dégusté'}</h3>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <button onClick={() => photoRef.current && photoRef.current.click()} disabled={busy === 'photo'} style={{ ...btnOutline, fontSize: '12px', padding: '7px 10px' }}>
                {busy === 'photo' ? 'Lecture...' : '📷 Photo de l’étiquette'}
              </button>
              <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={e => { lirePhoto(e.target.files && e.target.files[0]); e.target.value = '' }} />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={labelStyle}>Nom du vin *</label>
              <input value={form.nom} onChange={e => setField('nom', e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={labelStyle}>Lieu (restaurant, chez…)</label>
                <input list="lieux-degustation" value={form.lieu || ''} onChange={e => setField('lieu', e.target.value)} placeholder="Ex. Auberge de Vallamand" style={inputStyle} />
                <datalist id="lieux-degustation">{lieux.map(function(l) { return <option key={l} value={l} /> })}</datalist>
              </div>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={form.date_degustation || ''} onChange={e => setField('date_degustation', e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={labelStyle}>Millésime</label>
                <input value={form.millesime || ''} onChange={e => setField('millesime', e.target.value)} style={inputStyle} />
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={labelStyle}>Prix payé</label>
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
              <label style={labelStyle}>Mon avis</label>
              <textarea value={form.commentaire || ''} onChange={e => setField('commentaire', e.target.value)} rows={3} placeholder="Ex. avec le filet de bœuf, très rond…" style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={enregistrer} style={{ ...btnPrimary, flex: 1 }}>Enregistrer</button>
              <button onClick={() => { setForm(null); setFormId(null) }} style={btnGhost}>Annuler</button>
            </div>
            {formId && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                <button onClick={ajouterCave} style={{ ...btnOutline, fontSize: '12px' }}>🍷 Ajouter à ma cave</button>
                {confirmDel
                  ? <button onClick={supprimer} style={{ ...btnGhost, color: 'white', background: '#E24B4A', border: 'none', fontSize: '12px' }}>Confirmer</button>
                  : <button onClick={() => setConfirmDel(true)} style={{ ...btnGhost, color: '#E24B4A', borderColor: '#E24B4A', fontSize: '12px' }}>Supprimer</button>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
