/**
 * TOORSY — Analytics & Funnel Tracking Abstraction
 * Handles lightweight event tracking. Works standalone without GA4,
 * and will automatically push to window.dataLayer or gtag if installed later.
 */

export const Analytics = {
  /**
   * Track custom event with optional payload
   * @param {string} eventName
   * @param {Record<string, any>} [params]
   */
  track(eventName, params = {}) {
    const timestamp = new Date().toISOString();
    const eventData = {
      event: eventName,
      timestamp,
      ...params
    };

    // Console logging in development/preview
    console.log(`[TOORSY Analytics] ${eventName}:`, eventData);

    // Push to Google Tag Manager / GA4 dataLayer if present
    if (typeof window !== 'undefined' && Array.isArray((window).dataLayer)) {
      (window).dataLayer.push(eventData);
    }

    // Call gtag if available
    if (typeof window !== 'undefined' && typeof (window).gtag === 'function') {
      (window).gtag('event', eventName, params);
    }
  },

  // Pre-defined funnel events
  landingPageViewed(landingUrl) {
    this.track('landing_page_viewed', { landing_page: landingUrl });
  },

  planMyTripClicked(sourceLocation = 'hero') {
    this.track('plan_my_trip_clicked', { source: sourceLocation });
  },

  formStarted() {
    this.track('form_started');
  },

  stepCompleted(stepNumber, stepName) {
    this.track(`${stepName.toLowerCase()}_step_completed`, {
      step: stepNumber,
      step_name: stepName
    });
  },

  reviewReached() {
    this.track('review_reached');
  },

  enquirySubmitted(enquiryId) {
    this.track('enquiry_submitted', { enquiry_id: enquiryId });
  },

  enquiryFailed(errorMessage) {
    this.track('enquiry_failed', { error: errorMessage });
  },

  whatsAppClicked(context = 'general') {
    this.track('whatsapp_clicked', { context });
  },

  phoneClicked(context = 'general') {
    this.track('phone_clicked', { context });
  }
};
