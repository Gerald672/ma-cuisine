// api/exchange-rate.js
// Recupere le taux de change EUR/CHF depuis l'API gratuite exchangerate-api.com
// Pas de cle API requise pour les paires de base

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // API gratuite sans cle - taux mis a jour quotidiennement
    const response = await fetch('https://open.er-api.com/v6/latest/CHF')
    
    if (!response.ok) {
      throw new Error('API indisponible')
    }

    const data = await response.json()
    
    if (data.result !== 'success') {
      throw new Error('Reponse invalide')
    }

    const rates = {
      'CHF_EUR': data.rates['EUR'],   // 1 CHF = X EUR
      'EUR_CHF': 1 / data.rates['EUR'], // 1 EUR = X CHF
      'updated': data.time_last_update_utc
    }

    // Cache 1 heure
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.status(200).json(rates)

  } catch (error) {
    // Taux de secours si l API est indisponible
    return res.status(200).json({
      'CHF_EUR': 0.95,
      'EUR_CHF': 1.053,
      'updated': 'fallback',
      'error': error.message
    })
  }
}
