import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'

// Types de base
const emptyQuote = {
  id: null,
  title: '',
  pax: 0,
  start_date: null,
  end_date: null,
  days: [],
  margin_pct: 0.1627,
  onspot_manual: null,
  hassle_manual: null,
}

// Fonction pour enrichir une ligne depuis le catalogue
async function enrichLineFromCatalog(line, serviceId) {
  if (!serviceId) return line
  
  try {
    const res = await fetch(`http://127.0.0.1:8000/services/${serviceId}`)
    if (!res.ok) return line
    
    const svc = await res.json()
    const fields = svc.fields || {}
    const snapshot = {
      id: svc.id,
      name: svc.name,
      category: svc.category,
      supplier_name: svc.supplier?.name || svc.company,
      city: svc.city,
      country: svc.country,
      destination: svc.start_destination,
      hotel_stars: fields.hotel_stars || svc.hotel_stars,
      hotel_url: fields.hotel_url || fields.website_company,
      meal_1: fields.meal_1,
      full_description: svc.full_description,
      brief_description: svc.brief_description,
      notes: svc.notes,
      extras: svc.extras,
    }
    
    return {
      ...line,
      raw_json: {
        ...line.raw_json,
        fields,
        snapshot,
      },
    }
  } catch (err) {
    console.error('Erreur enrichissement:', err)
    return line
  }
}

// Fonction pour créer une ligne depuis le catalogue
function lineFromCatalog(svc, dayId) {
  const fields = svc.fields || {}
  const baseLine = {
    quote_day_id: dayId,
    position: 0,
    service_id: svc.id,
    category: svc.category || 'Hotel',
    title: svc.name || '',
    supplier_name: svc.supplier?.name || svc.company || '',
    visibility: 'client',
    achat_eur: svc.net_amount ? parseFloat(svc.net_amount) : null,
    achat_usd: null,
    vente_usd: null,
    fx_rate: null,
    currency: svc.currency || 'EUR',
    base_net_amount: svc.net_amount ? parseFloat(svc.net_amount) : null,
    raw_json: {
      fields: fields,
      snapshot: {
        id: svc.id,
        name: svc.name,
        category: svc.category,
        supplier_name: svc.supplier?.name || svc.company,
        city: svc.city,
        country: svc.country,
        destination: svc.start_destination,
        hotel_stars: fields.hotel_stars || svc.hotel_stars,
        hotel_url: fields.hotel_url || fields.website_company,
        meal_1: fields.meal_1,
        full_description: svc.full_description,
        brief_description: svc.brief_description,
        notes: svc.notes,
        extras: svc.extras,
      },
    },
  }
  return baseLine
}

export default function QuoteEditor() {
  const [q, setQ] = useState(emptyQuote)
  const [activeDayId, setActiveDayId] = useState(null)
  const [catalogServices, setCatalogServices] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const insertingRef = useRef(false)

  // Charger les services populaires du catalogue
  useEffect(() => {
    async function loadPopular() {
      try {
        const res = await fetch('http://127.0.0.1:8000/services/popular?category=Hotel&limit=20')
        if (res.ok) {
          const data = await res.json()
          setCatalogServices(data.items || data || [])
        }
      } catch (err) {
        console.error('Erreur chargement catalogue:', err)
      }
    }
    loadPopular()
  }, [])

  // Recherche dans le catalogue
  const handleSearch = useCallback(async (query) => {
    if (!query.trim()) {
      // Recharger les populaires
      const res = await fetch('http://127.0.0.1:8000/services/popular?category=Hotel&limit=20')
      if (res.ok) {
        const data = await res.json()
        setCatalogServices(data.items || data || [])
      }
      return
    }
    
    try {
      const res = await fetch(`http://127.0.0.1:8000/services/search?q=${encodeURIComponent(query)}&category=Hotel&limit=20`)
      if (res.ok) {
        const data = await res.json()
        setCatalogServices(data.items || data || [])
      }
    } catch (err) {
      console.error('Erreur recherche:', err)
    }
  }, [])

  // Garde-fou pour éviter les doubles clics
  const safeInsertFromCatalog = useCallback((svc) => {
    if (insertingRef.current) {
      console.warn('Insertion déjà en cours, ignoré')
      return
    }
    insertingRef.current = true
    setTimeout(() => {
      insertingRef.current = false
    }, 1000)
    insertCatalogService(svc)
  }, [])

  // Insérer un service du catalogue dans le jour actif
  const insertCatalogService = useCallback(async (svc) => {
    if (!activeDayId) {
      alert('Veuillez sélectionner un jour d\'abord')
      return
    }

    const day = q.days.find(d => d.id === activeDayId)
    if (!day) return

    const newLine = lineFromCatalog(svc, activeDayId)
    const newLines = [...(day.lines || []), newLine]

    // Mettre à jour l'état local
    const updatedDays = q.days.map(d =>
      d.id === activeDayId ? { ...d, lines: newLines } : d
    )

    setQ({ ...q, days: updatedDays })

    // Enrichir la ligne de manière asynchrone
    const enrichedLine = await enrichLineFromCatalog(newLine, svc.id)
    const finalLines = day.lines.map(l =>
      l === newLine ? enrichedLine : l
    )

    const finalDays = q.days.map(d =>
      d.id === activeDayId ? { ...d, lines: finalLines } : d
    )

    setQ({ ...q, days: finalDays })
  }, [q, activeDayId])

  // Composant RightItem pour afficher un service du catalogue
  const RightItem = ({ svc }) => {
    return (
      <div
        style={{
          padding: '12px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          marginBottom: '8px',
          cursor: 'pointer',
          backgroundColor: '#fff',
        }}
        onClick={() => safeInsertFromCatalog(svc)}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
          {svc.name}
        </div>
        {svc.supplier_name && (
          <div style={{ fontSize: '0.9em', color: '#666' }}>
            {svc.supplier_name}
          </div>
        )}
        {svc.city && (
          <div style={{ fontSize: '0.85em', color: '#888' }}>
            {svc.city}
          </div>
        )}
        {svc.price_value && (
          <div style={{ fontSize: '0.9em', fontWeight: 'bold', marginTop: '4px' }}>
            {svc.price_value} {svc.price_currency || 'EUR'}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui' }}>
      {/* Panneau principal */}
      <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
        <h1>Quote Editor</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Titre de la quote"
            value={q.title || ''}
            onChange={(e) => setQ({ ...q, title: e.target.value })}
            style={{ padding: '8px', width: '300px', fontSize: '16px' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label>
            PAX: 
            <input
              type="number"
              value={q.pax || 0}
              onChange={(e) => setQ({ ...q, pax: parseInt(e.target.value) || 0 })}
              style={{ marginLeft: '8px', padding: '4px', width: '80px' }}
            />
          </label>
        </div>

        {/* Liste des jours */}
        <div>
          <h2>Jours</h2>
          {q.days.length === 0 ? (
            <p>Aucun jour ajouté</p>
          ) : (
            q.days.map((day) => (
              <div
                key={day.id}
                style={{
                  border: activeDayId === day.id ? '2px solid #007bff' : '1px solid #ddd',
                  padding: '12px',
                  marginBottom: '12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveDayId(day.id)}
              >
                <div style={{ fontWeight: 'bold' }}>
                  Jour {day.position + 1} - {day.date || 'Date non définie'}
                </div>
                {day.destination && (
                  <div style={{ color: '#666', fontSize: '0.9em' }}>
                    {day.destination}
                  </div>
                )}
                <div style={{ marginTop: '8px' }}>
                  {day.lines?.length || 0} ligne(s)
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Panneau latéral - Catalogue */}
      <div
        style={{
          width: '350px',
          borderLeft: '1px solid #ddd',
          padding: '20px',
          backgroundColor: '#f9f9f9',
          overflow: 'auto',
        }}
      >
        <h2>Catalogue Hôtels</h2>
        
        <input
          type="text"
          placeholder="Rechercher un hôtel..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            handleSearch(e.target.value)
          }}
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '16px',
            fontSize: '14px',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />

        <div>
          {catalogServices.length === 0 ? (
            <p>Aucun service trouvé</p>
          ) : (
            catalogServices.map((svc) => (
              <RightItem key={svc.id} svc={svc} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
