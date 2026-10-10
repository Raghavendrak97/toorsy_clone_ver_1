/**
 * TOORSY — Multi-Step Form Controller
 * Manages steps, state, dynamic calculations, conditional rendering, review summary, and submission.
 */

import { Validation } from './validation.js';
import { submitEnquiryToGoogleSheets, generateClientSubmissionId, getActiveScriptUrl, CONFIG } from './googleSheets.js';
import { Analytics } from './analytics.js';

export class TripFormController {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 8;
    this.isSubmitting = false;
    this.clientSubmissionId = generateClientSubmissionId();

    // Form data model
    this.formData = {
      fullName: '',
      startingLocation: '',
      mainDestination: '',
      stops: [],
      roadDistanceKm: 0,
      estimatedDrivingTime: '',
      roamingKilometers: '100',
      totalEstimatedKm: 100,
      additionalDestinations: '',
      tripType: '',

      tripStartDate: '',
      tripEndDate: '',
      flexibleDates: 'No',

      adults: 2,
      children: 0,
      seniorCitizens: 0,

      vehiclePreference: '',

      localSightseeing: 'Yes',
      sightseeingPlaces: '',
      sightseeingPreference: 'Driver suggests places',

      accommodationRequired: 'No',
      numberOfRooms: 1,
      hotelCategory: '3 Star',
      hotelBudget: '',

      mobileNumber: '',
      whatsappNumber: '',
      email: '',
      preferredContactMethod: 'WhatsApp',
      specialRequirements: '',
      consentToContact: false,

      // UTM & metadata
      utmSource: '',
      utmMedium: '',
      utmCampaign: '',
      landingPage: window.location.href
    };

    this.stepNames = [
      'Trip',
      'Dates',
      'Travellers',
      'Vehicle',
      'Explore',
      'Stay',
      'Contact',
      'Review'
    ];

    this.init();
  }

  init() {
    this.captureUtmParameters();
    this.bindDomEvents();
    this.setupMinDates();
    this.updateCalculations();
    this.updateConditionalFields();
    this.renderStep();
  }

  captureUtmParameters() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      this.formData.utmSource = urlParams.get('utm_source') || '';
      this.formData.utmMedium = urlParams.get('utm_medium') || '';
      this.formData.utmCampaign = urlParams.get('utm_campaign') || '';
      this.formData.landingPage = window.location.origin + window.location.pathname;
    } catch (e) {
      console.warn('Could not parse UTM parameters', e);
    }
  }

  setupMinDates() {
    const today = new Date().toISOString().split('T')[0];
    const startDateInput = document.getElementById('tripStartDate');
    const endDateInput = document.getElementById('tripEndDate');

    if (startDateInput) startDateInput.min = today;
    if (endDateInput) endDateInput.min = today;
  }

  bindDomEvents() {
    // Stepper navigation buttons
    const nextBtn = document.getElementById('btnNextStep');
    const prevBtn = document.getElementById('btnPrevStep');
    const submitBtn = document.getElementById('btnSubmitEnquiry');
    const resetBtn = document.getElementById('btnPlanAnotherTrip');

    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.handleNextStep());
    }
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.handlePrevStep());
    }
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.handleSubmit());
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetForm());
    }

    // Number stepper buttons
    document.querySelectorAll('.stepper-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const field = target.getAttribute('data-field');
        const change = parseInt(target.getAttribute('data-change'), 10);
        this.handleStepperChange(field, change);
      });
    });

    // Inputs value sync
    document.querySelectorAll('input, select, textarea').forEach(input => {
      const name = input.name || input.id;
      if (!name) return;

      const eventType = (input.type === 'checkbox' || input.type === 'radio' || input.tagName === 'SELECT') ? 'change' : 'input';

      input.addEventListener(eventType, (e) => {
        this.handleInputChange(e.target);
      });
    });

    // Quick fill "Same as Mobile" for WhatsApp
    const copyMobileBtn = document.getElementById('btnSameAsMobile');
    if (copyMobileBtn) {
      copyMobileBtn.addEventListener('click', () => {
        const mobile = this.formData.mobileNumber;
        const whatsappInput = document.getElementById('whatsappNumber');
        if (whatsappInput) {
          whatsappInput.value = mobile;
          this.formData.whatsappNumber = mobile;
          this.clearFieldError('whatsappNumber');
        }
      });
    }

    // Vehicle cards selection
    document.querySelectorAll('.vehicle-card').forEach(card => {
      card.addEventListener('click', () => {
        const value = card.getAttribute('data-vehicle');
        this.selectVehicle(value);
      });
    });

    // Add Intermediate Stop button (+ Add Stop)
    const addStopBtn = document.getElementById('btnAddStop');
    if (addStopBtn) {
      addStopBtn.addEventListener('click', () => {
        this.addStop();
      });
    }

    // Roaming Kilometers preset chips
    document.querySelectorAll('.roaming-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const km = chip.getAttribute('data-km');
        const roamingInput = document.getElementById('roamingKilometers');
        if (km === 'custom') {
          if (roamingInput) {
            roamingInput.focus();
            roamingInput.select();
          }
        } else {
          if (roamingInput) roamingInput.value = km;
          this.formData.roamingKilometers = km;
        }
        this.updateRoamingChips(km);
        this.updateRouteJourneyPreview();
      });
    });

    // Route inputs live listener for journey preview
    const startInput = document.getElementById('startingLocation');
    const destInput = document.getElementById('mainDestination');
    const roamingInput = document.getElementById('roamingKilometers');

    if (startInput) startInput.addEventListener('input', () => this.updateRouteJourneyPreview());
    if (destInput) destInput.addEventListener('input', () => this.updateRouteJourneyPreview());
    if (roamingInput) {
      roamingInput.addEventListener('input', (e) => {
        this.formData.roamingKilometers = e.target.value;
        this.updateRoamingChips(e.target.value);
        this.updateRouteJourneyPreview();
      });
    }

    // Trip type selection pills/cards
    document.querySelectorAll('.trip-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const value = btn.getAttribute('data-trip-type');
        this.selectTripType(value);
      });
    });

    // Keyboard support: Enter key in single-line inputs advances to next step
    document.querySelectorAll('.step-pane input:not([type="checkbox"]):not([type="radio"])').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleNextStep();
        }
      });
    });
  }

  handleInputChange(target) {
    const field = target.name || target.id;
    if (!field) return;

    if (target.type === 'checkbox') {
      this.formData[field] = target.checked;
    } else if (target.type === 'radio') {
      if (target.checked) {
        this.formData[field] = target.value;
      }
    } else {
      this.formData[field] = target.value;
    }

    // Clear error for this field
    this.clearFieldError(field);

    // Dynamic triggers
    if (field === 'tripStartDate' || field === 'tripEndDate') {
      this.updateCalculations();
      // Ensure end date min is at least start date
      if (field === 'tripStartDate' && target.value) {
        const endDateInput = document.getElementById('tripEndDate');
        if (endDateInput) {
          endDateInput.min = target.value;
          if (endDateInput.value && endDateInput.value < target.value) {
            endDateInput.value = target.value;
            this.formData.tripEndDate = target.value;
          }
        }
      }
    }

    if (field === 'localSightseeing') {
      this.updateConditionalFields();
    }

    if (field === 'accommodationRequired') {
      this.updateConditionalFields();
    }

    if (field === 'roamingKilometers') {
      this.calculateTotalKilometers();
    }
  }

  handleStepperChange(field, change) {
    let currentVal = parseInt(this.formData[field], 10) || 0;
    let min = (field === 'adults') ? 1 : 0;
    let max = 50;

    let newVal = Math.max(min, Math.min(max, currentVal + change));
    this.formData[field] = newVal;

    const displayElem = document.getElementById(`display_${field}`);
    if (displayElem) displayElem.textContent = newVal;

    const inputElem = document.getElementById(field);
    if (inputElem) inputElem.value = newVal;

    this.clearFieldError(field);
    this.updateCalculations();
  }

  selectVehicle(vehicleName) {
    this.formData.vehiclePreference = vehicleName;
    document.querySelectorAll('.vehicle-card').forEach(card => {
      const isSelected = card.getAttribute('data-vehicle') === vehicleName;
      card.classList.toggle('selected', isSelected);
      card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });
    this.clearFieldError('vehiclePreference');
  }

  selectTripType(type) {
    this.formData.tripType = type;
    document.querySelectorAll('.trip-type-btn').forEach(btn => {
      const isSelected = btn.getAttribute('data-trip-type') === type;
      btn.classList.toggle('active', isSelected);
    });
    this.clearFieldError('tripType');
  }

  setMapController(mapCtrl) {
    this.mapController = mapCtrl;
  }

  setRouteMetrics(route) {
    if (route && route.distanceKm) {
      this.formData.roadDistanceKm = route.distanceKm;
      this.formData.estimatedDrivingTime = route.durationText || '';
    } else {
      this.formData.roadDistanceKm = 0;
      this.formData.estimatedDrivingTime = '';
    }
    this.calculateTotalKilometers();
  }

  calculateTotalKilometers() {
    const road = parseInt(this.formData.roadDistanceKm, 10) || 0;
    const roaming = parseInt(this.formData.roamingKilometers, 10) || 0;
    this.formData.totalEstimatedKm = road + roaming;
    this.updateRouteJourneyPreview();
  }

  // Stops management (Unlimited stops)
  addStop(value = '') {
    this.formData.stops.push(value);
    this.renderStops();
    this.updateRouteJourneyPreview();

    if (this.mapController) {
      this.mapController.refreshStopInputs();
    }

    // Focus newly added stop input
    setTimeout(() => {
      const inputs = document.querySelectorAll('.stop-input');
      if (inputs.length > 0) {
        inputs[inputs.length - 1].focus();
      }
    }, 50);
  }

  removeStop(index) {
    this.formData.stops.splice(index, 1);
    this.renderStops();
    this.updateRouteJourneyPreview();

    if (this.mapController) {
      this.mapController.onStopRemoved(index);
    }
  }

  handleStopChange(index, value) {
    this.formData.stops[index] = value;
    this.updateRouteJourneyPreview();
  }

  renderStops() {
    const container = document.getElementById('stopsListContainer');
    const countBadge = document.getElementById('stopsCountBadge');
    if (!container) return;

    if (countBadge) {
      const count = this.formData.stops.length;
      countBadge.textContent = `${count} stop${count === 1 ? '' : 's'}`;
    }

    if (this.formData.stops.length === 0) {
      container.innerHTML = `
        <div class="stops-empty-hint" id="stopsEmptyHint">
          No intermediate stops added yet. Click <strong>+ Add Stop</strong> to add places along the way.
        </div>
      `;
      return;
    }

    container.innerHTML = this.formData.stops.map((stop, i) => `
      <div class="stop-item-row" data-index="${i}">
        <span class="stop-badge">Stop ${i + 1}</span>
        <input type="text" class="form-input stop-input" placeholder="e.g. Mysuru" value="${this.escapeHtml(stop)}" data-index="${i}" aria-label="Intermediate Stop ${i + 1}" />
        <button type="button" class="btn-remove-stop" data-index="${i}" title="Remove Stop ${i + 1}" aria-label="Remove Stop ${i + 1}">
          ✕
        </button>
      </div>
    `).join('');

    // Bind stop input changes
    container.querySelectorAll('.stop-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        this.handleStopChange(idx, e.target.value);
      });
    });

    // Bind stop remove buttons
    container.querySelectorAll('.btn-remove-stop').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        this.removeStop(idx);
      });
    });
  }

  updateRoamingChips(currentVal) {
    let matched = false;
    document.querySelectorAll('.roaming-chip').forEach(chip => {
      const km = chip.getAttribute('data-km');
      if (km === String(currentVal)) {
        chip.classList.add('active');
        matched = true;
      } else {
        chip.classList.remove('active');
      }
    });
    if (!matched) {
      const customChip = document.querySelector('.roaming-chip[data-km="custom"]');
      if (customChip) customChip.classList.add('active');
    }
  }

  updateRouteJourneyPreview() {
    const preview = document.getElementById('routeJourneyPreview');
    const flow = document.getElementById('routeJourneyFlow');
    if (!preview || !flow) return;

    const start = (this.formData.startingLocation || '').trim();
    const dest = (this.formData.mainDestination || '').trim();
    const validStops = (this.formData.stops || []).map(s => (s || '').trim()).filter(Boolean);

    if (!start && !dest && validStops.length === 0) {
      preview.classList.add('hidden');
      return;
    }

    preview.classList.remove('hidden');

    const items = [];
    if (start) {
      items.push(`<span class="route-pill start">📍 ${this.escapeHtml(start)}</span>`);
    } else {
      items.push(`<span class="route-pill start" style="opacity: 0.5;">📍 Start</span>`);
    }

    validStops.forEach((stop, i) => {
      items.push(`<span class="route-arrow">➔</span>`);
      items.push(`<span class="route-pill stop">🛑 Stop ${i + 1}: ${this.escapeHtml(stop)}</span>`);
    });

    items.push(`<span class="route-arrow">➔</span>`);

    if (dest) {
      items.push(`<span class="route-pill end">🏁 ${this.escapeHtml(dest)}</span>`);
    } else {
      items.push(`<span class="route-pill end" style="opacity: 0.5;">🏁 Destination</span>`);
    }

    const roadKm = parseInt(this.formData.roadDistanceKm, 10) || 0;
    const roamingKm = parseInt(this.formData.roamingKilometers, 10) || 0;
    const totalKm = roadKm + roamingKm;

    if (roadKm > 0 && roamingKm > 0) {
      items.push(`<span style="margin-left: 0.5rem; font-size: 0.8rem; font-weight: 700; color: #1E3A8A; background: #DBEAFE; padding: 0.25rem 0.65rem; border-radius: 9999px;">🛣️ Road: ${roadKm} km + 🚗 Roaming: ${roamingKm} km = <strong>${totalKm} km Total</strong></span>`);
    } else if (roadKm > 0) {
      items.push(`<span style="margin-left: 0.5rem; font-size: 0.8rem; font-weight: 700; color: #1E3A8A; background: #DBEAFE; padding: 0.25rem 0.65rem; border-radius: 9999px;">🛣️ Road: ${roadKm} km</span>`);
    } else if (roamingKm > 0) {
      items.push(`<span style="margin-left: 0.5rem; font-size: 0.8rem; font-weight: 700; color: #1E3A8A; background: #DBEAFE; padding: 0.25rem 0.65rem; border-radius: 9999px;">🚗 Roaming: ${roamingKm} km</span>`);
    }

    flow.innerHTML = items.join(' ');
  }

  updateCalculations() {
    // 1. Duration calculation
    const durationInfo = Validation.calculateDuration(this.formData.tripStartDate, this.formData.tripEndDate);
    const durationBadge = document.getElementById('tripDurationBadge');
    const durationText = document.getElementById('tripDurationText');

    if (durationBadge && durationText) {
      if (durationInfo) {
        durationText.textContent = `Trip duration: ${durationInfo.text}`;
        durationBadge.classList.remove('hidden');
      } else {
        durationBadge.classList.add('hidden');
      }
    }

    // 2. Travellers calculation
    const adults = parseInt(this.formData.adults, 10) || 0;
    const children = parseInt(this.formData.children, 10) || 0;
    const seniorCitizens = parseInt(this.formData.seniorCitizens, 10) || 0;
    const total = adults + children + seniorCitizens;

    const totalTravellersBadge = document.getElementById('totalTravellersBadge');
    const totalTravellersText = document.getElementById('totalTravellersText');

    if (totalTravellersBadge && totalTravellersText) {
      totalTravellersText.textContent = `Total travellers: ${total} (${adults} Adults${children > 0 ? `, ${children} Children` : ''}${seniorCitizens > 0 ? `, ${seniorCitizens} Seniors` : ''})`;
      totalTravellersBadge.classList.remove('hidden');
    }
  }

  updateConditionalFields() {
    // Sightseeing conditional toggle
    const sightseeingVal = this.formData.localSightseeing;
    const sightseeingDetailsSection = document.getElementById('sightseeingDetailsSection');
    if (sightseeingDetailsSection) {
      if (sightseeingVal === 'Yes' || sightseeingVal === 'Not Sure') {
        sightseeingDetailsSection.classList.remove('hidden');
      } else {
        sightseeingDetailsSection.classList.add('hidden');
      }
    }

    // Accommodation conditional toggle
    const accommodationVal = this.formData.accommodationRequired;
    const accommodationDetailsSection = document.getElementById('accommodationDetailsSection');
    if (accommodationDetailsSection) {
      if (accommodationVal === 'Yes') {
        accommodationDetailsSection.classList.remove('hidden');
      } else {
        accommodationDetailsSection.classList.add('hidden');
      }
    }
  }

  handleNextStep() {
    if (this.currentStep >= this.totalSteps) return;

    // Validate current step
    const validation = Validation.validateStep(this.currentStep, this.formData);
    if (!validation.valid) {
      this.displayErrors(validation.errors);
      return;
    }

    // Track analytics
    const stepName = this.stepNames[this.currentStep - 1];
    Analytics.stepCompleted(this.currentStep, stepName);

    if (this.currentStep === 1) {
      Analytics.formStarted();
    }

    this.currentStep++;

    if (this.currentStep === 8) {
      Analytics.reviewReached();
      this.renderReviewSummary();
    }

    this.renderStep();
    this.scrollToTop();
  }

  handlePrevStep() {
    if (this.currentStep <= 1) return;
    this.currentStep--;
    this.renderStep();
    this.scrollToTop();
  }

  goToStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > this.totalSteps) return;
    this.currentStep = stepNumber;
    if (this.currentStep === 8) {
      this.renderReviewSummary();
    }
    this.renderStep();
    this.scrollToTop();
  }

  renderStep() {
    // Show active step pane, hide others
    for (let i = 1; i <= this.totalSteps; i++) {
      const pane = document.getElementById(`stepPane_${i}`);
      if (pane) {
        pane.classList.toggle('active', i === this.currentStep);
      }
    }

    // Update Progress Bar & indicators
    const progressPercent = ((this.currentStep) / this.totalSteps) * 100;
    const progressBar = document.getElementById('formProgressBar');
    if (progressBar) {
      progressBar.style.width = `${progressPercent}%`;
    }

    // Current step indicator text
    const stepIndicator = document.getElementById('currentStepIndicator');
    if (stepIndicator) {
      stepIndicator.textContent = `Step ${this.currentStep} of ${this.totalSteps}: ${this.stepNames[this.currentStep - 1]}`;
    }

    // Update step timeline markers
    document.querySelectorAll('.step-marker').forEach(marker => {
      const step = parseInt(marker.getAttribute('data-step'), 10);
      marker.classList.toggle('active', step === this.currentStep);
      marker.classList.toggle('completed', step < this.currentStep);
    });

    // Toggle navigation button visibility
    const prevBtn = document.getElementById('btnPrevStep');
    const nextBtn = document.getElementById('btnNextStep');
    const submitBtn = document.getElementById('btnSubmitEnquiry');

    if (prevBtn) {
      prevBtn.style.display = (this.currentStep === 1) ? 'none' : 'inline-flex';
    }

    if (nextBtn) {
      nextBtn.style.display = (this.currentStep === this.totalSteps) ? 'none' : 'inline-flex';
    }

    if (submitBtn) {
      submitBtn.style.display = (this.currentStep === this.totalSteps) ? 'inline-flex' : 'none';
    }

    if (this.currentStep === 1 && this.mapController && this.mapController.map) {
      setTimeout(() => this.mapController.map.invalidateSize(), 150);
    }
  }

  renderReviewSummary() {
    const summaryContainer = document.getElementById('reviewSummaryContainer');
    if (!summaryContainer) return;

    const durationInfo = Validation.calculateDuration(this.formData.tripStartDate, this.formData.tripEndDate);
    const durationString = durationInfo ? durationInfo.text : 'Dates not specified';
    const totalTravellers = (parseInt(this.formData.adults, 10) || 0) + (parseInt(this.formData.children, 10) || 0) + (parseInt(this.formData.seniorCitizens, 10) || 0);

    const formatDateDisplay = (dateStr) => {
      if (!dateStr) return 'Not set';
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const validStops = (this.formData.stops || []).map(s => (s || '').trim()).filter(Boolean);
    const stopsListDisplay = validStops.length > 0 ? validStops.join(' ➔ ') : '';

    const roadKm = parseInt(this.formData.roadDistanceKm, 10) || 0;
    const roamingKm = parseInt(this.formData.roamingKilometers, 10) || 0;
    const totalKm = roadKm + roamingKm;
    const driveTime = this.formData.estimatedDrivingTime || '';

    summaryContainer.innerHTML = `
      <div class="review-grid">
        <!-- 1. Trip Card -->
        <div class="review-card">
          <div class="review-card-header">
            <div class="review-title">
              <span class="icon">📍</span>
              <strong>TRIP DETAILS & ROUTE</strong>
            </div>
            <button type="button" class="btn-edit-step" data-step="1">Edit</button>
          </div>
          <div class="review-body">
            <div class="review-route" style="flex-wrap: wrap; gap: 0.4rem;">
              <span class="location-badge from">${this.escapeHtml(this.formData.startingLocation || 'Not set')}</span>
              ${validStops.length > 0 ? `
                <span class="arrow">➔</span>
                ${validStops.map(s => `<span class="location-badge" style="background: #EFF6FF; border-color: #BFDBFE; color: #1E40AF;">🛑 ${this.escapeHtml(s)}</span><span class="arrow">➔</span>`).join('')}
              ` : `<span class="arrow">➔</span>`}
              <span class="location-badge to">${this.escapeHtml(this.formData.mainDestination || 'Not set')}</span>
            </div>
            ${validStops.length > 0 ? `<p class="review-sub"><strong>Intermediate Stops (${validStops.length}):</strong> ${this.escapeHtml(stopsListDisplay)}</p>` : ''}
            
            ${(roadKm > 0 || roamingKm > 0) ? `
              <div style="margin-top: 0.75rem; padding: 0.75rem 0.9rem; background: #F8FAFC; border-radius: 8px; border: 1.5px solid #CBD5E1; font-size: 0.86rem; line-height: 1.55;">
                <div style="font-weight: 800; color: #1E293B; margin-bottom: 0.35rem; display: flex; align-items: center; justify-content: space-between;">
                  <span>📊 DETAILED KILOMETER BREAKDOWN</span>
                  <span style="font-size: 0.72rem; background: #E2E8F0; color: #475569; padding: 0.1rem 0.45rem; border-radius: 4px;">Syncs to Google Sheets</span>
                </div>
                ${roadKm > 0 ? `<div>🛣️ <strong>Road Distance (OSRM):</strong> ${roadKm} km ${driveTime ? `<span style="color: #64748B;">(${this.escapeHtml(driveTime)})</span>` : ''}</div>` : ''}
                <div>🚗 <strong>Local Roaming / Sightseeing Allowance:</strong> ${roamingKm} km</div>
                ${totalKm > 0 ? `<div style="margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px dashed #CBD5E1; font-size: 0.95rem; color: #0F172A;">✨ <strong>Total Estimated Distance:</strong> <strong style="color: #FF6B35; font-size: 1.05rem;">${totalKm} km</strong></div>` : ''}
              </div>
            ` : ''}

            ${this.formData.additionalDestinations ? `<p class="review-sub" style="margin-top: 0.5rem;"><strong>Route Notes:</strong> ${this.escapeHtml(this.formData.additionalDestinations)}</p>` : ''}
            <p class="review-sub"><strong>Trip Type:</strong> ${this.escapeHtml(this.formData.tripType || 'Standard')}</p>
          </div>
        </div>

        <!-- 2. Dates Card -->
        <div class="review-card">
          <div class="review-card-header">
            <div class="review-title">
              <span class="icon">📅</span>
              <strong>DATES & DURATION</strong>
            </div>
            <button type="button" class="btn-edit-step" data-step="2">Edit</button>
          </div>
          <div class="review-body">
            <p class="review-main-text">
              ${formatDateDisplay(this.formData.tripStartDate)} ➔ ${formatDateDisplay(this.formData.tripEndDate)}
            </p>
            <p class="review-sub"><strong>Duration:</strong> ${this.escapeHtml(durationString)}</p>
            <p class="review-sub"><strong>Flexible Dates:</strong> ${this.escapeHtml(this.formData.flexibleDates)}</p>
          </div>
        </div>

        <!-- 3. Travellers Card -->
        <div class="review-card">
          <div class="review-card-header">
            <div class="review-title">
              <span class="icon">👥</span>
              <strong>TRAVELLERS</strong>
            </div>
            <button type="button" class="btn-edit-step" data-step="3">Edit</button>
          </div>
          <div class="review-body">
            <p class="review-main-text"><strong>Total: ${totalTravellers} traveller${totalTravellers > 1 ? 's' : ''}</strong></p>
            <p class="review-sub">${this.formData.adults} Adults · ${this.formData.children} Children · ${this.formData.seniorCitizens} Senior Citizens</p>
          </div>
        </div>

        <!-- 4. Vehicle Card -->
        <div class="review-card">
          <div class="review-card-header">
            <div class="review-title">
              <span class="icon">🚗</span>
              <strong>VEHICLE PREFERENCE</strong>
            </div>
            <button type="button" class="btn-edit-step" data-step="4">Edit</button>
          </div>
          <div class="review-body">
            <p class="review-main-text highlight">${this.escapeHtml(this.formData.vehiclePreference || 'Not selected')}</p>
            <p class="review-sub">Our team will source dedicated options based on this ride preference.</p>
          </div>
        </div>

        <!-- 5. Sightseeing Card -->
        <div class="review-card">
          <div class="review-card-header">
            <div class="review-title">
              <span class="icon">🧭</span>
              <strong>LOCAL SIGHTSEEING</strong>
            </div>
            <button type="button" class="btn-edit-step" data-step="5">Edit</button>
          </div>
          <div class="review-body">
            <p class="review-main-text">Required: ${this.escapeHtml(this.formData.localSightseeing)}</p>
            ${(this.formData.localSightseeing === 'Yes' || this.formData.localSightseeing === 'Not Sure') ? `
              <p class="review-sub"><strong>Preference:</strong> ${this.escapeHtml(this.formData.sightseeingPreference || 'Flexible')}</p>
              ${this.formData.sightseeingPlaces ? `<p class="review-sub"><strong>Places:</strong> ${this.escapeHtml(this.formData.sightseeingPlaces)}</p>` : ''}
            ` : ''}
          </div>
        </div>

        <!-- 6. Stay Card -->
        <div class="review-card">
          <div class="review-card-header">
            <div class="review-title">
              <span class="icon">🏨</span>
              <strong>ACCOMMODATION</strong>
            </div>
            <button type="button" class="btn-edit-step" data-step="6">Edit</button>
          </div>
          <div class="review-body">
            <p class="review-main-text">${this.escapeHtml(this.formData.accommodationRequired)}</p>
            ${this.formData.accommodationRequired === 'Yes' ? `
              <p class="review-sub"><strong>Category:</strong> ${this.escapeHtml(this.formData.hotelCategory || 'Not specified')}</p>
              <p class="review-sub"><strong>Rooms:</strong> ${this.formData.numberOfRooms || '1'}</p>
              ${this.formData.hotelBudget ? `<p class="review-sub"><strong>Budget:</strong> ${this.escapeHtml(this.formData.hotelBudget)}</p>` : ''}
            ` : ''}
          </div>
        </div>

        <!-- 7. Contact Card -->
        <div class="review-card full-width">
          <div class="review-card-header">
            <div class="review-title">
              <span class="icon">📱</span>
              <strong>CONTACT INFORMATION</strong>
            </div>
            <button type="button" class="btn-edit-step" data-step="7">Edit</button>
          </div>
          <div class="review-body contact-details">
            <div><strong>Full Name:</strong> ${this.escapeHtml(this.formData.fullName)}</div>
            <div><strong>Mobile Number:</strong> ${this.escapeHtml(this.formData.mobileNumber)}</div>
            <div><strong>WhatsApp Number:</strong> ${this.escapeHtml(this.formData.whatsappNumber || this.formData.mobileNumber)}</div>
            <div><strong>Email:</strong> ${this.escapeHtml(this.formData.email || 'None provided')}</div>
            <div><strong>Preferred Contact:</strong> ${this.escapeHtml(this.formData.preferredContactMethod)}</div>
            ${this.formData.specialRequirements ? `<div class="full"><strong>Special Notes:</strong> ${this.escapeHtml(this.formData.specialRequirements)}</div>` : ''}
          </div>
        </div>
      </div>
    `;

    // Attach click listeners to edit buttons
    summaryContainer.querySelectorAll('.btn-edit-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const step = parseInt(btn.getAttribute('data-step'), 10);
        this.goToStep(step);
      });
    });
  }

  async handleSubmit() {
    if (this.isSubmitting) return;

    // Validate Step 7 & Consent
    const validation = Validation.validateStep(7, this.formData);
    if (!validation.valid) {
      this.goToStep(7);
      this.displayErrors(validation.errors);
      return;
    }

    const submitBtn = document.getElementById('btnSubmitEnquiry');
    const submitErrorBanner = document.getElementById('submitErrorBanner');
    const submitErrorMessage = document.getElementById('submitErrorMessage');

    if (submitErrorBanner) submitErrorBanner.classList.add('hidden');

    // UI loading state
    this.isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="spinner"></span>
        <span>Sending your enquiry...</span>
      `;
    }

    try {
      const roadKm = parseInt(this.formData.roadDistanceKm, 10) || 0;
      const roamingKm = parseInt(this.formData.roamingKilometers, 10) || 0;
      const totalKm = roadKm + roamingKm;
      const driveTime = this.formData.estimatedDrivingTime || '';

      const validStops = (this.formData.stops || []).map(s => (s || '').trim()).filter(Boolean);

      // 1. Detailed Additional Destinations with exact KM calculations
      let formattedAdditional = '';
      if (validStops.length > 0) {
        formattedAdditional = 'Stops: ' + validStops.join(' ➔ ');
      }
      let kmBreakdownParts = [];
      if (roadKm > 0) {
        kmBreakdownParts.push(`Road: ${roadKm} km${driveTime ? ` (${driveTime})` : ''}`);
      }
      if (roamingKm > 0) {
        kmBreakdownParts.push(`Roaming: ${roamingKm} km`);
      }
      if (totalKm > 0) {
        kmBreakdownParts.push(`Total: ${totalKm} km`);
      }
      if (kmBreakdownParts.length > 0) {
        formattedAdditional += (formattedAdditional ? ' | ' : '') + kmBreakdownParts.join(' + ') + (roadKm > 0 && roamingKm > 0 ? ` = ${totalKm} km Total` : '');
      }
      if (this.formData.additionalDestinations && this.formData.additionalDestinations.trim()) {
        formattedAdditional += (formattedAdditional ? ' | Notes: ' : '') + this.formData.additionalDestinations.trim();
      }

      // 2. Detailed Sightseeing Places with Roaming KM
      let formattedSightseeing = String(this.formData.sightseeingPlaces || '').trim();
      if (roamingKm > 0 && formattedSightseeing.indexOf('Roaming') === -1) {
        formattedSightseeing = (formattedSightseeing ? formattedSightseeing + ' | ' : '') + `Local Roaming Allowance: ${roamingKm} km`;
      }

      // 3. Detailed Special Requirements / Notes Breakdown
      let kmDetailNote = `[KM Breakdown] Road: ${roadKm > 0 ? `${roadKm} km` : 'TBD'}${driveTime ? ` (${driveTime})` : ''} | Roaming/Sightseeing: ${roamingKm} km | Total Est. Distance: ${totalKm > 0 ? `${totalKm} km` : `${roamingKm} km`}`;
      let detailedSpecialReq = (this.formData.specialRequirements && this.formData.specialRequirements.trim())
        ? `${kmDetailNote} | Notes: ${this.formData.specialRequirements.trim()}`
        : kmDetailNote;

      const response = await submitEnquiryToGoogleSheets({
        ...this.formData,
        stops: validStops,
        roadDistanceKm: roadKm,
        estimatedDrivingTime: driveTime,
        roamingKilometers: roamingKm,
        totalEstimatedKm: totalKm,
        additionalDestinations: formattedAdditional,
        sightseeingPlaces: formattedSightseeing,
        specialRequirements: detailedSpecialReq,
        clientSubmissionId: this.clientSubmissionId
      });

      if (response && response.success && response.enquiryId) {
        Analytics.enquirySubmitted(response.enquiryId);
        this.showSuccessPage(response.enquiryId);
      } else {
        const errMsg = response.error || "We couldn't send your enquiry right now. Your information has not been confirmed as submitted. Please try again.";
        Analytics.enquiryFailed(errMsg);
        this.showSubmissionError(errMsg);
      }
    } catch (err) {
      const errMsg = "We couldn't send your enquiry right now. Your information has not been confirmed as submitted. Please try again.";
      Analytics.enquiryFailed(errMsg);
      this.showSubmissionError(errMsg);
    } finally {
      this.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <span>Send Enquiry</span>
          <span class="icon">➔</span>
        `;
      }
    }
  }

  showSubmissionError(message) {
    const banner = document.getElementById('submitErrorBanner');
    const msgElem = document.getElementById('submitErrorMessage');
    if (banner && msgElem) {
      msgElem.textContent = message;
      banner.classList.remove('hidden');
      banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  showSuccessPage(enquiryId) {
    const formSection = document.getElementById('formSection');
    const successSection = document.getElementById('successSection');
    const refCodeElem = document.getElementById('enquiryReferenceCode');
    const whatsappBtn = document.getElementById('btnWhatsAppSuccess');

    if (refCodeElem) {
      refCodeElem.textContent = enquiryId;
    }

    if (whatsappBtn) {
      const phoneClean = CONFIG.TOORSY_WHATSAPP.replace(/[^\d]/g, '');
      const text = encodeURIComponent(`Hi TOORSY, I have submitted an enquiry on your website. My enquiry reference is: ${enquiryId}. Looking forward to discussing travel options.`);
      whatsappBtn.href = `https://wa.me/${phoneClean}?text=${text}`;
    }

    if (formSection) formSection.classList.add('hidden');
    if (successSection) {
      successSection.classList.remove('hidden');
      successSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  resetForm() {
    this.currentStep = 1;
    this.clientSubmissionId = generateClientSubmissionId();
    this.formData = {
      fullName: '',
      startingLocation: '',
      mainDestination: '',
      stops: [],
      roadDistanceKm: 0,
      estimatedDrivingTime: '',
      roamingKilometers: '100',
      totalEstimatedKm: 100,
      additionalDestinations: '',
      tripType: '',
      tripStartDate: '',
      tripEndDate: '',
      flexibleDates: 'No',
      adults: 2,
      children: 0,
      seniorCitizens: 0,
      vehiclePreference: '',
      localSightseeing: 'Yes',
      sightseeingPlaces: '',
      sightseeingPreference: 'Driver suggests places',
      accommodationRequired: 'No',
      numberOfRooms: 1,
      hotelCategory: '3 Star',
      hotelBudget: '',
      mobileNumber: '',
      whatsappNumber: '',
      email: '',
      preferredContactMethod: 'WhatsApp',
      specialRequirements: '',
      consentToContact: false,
      utmSource: this.formData.utmSource,
      utmMedium: this.formData.utmMedium,
      utmCampaign: this.formData.utmCampaign,
      landingPage: this.formData.landingPage
    };

    // Reset DOM form
    const formElem = document.getElementById('toorsyTripForm');
    if (formElem) formElem.reset();

    // Reset stops and route preview
    this.renderStops();
    this.updateRouteJourneyPreview();
    this.updateRoamingChips('100');

    // Reset map waypoints
    if (this.mapController) {
      this.mapController.waypoints = { start: null, stops: [], destination: null };
      this.mapController.updateMapAndRoute();
    }

    // Reset displays
    ['adults', 'children', 'seniorCitizens'].forEach(f => {
      const disp = document.getElementById(`display_${f}`);
      if (disp) disp.textContent = (f === 'adults') ? 2 : 0;
    });

    document.querySelectorAll('.vehicle-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.trip-type-btn').forEach(b => b.classList.remove('active'));

    const formSection = document.getElementById('formSection');
    const successSection = document.getElementById('successSection');
    const submitErrorBanner = document.getElementById('submitErrorBanner');

    if (submitErrorBanner) submitErrorBanner.classList.add('hidden');
    if (successSection) successSection.classList.add('hidden');
    if (formSection) formSection.classList.remove('hidden');

    this.updateCalculations();
    this.updateConditionalFields();
    this.renderStep();
    this.scrollToTop();
  }

  displayErrors(errors) {
    // Clear existing
    document.querySelectorAll('.form-error-msg').forEach(el => {
      el.textContent = '';
      el.classList.add('hidden');
    });
    document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));

    let firstErrorElem = null;

    Object.entries(errors).forEach(([field, msg]) => {
      const errElem = document.getElementById(`error_${field}`);
      const inputElem = document.getElementById(field) || document.querySelector(`[name="${field}"]`);

      if (errElem) {
        errElem.textContent = msg;
        errElem.classList.remove('hidden');
      }

      if (inputElem) {
        inputElem.classList.add('has-error');
        if (!firstErrorElem) firstErrorElem = inputElem;
      }
    });

    if (firstErrorElem) {
      firstErrorElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof firstErrorElem.focus === 'function') {
        firstErrorElem.focus();
      }
    }
  }

  clearFieldError(field) {
    const errElem = document.getElementById(`error_${field}`);
    if (errElem) {
      errElem.textContent = '';
      errElem.classList.add('hidden');
    }
    const inputElem = document.getElementById(field) || document.querySelector(`[name="${field}"]`);
    if (inputElem) {
      inputElem.classList.remove('has-error');
    }
  }

  scrollToTop() {
    const target = document.getElementById('formContainer') || document.getElementById('planTripSection');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
