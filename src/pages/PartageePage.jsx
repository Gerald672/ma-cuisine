import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function genCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function PartageePage() {
  const { user } = useAuth()

  // Mon code de partage
  const [myCode, setMyCode]         = useState(null)
  const [myCodeActive, setMyCodeActive] = useState(false)
  const [copyDone, setCopyDone]     = useState(false)

  // Connexion a un autre compte
  const [inputCode, setInputCode]   = useState('')
  const [sharedUser, setSharedUser] = useState(null)   // { id, email, share_code }
  const [sharedRecipes, setSharedRecipes] = useState([])
  const [searchShared, setSearchShared] = useState('')
  const [importing, setImporting]   = useState(null)   // recipe id en cours
  const [importedIds, setImportedIds] = useState(new Set())
  const [codeError, setCodeError]   = useState('')
  const [loadingShared, setLoadingShared] = useState(false)

  useEffect(() => { loadMyCode() }, [user])

  async function loadMyCode() {
    const { data } = await supabase
      .from('share_codes')
      .select('*')
      .eq('user_id', user.id)
      .single()
    if (data) {
      setMyCode(data.code)
      setMyCodeActive(data.active)
    }
  }

  async function generateCode() {
    const code = genCode()
    const { data: existing } = await supabase
      .from('share_codes')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      await supabase.from('share_codes').update({ code, active: true }).eq('user_id', user.id)
    } else {
      await supabase.from('share_codes').insert({ user_id: user.id, code, active: true })
    }
    setMyCode(code)
    setMyCodeActive(true)
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

  async function connectWithCode() {
    const code = inputCode.trim().toUpperCase()
    if (!code) return
    setCodeError('')
    setLoadingShared(true)

    const { data } = await supabase
      .from('share_codes')
      .select('*, profiles:user_id(email)')
      .eq('code', code)
      .eq('active', true)
      .single()

    if (!data) {
      setCodeError('Code invalide ou desactive. Verifie le code et reessaie.')
      setLoadingShared(false)
      return
    }
    if (data.user_id === user.id) {
      setCodeError('C\'est ton propre code !')
      setLoadingShared(false)
      return
    }

    setSharedUser({ id: data.user_id, email: data.profiles?.email || 'Utilisateur', code })

    const { data: recipes } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', data.user_id)
      .order('created_at', { ascending: false })

    setSharedRecipes(recipes || [])
    setLoadingShared(false)
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
    if (!error) {
      setImportedIds(s => new Set([...s, recipe.id]))
    }
    setImporting(null)
  }

  const filteredShared = sharedRecipes.filter(r =>
    !searchShared || r.title.toLowerCase().includes(searchShared.toLowerCase())
  )

  const TAG_COLORS = {
    vegan:      { bg: '#EAF3DE', color: '#3B6D11' },
    vegetarien: { bg: '#EAF3DE', color: '#3B6D11' },
    rapide:     { bg: '#E6F1FB', color: '#185FA5' },
    dessert:    { bg: '#EEEDFE', color: '#3C3489' },
    plat:       { bg: '#E1F5EE', color: '#085041' },
    entree:     { bg: '#FAECE7', color: '#712B13' },
  }

  return (
    <div>

      {/* Mon code de partage */}
      <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
          Mon code de partage
        </div>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
          Partage ce code avec quelqu'un pour qu'il puisse parcourir tes recettes et importer celles qui lui plaisent.
        </div>

        {myCode ? (
          <div>
            {/* Affichage du code */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {myCode.split('').map((c, i) => (
                  <div key={i} style={{
                    width: '36px', height: '44px', background: myCodeActive ? '#E1F5EE' : '#f5f5f0',
                    borderRadius: '8px', border: '0.5px solid ' + (myCodeActive ? '#5DCAA5' : '#ddd'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', fontWeight: '700', color: myCodeActive ? '#0F6E56' : '#aaa',
                    letterSpacing: 0, fontFamily: 'monospace'
                  }}>{c}</div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={copyCode}
                  style={{ padding: '8px 14px', background: copyDone ? '#1D9E75' : 'white', color: copyDone ? 'white' : '#555', border: '0.5px solid ' + (copyDone ? '#1D9E75' : '#ddd'), borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>
                  {copyDone ? 'Copie !' : 'Copier'}
                </button>
                <button onClick={generateCode}
                  style={{ padding: '8px 14px', background: 'none', color: '#888', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  Nouveau code
                </button>
              </div>
            </div>

            {/* Actif / inactif */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                onClick={() => toggleCode(!myCodeActive)}
                style={{
                  width: '36px', height: '20px', borderRadius: '10px', cursor: 'pointer',
                  background: myCodeActive ? '#1D9E75' : '#ddd', position: 'relative', transition: 'background 0.2s'
                }}
              >
                <div style={{
                  width: '16px', height: '16px', borderRadius: '50%', background: 'white',
                  position: 'absolute', top: '2px', transition: 'left 0.2s',
                  left: myCodeActive ? '18px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </div>
              <span style={{ fontSize: '12px', color: myCodeActive ? '#1D9E75' : '#aaa' }}>
                {myCodeActive ? 'Partage actif — les autres peuvent utiliser ce code' : 'Partage desactive'}
              </span>
            </div>
          </div>
        ) : (
          <button onClick={generateCode}
            style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
            Generer mon code de partage
          </button>
        )}
      </div>

      {/* Acceder aux recettes d'un autre */}
      <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
          Parcourir les recettes d'un ami
        </div>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '14px' }}>
          Saisis le code de partage de l'autre personne pour voir ses recettes et importer celles qui te plaisent.
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: codeError ? '8px' : '0' }}>
          <input
            value={inputCode}
            onChange={e => { setInputCode(e.target.value.toUpperCase()); setCodeError('') }}
            onKeyDown={e => e.key === 'Enter' && connectWithCode()}
            placeholder="Ex : AB3X7K"
            maxLength={6}
            style={{
              flex: 1, padding: '10px 14px', border: '0.5px solid #ddd', borderRadius: '8px',
              fontSize: '16px', fontWeight: '600', letterSpacing: '0.15em', outline: 'none',
              fontFamily: 'monospace', textTransform: 'uppercase', textAlign: 'center'
            }}
          />
          <button onClick={connectWithCode} disabled={loadingShared || inputCode.length !== 6}
            style={{ padding: '10px 18px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', opacity: inputCode.length !== 6 ? 0.5 : 1 }}>
            {loadingShared ? 'Recherche...' : 'Acceder'}
          </button>
        </div>

        {codeError && (
          <div style={{ background: '#FCEBEB', color: '#791F1F', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginTop: '8px' }}>
            {codeError}
          </div>
        )}
      </div>

      {/* Recettes partagees */}
      {sharedUser && (
        <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>
                Recettes de {sharedUser.email.split('@')[0]}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>
                {sharedRecipes.length} recette{sharedRecipes.length !== 1 ? 's' : ''} disponible{sharedRecipes.length !== 1 ? 's' : ''}
              </div>
            </div>
            <button onClick={() => { setSharedUser(null); setSharedRecipes([]); setInputCode(''); setImportedIds(new Set()) }}
              style={{ padding: '6px 12px', background: 'none', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', color: '#888' }}>
              Fermer
            </button>
          </div>

          {/* Recherche */}
          <input
            value={searchShared}
            onChange={e => setSearchShared(e.target.value)}
            placeholder="Rechercher une recette..."
            style={{ width: '100%', padding: '9px 14px', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#fafaf8', boxSizing: 'border-box', marginBottom: '12px' }}
          />

          {/* Grille de recettes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
            {filteredShared.map(r => {
              const alreadyImported = importedIds.has(r.id)
              const isImporting = importing === r.id
              return (
                <div key={r.id} style={{ border: '0.5px solid #e0e0e0', borderRadius: '10px', overflow: 'hidden', background: 'white' }}>
                  {r.photo_url ? (
                    <img src={r.photo_url} alt={r.title} style={{ width: '100%', height: '100px', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', background: '#fafaf8' }}>{r.emoji}</div>
                  )}
                  <div style={{ padding: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>{r.title}</div>
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
                      style={{
                        width: '100%', padding: '7px', borderRadius: '7px', fontSize: '12px', cursor: alreadyImported ? 'default' : 'pointer',
                        border: 'none', fontWeight: '500',
                        background: alreadyImported ? '#E1F5EE' : '#1D9E75',
                        color: alreadyImported ? '#0F6E56' : 'white',
                        opacity: isImporting ? 0.7 : 1
                      }}>
                      {isImporting ? 'Import...' : alreadyImported ? 'Importee !' : 'Importer dans ma bibliotheque'}
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
