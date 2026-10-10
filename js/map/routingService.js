/**
 * TOORSY — Road Routing Service
 * 
 * Compliant OSRM road routing engine with:
 * - Minimum 2 valid coordinate waypoints requirement
 * - Coordinate signature hashing & session caching
 * - In-flight query cancellation (AbortController)
 * - Zero repeated requests for the same route
 * - Strict prohibition of fake / straight-line driving distance
 * - Clear error handling: "We couldn't calculate the route right now."
 */

import { MAP_CONFIG } from './mapConfig.js';

export class RoutingService {
  constructor() {
    this.routeCache = new Map(); // hash -> { distanceKm, durationSec, durationText, geometry, timestamp }
    this.activeAbortController = null;
    this.lastCalculatedHash = '';
  }

  /**
   * Generates a stable unique signature for ordered waypoints
   */
  getRouteHash(points) {
    if (!Array.isArray(points) || points.length < 2) return '';
    return points
      .map(p => `${Number(p.lon).toFixed(4)},${Number(p.lat).toFixed(4)}`)
      .join(';');
  }

  /**
   * Calculates actual road route using OSRM driving profile
   * @param {Array<{ lat: number, lon: number, name?: string }>} orderedPoints 
   * @returns {Promise<{ ok: boolean, route?: object, error?: string }>}
   */
  async calculateRoute(orderedPoints) {
    if (!Array.isArray(orderedPoints) || orderedPoints.length < 2) {
      return { ok: false, error: 'At least two valid waypoints required.' };
    }

    // Verify all points have valid finite coordinates
    const valid = orderedPoints.every(p => 
      p && typeof p.lat === 'number' && typeof p.lon === 'number' &&
      isFinite(p.lat) && isFinite(p.lon)
    );

    if (!valid) {
      return { ok: false, error: 'Invalid waypoint coordinates.' };
    }

    const coordsHash = this.getRouteHash(orderedPoints);

    // 1. Check session cache first (zero duplicate requests)
    const cached = this.routeCache.get(coordsHash);
    if (cached && (Date.now() - cached.timestamp < MAP_CONFIG.routing.cacheTtlMs)) {
      this.lastCalculatedHash = coordsHash;
      return { ok: true, route: cached };
    }

    // 2. Cancel previous in-flight routing request
    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    this.activeAbortController = new AbortController();
    const { signal } = this.activeAbortController;

    try {
      const url = `${MAP_CONFIG.routing.endpoint}${coordsHash}?overview=full&geometries=geojson`;
      const res = await fetch(url, { signal });

      if (!res.ok) {
        throw new Error(`Routing provider responded with status ${res.status}`);
      }

      const data = await res.json();
      if (!data || !Array.isArray(data.routes) || data.routes.length === 0) {
        throw new Error('No driving route found between specified points');
      }

      const bestRoute = data.routes[0];
      const distanceKm = Math.round(bestRoute.distance / 1000);
      const durationSec = Math.round(bestRoute.duration);
      const durationText = this.formatDuration(durationSec);

      const routeResult = {
        distanceKm,
        durationSec,
        durationText,
        geometry: bestRoute.geometry,
        timestamp: Date.now()
      };

      // Save to cache
      this.saveToCache(coordsHash, routeResult);
      this.lastCalculatedHash = coordsHash;

      return { ok: true, route: routeResult };

    } catch (err) {
      if (err.name === 'AbortError') {
        return { ok: false, isAborted: true };
      }
      console.warn('[TOORSY RoutingService] OSRM route calculation failed:', err);

      return {
        ok: false,
        error: MAP_CONFIG.messages.routingUnavailable
      };
    } finally {
      if (this.activeAbortController && this.activeAbortController.signal === signal) {
        this.activeAbortController = null;
      }
    }
  }

  formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0 min';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);

    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} hr`;
    return `${hours} hr ${mins} min`;
  }

  saveToCache(key, route) {
    if (this.routeCache.size >= MAP_CONFIG.routing.maxCacheEntries) {
      const oldestKey = this.routeCache.keys().next().value;
      if (oldestKey) this.routeCache.delete(oldestKey);
    }
    this.routeCache.set(key, route);
  }

  clear() {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    this.routeCache.clear();
    this.lastCalculatedHash = '';
  }
}
