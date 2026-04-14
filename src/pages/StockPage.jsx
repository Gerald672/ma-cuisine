import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const CATEGORIES = ['Épicerie', 'Frais', 'Fruits & légumes', 'Produits laitiers', 'Viande & poisson', 'Surgelés', 'Herbes & épices']
const UNITES = ['g', 'kg', 'ml', 'L', 'unité(s)', 'sachet(s)', 'boîte(s)']

const CAT_STYLE = {
  'Épicerie':          { bg: '#E6F1FB', color: '#185FA5' },
  'Frais':             { bg: '#EAF3DE', color: '#3B6D11' },
  'Fruits & légumes':  { bg: '#E1F5EE', color: '#085041' },
  'Produits laitiers': { bg: '#FAEEDA', color: '#854F0B' },
  'Viande & poisson':  { bg: '#FAECE7', color: '#712B13' },
  'Surgelés':          { bg: '#EEEDFE', color: '#3C3489' },
  'Herbes & épices':   { bg: '#EAF3DE', color: '#27500A' },
}

export default function StockPage() {
  const { user } = useAuth()
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ name: '', qty: '', unit: 'g', cat: 'Épicerie', seuil: '' })

  useEffect(() => { loadStock() }, [user])

  async function loadStock() {
    setLoading(true)
    const { data } = await supabase
      .from('stock')
      .select('*')
      .eq('user_id', user.id)
      .order('cat', { ascending: true })
    setStock(data || [])
    setLoading(false)
  }

  async function saveItem() {
    if (!form.name.trim()) return
    const payload = {
      user_id: user.id,
      name: form.name,
      qty: parseFloat(form.qty) || 0,
      unit: form.unit,
      cat: form.cat,
      seuil: parseFloat(form.seuil) || 0,
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
    setForm({ name: '', qty: '', unit: 'g', cat: 'Épicerie', seuil: '' })
    setShowModal(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({ name: item.name, qty: item.qty, unit: item.unit, cat: item.cat, seuil: item.seuil })
    setShowModal(true)
  }

  function closeModal() { setShowModal(false); setEditItem(null) }

  function getEtat(item) {
    if (item.qty === 0) return { label: 'Épuisé', bg: '#FCEBEB', color: '#791F1F' }
    if (item.qty <= item.seuil) return { label: 'Faible', bg: '#FAEEDA', color: '#854F0B' }
    return { label: 'OK', bg: '#EAF3DE', color: '#3B6D11' }
  }

  const filtered = stock.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || i.cat === catFilter
    return matchSearch && matchCat
  })

  const alerts = stock.filter(i => i.qty === 0 || i.qty <= i.seuil)

  return (
    <div>
      {alerts.length > 0 && (
        <div style={{
          background: '#FAEEDA', border: '0.5px solid #EF9F27', borderRadius: '8px',
          padding: '10px 14px', fontSize: '13px', color: '#633806', marginBottom: '1rem'
        }}>
          ⚠ Stock faible : {alerts.map(a => <strong key={a.id}>{a.name}</strong>).reduce((a, b) => [a, ', ', b])}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un ingrédient..."
          style={{
            flex: 1, minWidth: '180px', padding: '9px 14px', border: '0.5px solid #e0e0e0',
            borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#fafaf8'
          }}
        />
        <select
          value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{
            padding: '9px 12px', border: '0.5px solid #e0e0e0', borderRadius: '8px',
            fontSize: '13px', outline: 'none', background: '#fafaf8'
          }}
        >
          <option value="all">Toutes catégories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <button onClick={openAdd} style={{
          background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px',
          padding: '9px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '500'
        }}>+ Ajouter</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Chargement...</div>
      ) : (
        <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Ingrédient', 'Catégorie', 'Quantité', 'Unité', 'Seuil', 'État', ''].map(h => (
                    <th key={h} style={{
                      padding: '9px 12px', fontSize: '11px', fontWeight: '500',
                      color: '#888', textAlign: 'left', borderBottom: '0.5px solid #e0e0e0'
                    }}>{h}</th>
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
                        <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '500', background: catStyle.bg, color: catStyle.color }}>
                          {item.cat}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <input
                          type="number" defaultValue={item.qty} min="0"
                          onBlur={e => updateQty(item.id, e.target.value)}
                          style={{
                            width: '65px', padding: '4px 6px', border: '0.5px solid #e0e0e0',
                            borderRadius: '6px', fontSize: '13px', textAlign: 'right'
                          }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#888' }}>{item.unit}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#888' }}>{item.seuil} {item.unit}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '500', background: etat.bg, color: etat.color }}>
                          {etat.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => openEdit(item)} style={{
                            padding: '4px 10px', fontSize: '12px', cursor: 'pointer',
                            border: '0.5px solid #ddd', borderRadius: '6px', background: 'white'
                          }}>Éditer</button>
                          <button onClick={() => deleteItem(item.id)} style={{
                            padding: '4px 8px', fontSize: '12px', cursor: 'pointer',
                            border: 'none', borderRadius: '6px', background: '#E24B4A', color: 'white'
                          }}>✕</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#888', fontSize: '13px' }}>
                      Aucun ingrédient trouvé. Ajoute ton premier article !
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal ajout/édition */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem'
        }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '500', marginBottom: '1rem' }}>
              {editItem ? 'Modifier l\'ingrédient' : 'Ajouter un ingrédient'}
            </h3>
            {[
              { label: 'Nom', key: 'name', placeholder: 'Ex : farine de blé', type: 'text' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>{f.label}</label>
                <input
                  type={f.type} placeholder={f.placeholder} value={form[f.key]}
                  onChange={e => setForm(fr => ({ ...fr, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Quantité</label>
                <input type="number" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                  placeholder="500"
                  style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Unité</label>
                <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}>
                  {UNITES.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Catégorie</label>
                <select value={form.cat} onChange={e => setForm(f => ({ ...f, cat: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>Seuil alerte</label>
                <input type="number" value={form.seuil} onChange={e => setForm(f => ({ ...f, seuil: e.target.value }))}
                  placeholder="100"
                  style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
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
