import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const RADIUS_OPTIONS = [
  { label: '1 mi', value: 1609 },
  { label: '5 mi', value: 8047 },
  { label: '10 mi', value: 16093 },
  { label: '25 mi', value: 40234 },
  { label: '50 mi', value: 50000 },
];

const BUSINESS_TYPES = [
  { label: 'All Types', value: '' },
  { label: 'Restaurants', value: 'restaurant' },
  { label: 'Contractors', value: 'general_contractor' },
  { label: 'Plumbers', value: 'plumber' },
  { label: 'Electricians', value: 'electrician' },
  { label: 'Roofers', value: 'roofing_contractor' },
  { label: 'HVAC', value: 'hvac_contractor' },
  { label: 'Auto Repair', value: 'car_repair' },
  { label: 'Dentists', value: 'dentist' },
  { label: 'Lawyers', value: 'lawyer' },
  { label: 'Real Estate', value: 'real_estate_agency' },
  { label: 'Insurance', value: 'insurance_agency' },
  { label: 'Retail Stores', value: 'store' },
  { label: 'Gyms', value: 'gym' },
  { label: 'Salons', value: 'hair_care' },
];

export default function App() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [leads, setLeads] = useState(() => JSON.parse(localStorage.getItem('leads') || '[]'));
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState('leads');
  const [filters, setFilters] = useState({ noWeb: false, noPhone: false, notCalled: false });
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('mapsApiKey') || '');
  const [keyInput, setKeyInput] = useState('');
  const markers = useRef([]);
  const searchCircle = useRef(null);
  
  // Search controls
  const [radius, setRadius] = useState(8047); // 5 miles default
  const [businessType, setBusinessType] = useState('');
  const [pagination, setPagination] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [searchCenter, setSearchCenter] = useState(null);

  useEffect(() => { localStorage.setItem('leads', JSON.stringify(leads)); updateMarkers(); }, [leads]);

  useEffect(() => {
    if (!apiKey) return;
    if (window.google?.maps) { initMap(); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = initMap;
    script.onerror = () => alert('Failed to load Google Maps. Check your API key.');
    document.head.appendChild(script);
  }, [apiKey]);

  function initMap() {
    if (!mapRef.current || mapInstance.current) return;
    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 39.8283, lng: -98.5795 }, zoom: 4,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d1d' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e0e' }] },
      ],
      disableDefaultUI: true, zoomControl: true,
    });
    // Update search center when map is moved
    mapInstance.current.addListener('idle', () => {
      const center = mapInstance.current.getCenter();
      setSearchCenter({ lat: center.lat(), lng: center.lng() });
    });
    updateMarkers();
  }

  function updateSearchCircle(center, radiusVal) {
    if (searchCircle.current) {
      searchCircle.current.setMap(null);
    }
    if (!mapInstance.current || !window.google || !center) return;
    searchCircle.current = new window.google.maps.Circle({
      map: mapInstance.current,
      center: center,
      radius: radiusVal,
      fillColor: '#a855f7',
      fillOpacity: 0.1,
      strokeColor: '#a855f7',
      strokeOpacity: 0.4,
      strokeWeight: 2,
    });
  }

  function updateMarkers() {
    markers.current.forEach(m => m.setMap(null));
    markers.current = [];
    if (!mapInstance.current || !window.google) return;
    leads.forEach(lead => {
      if (!lead.lat || !lead.lng) return;
      const marker = new window.google.maps.Marker({
        position: { lat: lead.lat, lng: lead.lng },
        map: mapInstance.current,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: lead.called ? '#22c55e' : '#a855f7', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
      });
      markers.current.push(marker);
    });
  }

  function search(loadMore = false) {
    if (!mapInstance.current) return;
    
    // If loading more, use the pagination object
    if (loadMore && pagination) {
      setSearching(true);
      pagination.nextPage();
      return;
    }
    
    if (!query.trim() && !businessType) {
      alert('Enter a search term or select a business type');
      return;
    }
    
    setSearching(true);
    setHasMore(false);
    setPagination(null);
    
    const center = mapInstance.current.getCenter();
    const searchLocation = { lat: center.lat(), lng: center.lng() };
    
    // Show search radius circle
    updateSearchCircle(searchLocation, radius);
    
    const service = new window.google.maps.places.PlacesService(mapInstance.current);
    
    const searchRequest = {
      location: searchLocation,
      radius: radius,
    };
    
    // Add keyword if provided
    if (query.trim()) {
      searchRequest.keyword = query.trim();
    }
    
    // Add type if selected
    if (businessType) {
      searchRequest.type = businessType;
    }
    
    service.nearbySearch(searchRequest, (results, status, paginationObj) => {
      setSearching(false);
      if (status !== 'OK' || !results) {
        if (status === 'ZERO_RESULTS') {
          alert('No results found in this area. Try expanding your radius or moving the map.');
        } else {
          alert('Search failed: ' + status);
        }
        return;
      }
      
      // Store pagination for "load more"
      if (paginationObj && paginationObj.hasNextPage) {
        setPagination(paginationObj);
        setHasMore(true);
      } else {
        setPagination(null);
        setHasMore(false);
      }
      
      const newLeads = results.map(p => ({
        id: p.place_id, name: p.name, address: p.vicinity || p.formatted_address,
        lat: p.geometry.location.lat(), lng: p.geometry.location.lng(),
        phone: null, website: null, called: false, addedAt: Date.now(),
        rating: p.rating || null, userRatingsTotal: p.user_ratings_total || 0,
      }));
      
      // Fetch details for each lead (phone/website)
      newLeads.forEach(lead => {
        service.getDetails({ placeId: lead.id, fields: ['formatted_phone_number', 'website'] }, (place) => {
          if (place) setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, phone: place.formatted_phone_number || null, website: place.website || null } : l));
        });
      });
      
      setLeads(prev => { const ids = new Set(prev.map(l => l.id)); return [...prev, ...newLeads.filter(l => !ids.has(l.id))]; });
      setTab('leads');
    });
  }
  
  function loadMore() {
    if (pagination && pagination.hasNextPage) {
      setSearching(true);
      pagination.nextPage();
    }
  }
  
  // Handle pagination results
  useEffect(() => {
    if (!pagination) return;
    
    const handlePagination = (results, status, paginationObj) => {
      setSearching(false);
      if (status !== 'OK' || !results) return;
      
      if (paginationObj && paginationObj.hasNextPage) {
        setPagination(paginationObj);
        setHasMore(true);
      } else {
        setPagination(null);
        setHasMore(false);
      }
      
      const newLeads = results.map(p => ({
        id: p.place_id, name: p.name, address: p.vicinity || p.formatted_address,
        lat: p.geometry.location.lat(), lng: p.geometry.location.lng(),
        phone: null, website: null, called: false, addedAt: Date.now(),
        rating: p.rating || null, userRatingsTotal: p.user_ratings_total || 0,
      }));
      
      const service = new window.google.maps.places.PlacesService(mapInstance.current);
      newLeads.forEach(lead => {
        service.getDetails({ placeId: lead.id, fields: ['formatted_phone_number', 'website'] }, (place) => {
          if (place) setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, phone: place.formatted_phone_number || null, website: place.website || null } : l));
        });
      });
      
      setLeads(prev => { const ids = new Set(prev.map(l => l.id)); return [...prev, ...newLeads.filter(l => !ids.has(l.id))]; });
    };
    
    // This effect runs when pagination changes, but the actual callback happens in loadMore
  }, [pagination]);

  function toggleCalled(id) { setLeads(prev => prev.map(l => l.id === id ? { ...l, called: !l.called } : l)); }
  function removeLead(id) { setLeads(prev => prev.filter(l => l.id !== id)); }

  const filtered = leads.filter(l => {
    if (filters.noWeb && l.website) return false;
    if (filters.noPhone && l.phone) return false;
    if (filters.notCalled && l.called) return false;
    return true;
  });

  function saveKey() { if (keyInput.trim()) { localStorage.setItem('mapsApiKey', keyInput.trim()); setApiKey(keyInput.trim()); } }

  if (!apiKey) {
    return (
      <div className="setup">
        <div className="setup-box">
          <h1>🗺️ Sales Tracker</h1>
          <p>Enter your Google Maps API key to get started</p>
          <input placeholder="AIzaSy..." value={keyInput} onChange={e => setKeyInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveKey()} />
          <button onClick={saveKey} disabled={!keyInput.trim()}>Start</button>
          <div className="help">
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Get API Key</a>
            <span> • Enable Maps JavaScript API + Places API</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="map" ref={mapRef} />
      <div className={`panel ${panelOpen ? '' : 'closed'}`}>
        <div className="panel-header">
          <button className="toggle-btn" onClick={() => setPanelOpen(!panelOpen)}>{panelOpen ? '◀' : '▶'}</button>
          {panelOpen && (
            <div className="tabs">
              <button className={tab === 'leads' ? 'active' : ''} onClick={() => setTab('leads')}>Leads <span className="count">{filtered.length}</span></button>
              <button className={tab === 'search' ? 'active' : ''} onClick={() => setTab('search')}>Search</button>
            </div>
          )}
        </div>
        {panelOpen && (
          <div className="panel-body">
            {tab === 'search' && (
              <div className="search-row">
                <input placeholder="e.g. plumbers in miami" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
                <button onClick={search} disabled={searching}>🔍</button>
              </div>
            )}
            {tab === 'leads' && (
              <>
                <div className="filters">
                  <label><input type="checkbox" checked={filters.noWeb} onChange={() => setFilters(f => ({ ...f, noWeb: !f.noWeb }))} /> No Website</label>
                  <label><input type="checkbox" checked={filters.noPhone} onChange={() => setFilters(f => ({ ...f, noPhone: !f.noPhone }))} /> No Phone</label>
                  <label><input type="checkbox" checked={filters.notCalled} onChange={() => setFilters(f => ({ ...f, notCalled: !f.notCalled }))} /> Not Called</label>
                </div>
                <div className="list">
                  {filtered.length === 0 && <div className="empty">No leads yet. Search to add some!</div>}
                  {filtered.map(lead => (
                    <div key={lead.id} className={`item ${lead.called ? 'done' : ''}`}>
                      <label className="check"><input type="checkbox" checked={lead.called} onChange={() => toggleCalled(lead.id)} /><span></span></label>
                      <div className="item-info">
                        <div className="item-name">{lead.name}</div>
                        <div className="item-addr">{lead.address}</div>
                        <div className="item-tags">
                          {lead.phone ? <span className="tag ok">📞 {lead.phone}</span> : <span className="tag bad">No phone</span>}
                          {lead.website ? <span className="tag ok">🌐 Has site</span> : <span className="tag bad">No website</span>}
                        </div>
                      </div>
                      <button className="del-btn" onClick={() => removeLead(lead.id)}>×</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <div className="legend"><span><i style={{ background: '#a855f7' }}></i> Not called</span><span><i style={{ background: '#22c55e' }}></i> Called</span></div>
    </div>
  );
}
