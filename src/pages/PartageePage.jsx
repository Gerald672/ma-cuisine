import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function genCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

const TAG_COLORS = {
  vegan:      { bg: '#EAF3DE', color: '#3B6D11' },
  vegetarien: { bg: '#EAF3DE', color: '#3B6D11' },
  rapide:     { bg: '#E6F1FB', color: '#185FA5' },
  dessert:    { bg: '#EEEDFE', color: '#3C3489' },
  plat:       { bg: '#E1F5EE', color: '#085041' },
  entree:     { bg: '#FAECE7', color: '#712B13' },
  accompagnement: { bg: '#F0FDF4', color: '#166534' },
  healthy:    { bg: '#ECFDF5', color: '#065F46' },
  aperitif:   { bg: '#FDF4FF', color: '#7E22CE' },
}

export default function PartageePage() {
  const { user } = useAuth()

  // Mon code
  const [myCode, setMyCode]             = useState(null)
  const [myCodeActive, setMyCodeActive] = useState(false)
  const [copyDone, setCopyDone]         = useState(false)

  // Connexions persistantes
  const [connections, setConnections]   = useState([]) // [{ code, user_id, label, recipes[] }]
  const [activeConn, setActiveConn]     = useState(null) // index dans connections
  const [searchShared, setSearchShared] = useState('')
  const [importing, setImporting]       = useState(null)
  const [importedIds, setImportedIds]   = useState(new Set())

  // Ajout connexion
  const [inputCode, setInputCode]       = useState('')
  const [inputLabel, setInputLabel]     = useState('')
  const [codeError, setCodeError]       = useState('')
  const [loadingShared, setLoadingShared] = useState(false)
  const [showAddForm, setShowAddForm]   = useState(false)

  useEffect(() => {
    loadMyCode()
    loadConnections()
  }, [user])

  // --- Mon code ---

  async function loadMyCode() {
    const { data } = await supabase
      .from('share_codes').select('*').eq('user_id', user.id).single()
    if (data) { setMyCode(data.code); setMyCodeActive(data.active) }
  }

  async function generateCode() {
    const code = genCode()
    const { data: existing } = await supabase
      .from('share_codes').select('id').eq('user_id', user.id).single()
    if (existing) {
      await supabase.from('share_codes').update({ code, active: true }).eq('user_id', user.id)
    } else {
      await supabase.from('share_codes').insert({ user_id: user.id, code, active: true })
    }
    setMyCode(code); setMyCodeActive(true)
  }

  async function toggleCode(active) {
    await supabase.from('share_codes').update({ active }).eq('user_id', user.id)
    setMyCodeActive(active)
  }

  function copyCode() {
    navigator.clipboard.writeText(myCode)
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 2000)
  }

  // --- Connexions persistantes ---
  // Stockees dans localStorage sous la cle 'ma_cuisine_connections_<user_id>'

  function connKey() { return 'ma_cuisine_connections_' + user.id }

  function loadConnections() {
    try {
      const saved = localStorage.getItem(connKey())
      if (saved) {
        const parsed = JSON.parse(saved)
        setConnections(parsed)
      }
    } catch (e) {}
  }

  function saveConnections(conns) {
    try {
      localStorage.setItem(connKey(), JSON.stringify(conns))
    } catch (e) {}
    setConnections(conns)
  }

  async function connectWithCode() {
    const code = inputCode.trim().toUpperCase()
    if (!code) return
    setCodeError('')
    setLoadingShared(true)

    // Verifier que le code existe et est actif
    const { data } = await supabase
      .from('share_codes')
      .select('user_id, code, active')
      .eq('code', code)
      .eq('active', true)
      .single()

    if (!data) {
      setCodeError('Code invalide ou desactive. Verifie le code et reessaie.')
      setLoadingShared(false)
      return
    }
    if (data.user_id === user.id) {
      setCodeError("C'est ton propre code !")
      setLoadingShared(false)
      return
    }

    // Verifier si deja connecte
    const alreadyExists = connections.find(c => c.code === code)
    if (alreadyExists) {
      setCodeError('Tu es deja connecte avec ce code.')
      setLoadingShared(false)
      return
    }

    // Charger les recettes
    const { data: recipes } = await supabase
      .from('recipes').select('*').eq('user_id', data.user_id)
      .order('created_at', { ascending: false })

    const label = inputLabel.trim() || 'Utilisateur ' + (connections.length + 1)
    const newConn = { code, user_id: data.user_id, label, recipes: recipes || [] }
    const newConns = [...connections, newConn]
    saveConnections(newConns)
    setActiveConn(newConns.length - 1)
    setInputCode('')
    setInputLabel('')
    setShowAddForm(false)
    setImportedIds(new Set())
    setLoadingShared(false)
  }

  async function refreshConnection(idx) {
    const conn = connections[idx]
    if (!conn) return
    // Verifier que le code est toujours actif
    const { data } = await supabase
      .from('share_codes').select('active').eq('code', conn.code).single()
    if (!data || !data.active) {
      alert('Le code de ' + conn.label + ' a ete desactive.')
      return
    }
    const { data: recipes } = await supabase
      .from('recipes').select('*').eq('user_id', conn.user_id)
      .order('created_at', { ascending: false })
    const updated = connections.map((c, i) => i === idx ? { ...c, recipes: recipes || [] } : c)
    saveConnections(updated)
    setImportedIds(new Set())
  }

  function removeConnection(idx) {
    const newConns = connections.filter((_, i) => i !== idx)
    saveConnections(newConns)
    if (activeConn === idx) setActiveConn(null)
    else if (activeConn > idx) setActiveConn(activeConn - 1)
  }

  async function importRecipe(recipe) {
    setImporting(recipe.id)
    const { error } = await supabase.from('recipes').insert({
      user_id: user.id,
      title: recipe.title,
      source: recipe.source || 'Partage',
      url: recipe.url || '',
      emoji: recipe.emoji,
      time: recipe.time,
      cost: recipe.cost,
      cats: recipe.cats || [],
      tags: recipe.tags || [],
      servings: recipe.servings,
      ingredients: recipe.ingredients || [],
      steps: recipe.steps || [],
      notes: recipe.notes || '',
      photo_url: recipe.photo_url || '',
      nutrition: recipe.nutrition || null,
    })
    if (!error) setImportedIds(s => new Set([...s, recipe.id]))
    setImporting(null)
  }

  const currentConn = activeConn !== null ? connections[activeConn] : null
  const filteredShared = (currentConn ? currentConn.recipes : []).filter(r =>
    !searchShared || r.title.toLowerCase().includes(searchShared.toLowerCase())
  )

  return (
    <div>

      {/* Mon code de partage */}
      <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Mon code de partage</div>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
          Partage ce code avec quelqu'un pour qu'il puisse parcourir tes recettes et en importer.
        </div>

        {myCode ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {myCode.split('').map((c, i) => (
                  <div key={i} style={{
                    width: '36px', height: '44px',
                    background: myCodeActive ? '#E1F5EE' : '#f5f5f0',
                    borderRadius: '8px', border: '0.5px solid ' + (myCodeActive ? '#5DCAA5' : '#ddd'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', fontWeight: '700',
                    color: myCodeActive ? '#0F6E56' : '#aaa', fontFamily: 'monospace'
                  }}>{c}</div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={copyCode} style={{ padding: '8px 14px', background: copyDone ? '#1D9E75' : 'white', color: copyDone ? 'white' : '#555', border: '0.5px solid ' + (copyDone ? '#1D9E75' : '#ddd'), borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>
                  {copyDone ? 'Copie !' : 'Copier'}
                </button>
                <button onClick={generateCode} style={{ padding: '8px 14px', background: 'none', color: '#888', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  Nouveau code
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div onClick={() => toggleCode(!myCodeActive)} style={{ width: '36px', height: '20px', borderRadius: '10px', cursor: 'pointer', background: myCodeActive ? '#1D9E75' : '#ddd', position: 'relative', transition: 'background 0.2s' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', transition: 'left 0.2s', left: myCodeActive ? '18px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
              <span style={{ fontSize: '12px', color: myCodeActive ? '#1D9E75' : '#aaa' }}>
                {myCodeActive ? 'Partage actif' : 'Partage desactive'}
              </span>
            </div>
          </div>
        ) : (
          <button onClick={generateCode} style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
            Generer mon code de partage
          </button>
        )}
      </div>

      {/* Mes connexions */}
      <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '500' }}>Bibliotheques partagees</div>
            <div style={{ fontSize: '12px', color: '#888' }}>{connections.length} connexion{connections.length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={() => setShowAddForm(s => !s)} style={{ padding: '7px 14px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
            + Ajouter
          </button>
        </div>

        {/* Formulaire ajout */}
        {showAddForm && (
          <div style={{ background: '#fafaf8', borderRadius: '10px', padding: '1rem', marginBottom: '12px', border: '0.5px solid #e0e0e0' }}>
            <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '10px' }}>Connecter une nouvelle bibliotheque</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                value={inputLabel}
                onChange={e => setInputLabel(e.target.value)}
                placeholder="Nom (ex: Ma fille, Maman...)"
                style={{ flex: 1, padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={inputCode}
                onChange={e => { setInputCode(e.target.value.toUpperCase()); setCodeError('') }}
                onKeyDown={e => e.key === 'Enter' && connectWithCode()}
                placeholder="Code (ex: AB3X7K)"
                maxLength={6}
                style={{ flex: 1, padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '15px', fontWeight: '600', letterSpacing: '0.12em', outline: 'none', fontFamily: 'monospace', textTransform: 'uppercase', textAlign: 'center' }}
              />
              <button onClick={connectWithCode} disabled={loadingShared || inputCode.length !== 6}
                style={{ padding: '8px 16px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', opacity: inputCode.length !== 6 ? 0.5 : 1 }}>
                {loadingShared ? '...' : 'Connecter'}
              </button>
              <button onClick={() => { setShowAddForm(false); setCodeError(''); setInputCode(''); setInputLabel('') }}
                style={{ padding: '8px 12px', background: 'none', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: '#888' }}>
                Annuler
              </button>
            </div>
            {codeError && (
              <div style={{ background: '#FCEBEB', color: '#791F1F', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', marginTop: '8px' }}>{codeError}</div>
            )}
          </div>
        )}

        {/* Liste des connexions */}
        {connections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '13px' }}>
            Aucune connexion — clique sur "+ Ajouter" et saisis le code d'un ami.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {connections.map((conn, idx) => (
              <div key={idx}
                onClick={() => { setActiveConn(activeConn === idx ? null : idx); setSearchShared(''); setImportedIds(new Set()) }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', border: '0.5px solid ' + (activeConn === idx ? '#1D9E75' : '#e0e0e0'), borderRadius: '10px', cursor: 'pointer', background: activeConn === idx ? '#E1F5EE' : 'white', transition: 'all 0.15s' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#1D9E75', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: '600', flexShrink: 0 }}>
                  {conn.label.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>{conn.label}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>{conn.recipes.length} recette{conn.recipes.length !== 1 ? 's' : ''} — code {conn.code}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => refreshConnection(idx)} style={{ padding: '4px 10px', fontSize: '11px', border: '0.5px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: 'white', color: '#555' }}>
                    Actualiser
                  </button>
                  <button onClick={() => removeConnection(idx)} style={{ padding: '4px 8px', fontSize: '11px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: '#FCEBEB', color: '#791F1F' }}>
                    x
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recettes de la connexion active */}
      {currentConn && (
        <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>Recettes de {currentConn.label}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>{currentConn.recipes.length} recette{currentConn.recipes.length !== 1 ? 's' : ''}</div>
            </div>
          </div>

          <input
            value={searchShared}
            onChange={e => setSearchShared(e.target.value)}
            placeholder="Rechercher une recette..."
            style={{ width: '100%', padding: '9px 14px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#fafaf8', boxSizing: 'border-box', marginBottom: '12px' }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
            {filteredShared.map(r => {
              const alreadyImported = importedIds.has(r.id)
              const isImporting = importing === r.id
              return (
                <div key={r.id} style={{ border: '0.5px solid #e0e0e0', borderRadius: '10px', overflow: 'hidden', background: 'white' }}>
                  {r.photo_url ? (
                    <img src={r.photo_url} alt={r.title} style={{ width: '100%', height: '100px', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', background: '#fafaf8' }}>{r.emoji}</div>
                  )}
                  <div style={{ padding: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '5px' }}>{r.title}</div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {(r.cats || []).slice(0, 2).map(cat => {
                        const s = TAG_COLORS[cat] || { bg: '#f0f0ec', color: '#888' }
                        return <span key={cat} style={{ padding: '2px 7px', borderRadius: '8px', fontSize: '10px', fontWeight: '500', background: s.bg, color: s.color }}>{cat}</span>
                      })}
                      {r.time && <span style={{ padding: '2px 7px', borderRadius: '8px', fontSize: '10px', background: '#f0f0ec', color: '#888' }}>{r.time} min</span>}
                    </div>
                    <button
                      onClick={() => !alreadyImported && importRecipe(r)}
                      disabled={alreadyImported || isImporting}
                      style={{ width: '100%', padding: '7px', borderRadius: '7px', fontSize: '12px', cursor: alreadyImported ? 'default' : 'pointer', border: 'none', fontWeight: '500', background: alreadyImported ? '#E1F5EE' : '#1D9E75', color: alreadyImported ? '#0F6E56' : 'white', opacity: isImporting ? 0.7 : 1 }}>
                      {isImporting ? 'Import...' : alreadyImported ? 'Importee !' : 'Importer'}
                    </button>
                  </div>
                </div>
              )
            })}
            {filteredShared.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '13px' }}>
                Aucune recette trouvee
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
