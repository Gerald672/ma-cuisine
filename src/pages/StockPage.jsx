import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const CATEGORIES = ['Épicerie', 'Frais', 'Fruits & légumes', 'Produits laitiers', 'Viande & poisson', 'Surgelés', 'Congélateur', 'Herbes & épices']
const UNITES = ['g', 'kg', 'ml', 'L', 'unite(s)', 'sachet(s)', 'boite(s)']

const CAT_STYLE = {
  'Épicerie':          { bg: '#E6F1FB', color: '#185FA5' },
  'Frais':             { bg: '#EAF3DE', color: '#3B6D11' },
  'Fruits & légumes':  { bg: '#E1F5EE', color: '#085041' },
  'Produits laitiers': { bg: '#FAEEDA', color: '#854F0B' },
  'Viande & poisson':  { bg: '#FAECE7', color: '#712B13' },
  'Surgelés':          { bg: '#EEEDFE', color: '#3C3489' },
  'Congélateur':       { bg: '#EFF6FF', color: '#1D4ED8' },
  'Herbes & épices':   { bg: '#EAF3DE', color: '#27500A' },
}

// Deviner la categorie depuis le nom Open Food Facts
function guessCat(name, offCat) {
  const n = (name || '').toLowerCase()
  const c = (offCat || '').toLowerCase()
  if (c.includes('lait') || c.includes('fromage') || c.includes('yaourt') || c.includes('beurre') || c.includes('creme')) return 'Produits laitiers'
  if (c.includes('viande') || c.includes('poisson') || c.includes('poultry') || c.includes('seafood')) return 'Viande & poisson'
  if (c.includes('surgele') || c.includes('frozen')) return 'Surgelés'
  if (c.includes('epice') || c.includes('herbe') || c.includes('spice') || c.includes('condiment')) return 'Herbes & épices'
  if (c.includes('fruit') || c.includes('legume') || c.includes('vegetable')) return 'Fruits & légumes'
  if (n.includes('lait') || n.includes('fromage') || n.includes('beurre') || n.includes('yaourt')) return 'Produits laitiers'
  if (n.includes('poulet') || n.includes('boeuf') || n.includes('saumon') || n.includes('poisson')) return 'Viande & poisson'
  if (n.includes('pomme') || n.includes('carotte') || n.includes('tomate') || n.includes('oignon')) return 'Fruits & légumes'
  if (n.includes('sel') || n.includes('poivre') || n.includes('thym') || n.includes('basilic')) return 'Herbes & épices'
  return 'Épicerie'
}

// Scanner codes barres - capture photo puis analyse
function BarcodeScanner({ onResult, onClose }) {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady]           = useState(false)
  const [scanning, setScanning]     = useState(false)
  const [errorType, setErrorType]   = useState('')
  const [manualCode, setManualCode] = useState('')
  const [hint, setHint]             = useState('')

  useEffect(() => {
    startCamera()
    return function() {
      if (streamRef.current) streamRef.current.getTracks().forEach(function(t) { t.stop() })
    }
  }, [])

  async function startCamera() {
    try {
      var stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      })
      streamRef.current = stream
      var video = videoRef.current
      if (!video) return
      video.srcObject = stream
      video.play()
      video.oncanplay = function() { setReady(true) }
    } catch(e) {
      if (e.name === 'NotAllowedError') setErrorType('PERMISSION_DENIED')
      else setErrorType('OTHER')
    }
  }

  // L'utilisateur appuie sur le bouton -> on capture une image et on analyse
  async function captureAndScan() {
    var video = videoRef.current
    var canvas = canvasRef.current
    if (!video || !canvas) return
    setScanning(true)
    setHint('')

    // Capturer le frame actuel en haute resolution
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    var ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    // Essai 1 : BarcodeDetector natif
    if ('BarcodeDetector' in window) {
      try {
        var detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
        })
        var results = await detector.detect(canvas)
        if (results && results.length > 0) {
          stopAndReturn(results[0].rawValue)
          return
        }
      } catch(e) {}
    }

    // Essai 2 : envoyer l'image a Open Food Facts via leur API scan
    // (pas possible directement, mais on peut essayer via un service tiers)

    // Essai 3 : lire les pixels et chercher manuellement via API externe
    // On convertit le canvas en blob et on appelle quagga via worker
    try {
      var blob = await new Promise(function(res) { canvas.toBlob(res, 'image/jpeg', 0.95) })
      var url = URL.createObjectURL(blob)

      // Charger Quagga si pas dispo
      if (!window.Quagga) {
        await new Promise(function(res, rej) {
          var s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js'
          s.onload = res; s.onerror = rej
          document.head.appendChild(s)
        })
      }

      await new Promise(function(resolve) {
        window.Quagga.decodeSingle({
          decoder: { readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader', 'code_128_reader'] },
          locate: true,
          src: url
        }, function(result) {
          URL.revokeObjectURL(url)
          if (result && result.codeResult && result.codeResult.code) {
            stopAndReturn(result.codeResult.code)
          } else {
            setHint('Code non detecte. Rapproche-toi et reessaie.')
            setScanning(false)
          }
          resolve()
        })
      })
    } catch(e) {
      setHint('Erreur. Essaie la saisie manuelle.')
      setScanning(false)
    }
  }

  function stopAndReturn(code) {
    if (streamRef.current) streamRef.current.getTracks().forEach(function(t) { t.stop() })
    onResult(code)
  }

  function submitManual() {
    if (manualCode.length >= 8) {
      if (streamRef.current) streamRef.current.getTracks().forEach(function(t) { t.stop() })
      onResult(manualCode)
    }
  }

  if (errorType) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
          <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>Permission camera refusee</div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px', lineHeight: 1.6 }}>
            Dans Chrome : icone cadenas dans la barre adresse → Camera → Autoriser.
          </div>
          <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>Ou saisis le code manuellement :</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input autoFocus value={manualCode} onChange={e => setManualCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && submitManual()} placeholder="3017620422003" maxLength={14}
              style={{ flex: 1, padding: '10px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '15px', outline: 'none', fontFamily: 'monospace', textAlign: 'center' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button onClick={submitManual} disabled={manualCode.length < 8}
              style={{ padding: '10px 18px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', opacity: manualCode.length < 8 ? 0.5 : 1 }}>
              Rechercher
            </button>
            <button onClick={onClose} style={{ padding: '10px 14px', background: 'none', border: '0.5px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#555' }}>
              Annuler
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.6)' }}>
        <div style={{ color: 'white', fontSize: '15px', fontWeight: '500' }}>Scanner un code barres</div>
        <button onClick={() => { if (streamRef.current) streamRef.current.getTracks().forEach(function(t) { t.stop() }); onClose() }}
          style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>x</button>
      </div>

      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Cadre de visee */}
        {ready && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: '260px', height: '120px', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
              <div style={{ position: 'absolute', top: 0, left: 0, width: '28px', height: '28px', borderTop: '3px solid #1D9E75', borderLeft: '3px solid #1D9E75' }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: '28px', height: '28px', borderTop: '3px solid #1D9E75', borderRight: '3px solid #1D9E75' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '28px', height: '28px', borderBottom: '3px solid #1D9E75', borderLeft: '3px solid #1D9E75' }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '28px', height: '28px', borderBottom: '3px solid #1D9E75', borderRight: '3px solid #1D9E75' }} />
              <div style={{ position: 'absolute', top: '50%', left: '5%', right: '5%', height: '2px', background: 'rgba(29,158,117,0.8)', transform: 'translateY(-50%)' }} />
            </div>
          </div>
        )}

        {!ready && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: 'white', fontSize: '14px' }}>Demarrage...</div>
          </div>
        )}
      </div>

      {/* Bouton capture + hint */}
      <div style={{ background: 'rgba(0,0,0,0.85)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
        {hint && <div style={{ color: '#EF9F27', fontSize: '12px', textAlign: 'center' }}>{hint}</div>}

        <button onClick={captureAndScan} disabled={!ready || scanning}
          style={{ width: '64px', height: '64px', borderRadius: '50%', background: scanning ? '#888' : '#1D9E75', border: '4px solid white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
          {scanning ? '⏳' : '📷'}
        </button>
        <div style={{ color: '#aaa', fontSize: '12px' }}>
          {scanning ? 'Analyse en cours...' : 'Appuie pour scanner'}
        </div>

        <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
          <input value={manualCode} onChange={e => setManualCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && submitManual()}
            placeholder="Ou saisir le code..." maxLength={14}
            style={{ flex: 1, padding: '8px 12px', border: 'none', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'monospace', background: 'rgba(255,255,255,0.15)', color: 'white' }} />
          <button onClick={submitManual} disabled={manualCode.length < 8}
            style={{ padding: '8px 14px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', opacity: manualCode.length < 8 ? 0.4 : 1 }}>
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

export default function StockPage() {
  const { user } = useAuth()
  const [stock, setStock]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [form, setForm]           = useState({ name: '', qty: '', unit: 'g', cat: 'Épicerie', seuil: '', peremption: '' })
  const [showScanner, setShowScanner] = useState(false)
  const [sortStock, setSortStock]       = useState('cat') // 'cat' ou 'alpha'
  const [scanStatus, setScanStatus]   = useState('') // message apres scan
  const [scanLoading, setScanLoading] = useState(false)

  useEffect(() => { loadStock() }, [user])

  async function loadStock() {
    setLoading(true)
    const { data } = await supabase
      .from('stock').select('*').eq('user_id', user.id)
    setStock(data || [])
    setLoading(false)
  }

  async function saveItem() {
    if (!form.name.trim()) return
    const payload = {
      user_id: user.id, name: form.name,
      qty: parseFloat(form.qty) || 0, unit: form.unit,
      cat: form.cat, seuil: parseFloat(form.seuil) || 0,
      peremption: form.peremption || null,
    }
    if (editItem) {
      await supabase.from('stock').update(payload).eq('id', editItem.id)
    } else {
      await supabase.from('stock').insert(payload)
    }
    closeModal()
    loadStock()
  }

  async function updateQty(id, qty) {
    await supabase.from('stock').update({ qty: parseFloat(qty) || 0 }).eq('id', id)
    setStock(s => s.map(i => i.id === id ? { ...i, qty: parseFloat(qty) || 0 } : i))
  }

  async function deleteItem(id) {
    await supabase.from('stock').delete().eq('id', id)
    loadStock()
  }

  function openAdd() {
    setEditItem(null)
    setForm({ name: '', qty: '', unit: 'g', cat: 'Épicerie', seuil: '', peremption: '' })
    setShowModal(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({ name: item.name, qty: item.qty, unit: item.unit, cat: item.cat, seuil: item.seuil, peremption: item.peremption || '' })
    setShowModal(true)
  }

  function closeModal() { setShowModal(false); setEditItem(null) }

  function getPeremption(dateStr) {
  if (!dateStr) return null
  var today = new Date(); today.setHours(0,0,0,0)
  var date = new Date(dateStr)
  var diffDays = Math.round((date - today) / 86400000)
  if (diffDays < 0)  return { label: 'Perime !', bg: '#FCEBEB', color: '#791F1F', days: diffDays, urgent: true }
  if (diffDays <= 3) return { label: 'Expire dans ' + diffDays + 'j', bg: '#FCEBEB', color: '#791F1F', days: diffDays, urgent: true }
  if (diffDays <= 7) return { label: 'Expire dans ' + diffDays + 'j', bg: '#FAEEDA', color: '#854F0B', days: diffDays, urgent: false }
  return { label: diffDays + 'j restants', bg: '#EAF3DE', color: '#3B6D11', days: diffDays, urgent: false }
}

function getEtat(item) {
    if (item.qty === 0) return { label: 'Epuise', bg: '#FCEBEB', color: '#791F1F' }
    if (item.seuil > 0 && item.qty <= item.seuil) return { label: 'Faible', bg: '#FAEEDA', color: '#854F0B' }
    return { label: 'OK', bg: '#EAF3DE', color: '#3B6D11' }
  }

  // Apres scan : chercher le produit sur Open Food Facts
  async function handleBarcode(code) {
    setShowScanner(false)
    setScanLoading(true)
    setScanStatus('Code detecte : ' + code + ' — Recherche du produit...')

    try {
      var resp = await fetch('https://world.openfoodfacts.org/api/v0/product/' + code + '.json')
      var data = await resp.json()

      if (data.status === 0 || !data.product) {
        setScanStatus('Produit non trouve dans la base Open Food Facts.')
        setScanLoading(false)
        // Ouvrir le formulaire vide pour saisie manuelle
        setForm({ name: '', qty: '', unit: 'unite(s)', cat: 'Epicerie', seuil: '' })
        setEditItem(null)
        setShowModal(true)
        return
      }

      var product = data.product
      var name = product.product_name_fr || product.product_name || product.generic_name_fr || product.generic_name || ''
      name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()

      // Quantite et unite depuis le produit
      var qty = ''
      var unit = 'unite(s)'
      var qtyStr = product.quantity || ''
      var qtyMatch = qtyStr.match(/(\d+(?:[.,]\d+)?)\s*(g|kg|ml|L|cl|l)/i)
      if (qtyMatch) {
        qty = parseFloat(qtyMatch[1].replace(',', '.'))
        var u = qtyMatch[2].toLowerCase()
        if (u === 'cl') { qty = qty * 10; u = 'ml' }
        if (u === 'l') u = 'L'
        unit = u
      }

      var cat = guessCat(name, product.categories || '')
      setScanStatus('Produit trouve : ' + name)
      setScanLoading(false)

      // Verifier si l'article existe deja dans le stock
      var nameLower = name.toLowerCase()
      var existing = stock.find(function(s) {
        return s.name.toLowerCase() === nameLower ||
               s.name.toLowerCase().includes(nameLower) ||
               nameLower.includes(s.name.toLowerCase())
      })

      if (existing) {
        // Article trouve -> ouvrir en mode edition avec quantite additionnelle
        setScanStatus('Produit trouve : ' + name + ' — deja dans le stock, tu peux ajuster la quantite')
        setEditItem(existing)
        setForm({
          name: existing.name,
          qty: qty ? (parseFloat(existing.qty) || 0) + parseFloat(qty) : existing.qty,
          unit: existing.unit,
          cat: existing.cat,
          seuil: existing.seuil || '',
          peremption: existing.peremption || ''
        })
      } else {
        // Nouvel article
        setEditItem(null)
        setForm({ name, qty: qty || '', unit, cat, seuil: '', peremption: '' })
      }
      setShowModal(true)
    } catch (e) {
      setScanStatus('Erreur de connexion. Verifie ta connexion internet.')
      setScanLoading(false)
    }
  }

  const filtered = stock.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || i.cat === catFilter
    return matchSearch && matchCat
  }).sort((a, b) => {
    if (sortStock === 'alpha') return a.name.localeCompare(b.name, 'fr')
    // Par categorie puis nom
    var catCmp = (a.cat || '').localeCompare(b.cat || '', 'fr')
    return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name, 'fr')
  })

  const alerts = stock.filter(i => i.qty === 0 || (i.seuil > 0 && i.qty <= i.seuil))
  const peremptionAlerts = stock.filter(i => {
    if (!i.peremption) return false
    var p = getPeremption(i.peremption)
    return p && p.days <= 7
  }).sort((a, b) => new Date(a.peremption) - new Date(b.peremption))

  return (
    <div>
      {/* Scanner actif */}
      {showScanner && <BarcodeScanner onResult={handleBarcode} onClose={() => setShowScanner(false)} />}

      {/* Alerte stock faible */}
      {alerts.length > 0 && (
        <div style={{ background: '#FAEEDA', border: '0.5px solid #EF9F27', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#633806', marginBottom: '1rem' }}>
          Stock faible : {alerts.map(a => <strong key={a.id}>{a.name}</strong>).reduce((a, b) => [a, ', ', b])}
        </div>
      )}

      {/* Alerte peremption */}
      {peremptionAlerts.length > 0 && (
        <div style={{ background: '#FCEBEB', border: '0.5px solid #E24B4A', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#791F1F', marginBottom: '1rem' }}>
          <strong>Date de peremption proche :</strong>{' '}
          {peremptionAlerts.map((a, i) => {
            var p = getPeremption(a.peremption)
            return (
              <span key={a.id}>
                {i > 0 && ', '}
                <strong>{a.name}</strong>
                <span style={{ fontWeight: '400' }}> ({p.label})</span>
              </span>
            )
          })}
        </div>
      )}

      {/* Message apres scan */}
      {scanStatus && (
        <div style={{ background: scanLoading ? '#E1F5EE' : '#f0f0ec', border: '0.5px solid ' + (scanLoading ? '#5DCAA5' : '#ddd'), borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#333', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{scanLoading ? 'Recherche...' : scanStatus}</span>
          <button onClick={() => setScanStatus('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '16px' }}>x</button>
        </div>
      )}

      {/* Barre d'actions */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un ingredient..."
          style={{ flex: 1, minWidth: '180px', padding: '9px 14px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#fafaf8' }} />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ padding: '9px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#fafaf8' }}>
          <option value="all">Toutes categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <div style={{ display: 'flex', border: '0.5px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
          <button onClick={() => setSortStock('cat')}
            style={{ padding: '9px 12px', fontSize: '12px', cursor: 'pointer', border: 'none', background: sortStock === 'cat' ? '#1D9E75' : 'white', color: sortStock === 'cat' ? 'white' : '#666', fontWeight: sortStock === 'cat' ? '500' : '400' }}>
            Categorie
          </button>
          <button onClick={() => setSortStock('alpha')}
            style={{ padding: '9px 12px', fontSize: '12px', cursor: 'pointer', border: 'none', borderLeft: '0.5px solid #e0e0e0', background: sortStock === 'alpha' ? '#1D9E75' : 'white', color: sortStock === 'alpha' ? 'white' : '#666', fontWeight: sortStock === 'alpha' ? '500' : '400' }}>
            A - Z
          </button>
        </div>
        <button onClick={() => { setScanStatus(''); setShowScanner(true) }}
          style={{ background: 'white', color: '#1D9E75', border: '0.5px solid #1D9E75', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
          Scanner
        </button>
        <button onClick={openAdd}
          style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
          + Ajouter
        </button>
      </div>

      {/* Tableau stock */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Chargement...</div>
      ) : (
        <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Ingredient', 'Categorie', 'Quantite', 'Unite', 'Seuil', 'Peremption', 'Etat', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', fontSize: '11px', fontWeight: '500', color: '#888', textAlign: 'left', borderBottom: '0.5px solid #e0e0e0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const etat = getEtat(item)
                  const catStyle = CAT_STYLE[item.cat] || { bg: '#f0f0ec', color: '#888' }
                  return (
                    <tr key={item.id} style={{ borderBottom: '0.5px solid #f0f0ec' }}>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '500' }}>{item.name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '500', background: catStyle.bg, color: catStyle.color }}>{item.cat}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <input type="number" defaultValue={item.qty} min="0"
                          onBlur={e => updateQty(item.id, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { updateQty(item.id, e.target.value); e.target.blur() } }}
                          style={{ width: '65px', padding: '4px 6px', border: '0.5px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#888' }}>{item.unit}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#888' }}>{item.seuil} {item.unit}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {item.peremption ? (function() {
                          var p = getPeremption(item.peremption)
                          return <span style={{ padding: '3px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '500', background: p.bg, color: p.color, whiteSpace: 'nowrap' }}>{new Date(item.peremption).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                        })() : <span style={{ fontSize: '11px', color: '#ccc' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '500', background: etat.bg, color: etat.color }}>{etat.label}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => openEdit(item)} style={{ padding: '4px 10px', fontSize: '12px', cursor: 'pointer', border: '0.5px solid #ddd', borderRadius: '6px', background: 'white' }}>Editer</button>
                          <button onClick={() => deleteItem(item.id)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', border: 'none', borderRadius: '6px', background: '#E24B4A', color: 'white' }}>x</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#888', fontSize: '13px' }}>Aucun ingredient trouve. Ajoute ton premier article !</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal ajout/edition */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '500', marginBottom: '1rem' }}>
              {editItem ? 'Modifier' : 'Ajouter un ingredient'}
            </h3>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Nom</label>
              <input type="text" placeholder="Ex : farine de ble" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Quantite</label>
                <input type="number" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} placeholder="500"
                  style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Unite</label>
                <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}>
                  {UNITES.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Categorie</label>
                <select value={form.cat} onChange={e => setForm(f => ({ ...f, cat: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Seuil alerte</label>
                <input type="number" value={form.seuil} onChange={e => setForm(f => ({ ...f, seuil: e.target.value }))} placeholder="100"
                  style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Date de peremption (optionnel)</label>
              <input type="date" value={form.peremption || ''} onChange={e => setForm(f => ({ ...f, peremption: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              {form.peremption && (
                <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {(function() {
                    var p = getPeremption(form.peremption)
                    return p ? <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '500', background: p.bg, color: p.color }}>{p.label}</span> : null
                  })()}
                  <button type="button" onClick={() => setForm(f => ({ ...f, peremption: '' }))}
                    style={{ fontSize: '11px', color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                    Effacer
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={closeModal} style={{ background: 'none', border: '0.5px solid #ddd', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}>Annuler</button>
              <button onClick={saveItem} style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
