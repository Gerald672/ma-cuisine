import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const CATEGORIES = ['Epicerie', 'Frais', 'Fruits et legumes', 'Produits laitiers', 'Viande et poisson', 'Surgeles', 'Herbes et epices']
const UNITES = ['g', 'kg', 'ml', 'L', 'unite(s)', 'sachet(s)', 'boite(s)']

const CAT_STYLE = {
  'Epicerie':           { bg: '#E6F1FB', color: '#185FA5' },
  'Frais':              { bg: '#EAF3DE', color: '#3B6D11' },
  'Fruits et legumes':  { bg: '#E1F5EE', color: '#085041' },
  'Produits laitiers':  { bg: '#FAEEDA', color: '#854F0B' },
  'Viande et poisson':  { bg: '#FAECE7', color: '#712B13' },
  'Surgeles':           { bg: '#EEEDFE', color: '#3C3489' },
  'Herbes et epices':   { bg: '#EAF3DE', color: '#27500A' },
}

// Deviner la categorie depuis le nom Open Food Facts
function guessCat(name, offCat) {
  const n = (name || '').toLowerCase()
  const c = (offCat || '').toLowerCase()
  if (c.includes('lait') || c.includes('fromage') || c.includes('yaourt') || c.includes('beurre') || c.includes('creme')) return 'Produits laitiers'
  if (c.includes('viande') || c.includes('poisson') || c.includes('poultry') || c.includes('seafood')) return 'Viande et poisson'
  if (c.includes('surgele') || c.includes('frozen')) return 'Surgeles'
  if (c.includes('epice') || c.includes('herbe') || c.includes('spice') || c.includes('condiment')) return 'Herbes et epices'
  if (c.includes('fruit') || c.includes('legume') || c.includes('vegetable')) return 'Fruits et legumes'
  if (n.includes('lait') || n.includes('fromage') || n.includes('beurre') || n.includes('yaourt')) return 'Produits laitiers'
  if (n.includes('poulet') || n.includes('boeuf') || n.includes('saumon') || n.includes('poisson')) return 'Viande et poisson'
  if (n.includes('pomme') || n.includes('carotte') || n.includes('tomate') || n.includes('oignon')) return 'Fruits et legumes'
  if (n.includes('sel') || n.includes('poivre') || n.includes('thym') || n.includes('basilic')) return 'Herbes et epices'
  return 'Epicerie'
}

// Scanner codes barres via camera
function BarcodeScanner({ onResult, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const animRef = useRef(null)
  const [status, setStatus] = useState('Demarrage de la camera...')
  const [error, setError] = useState('')

  useEffect(() => {
    var ZXing = null

    async function loadZXing() {
      // Charger ZXing depuis CDN
      if (!window.ZXing) {
        await new Promise(function(resolve, reject) {
          var script = document.createElement('script')
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/zxing-js/0.18.6/zxing.min.js'
          script.onload = resolve
          script.onerror = reject
          document.head.appendChild(script)
        })
      }
      ZXing = window.ZXing
    }

    async function startCamera() {
      setError('')
      try {
        await loadZXing()
        var stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setStatus('Pointez la camera sur un code barres')
          scanLoop()
        }
      } catch (e) {
        setError('Impossible d\'acceder a la camera. Verifie les permissions.')
      }
    }

    function scanLoop() {
      if (!videoRef.current || !canvasRef.current) return
      var video = videoRef.current
      var canvas = canvasRef.current
      var ctx = canvas.getContext('2d')

      function tick() {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          try {
            if (ZXing && ZXing.MultiFormatReader) {
              var reader = new ZXing.MultiFormatReader()
              var luminanceSource = new ZXing.RGBLuminanceSource(imageData.data, canvas.width, canvas.height)
              var binaryBitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource))
              var result = reader.decode(binaryBitmap)
              if (result) {
                stopCamera()
                onResult(result.getText())
                return
              }
            }
          } catch (e) {}
        }
        animRef.current = requestAnimationFrame(tick)
      }
      animRef.current = requestAnimationFrame(tick)
    }

    function stopCamera() {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(function(t) { t.stop() })
      }
    }

    startCamera()
    return function() { stopCamera() }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ width: '100%', maxWidth: '480px', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ color: 'white', fontSize: '16px', fontWeight: '500' }}>Scanner un code barres</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', padding: 0 }}>x</button>
        </div>

        {error ? (
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
            {error === 'PERMISSION_DENIED' && (
              <div>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📷</div>
                <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>Acces a la camera refuse</div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px', lineHeight: 1.6 }}>
                  Le navigateur a bloque l'acces a la camera.<br/>
                  Pour autoriser :
                </div>
                <div style={{ background: '#f5f5f0', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#555', textAlign: 'left', marginBottom: '16px', lineHeight: 1.8 }}>
                  <strong>Sur Chrome Android :</strong><br/>
                  Icone cadenas dans la barre d'adresse<br/>
                  → Permissions → Camera → Autoriser<br/><br/>
                  <strong>Sur Samsung Internet :</strong><br/>
                  Utilise Chrome a la place — il gere<br/>
                  mieux les permissions camera.<br/><br/>
                  <strong>Raccourci depuis Chrome :</strong><br/>
                  Menu ... → Ajouter a l'ecran d'accueil
                </div>
              </div>
            )}
            {error === 'NO_CAMERA' && (
              <div>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
                <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>Aucune camera trouvee</div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>Cet appareil ne semble pas avoir de camera accessible.</div>
              </div>
            )}
            {error === 'NOT_HTTPS' && (
              <div>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
                <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>Connexion non securisee</div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
                  La camera necessite une connexion HTTPS.<br/>
                  Ouvre l'app via <strong>ma-cuisine-ten.vercel.app</strong>
                </div>
              </div>
            )}
            {error === 'OTHER' && (
              <div>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
                <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>Camera indisponible</div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>Impossible d'acceder a la camera. Essaie avec Chrome.</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {error === 'PERMISSION_DENIED' && (
                <button onClick={() => { setError(''); startCamera() }}
                  style={{ padding: '10px 18px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                  Reessayer
                </button>
              )}
              <button onClick={onClose}
                style={{ padding: '10px 18px', background: 'none', border: '0.5px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#555' }}>
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
            <video ref={videoRef} style={{ width: '100%', display: 'block' }} playsInline muted />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            {/* Cadre de visee */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ width: '240px', height: '120px', border: '2px solid #1D9E75', borderRadius: '8px', boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '20px', height: '20px', borderTop: '3px solid #1D9E75', borderLeft: '3px solid #1D9E75', borderRadius: '4px 0 0 0' }} />
                <div style={{ position: 'absolute', top: 0, right: 0, width: '20px', height: '20px', borderTop: '3px solid #1D9E75', borderRight: '3px solid #1D9E75', borderRadius: '0 4px 0 0' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '20px', height: '20px', borderBottom: '3px solid #1D9E75', borderLeft: '3px solid #1D9E75', borderRadius: '0 0 0 4px' }} />
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', borderBottom: '3px solid #1D9E75', borderRight: '3px solid #1D9E75', borderRadius: '0 0 4px 0' }} />
              </div>
            </div>
          </div>
        )}

        <div style={{ color: '#aaa', fontSize: '13px', textAlign: 'center', marginTop: '12px' }}>{status}</div>
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
  const [form, setForm]           = useState({ name: '', qty: '', unit: 'g', cat: 'Epicerie', seuil: '' })
  const [showScanner, setShowScanner] = useState(false)
  const [scanStatus, setScanStatus]   = useState('') // message apres scan
  const [scanLoading, setScanLoading] = useState(false)

  useEffect(() => { loadStock() }, [user])

  async function loadStock() {
    setLoading(true)
    const { data } = await supabase
      .from('stock').select('*').eq('user_id', user.id).order('cat', { ascending: true })
    setStock(data || [])
    setLoading(false)
  }

  async function saveItem() {
    if (!form.name.trim()) return
    const payload = {
      user_id: user.id, name: form.name,
      qty: parseFloat(form.qty) || 0, unit: form.unit,
      cat: form.cat, seuil: parseFloat(form.seuil) || 0,
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
    setForm({ name: '', qty: '', unit: 'g', cat: 'Epicerie', seuil: '' })
    setShowModal(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({ name: item.name, qty: item.qty, unit: item.unit, cat: item.cat, seuil: item.seuil })
    setShowModal(true)
  }

  function closeModal() { setShowModal(false); setEditItem(null) }

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
      setForm({ name, qty: qty || '', unit, cat, seuil: '' })
      setEditItem(null)
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
  })

  const alerts = stock.filter(i => i.qty === 0 || (i.seuil > 0 && i.qty <= i.seuil))

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
                  {['Ingredient', 'Categorie', 'Quantite', 'Unite', 'Seuil', 'Etat', ''].map(h => (
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
