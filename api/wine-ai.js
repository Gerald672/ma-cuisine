// api/wine-ai.js — Claude pour la cave (fiche, étiquette, accords, questions)
// Sécurité : l'appel exige un utilisateur connecté (jeton Supabase vérifié) + limite par utilisateur.

const MODELE_RAPIDE = 'claude-haiku-5-5'
const MODELE = 'claude-sonnet-5-5'

const FICHE = 'Réponds UNIQUEMENT en JSON : {"nom":"","producteur":"","millesime":"","couleur":"rouge|blanc|rose|bulles|doux","region":"","pays":"","cepages":"","garde":"année jusqu\'à laquelle le boire, si tu peux l\'estimer"}. Laisse "" ce que tu ne sais pas. N\'invente pas.'
const SOMMELIER = "Tu es un sommelier simple et chaleureux qui parle à un agriculteur suisse romand. Réponds en français, court et concret, sans jargon, avec des listes courtes. Pas de titre en tête de réponse."

const hits = new Map() // limite simple en mémoire : 60 appels / heure / utilisateur
function limite(uid) {
  const now = Date.now()
  const arr = (hits.get(uid) || []).filter(t => now - t < 3600000)
  if (arr.length >= 60) return false
  arr.push(now); hits.set(uid, arr)
  return true
}

async function utilisateur(req) {
  const auth = req.headers.authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const r = await fetch(process.env.REACT_APP_SUPABASE_URL + '/auth/v1/user', {
    headers: { Authorization: 'Bearer ' + token, apikey: process.env.REACT_APP_SUPABASE_ANON_KEY }
  })
  if (!r.ok) return null
  return await r.json()
}

async function claude(messages, { system, modele = MODELE, max_tokens = 1500, web = false } = {}) {
  const corps = { model: modele, max_tokens, messages }
  if (system) corps.system = system
  if (web) corps.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }]
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(corps)
  })
  if (!r.ok) {
    if (web && r.status === 400) return claude(messages, { system, modele, max_tokens, web: false })
    const detail = await r.text()
    if (r.status === 401 || r.status === 403) throw new Error('Clé Claude refusée (vérifie ANTHROPIC_API_KEY sur Vercel).')
    if (/credit/i.test(detail)) throw new Error('Crédit Claude épuisé : recharge-le sur platform.claude.com.')
    if (r.status === 429) throw new Error('Trop de demandes, réessaie dans une minute.')
    throw new Error('Claude a répondu une erreur (' + r.status + ').')
  }
  const data = await r.json()
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
}

function extraireJson(t) {
  const m = (t || '').match(/\{[\s\S]*\}/)
  if (!m) return {}
  try { return JSON.parse(m[0]) } catch (e) { return {} }
}

const COULEURS = { rouge: 'Rouge', blanc: 'Blanc', rose: 'Rosé', bulles: 'Effervescent', doux: 'Doux / liquoreux' }
function decrire(v) {
  if (!v) return ''
  return [v.nom, v.producteur && 'producteur ' + v.producteur, v.millesime, COULEURS[v.couleur] || '', v.region, v.pays,
    v.cepages && 'cépages : ' + v.cepages].filter(Boolean).join(', ')
}
function texteCave(cave) {
  const vins = (cave || []).filter(v => (v.quantite || 0) > 0).slice(0, 300)
  if (!vins.length) return '(cave vide)'
  return vins.map(v => '- ' + decrire(v) + ' — casier ' + (v.casier || '?') + ' — ' + v.quantite + ' btl' + (v.garde ? ' — à boire avant ' + v.garde : '')).join('\n')
}
const court = (s, n) => String(s || '').slice(0, n)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erreur: 'Method not allowed' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ erreur: 'ANTHROPIC_API_KEY non configurée sur Vercel.' })

  let user
  try { user = await utilisateur(req) } catch (e) { user = null }
  if (!user || !user.id) return res.status(401).json({ erreur: 'Connexion nécessaire.' })
  if (!limite(user.id)) return res.status(429).json({ erreur: 'Trop de demandes pour le moment, réessaie plus tard.' })

  const b = req.body || {}
  try {
    if (b.action === 'completer') {
      const v = b.vin || {}
      const t = await claude([{ role: 'user', content: 'Vin : ' + court(decrire(v), 400) + (v.barcode ? '. Code-barres : ' + court(v.barcode, 20) : '') + '.\nComplète la fiche de ce vin. ' + FICHE }], { modele: MODELE_RAPIDE, max_tokens: 400 })
      return res.status(200).json(extraireJson(t))
    }

    if (b.action === 'etiquette') {
      const img = String(b.image || '')
      if (!img || img.length > 4000000) return res.status(400).json({ erreur: 'Photo absente ou trop lourde.' })
      const t = await claude([{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } },
        { type: 'text', text: "Voici la photo d'une étiquette de vin. Lis-la et remplis la fiche. " + FICHE }] }], { max_tokens: 500 })
      return res.status(200).json(extraireJson(t))
    }

    if (b.action === 'demander') {
      const genre = b.genre
      const desc = court(b.vin ? decrire(b.vin) : b.vinTexte, 400)
      let q, web = false
      if (genre === 'cepages') {
        q = 'Pour ce vin : ' + desc + '\nDonne brièvement : les cépages (et proportions habituelles si connues), le style (corps, tanins, acidité, arômes), la température de service, s\'il faut le carafer, et s\'il est à boire maintenant ou à garder.'
        web = true
      } else if (genre === 'repas') {
        q = 'Vin : ' + desc + '\nPropose 5 repas qui iraient très bien avec : 2 simples du quotidien, 2 plats suisses ou de terroir, 1 plat de fête. Une ligne d\'explication chacun. Ajoute la température de service.'
      } else if (genre === 'semblables') {
        q = 'Pour ce vin : ' + desc + '\nPropose 5 vins semblables (même style ou cépages proches), dont au moins 2 suisses s\'il y en a, une ligne sur ce qui les rapproche et un ordre de prix en CHF.\n\nMa cave, pour info (cite ceux qui ressemblent, avec leur casier) :\n' + texteCave(b.cave)
        web = true
      } else if (genre === 'pour_repas') {
        q = 'Repas prévu : ' + court(b.repas, 500) + '\n\nVoici ma cave :\n' + texteCave(b.cave) + '\n\nChoisis les 1 à 3 meilleures bouteilles DE MA CAVE pour ce repas. Pour chacune : nom, **casier** (en gras), une phrase d\'explication. Signale si une bouteille arrive en fin de garde. Si rien ne convient vraiment, dis-le et propose quel type de vin acheter.'
      } else if (genre === 'question') {
        q = 'Question : ' + court(b.question, 800) + '\n\nMa cave, pour info :\n' + texteCave(b.cave) + '\n\nRéponds à la question. Si des vins de ma cave sont concernés, cite-les avec leur casier. Cherche sur internet si la réponse demande des informations récentes ou précises.'
        web = true
      } else {
        return res.status(400).json({ erreur: 'Demande inconnue' })
      }
      const texte = await claude([{ role: 'user', content: q }], { system: SOMMELIER, max_tokens: 1800, web })
      return res.status(200).json({ texte })
    }

    if (b.action === 'suggerer') {
      const pr = b.profil || {}
      const liste = a => (Array.isArray(a) ? a : []).slice(0, 40).map(x => court(x, 120)).join('; ') || '—'
      const q = 'Voici le profil de ma cave :\n'
        + '- ' + (Number(pr.nbBouteilles) || 0) + ' bouteilles, ' + (Number(pr.nbRefs) || 0) + ' références\n'
        + '- Répartition par couleur : ' + court(JSON.stringify(pr.parCouleur || {}), 300) + '\n'
        + '- Régions les plus présentes : ' + liste(pr.regions) + '\n'
        + '- Pays : ' + liste(pr.pays) + '\n'
        + '- Producteurs présents : ' + liste(pr.producteurs) + '\n'
        + '- Prix habituel payé : ' + (pr.prixMoyen ? 'environ ' + Number(pr.prixMoyen) + ' CHF en moyenne (médiane ' + Number(pr.prixMediane) + ', de ' + Number(pr.prixMin) + ' à ' + Number(pr.prixMax) + ')' : 'inconnu') + '\n'
        + '- Mes vins préférés (bien notés) : ' + liste(pr.favoris) + '\n'
        + '- Vins goûtés ailleurs et aimés : ' + liste(pr.degustes) + '\n'
        + '- Déjà en cave (à NE PAS re-proposer) : ' + liste(pr.possedes) + '\n\n'
        + 'Budget par bouteille : ' + court(pr.budget || 'dans mon prix habituel', 60) + '. Focus : ' + court(pr.focus || 'ce qui manque à ma cave', 60) + '.\n\n'
        + 'Propose ' + Math.min(8, Math.max(3, Number(pr.nombre) || 6)) + ' vins À ACHETER pour compléter ma cave : combler ce qui manque (couleurs, régions, styles, vins de garde ou de soif) tout en restant proches de mes goûts et du budget. Mélange des valeurs sûres et 1 ou 2 découvertes. Au moins la moitié de Suisse romande ou de vins faciles à trouver en Suisse si mes goûts vont dans ce sens. Ne propose que de vrais vins existants que tu connais (cuvée précise si tu es sûr), n\'invente ni cuvée ni millésime ; les prix sont des ordres de grandeur en CHF.\n'
        + 'Réponds UNIQUEMENT en JSON : {"analyse":"2 ou 3 phrases : ce que montre ma cave et ce qui lui manque","suggestions":[{"nom":"","producteur":"","region":"","pays":"","couleur":"rouge|blanc|rose|bulles|doux","millesime":"","prix_chf":"ex. 18-24","pourquoi":"1 phrase : pourquoi celui-ci me plaira / ce qu\'il apporte","ou_acheter":"ex. domaine en direct, Coop, caviste"}]}'
      const t = await claude([{ role: 'user', content: q }], { system: SOMMELIER, max_tokens: 2400, web: true })
      const d = extraireJson(t)
      if (!Array.isArray(d.suggestions)) return res.status(502).json({ erreur: 'Réponse illisible, réessaie.' })
      return res.status(200).json({ analyse: court(d.analyse, 600), suggestions: d.suggestions.slice(0, 8).map(x => ({
        nom: court(x.nom, 120), producteur: court(x.producteur, 120), region: court(x.region, 80), pays: court(x.pays, 60),
        couleur: COULEURS[x.couleur] ? x.couleur : 'rouge', millesime: court(x.millesime, 10), prix_chf: court(x.prix_chf, 30),
        pourquoi: court(x.pourquoi, 300), ou_acheter: court(x.ou_acheter, 100) })) })
    }

    return res.status(400).json({ erreur: 'Action inconnue' })
  } catch (e) {
    return res.status(502).json({ erreur: e.message || 'Erreur Claude' })
  }
}
