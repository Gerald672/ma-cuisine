// Table de normalisation des ingrédients
// Clé = variantes à corriger, valeur = forme canonique
const INGREDIENT_NORMALIZATION = {
  // Oeufs
  'oeuf':          'oeuf',
  'oeufs':         'oeufs',
  'œuf':           'oeuf',
  'œufs':          'oeufs',
  'Oeuf':          'oeuf',
  'Oeufs':         'oeufs',
  'Œuf':           'oeuf',
  'Œufs':          'oeufs',
  // Boeuf
  'bœuf':          'boeuf',
  'Bœuf':          'boeuf',
  'Boeuf':         'boeuf',
  'bœuf haché':    'boeuf haché',
  'bœuf hache':    'boeuf haché',
  'boeuf hache':   'boeuf haché',
  'rôti de bœuf':  'rôti de boeuf',
  'roti de boeuf': 'rôti de boeuf',
  // Ail
  'Ail':           'ail',
  'gousse d\'ail': 'gousse d\'ail',
  'gousses d\'ail':'gousses d\'ail',
  // Beurre
  'Beurre':        'beurre',
  // Crème
  'crème fraîche': 'crème fraîche',
  'creme fraiche': 'crème fraîche',
  'Crème':         'crème',
  'Crème fraîche': 'crème fraîche',
  // Champignons
  'Champignons':   'champignons',
  'champignon':    'champignons',
  'Champignon':    'champignons',
  // Curry
  'Curry':         'curry',
  // Chocolat
  'Chocolat':      'chocolat',
  // Carottes
  'carotte':       'carottes',
  'Carotte':       'carottes',
  'Carottes':      'carottes',
  // Courgettes
  'courgette':     'courgettes',
  'Courgette':     'courgettes',
  'Courgettes':    'courgettes',
  // Echalotes
  'échalote':      'échalotes',
  'echalote':      'échalotes',
  'echalotes':     'échalotes',
  'Échalote':      'échalotes',
  'Echalote':      'échalotes',
  'Échalotes':     'échalotes',
  // Oignon
  'Oignon':        'oignon',
  'oignons':       'oignon',
  'Oignons':       'oignon',
  // Poivre
  'Poivre':        'poivre',
}

/**
 * Normalise le nom d'un ingrédient selon la table de référence.
 * Si pas de correspondance exacte, retourne le nom en minuscules avec trim.
 */
function normalizeIngredientName(name) {
  if (!name) return name
  const trimmed = name.trim()
  // Correspondance exacte dans la table
  if (INGREDIENT_NORMALIZATION[trimmed]) {
    return INGREDIENT_NORMALIZATION[trimmed]
  }
  // Sinon : minuscules + trim (évite au moins les Majuscules parasites)
  return trimmed.toLowerCase()
}

/**
 * Applique la normalisation sur tous les ingrédients d'une recette.
 */
function normalizeIngredients(recipe) {
  if (!recipe || !Array.isArray(recipe.ingredients)) return recipe
  return {
    ...recipe,
    ingredients: recipe.ingredients.map(ing => ({
      ...ing,
      name: normalizeIngredientName(ing.name)
    }))
  }
}

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
  "ingredients": [{"name": "nom en minuscules sans accent superflu", "qty": quantite_nombre, "unit": "g ou kg ou ml ou L ou unite(s) ou sachet(s)"}],
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
- Les noms d'ingredients doivent etre en minuscules, sans majuscule initiale, sans ligature (oeuf pas oeuf, boeuf pas boeuf).
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

    // Normalisation des ingrédients avant de retourner la recette
    const normalizedRecipe = normalizeIngredients(recipe)

    return res.status(200).json(normalizedRecipe)

  } catch (error) {
    return res.status(500).json({ error: "Erreur lors de l'analyse", details: error.message })
  }
}
