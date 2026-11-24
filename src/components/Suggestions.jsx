import { useState, useMemo } from 'react'

// Suggestions d'achat : Claude regarde ta cave (couleurs, régions, prix habituel, vins aimés) et propose des vins à acheter.
const COULEURS = { rouge: 'Rouge', blanc: 'Blanc', rose: 'Rosé', bulles: 'Effervescent', doux: 'Doux / liquoreux' }
const DOT = { rouge: '#9B2C4B', blanc: '#D9B84A', rose: '#EE8FA8', bulles: '#7FB5E6', doux: '#E0A03A' }

const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #DDE2D6', borderRadius: '10px', fontSize: '14px', outline: 'none', background: '#F6F8F2', boxSizing: 'border-box' }
const btnPrimary = { background: '#2F6B4A', color: 'white', border: 'none', borderRadius: '10px', padding: '11px 16px', fontSize: '14px', fontWeight: '600' }
const btnOutline = { background: 'white', color: '#2F6B4A', border: '1px solid #2F6B4A', borderRadius: '10px', padding: '8px 12px', fontSize: '12px', fontWeight: '600', textDecoration: 'none', display: 'inline-block' }

function prixNum(s) {
  var m = String(s || '').replace(',', '.').match(/\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}
function top(arr, n) {
  var c = {}
  arr.forEach(function(x) { if (x) c[x] = (c[x] || 0) + 1 })
  return Object.keys(c).sort(function(a, b) { return c[b] - c[a] }).slice(0, n)
}
const decrire = function(w) { return [w.nom, w.producteur, w.millesime].filter(Boolean).join(' ') }

export default function Suggestions({ wines, tastings, callAI, versCave, toast }) {
  const [focus, setFocus] = useState('')
  const [bMin, setBMin] = useState('')
  const [bMax, setBMax] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)

  const enCave = useMemo(function() { return wines.filter(function(w) { return (w.quantite || 0) > 0 }) }, [wines])

  const stats = useMemo(function() {
    var prix = wines.map(function(w) { return prixNum(w.prix) }).filter(function(x) { return x && x > 0 }).sort(function(a, b) { return a - b })
    var moy = prix.length ? prix.reduce(function(s, x) { return s + x }, 0) / prix.length : 0
    var med = prix.length ? prix[Math.floor(prix.length / 2)] : 0
    var parCouleur = {}
    enCave.forEach(function(w) { parCouleur[w.couleur] = (parCouleur[w.couleur] || 0) + (w.quantite || 0) })
    return { nPrix: prix.length, moy: Math.round(moy), med: Math.round(med), min: prix[0] || 0, max: prix[prix.length - 1] || 0, parCouleur: parCouleur }
  }, [wines, enCave])

  const totalBtl = enCave.reduce(function(s, w) { return s + (w.quantite || 0) }, 0)
  const defMin = stats.moy ? Math.max(5, Math.round(stats.moy * 0.7)) : 15
  const defMax = stats.moy ? Math.round(stats.moy * 1.3) : 30

  async function demander() {
    setBusy(true); setRes(null)
    var mn = parseFloat(bMin) || defMin, mx = parseFloat(bMax) || defMax
    var aimes = wines.filter(function(w) { return parseFloat(w.note) >= 4 }).sort(function(a, b) { return b.note - a.note }).slice(0, 12).map(decrire)
    var degustes = (tastings || []).filter(function(d) { return parseFloat(d.note) >= 4 }).slice(0, 10).map(function(d) { return decrire(d) + (d.lieu ? ' (' + d.lieu + ')' : '') })
    var profil = {
      nbBouteilles: totalBtl, nbRefs: enCave.length, parCouleur: stats.parCouleur,
      regions: top(enCave.map(function(w) { return w.region }), 8), pays: top(enCave.map(function(w) { return w.pays }), 5),
      producteurs: top(enCave.map(function(w) { return w.producteur }), 12),
      prixMoyen: stats.moy, prixMediane: stats.med, prixMin: stats.min, prixMax: stats.max,
      favoris: aimes, degustes: degustes, possedes: wines.map(decrire).slice(0, 150),
      budget: mn + ' à ' + mx + ' CHF', focus: focus ? COULEURS[focus] : '', nombre: 6,
    }
    try { setRes(await callAI({ action: 'suggerer', profil: profil })) }
    catch (e) { toast(e.message) }
    setBusy(false)
  }

  const chip = function(on) {
    return { padding: '5px 12px', borderRadius: '16px', fontSize: '12px', whiteSpace: 'nowrap', border: '1px solid ' + (on ? '#2F6B4A' : '#DDE2D6'), background: on ? '#E3EDE2' : 'white', color: on ? '#1F4A33' : '#666', fontWeight: on ? '600' : '400' }
  }
  function lien(s) { return 'https://www.vivino.com/search/wines?q=' + encodeURIComponent([s.nom, s.producteur, s.millesime].filter(Boolean).join(' ')) }

  return (
    <div>
      <div style={{ background: '#FCFDFA', border: '1px solid #DDE2D6', borderRadius: '16px', padding: '14px', marginBottom: '12px' }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: '17px', marginBottom: '6px', color: '#2A2118' }}>Ta cave en un coup d’œil</div>
        {enCave.length === 0
          ? <div style={{ fontSize: '13px', color: '#6B6556' }}>Ta cave est vide : ajoute quelques bouteilles pour que les suggestions te ressemblent.</div>
          : <>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: '#6B6556', marginBottom: '8px' }}>
                <span><b style={{ color: '#2A2118' }}>{totalBtl}</b> bouteilles</span>
                <span><b style={{ color: '#2A2118' }}>{enCave.length}</b> références</span>
                {stats.nPrix >= 3
                  ? <span>prix habituel <b style={{ color: '#2A2118' }}>~{stats.moy} CHF</b> ({stats.min}–{stats.max})</span>
                  : <span>prix : renseigne-les dans tes fiches pour affiner</span>}
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {Object.keys(COULEURS).filter(function(c) { return stats.parCouleur[c] }).map(function(c) {
                  return <span key={c} style={{ fontSize: '12px', color: '#555', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: DOT[c] }} />{COULEURS[c]} {stats.parCouleur[c]}
                  </span>
                })}
              </div>
            </>}
      </div>

      <div style={{ marginBottom: '10px', fontSize: '12px', color: '#6B6556' }}>Je cherche surtout</div>
      <div className="mc-scroll" style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto' }}>
        <button onClick={() => setFocus('')} style={chip(!focus)}>Ce qui me manque</button>
        {Object.keys(COULEURS).map(function(c) { return <button key={c} onClick={() => setFocus(focus === c ? '' : c)} style={chip(focus === c)}>{COULEURS[c]}</button> })}
      </div>

      <div style={{ marginBottom: '6px', fontSize: '12px', color: '#6B6556' }}>Budget par bouteille (CHF)</div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px' }}>
        <input type="number" inputMode="decimal" value={bMin} onChange={e => setBMin(e.target.value)} placeholder={String(defMin)} style={inputStyle} />
        <span style={{ color: '#888' }}>à</span>
        <input type="number" inputMode="decimal" value={bMax} onChange={e => setBMax(e.target.value)} placeholder={String(defMax)} style={inputStyle} />
      </div>

      <button onClick={demander} disabled={busy} style={{ ...btnPrimary, width: '100%', opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Je cherche dans ma tête et sur internet…' : '🍷 Me suggérer des vins'}
      </button>
      <div style={{ fontSize: '11px', color: '#8A8576', marginTop: '6px', textAlign: 'center' }}>
        Basé sur ta cave, tes notes et tes dégustations. Les prix sont des ordres de grandeur.
      </div>

      {res && (
        <div style={{ marginTop: '16px' }}>
          {res.analyse && <div style={{ background: '#F3E6CC', borderRadius: '14px', padding: '12px 14px', fontSize: '13px', color: '#2A2118', lineHeight: 1.55, marginBottom: '12px' }}>{res.analyse}</div>}
          {res.suggestions.map(function(s, i) {
            var sous = [s.producteur, s.region, s.pays].filter(Boolean).join(' · ')
            return (
              <div key={i} style={{ background: '#FCFDFA', border: '1px solid #DDE2D6', borderRadius: '16px', padding: '12px 14px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: DOT[s.couleur], marginTop: '6px', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: '16px', lineHeight: 1.25, color: '#2A2118' }}>{s.nom}{s.millesime ? ' ' + s.millesime : ''}</div>
                    {sous && <div style={{ fontSize: '12px', color: '#6B6556', marginTop: '2px' }}>{sous}</div>}
                  </div>
                  {s.prix_chf && <div style={{ fontSize: '13px', fontWeight: '600', color: '#1F4A33', whiteSpace: 'nowrap' }}>{s.prix_chf} CHF</div>}
                </div>
                {s.pourquoi && <div style={{ fontSize: '13px', color: '#444', marginTop: '8px', lineHeight: 1.5 }}>{s.pourquoi}</div>}
                {s.ou_acheter && <div style={{ fontSize: '12px', color: '#8A8576', marginTop: '6px' }}>🛒 {s.ou_acheter}</div>}
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <a href={lien(s)} target="_blank" rel="noopener noreferrer" style={btnOutline}>Voir sur Vivino</a>
                  <button onClick={() => versCave({ nom: s.nom, producteur: s.producteur, millesime: s.millesime, couleur: s.couleur, region: s.region, pays: s.pays, quantite: 1 })} style={btnOutline}>Ajouter à ma cave</button>
                </div>
              </div>
            )
          })}
          <div style={{ textAlign: 'center', marginTop: '6px' }}>
            <button onClick={demander} disabled={busy} style={{ ...btnOutline, opacity: busy ? 0.6 : 1 }}>↻ D’autres idées</button>
          </div>
        </div>
      )}
    </div>
  )
}
