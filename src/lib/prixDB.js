// Base de prix moyens Suisse 2026
// Sources : Migros, Coop, Rapport Agricole Suisse
// Mise à jour : avril 2026

export const PRIX_DB = [
  // Épicerie
  { nom: 'Farine de blé',       cat: 'Épicerie',          prix: 1.05,  unite: 'CHF/kg',     source: 'Rapport Agricole 2025' },
  { nom: 'Farine bise',         cat: 'Épicerie',          prix: 1.40,  unite: 'CHF/kg',     source: 'Rapport Agricole 2025' },
  { nom: 'Sucre blanc',         cat: 'Épicerie',          prix: 1.20,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Sucre glace',         cat: 'Épicerie',          prix: 1.80,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Sel',                 cat: 'Épicerie',          prix: 0.60,  unite: 'CHF/kg',     source: 'Migros' },
  { nom: 'Huile d\'olive',      cat: 'Épicerie',          prix: 12.00, unite: 'CHF/L',      source: 'Migros/Coop' },
  { nom: 'Huile de tournesol',  cat: 'Épicerie',          prix: 3.50,  unite: 'CHF/L',      source: 'Denner 2025' },
  { nom: 'Vinaigre blanc',      cat: 'Épicerie',          prix: 1.50,  unite: 'CHF/L',      source: 'Migros' },
  { nom: 'Riz arborio',         cat: 'Épicerie',          prix: 4.00,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Riz long grain',      cat: 'Épicerie',          prix: 2.50,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Quinoa',              cat: 'Épicerie',          prix: 6.00,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Pâtes spaghetti',     cat: 'Épicerie',          prix: 1.20,  unite: 'CHF/kg',     source: 'Migros M-Budget' },
  { nom: 'Poudre d\'amandes',   cat: 'Épicerie',          prix: 12.00, unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Levure chimique',     cat: 'Épicerie',          prix: 8.00,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Vin blanc',           cat: 'Épicerie',          prix: 5.00,  unite: 'CHF/L',      source: 'Estimation' },
  { nom: 'Bouillon de légumes', cat: 'Épicerie',          prix: 2.50,  unite: 'CHF/L',      source: 'Migros/Coop' },
  { nom: 'Tomates pelées',      cat: 'Épicerie',          prix: 2.20,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Chocolat noir',       cat: 'Épicerie',          prix: 10.00, unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Miel',                cat: 'Épicerie',          prix: 14.00, unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Confiture',           cat: 'Épicerie',          prix: 1.30,  unite: 'CHF/unité',  source: 'Denner 2025' },
  // Produits laitiers
  { nom: 'Lait entier',         cat: 'Produits laitiers', prix: 1.70,  unite: 'CHF/L',      source: 'Migros/Coop' },
  { nom: 'Crème entière',       cat: 'Produits laitiers', prix: 4.50,  unite: 'CHF/L',      source: 'Migros/Coop' },
  { nom: 'Beurre',              cat: 'Produits laitiers', prix: 15.80, unite: 'CHF/kg',     source: 'Migros Die Butter' },
  { nom: 'Parmesan',            cat: 'Produits laitiers', prix: 22.00, unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Gruyère',             cat: 'Produits laitiers', prix: 18.00, unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Mozzarella',          cat: 'Produits laitiers', prix: 10.00, unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Yaourt nature',       cat: 'Produits laitiers', prix: 2.80,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Fromage frais',       cat: 'Produits laitiers', prix: 6.00,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  // Frais
  { nom: 'Œufs élevage sol',    cat: 'Frais',             prix: 0.40,  unite: 'CHF/unité',  source: 'Rapport Agricole 2025' },
  { nom: 'Œufs plein air',      cat: 'Frais',             prix: 0.63,  unite: 'CHF/unité',  source: 'Rapport Agricole 2025' },
  { nom: 'Menthe fraîche',      cat: 'Frais',             prix: 1.50,  unite: 'CHF/sachet', source: 'Migros/Coop' },
  { nom: 'Basilic frais',       cat: 'Frais',             prix: 1.80,  unite: 'CHF/sachet', source: 'Migros/Coop' },
  { nom: 'Thym frais',          cat: 'Frais',             prix: 1.50,  unite: 'CHF/sachet', source: 'Migros/Coop' },
  { nom: 'Persil frais',        cat: 'Frais',             prix: 1.50,  unite: 'CHF/sachet', source: 'Migros/Coop' },
  // Fruits & légumes
  { nom: 'Champignons de Paris',cat: 'Fruits & légumes',  prix: 8.00,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Oignon',              cat: 'Fruits & légumes',  prix: 1.80,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Ail',                 cat: 'Fruits & légumes',  prix: 8.00,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Tomates',             cat: 'Fruits & légumes',  prix: 3.50,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Carottes',            cat: 'Fruits & légumes',  prix: 2.00,  unite: 'CHF/kg',     source: 'Migros Tiefpreis' },
  { nom: 'Pommes de terre',     cat: 'Fruits & légumes',  prix: 1.80,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Courgettes',          cat: 'Fruits & légumes',  prix: 3.00,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Épinards',            cat: 'Fruits & légumes',  prix: 4.50,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Poireaux',            cat: 'Fruits & légumes',  prix: 3.00,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Citron',              cat: 'Fruits & légumes',  prix: 0.60,  unite: 'CHF/unité',  source: 'Migros/Coop' },
  { nom: 'Oranges',             cat: 'Fruits & légumes',  prix: 0.80,  unite: 'CHF/unité',  source: 'Migros/Coop' },
  { nom: 'Pamplemousse',        cat: 'Fruits & légumes',  prix: 1.20,  unite: 'CHF/unité',  source: 'Migros/Coop' },
  { nom: 'Pommes',              cat: 'Fruits & légumes',  prix: 3.90,  unite: 'CHF/kg',     source: 'Estimation 2024' },
  { nom: 'Bananes',             cat: 'Fruits & légumes',  prix: 2.20,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Fraises',             cat: 'Fruits & légumes',  prix: 6.00,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  // Viande & poisson
  { nom: 'Poulet entier',       cat: 'Viande & poisson',  prix: 9.00,  unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Blanc de poulet',     cat: 'Viande & poisson',  prix: 20.00, unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Poulet budget',       cat: 'Viande & poisson',  prix: 11.50, unite: 'CHF/kg',     source: 'Coop Prix Garantie' },
  { nom: 'Bœuf haché',          cat: 'Viande & poisson',  prix: 18.00, unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Saumon',              cat: 'Viande & poisson',  prix: 28.00, unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Filet de porc',       cat: 'Viande & poisson',  prix: 22.00, unite: 'CHF/kg',     source: 'Migros/Coop' },
  { nom: 'Lardons',             cat: 'Viande & poisson',  prix: 14.00, unite: 'CHF/kg',     source: 'Migros/Coop' },
]

// Recherche rapide par nom d'ingrédient
export function getPrixIngredient(nom) {
  const found = PRIX_DB.find(p => p.nom.toLowerCase() === nom.toLowerCase())
  return found ? found.prix : null
}

// Calcul du coût d'un ingrédient
export function calculerCout(ingredient, factor = 1, prixCustom = {}) {
  const { name, qty, unit } = ingredient
  const prixBase = prixCustom[name] ?? getPrixIngredient(name) ?? 1

  const qteFactor = qty * factor

  if (unit === 'unité(s)' || unit === 'sachet(s)' || unit === 'boîte(s)') {
    return prixBase * qteFactor
  }
  if (unit === 'g') return (prixBase / 1000) * qteFactor
  if (unit === 'ml') return (prixBase / 1000) * qteFactor
  if (unit === 'kg') return prixBase * qteFactor
  if (unit === 'L') return prixBase * qteFactor
  return 0
}
