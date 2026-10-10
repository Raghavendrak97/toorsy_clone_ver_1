/**
 * TOORSY — OpenStreetMap & Routing Configuration
 * 
 * Modular configuration designed for:
 * - Responsible, compliant OpenStreetMap API usage
 * - Easy migration to dedicated/hosted OSM tiles or routing providers as TOORSY scales
 * - Zero Google Maps / zero paid APIs
 */

export const MAP_CONFIG = {
  // Map Tiles (OpenStreetMap compatible)
  tiles: {
    // Default public OpenStreetMap tile source
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    maxZoom: 19,
    minZoom: 4,
    // Can be switched to self-hosted or dedicated OSM tile server (e.g. Stadia, Jawg, MapTiler)
    providerName: 'OpenStreetMap'
  },

  // Geocoding & Place Search (Responsible OSM-based search via Photon)
  geocoding: {
    minQueryLength: 3,         // Strictly search only after 3+ characters
    debounceMs: 450,           // 450ms debounce to prevent keystroke request hammering
    cacheTtlMs: 3600000,       // 1 hour session cache for recent queries
    maxCacheEntries: 100,      // Max cached queries
    // Primary: Photon (Komoot OSM-based search, ₹0 cost)
    photonEndpoint: 'https://photon.komoot.io/api/'
  },

  // Routing (Open Source Routing Machine)
  routing: {
    // Public OSRM driving profile endpoint
    endpoint: 'https://router.project-osrm.org/route/v1/driving/',
    cacheTtlMs: 3600000,       // 1 hour session cache for calculated routes
    maxCacheEntries: 50        // Max cached routes
  },

  // User-facing error and status messages (Strict compliance with guidelines)
  messages: {
    geocodingUnavailable: 'Location search is temporarily unavailable.',
    routingUnavailable: "We couldn't calculate the route right now.",
    tilesUnavailable: 'The map is temporarily unavailable.',
    disclaimer: 'Distance and driving time are approximate and may vary depending on the route, traffic, road conditions and stops.'
  }
};

// 32+ Pre-seeded major Indian travel hubs for instant zero-network resolution
export const POPULAR_HUBS = [
  { name: 'Bengaluru', fullName: 'Bengaluru, Karnataka, India', lat: 12.97679, lon: 77.59008, state: 'Karnataka' },
  { name: 'Mysuru', fullName: 'Mysuru (Mysore), Karnataka, India', lat: 12.29581, lon: 76.63938, state: 'Karnataka' },
  { name: 'Mangaluru', fullName: 'Mangaluru (Mangalore), Karnataka, India', lat: 12.91414, lon: 74.85596, state: 'Karnataka' },
  { name: 'Hyderabad', fullName: 'Hyderabad, Telangana, India', lat: 17.38504, lon: 78.48667, state: 'Telangana' },
  { name: 'Chennai', fullName: 'Chennai, Tamil Nadu, India', lat: 13.08268, lon: 80.27072, state: 'Tamil Nadu' },
  { name: 'Mumbai', fullName: 'Mumbai, Maharashtra, India', lat: 19.07609, lon: 72.87743, state: 'Maharashtra' },
  { name: 'Pune', fullName: 'Pune, Maharashtra, India', lat: 18.52043, lon: 73.85674, state: 'Maharashtra' },
  { name: 'Goa', fullName: 'Panaji, Goa, India', lat: 15.49886, lon: 73.82785, state: 'Goa' },
  { name: 'Kochi', fullName: 'Kochi (Cochin), Kerala, India', lat: 9.93123, lon: 76.26730, state: 'Kerala' },
  { name: 'Delhi', fullName: 'New Delhi, Delhi, India', lat: 28.61394, lon: 77.20902, state: 'Delhi' },
  { name: 'Coimbatore', fullName: 'Coimbatore, Tamil Nadu, India', lat: 11.01684, lon: 76.95583, state: 'Tamil Nadu' },
  { name: 'Madurai', fullName: 'Madurai, Tamil Nadu, India', lat: 9.92520, lon: 78.11978, state: 'Tamil Nadu' },
  { name: 'Hubballi', fullName: 'Hubballi-Dharwad, Karnataka, India', lat: 15.36471, lon: 75.12395, state: 'Karnataka' },
  { name: 'Belagavi', fullName: 'Belagavi (Belgaum), Karnataka, India', lat: 15.84969, lon: 74.49767, state: 'Karnataka' },
  { name: 'Udupi', fullName: 'Udupi, Karnataka, India', lat: 13.34088, lon: 74.74214, state: 'Karnataka' },
  { name: 'Gokarna', fullName: 'Gokarna, Uttara Kannada, Karnataka, India', lat: 14.54786, lon: 74.31884, state: 'Karnataka' },
  { name: 'Murudeshwar', fullName: 'Murudeshwar, Bhatkal, Karnataka, India', lat: 14.09403, lon: 74.48995, state: 'Karnataka' },
  { name: 'Ooty', fullName: 'Ooty (Udhagamandalam), Tamil Nadu, India', lat: 11.41020, lon: 76.69503, state: 'Tamil Nadu' },
  { name: 'Coonoor', fullName: 'Coonoor, Nilgiris, Tamil Nadu, India', lat: 11.35300, lon: 76.79590, state: 'Tamil Nadu' },
  { name: 'Kodaikanal', fullName: 'Kodaikanal, Dindigul, Tamil Nadu, India', lat: 10.23811, lon: 77.48918, state: 'Tamil Nadu' },
  { name: 'Wayanad', fullName: 'Wayanad (Kalpetta), Kerala, India', lat: 11.60539, lon: 76.08299, state: 'Kerala' },
  { name: 'Munnar', fullName: 'Munnar, Idukki, Kerala, India', lat: 10.08893, lon: 77.05952, state: 'Kerala' },
  { name: 'Coorg (Madikeri)', fullName: 'Madikeri, Kodagu (Coorg), Karnataka, India', lat: 12.42442, lon: 75.73819, state: 'Karnataka' },
  { name: 'Chikkamagaluru', fullName: 'Chikkamagaluru, Karnataka, India', lat: 13.31614, lon: 75.77205, state: 'Karnataka' },
  { name: 'Hampi', fullName: 'Hampi, Vijayanagara, Karnataka, India', lat: 15.33501, lon: 76.46002, state: 'Karnataka' },
  { name: 'Pondicherry', fullName: 'Puducherry (Pondicherry), India', lat: 11.94159, lon: 79.80831, state: 'Puducherry' },
  { name: 'Tirupati', fullName: 'Tirupati, Andhra Pradesh, India', lat: 13.62876, lon: 79.41918, state: 'Andhra Pradesh' },
  { name: 'Vijayawada', fullName: 'Vijayawada, Andhra Pradesh, India', lat: 16.50617, lon: 80.64802, state: 'Andhra Pradesh' },
  { name: 'Visakhapatnam', fullName: 'Visakhapatnam, Andhra Pradesh, India', lat: 17.68682, lon: 83.21848, state: 'Andhra Pradesh' },
  { name: 'Ahmedabad', fullName: 'Ahmedabad, Gujarat, India', lat: 23.02250, lon: 72.57136, state: 'Gujarat' },
  { name: 'Jaipur', fullName: 'Jaipur, Rajasthan, India', lat: 26.91243, lon: 75.78727, state: 'Rajasthan' },
  { name: 'Kolkata', fullName: 'Kolkata, West Bengal, India', lat: 22.57265, lon: 88.36390, state: 'West Bengal' }
];
