export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.body

  if (!url) {
    return res.status(400).json({ error: 'URL manquante' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: `Analyse cette URL de recette et extrait toutes les informations : ${url}

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans backticks) :
{
  "title": "nom exact de la recette",
  "source": "nom du site web",
  "emoji": "un emoji représentant le plat",
  "time": nombre_minutes_entier,
  "cost": estimation_cout_CHF_entier,
  "servings": nombre_portions_entier,
  "cats": ["parmi: vegan, vegetarien, rapide, economique, dessert, plat, entree, soupe"],
  "ingredients": [{"name": "nom", "qty": quantite_nombre, "unit": "g ou kg ou ml ou L ou unite(s) ou sachet(s)"}],
  "steps": ["etape 1 complete", "etape 2 complete"],
  "notes": "conseils ou variantes si mentionnes",
  "nutrition": {
    "calories": nombre_kcal_par_portion,
    "proteines": nombre_g_par_portion,
    "glucides": nombre_g_par_portion,
    "lipides": nombre_g_par_portion,
    "fibres": nombre_g_par_portion_ou_null,
    "sel": nombre_g_par_portion_ou_null
  }
}

Regles importantes :
- Pour la nutrition : si le site affiche des valeurs nutritionnelles, utilise-les exactement. Sinon, calcule-les a partir des ingredients de facon realiste. Les valeurs sont TOUJOURS par portion individuelle.
- calories, proteines, glucides, lipides sont obligatoires (jamais null).
- fibres et sel peuvent etre null si vraiment impossibles a estimer.
- Si tu ne peux pas acceder a la page, genere une recette plausible basee sur le titre dans l URL.`
        }]
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: 'Erreur API Anthropic', details: data })
    }

    const text = data.content.map(i => i.text || '').join('')
    const clean = text.replace(/```json|```/g, '').trim()
    const recipe = JSON.parse(clean)

    return res.status(200).json(recipe)

  } catch (error) {
    return res.status(500).json({ error: "Erreur lors de l'analyse", details: error.message })
  }
}
