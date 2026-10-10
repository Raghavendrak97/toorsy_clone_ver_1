/**
 * TOORSY — Interactive Map Component
 * 
 * Modular Architecture:
 * Map Component (Leaflet)
 *   ↓
 * Geocoding Service (Photon / Nominatim OSM)
 *   ↓
 * Routing Service (OSRM Driving Profile)
 * 
 * Principles:
 * - Responsible, compliant OpenStreetMap API usage
 * - No aggressive querying, debounced input, session-cached results
 * - No Google Maps, zero API keys
 * - Graceful failure handling (the form is never blocked)
 * - Scalable design ready for dedicated/self-hosted OSM tiles & routing
 */

import L from 'leaflet';
import { MAP_CONFIG, POPULAR_HUBS } from './map/mapConfig.js';
import { GeocodingService } from './map/geocodingService.js';
import { RoutingService } from './map/routingService.js';

export class MapRouteController {
  constructor() {
    this.map = null;
    this.tileLayer = null;
    this.markersLayer = null;
    this.routeLayer = null;

    // Services
    this.geocodingService = new GeocodingService();
    this.routingService = new RoutingService();

    // Active waypoints
    this.waypoints = {
      start: null,       // { lat: number, lon: number, name: string, fullName?: string }
      stops: [],         // array of { lat: number, lon: number, name: string, fullName?: string }
      destination: null  // { lat: number, lon: number, name: string, fullName?: string }
    };

    // UI state & debounce
    this.debounceTimer = null;
    this.activeDropdown = null;
    this.activeInputWrap = null;
    this.onRouteUpdate = null; // Callback for form controller

    this.init();
  }

  init() {
    const mapContainer = document.getElementById('toorsyRouteMap');
    if (!mapContainer) return;

    this.initMap(mapContainer);
    this.bindLocationInputs();
    this.bindQuickHubButtons();
    this.bindWindowEvents();
  }

  /**
   * Initializes Leaflet map with OpenStreetMap tiles & attribution
   */
  initMap(container) {
    try {
      this.map = L.map(container, {
        center: [15.3173, 75.7139], // South-Central India
        zoom: 6,
        minZoom: MAP_CONFIG.tiles.minZoom,
        maxZoom: MAP_CONFIG.tiles.maxZoom,
        zoomControl: true,
        scrollWheelZoom: false
      });

      // Enable scroll zoom only when explicitly interacting with the map
      this.map.on('focus', () => this.map.scrollWheelZoom.enable());
      this.map.on('blur', () => this.map.scrollWheelZoom.disable());

      // OpenStreetMap standard tile layer with visible attribution
      this.tileLayer = L.tileLayer(MAP_CONFIG.tiles.url, {
        maxZoom: MAP_CONFIG.tiles.maxZoom,
        attribution: MAP_CONFIG.tiles.attribution
      }).addTo(this.map);

      // Graceful tile error handling
      this.tileLayer.on('tileerror', () => {
        this.showMapNotice(MAP_CONFIG.messages.tilesUnavailable);
      });

      // Layer groups for markers and road polyline
      this.routeLayer = L.layerGroup().addTo(this.map);
      this.markersLayer = L.layerGroup().addTo(this.map);

      // Invalidate size once DOM finishes initial rendering
      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
      }, 250);

    } catch (err) {
      console.warn('[TOORSY Map] Failed to initialize Leaflet map:', err);
      this.showMapNotice(MAP_CONFIG.messages.tilesUnavailable);
    }
  }

  /**
   * Binds autocomplete listeners to startingLocation and mainDestination
   */
  bindLocationInputs() {
    const startInput = document.getElementById('startingLocation');
    const destInput = document.getElementById('mainDestination');

    if (startInput) {
      this.attachAutocomplete(startInput, 'start');
    }

    if (destInput) {
      this.attachAutocomplete(destInput, 'destination');
    }

    this.refreshStopInputs();
  }

  /**
   * Binds quick-pick buttons for starting location chips (0 network calls)
   */
  bindQuickHubButtons() {
    document.querySelectorAll('.quick-hub-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const city = btn.getAttribute('data-city') || btn.textContent.trim();
        const lat = parseFloat(btn.getAttribute('data-lat') || '0');
        const lon = parseFloat(btn.getAttribute('data-lon') || '0');
        const targetInputId = btn.getAttribute('data-input') || 'startingLocation';
        const targetInput = document.getElementById(targetInputId);

        if (targetInput) {
          targetInput.value = city;
          targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          targetInput.dispatchEvent(new Event('change', { bubbles: true }));

          this.setWaypoint('start', null, {
            lat,
            lon,
            name: city.split(',')[0].trim(),
            fullName: city
          });

          this.updateMapAndRoute();
        }
      });
    });
  }

  /**
   * Attaches responsible place search & autocomplete to an input
   */
  attachAutocomplete(inputElem, type, stopIndex = null) {
    if (!inputElem || inputElem.dataset.hasAutocomplete === 'true') return;
    inputElem.dataset.hasAutocomplete = 'true';

    let wrap = inputElem.closest('.input-suggest-wrap');
    if (!wrap) {
      wrap = inputElem.parentElement;
      if (wrap && window.getComputedStyle(wrap).position === 'static') {
        wrap.style.position = 'relative';
      }
    }

    // Focus listener: Show suggested hubs on focus (0 network calls)
    inputElem.addEventListener('focus', () => {
      const val = (inputElem.value || '').trim();
      if (val.length === 0) {
        const defaultHubs = POPULAR_HUBS.slice(0, 6).map(h => ({
          name: h.name,
          display_name: h.fullName,
          lat: String(h.lat),
          lon: String(h.lon),
          source: 'Suggested Hub'
        }));
        this.renderDropdown(defaultHubs, inputElem, wrap, type, stopIndex, 'Popular Travel Hubs');
      } else if (val.length >= MAP_CONFIG.geocoding.minQueryLength) {
        this.performSearch(val, inputElem, wrap, type, stopIndex);
      }
    });

    // Input listener: Strictly debounced (450ms) to avoid keystroke spam
    inputElem.addEventListener('input', (e) => {
      const query = (e.target.value || '').trim();

      if (this.debounceTimer) clearTimeout(this.debounceTimer);

      if (query.length === 0) {
        this.closeActiveDropdown();
        this.setWaypoint(type, stopIndex, null);
        this.updateMapAndRoute();
        return;
      }

      // Check instant local hub matches (< 5ms, 0 network calls)
      const instantMatches = this.geocodingService.getLocalMatches(query);
      if (instantMatches.length > 0) {
        this.renderDropdown(instantMatches, inputElem, wrap, type, stopIndex, 'OpenStreetMap Matches');
      }

      // If query is shorter than 3 characters, do NOT query public API
      if (query.length < MAP_CONFIG.geocoding.minQueryLength) {
        return;
      }

      // Debounce external search responsibly
      this.debounceTimer = setTimeout(() => {
        this.performSearch(query, inputElem, wrap, type, stopIndex);
      }, MAP_CONFIG.geocoding.debounceMs);
    });

    // Keyboard support: Enter, Escape, Arrow keys
    inputElem.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (this.activeDropdown) {
          const selectedOption = this.activeDropdown.querySelector('.autocomplete-item.selected') ||
                                 this.activeDropdown.querySelector('.autocomplete-item');
          if (selectedOption) {
            e.preventDefault();
            selectedOption.click();
            return;
          }
        }
        this.resolveTypedLocation(inputElem.value, type, stopIndex);
      } else if (e.key === 'Escape') {
        this.closeActiveDropdown();
      }
    });

    inputElem.addEventListener('blur', () => {
      setTimeout(() => {
        this.closeActiveDropdown();
        const val = (inputElem.value || '').trim();
        const currentWp = this.getWaypoint(type, stopIndex);
        // Only geocode on blur if valid text exists and is not already resolved
        if (val.length >= MAP_CONFIG.geocoding.minQueryLength && (!currentWp || !currentWp.name || !val.includes(currentWp.name))) {
          this.resolveTypedLocation(val, type, stopIndex);
        }
      }, 250);
    });
  }

  /**
   * Executes geocoding search via GeocodingService
   */
  async performSearch(query, targetInput, wrap, type, stopIndex) {
    const res = await this.geocodingService.search(query);

    if (res.ok && Array.isArray(res.results) && res.results.length > 0) {
      this.hideMapNotice();
      this.renderDropdown(res.results, targetInput, wrap, type, stopIndex, 'OpenStreetMap Results');
    } else if (!res.ok) {
      this.showMapNotice(res.error || MAP_CONFIG.messages.geocodingUnavailable);
    }
  }

  /**
   * Renders place suggestions in an isolated floating dropdown
   */
  renderDropdown(results, targetInput, wrap, type, stopIndex, headerTitle = 'Suggestions') {
    this.closeActiveDropdown();
    if (!results || results.length === 0) return;

    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    dropdown.setAttribute('role', 'listbox');

    // Clean header bar
    const header = document.createElement('div');
    header.className = 'dropdown-header-bar';
    header.innerHTML = `<span>📍 ${this.escapeHtml(headerTitle)}</span> <span class="osm-tag">OpenMap</span>`;
    dropdown.appendChild(header);

    results.forEach((item, idx) => {
      const option = document.createElement('div');
      option.className = 'autocomplete-item' + (idx === 0 ? ' selected' : '');
      option.setAttribute('role', 'option');

      const title = item.name || item.display_name.split(',')[0];
      const subtitle = item.display_name;

      option.innerHTML = `
        <span class="icon">📍</span>
        <div class="text-wrap">
          <strong class="title">${this.escapeHtml(title)}</strong>
          <span class="sub">${this.escapeHtml(subtitle)}</span>
        </div>
      `;

      option.addEventListener('mousedown', (e) => {
        e.preventDefault(); // prevent blur before click
        this.selectSuggestion(item, targetInput, type, stopIndex);
      });

      dropdown.appendChild(option);
    });

    wrap.appendChild(dropdown);
    wrap.classList.add('has-dropdown-open');
    this.activeDropdown = dropdown;
    this.activeInputWrap = wrap;
  }

  closeActiveDropdown() {
    if (this.activeDropdown) {
      if (this.activeDropdown.parentElement) {
        this.activeDropdown.parentElement.removeChild(this.activeDropdown);
      }
      this.activeDropdown = null;
    }
    if (this.activeInputWrap) {
      this.activeInputWrap.classList.remove('has-dropdown-open');
      this.activeInputWrap = null;
    }
  }

  /**
   * User clicked a suggestion
   */
  selectSuggestion(item, targetInput, type, stopIndex) {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const primaryName = item.name || item.display_name.split(',')[0];
    const cleanDisplay = this.formatCleanName(item);

    targetInput.value = cleanDisplay;

    // Trigger standard input/change events for form sync
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    targetInput.dispatchEvent(new Event('change', { bubbles: true }));

    this.closeActiveDropdown();

    // Store waypoint
    this.setWaypoint(type, stopIndex, {
      lat,
      lon,
      name: primaryName,
      fullName: cleanDisplay
    });

    if (type === 'start') {
      const startStatus = document.getElementById('startStatusText');
      if (startStatus) {
        startStatus.textContent = `🟢 Origin: ${primaryName}`;
      }
    }

    this.hideMapNotice();
    this.updateMapAndRoute();
  }

  /**
   * Resolves typed location directly if user leaves without clicking suggestion
   */
  async resolveTypedLocation(query, type, stopIndex) {
    if (!query || query.trim().length < MAP_CONFIG.geocoding.minQueryLength) return;

    const res = await this.geocodingService.search(query.trim());
    if (res.ok && Array.isArray(res.results) && res.results.length > 0) {
      const item = res.results[0];
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      const primaryName = item.name || query.trim();

      this.setWaypoint(type, stopIndex, {
        lat,
        lon,
        name: primaryName,
        fullName: item.display_name || query.trim()
      });

      this.updateMapAndRoute();
    }
  }

  formatCleanName(item) {
    if (item.display_name) {
      const parts = item.display_name.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0]}, ${parts[1]}`;
      }
      return parts[0] || item.name;
    }
    return item.name;
  }

  setWaypoint(type, stopIndex, waypoint) {
    if (type === 'start') {
      this.waypoints.start = waypoint;
    } else if (type === 'destination') {
      this.waypoints.destination = waypoint;
    } else if (type === 'stop') {
      if (stopIndex !== null && stopIndex !== undefined) {
        this.waypoints.stops[stopIndex] = waypoint;
      }
    }
  }

  getWaypoint(type, stopIndex) {
    if (type === 'start') return this.waypoints.start;
    if (type === 'destination') return this.waypoints.destination;
    if (type === 'stop' && stopIndex !== null) return this.waypoints.stops[stopIndex];
    return null;
  }

  refreshStopInputs() {
    const stopInputs = document.querySelectorAll('.stop-input');
    while (this.waypoints.stops.length > stopInputs.length) {
      this.waypoints.stops.pop();
    }

    stopInputs.forEach((input, index) => {
      this.attachAutocomplete(input, 'stop', index);
    });
  }

  onStopRemoved(index) {
    if (this.waypoints.stops[index]) {
      this.waypoints.stops.splice(index, 1);
      this.updateMapAndRoute();
    }
  }

  /**
   * Updates map markers & calculates road route via RoutingService
   */
  async updateMapAndRoute() {
    if (!this.map) return;

    this.markersLayer.clearLayers();
    this.routeLayer.clearLayers();

    // Assemble ordered waypoints: start -> stops -> destination
    const orderedPoints = [];

    if (this.waypoints.start) {
      orderedPoints.push({
        ...this.waypoints.start,
        type: 'start',
        label: 'A',
        badge: 'Start Origin'
      });
    }

    (this.waypoints.stops || []).forEach((stop, i) => {
      if (stop && typeof stop.lat === 'number' && typeof stop.lon === 'number') {
        orderedPoints.push({
          ...stop,
          type: 'stop',
          label: `${i + 1}`,
          badge: `Stop ${i + 1}`
        });
      }
    });

    if (this.waypoints.destination) {
      orderedPoints.push({
        ...this.waypoints.destination,
        type: 'destination',
        label: 'B',
        badge: 'Destination'
      });
    }

    // Render Markers on Map
    const bounds = L.latLngBounds([]);

    orderedPoints.forEach((pt) => {
      const latlng = [pt.lat, pt.lon];
      bounds.extend(latlng);

      const markerIcon = this.createCustomMarkerIcon(pt);
      const marker = L.marker(latlng, { icon: markerIcon });

      marker.bindPopup(`
        <div class="map-popup-card">
          <div class="popup-badge ${pt.type}">${this.escapeHtml(pt.badge)}</div>
          <strong>${this.escapeHtml(pt.name)}</strong>
          ${pt.fullName ? `<p class="popup-sub">${this.escapeHtml(pt.fullName)}</p>` : ''}
        </div>
      `);

      this.markersLayer.addLayer(marker);
    });

    // 0 or 1 point entered
    if (orderedPoints.length < 2) {
      if (orderedPoints.length === 1) {
        const p = orderedPoints[0];
        this.map.setView([p.lat, p.lon], 11, { animate: true });
        this.updateStatusBadge(`📍 Start: ${p.name}. Add stops or destination`, 'neutral');
      } else {
        this.updateStatusBadge('Awaiting route', 'neutral');
      }
      this.renderMetricSummary(null);
      if (typeof this.onRouteUpdate === 'function') {
        this.onRouteUpdate(null);
      }
      return;
    }

    // 2 or more points -> Request road route from RoutingService
    this.updateStatusBadge('Calculating road route...', 'loading');

    const result = await this.routingService.calculateRoute(orderedPoints);

    if (result.isAborted) {
      return; // A newer route request superseded this one
    }

    if (result.ok && result.route) {
      const { distanceKm, durationSec, durationText, geometry } = result.route;

      // Draw actual road geometry
      const routeGeoJson = L.geoJSON(geometry, {
        style: {
          color: '#FF6B35',
          weight: 5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        }
      });

      this.routeLayer.addLayer(routeGeoJson);

      // Fit map view to route bounds
      this.map.fitBounds(routeGeoJson.getBounds(), {
        padding: [35, 35],
        maxZoom: 14,
        animate: true
      });

      this.updateStatusBadge('Road route calculated', 'success');
      this.hideMapNotice();

      const routeInfo = {
        distanceKm,
        durationSec,
        durationText,
        points: orderedPoints
      };

      this.renderMetricSummary(routeInfo);

      if (typeof this.onRouteUpdate === 'function') {
        this.onRouteUpdate(routeInfo);
      }

    } else {
      // Routing failure: strictly NEVER show fake distance or straight-line distance
      console.warn('[TOORSY Map] Routing unavailable:', result.error);
      this.updateStatusBadge('Route unavailable', 'warning');
      this.showMapNotice(result.error || MAP_CONFIG.messages.routingUnavailable);

      this.renderMetricSummary(null);

      if (typeof this.onRouteUpdate === 'function') {
        this.onRouteUpdate(null);
      }
    }
  }

  createCustomMarkerIcon(point) {
    let pinClass = 'start';
    if (point.type === 'stop') pinClass = 'stop';
    if (point.type === 'destination') pinClass = 'end';

    const html = `
      <div class="custom-map-pin ${pinClass}">
        <span class="pin-symbol">${this.escapeHtml(point.label)}</span>
      </div>
    `;

    return L.divIcon({
      className: 'custom-div-icon',
      html,
      iconSize: [32, 42],
      iconAnchor: [16, 40],
      popupAnchor: [0, -36]
    });
  }

  renderMetricSummary(info) {
    const emptyState = document.getElementById('metricEmptyState');
    const activeState = document.getElementById('metricActiveState');
    const distElem = document.getElementById('routeDistanceDisplay');
    const durationElem = document.getElementById('routeDurationDisplay');
    const stopsLine = document.getElementById('routeSummaryStopsLine');

    if (!emptyState || !activeState) return;

    if (!info || typeof info.distanceKm !== 'number' || !isFinite(info.distanceKm)) {
      emptyState.classList.remove('hidden');
      activeState.classList.add('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    activeState.classList.remove('hidden');

    if (distElem) distElem.textContent = `${info.distanceKm} km`;
    if (durationElem) durationElem.textContent = `approximately ${info.durationText}`;

    if (stopsLine && Array.isArray(info.points)) {
      const pills = info.points.map((p, idx) => {
        let badgeColor = '#065F46';
        let bgColor = '#D1FAE5';
        if (p.type === 'stop') {
          badgeColor = '#1E40AF';
          bgColor = '#DBEAFE';
        } else if (p.type === 'destination') {
          badgeColor = '#C2410C';
          bgColor = '#FFEDD5';
        }
        return `
          <span style="background: ${bgColor}; color: ${badgeColor}; padding: 0.15rem 0.55rem; border-radius: 9999px; font-weight: 700; font-size: 0.8rem;">
            ${this.escapeHtml(p.name)}
          </span>
          ${idx < info.points.length - 1 ? '<span style="color: #94A3B8; font-weight: 800;">➔</span>' : ''}
        `;
      }).join(' ');

      stopsLine.innerHTML = pills;
    }
  }

  updateStatusBadge(text, state = 'neutral') {
    const badge = document.getElementById('mapRouteStatusBadge');
    if (!badge) return;

    badge.className = `map-header-badge ${state}`;
    badge.innerHTML = `<span class="dot"></span> ${this.escapeHtml(text)}`;
  }

  showMapNotice(message) {
    const notice = document.getElementById('mapErrorNotice') || document.getElementById('mapStatusNotice');
    if (notice) {
      notice.textContent = message;
      notice.classList.remove('hidden');
    }
  }

  hideMapNotice() {
    const notice = document.getElementById('mapErrorNotice') || document.getElementById('mapStatusNotice');
    if (notice) {
      notice.textContent = '';
      notice.classList.add('hidden');
    }
  }

  bindWindowEvents() {
    window.addEventListener('resize', () => {
      if (this.map) this.map.invalidateSize();
    });

    document.addEventListener('toorsy_step_changed', (e) => {
      if (e.detail && e.detail.step === 1 && this.map) {
        setTimeout(() => this.map.invalidateSize(), 150);
      }
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
