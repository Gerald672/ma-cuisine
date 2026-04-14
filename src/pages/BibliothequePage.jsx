import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const FILTRES = ['Toutes', 'Végan', 'Végétarien', 'Rapide', 'Économique', 'Dessert', 'Plat principal']
const CATEGORIES = ['vegan', 'vegetarien', 'rapide', 'economique', 'dessert', 'plat']

export default function BibliothequeePage() {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtre, setFiltre] = useState('Toutes')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', source: '', time: '', cost: '', cats: [], emoji: '🍳', url: '' })
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { loadRecipes() }, [user])

  async function loadRecipes() {
    setLoading(true)
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setRecipes(data || [])
    setLoading(false)
  }

  async function addRecipe() {
    if (!form.title.trim()) return
    const { error } = await supabase.from('recipes').insert({
      user_id: user.id,
      title: form.title,
      source: form.source || 'Source inconnue',
      time: parseInt(form.time) || 30,
      cost: parseFloat(form.cost) || 10,
      cats: form.cats,
      emoji: form.emoji,
      url: form.url,
      ingredients: [],
      steps: []
    })
    if (!error) {
      setShowModal(false)
      setForm({ title: '', source: '', time: '', cost: '', cats: [], emoji: '🍳', url: '' })
      loadRecipes()
    }
  }

  async function deleteRecipe(id) {
    await supabase.from('recipes').delete().eq('id', id)
    setConfirmDelete(null)
    loadRecipes()
  }

  function toggleCat(cat) {
    setForm(f => ({
      ...f,
      cats: f.cats.includes(cat) ? f.cats.filter(c => c !== cat) : [...f.cats, cat]
    }))
  }

  const filteredRecipes = recipes.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase())
    const matchFiltre = filtre === 'Toutes' || r.cats?.includes(filtre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(' ', ''))
    return matchSearch && matchFiltre
  })

  const TAG = {
    vegan: { label: 'Végan', bg: '#EAF3DE', color: '#3B6D11' },
    vegetarien: { label: 'Végétarien', bg: '#EAF3DE', color: '#3B6D11' },
    rapide: { label: 'Rapide', bg: '#E6F1FB', color: '#185FA5' },
    economique: { label: 'Éco.', bg: '#FAEEDA', color: '#854F0B' },
    dessert: { label: 'Dessert', bg: '#EEEDFE', color: '#3C3489' },
    plat: { label: 'Plat', bg: '#E1F5EE', color: '#085041' },
  }

  return (
    <div>
      {/* Barre de recherche */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une recette..."
          style={{
            flex: 1, padding: '10px 14px', border: '0.5px solid #e0e0e0',
            borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#fafaf8'
          }}
        />
        <button onClick={() => setShowModal(true)} style={{
          background: '#1D9E75', color: 'white', border: 'none',
          borderRadius: '8px', padding: '10px 16px', fontSize: '13px',
          cursor: 'pointer', fontWeight: '500', whiteSpace: 'nowrap'
        }}>+ Ajouter</button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {FILTRES.map(f => (
          <button key={f} onClick={() => setFiltre(f)} style={{
            padding: '5px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
            border: '0.5px solid ' + (filtre === f ? '#5DCAA5' : '#e0e0e0'),
            background: filtre === f ? '#E1F5EE' : 'white',
            color: filtre === f ? '#0F6E56' : '#888',
            fontWeight: filtre === f ? '500' : '400'
          }}>{f}</button>
        ))}
      </div>

      {/* Grille de recettes */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Chargement...</div>
      ) : filteredRecipes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🍽</div>
          <p style={{ fontWeight: '500' }}>Aucune recette trouvée</p>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>Ajoute ta première recette !</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '12px'
        }}>
          {filteredRecipes.map(r => (
            <div key={r.id} style={{
              background: 'white', border: '0.5px solid #e0e0e0',
              borderRadius: '12px', overflow: 'hidden', position: 'relative'
            }}>
              <button onClick={() => setConfirmDelete(r)} style={{
                position: 'absolute', top: '8px', right: '8px',
                width: '26px', height: '26px', borderRadius: '50%',
                background: 'rgba(226,75,74,0.85)', border: 'none',
                color: 'white', fontSize: '12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>✕</button>
              <div style={{
                height: '110px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '36px', background: '#fafaf8'
              }}>{r.emoji}</div>
              <div style={{ padding: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>{r.title}</div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {(r.cats || []).slice(0, 2).map(cat => TAG[cat] && (
                    <span key={cat} style={{
                      padding: '2px 8px', borderRadius: '10px', fontSize: '10px',
                      fontWeight: '500', background: TAG[cat].bg, color: TAG[cat].color
                    }}>{TAG[cat].label}</span>
                  ))}
                  <span style={{
                    padding: '2px 8px', borderRadius: '10px', fontSize: '10px',
                    background: '#f0f0ec', color: '#888'
                  }}>{r.time} min</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: '10px', fontSize: '10px',
                    background: '#FAEEDA', color: '#854F0B'
                  }}>~{r.cost} CHF</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal ajout */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '1.5rem',
            width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '1rem' }}>Ajouter une recette</h3>
            {[
              { label: 'Nom', key: 'title', placeholder: 'Ex : Crème d\'amandes', type: 'text' },
              { label: 'Source ou URL', key: 'url', placeholder: 'https://...', type: 'text' },
              { label: 'Nom du site', key: 'source', placeholder: 'Ex : Marie Claire Cuisine', type: 'text' },
              { label: 'Temps (minutes)', key: 'time', placeholder: '45', type: 'number' },
              { label: 'Coût estimé (CHF)', key: 'cost', placeholder: '12', type: 'number' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '3px' }}>{field.label}</label>
                <input
                  type={field.type} placeholder={field.placeholder}
                  value={form[field.key]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  style={{
                    width: '100%', padding: '8px 12px', border: '0.5px solid #ddd',
                    borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>
            ))}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '6px' }}>Catégories</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => toggleCat(cat)} style={{
                    padding: '4px 12px', borderRadius: '14px', fontSize: '12px', cursor: 'pointer',
                    border: '0.5px solid ' + (form.cats.includes(cat) ? '#5DCAA5' : '#ddd'),
                    background: form.cats.includes(cat) ? '#E1F5EE' : 'white',
                    color: form.cats.includes(cat) ? '#0F6E56' : '#888'
                  }}>{cat}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={() => setShowModal(false)} style={{
                background: 'none', border: '0.5px solid #ddd', borderRadius: '8px',
                padding: '8px 16px', fontSize: '13px', cursor: 'pointer'
              }}>Annuler</button>
              <button onClick={addRecipe} style={{
                background: '#1D9E75', color: 'white', border: 'none',
                borderRadius: '8px', padding: '8px 16px', fontSize: '13px',
                cursor: 'pointer', fontWeight: '500'
              }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '1.5rem',
            width: '100%', maxWidth: '360px', textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🗑</div>
            <h3 style={{ fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>Supprimer cette recette ?</h3>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '1.5rem' }}>
              « {confirmDelete.title} » sera définitivement supprimée.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button onClick={() => setConfirmDelete(null)} style={{
                background: 'none', border: '0.5px solid #ddd', borderRadius: '8px',
                padding: '8px 16px', fontSize: '13px', cursor: 'pointer'
              }}>Annuler</button>
              <button onClick={() => deleteRecipe(confirmDelete.id)} style={{
                background: '#E24B4A', color: 'white', border: 'none',
                borderRadius: '8px', padding: '8px 16px', fontSize: '13px',
                cursor: 'pointer', fontWeight: '500'
              }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
