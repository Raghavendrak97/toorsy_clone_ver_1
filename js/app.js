/**
 * TOORSY — Main Application Orchestration Script
 */

import { TripFormController } from './form.js';
import { Analytics } from './analytics.js';
import { CONFIG, getActiveScriptUrl, setActiveScriptUrl } from './googleSheets.js';
import { MapRouteController } from './mapRoute.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Form Controller
  const formController = new TripFormController();

  // 2. Initialize Interactive Leaflet Route Map (OpenStreetMap, Nominatim & OSRM)
  const mapController = new MapRouteController();
  formController.setMapController(mapController);

  // Sync calculated road kilometers with form state for Google Sheets submission
  mapController.onRouteUpdate = (route) => {
    formController.setRouteMetrics(route);
  };

  // 3. Track initial landing page visit
  Analytics.landingPageViewed(window.location.href);

  // 4. Setup Navigation & Smooth Scrolling
  setupNavigation(formController);

  // 5. Setup Contact Buttons
  setupContactLinks();

  // 6. Setup Web App URL Config Drawer / Tester
  setupConfigDrawer();
});

function setupNavigation(formController) {
  // Mobile hamburger menu toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileNavMenu = document.getElementById('mobileNavMenu');

  if (mobileMenuBtn && mobileNavMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      const isExpanded = mobileMenuBtn.getAttribute('aria-expanded') === 'true';
      mobileMenuBtn.setAttribute('aria-expanded', String(!isExpanded));
      mobileNavMenu.classList.toggle('active');
    });

    // Close mobile menu on link click
    mobileNavMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
        mobileNavMenu.classList.remove('active');
      });
    });
  }

  // Smooth scroll and CTA triggers
  document.querySelectorAll('[data-scroll-to]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('data-scroll-to');
      const targetElem = document.getElementById(targetId);

      if (btn.classList.contains('btn-plan-cta')) {
        const source = btn.getAttribute('data-cta-source') || 'general';
        Analytics.planMyTripClicked(source);

        // If form is in success state or closed, bring it back
        const successSection = document.getElementById('successSection');
        const formSection = document.getElementById('formSection');
        if (successSection && !successSection.classList.contains('hidden')) {
          formController.resetForm();
        }
      }

      if (targetElem) {
        targetElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

function setupContactLinks() {
  const phoneClean = CONFIG.TOORSY_PHONE.replace(/[^\d+]/g, '');
  const whatsappClean = CONFIG.TOORSY_WHATSAPP.replace(/[^\d]/g, '');

  // Track phone clicks
  document.querySelectorAll('.btn-phone-contact').forEach(el => {
    el.href = `tel:${phoneClean}`;
    el.addEventListener('click', () => {
      Analytics.phoneClicked('header_or_footer');
    });
  });

  // Track whatsapp clicks
  document.querySelectorAll('.btn-whatsapp-contact').forEach(el => {
    el.href = `https://wa.me/${whatsappClean}?text=${encodeURIComponent('Hello TOORSY, I would like to plan a trip.')}`;
    el.addEventListener('click', () => {
      Analytics.whatsAppClicked('general_link');
    });
  });
}

/**
 * Provides a clean UI helper for users testing their Google Apps Script integration
 */
function setupConfigDrawer() {
  const openModalBtn = document.getElementById('btnOpenScriptConfig');
  const modal = document.getElementById('scriptConfigModal');
  const closeModalBtn = document.getElementById('btnCloseScriptConfig');
  const saveUrlBtn = document.getElementById('btnSaveScriptUrl');
  const urlInput = document.getElementById('customScriptUrlInput');
  const activeScriptDisplay = document.getElementById('activeScriptUrlDisplay');
  const connectionBadge = document.getElementById('sheetsConnectionBadge');

  function updateStatusDisplay() {
    const activeUrl = getActiveScriptUrl();
    const isConfigured = activeUrl && !activeUrl.includes("PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE");

    if (activeScriptDisplay) {
      activeScriptDisplay.textContent = isConfigured ? activeUrl : "Not Configured Yet (Code.gs Web App)";
    }

    if (connectionBadge) {
      if (isConfigured) {
        connectionBadge.className = 'status-badge connected';
        connectionBadge.innerHTML = '<span class="dot"></span> Web App URL Connected';
      } else {
        connectionBadge.className = 'status-badge pending';
        connectionBadge.innerHTML = '<span class="dot"></span> Setup Required (Apps Script)';
      }
    }

    if (urlInput) {
      urlInput.value = isConfigured ? activeUrl : '';
    }
  }

  updateStatusDisplay();

  if (openModalBtn && modal) {
    openModalBtn.addEventListener('click', () => {
      updateStatusDisplay();
      modal.classList.remove('hidden');
    });
  }

  if (closeModalBtn && modal) {
    closeModalBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  // Click outside modal to close
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  }

  if (saveUrlBtn && urlInput && modal) {
    saveUrlBtn.addEventListener('click', () => {
      const enteredUrl = urlInput.value.trim();
      setActiveScriptUrl(enteredUrl);
      updateStatusDisplay();
      modal.classList.add('hidden');

      // Also clear any previous submission failure banners
      const banner = document.getElementById('submitErrorBanner');
      if (banner) banner.classList.add('hidden');
    });
  }
}
