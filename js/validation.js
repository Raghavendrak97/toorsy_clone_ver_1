/**
 * TOORSY — Form Field Validation Module
 * Enforces business rules and Indian mobile formatting.
 */

export const Validation = {
  /**
   * Cleans Indian mobile string: removes spaces, dashes, +91, 0 prefix
   */
  sanitizeMobile(input) {
    if (!input) return '';
    let cleaned = String(input).trim().replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('+91')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = cleaned.substring(1);
    }
    return cleaned;
  },

  /**
   * Validates standard 10-digit Indian mobile number (starts with 6, 7, 8, 9)
   */
  isValidIndianMobile(mobile) {
    const cleaned = this.sanitizeMobile(mobile);
    return /^[6-9]\d{9}$/.test(cleaned);
  },

  /**
   * Validates email format if entered
   */
  isValidEmail(email) {
    if (!email || email.trim() === '') return true; // Optional
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  },

  /**
   * Validates date strings and chronological order
   */
  validateDates(startDateStr, endDateStr) {
    if (!startDateStr) {
      return { valid: false, field: 'tripStartDate', message: 'Please select a trip start date.' };
    }
    if (!endDateStr) {
      return { valid: false, field: 'tripEndDate', message: 'Please select a trip end date.' };
    }

    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');

    if (isNaN(start.getTime())) {
      return { valid: false, field: 'tripStartDate', message: 'Invalid start date format.' };
    }
    if (isNaN(end.getTime())) {
      return { valid: false, field: 'tripEndDate', message: 'Invalid end date format.' };
    }

    if (start > end) {
      return {
        valid: false,
        field: 'tripEndDate',
        message: 'Trip end date cannot be earlier than start date.'
      };
    }

    return { valid: true };
  },

  /**
   * Calculate duration in days & nights
   */
  calculateDuration(startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) return null;
    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const days = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const nights = Math.max(0, days - 1);

    if (days === 1) {
      return { days: 1, nights: 0, text: '1 day (Same day trip)' };
    }
    return {
      days,
      nights,
      text: `${days} days / ${nights} night${nights > 1 ? 's' : ''}`
    };
  },

  /**
   * Validate a specific step's data
   * @param {number} stepNumber 1 to 7
   * @param {Record<string, any>} data
   * @returns {{ valid: boolean, errors: Record<string, string> }}
   */
  validateStep(stepNumber, data) {
    const errors = {};

    switch (stepNumber) {
      case 1: // Trip
        if (!data.fullName || String(data.fullName).trim() === '') {
          errors.fullName = 'Please enter your full name.';
        }
        if (!data.startingLocation || String(data.startingLocation).trim() === '') {
          errors.startingLocation = 'Please enter starting location (e.g., Bengaluru).';
        }
        if (!data.mainDestination || String(data.mainDestination).trim() === '') {
          errors.mainDestination = 'Please enter main destination (e.g., Goa).';
        }
        if (!data.tripType) {
          errors.tripType = 'Please select a trip type.';
        }
        break;

      case 2: // Dates
        const dateCheck = this.validateDates(data.tripStartDate, data.tripEndDate);
        if (!dateCheck.valid) {
          errors[dateCheck.field] = dateCheck.message;
        }
        if (!data.flexibleDates) {
          errors.flexibleDates = 'Please select whether your dates are flexible.';
        }
        break;

      case 3: // Travellers
        const adults = Number(data.adults);
        if (isNaN(adults) || adults < 1) {
          errors.adults = 'Please select at least 1 adult traveller.';
        }
        if (data.children !== undefined && data.children !== null && Number(data.children) < 0) {
          errors.children = 'Children cannot be negative.';
        }
        if (data.seniorCitizens !== undefined && data.seniorCitizens !== null && Number(data.seniorCitizens) < 0) {
          errors.seniorCitizens = 'Senior citizens cannot be negative.';
        }
        break;

      case 4: // Vehicle
        if (!data.vehiclePreference || String(data.vehiclePreference).trim() === '') {
          errors.vehiclePreference = 'Please choose a vehicle preference.';
        }
        break;

      case 5: // Explore / Sightseeing
        if (!data.localSightseeing) {
          errors.localSightseeing = 'Please specify if you want local sightseeing.';
        }
        if ((data.localSightseeing === 'Yes' || data.localSightseeing === 'Not Sure') && !data.sightseeingPreference) {
          errors.sightseeingPreference = 'Please choose a sightseeing preference.';
        }
        break;

      case 6: // Stay / Accommodation
        if (!data.accommodationRequired) {
          errors.accommodationRequired = 'Please specify if you need accommodation.';
        }
        if (data.accommodationRequired === 'Yes') {
          if (!data.hotelCategory) {
            errors.hotelCategory = 'Please select a hotel category preference.';
          }
          if (data.numberOfRooms && Number(data.numberOfRooms) < 1) {
            errors.numberOfRooms = 'Number of rooms must be at least 1.';
          }
        }
        break;

      case 7: // Contact & Consent
        if (!data.mobileNumber || !this.isValidIndianMobile(data.mobileNumber)) {
          errors.mobileNumber = 'Please enter a valid 10-digit Indian mobile number.';
        }
        if (data.whatsappNumber && !this.isValidIndianMobile(data.whatsappNumber)) {
          errors.whatsappNumber = 'Please enter a valid 10-digit WhatsApp number.';
        }
        if (data.email && !this.isValidEmail(data.email)) {
          errors.email = 'Please enter a valid email address.';
        }
        if (!data.preferredContactMethod) {
          errors.preferredContactMethod = 'Please choose your preferred contact method.';
        }
        if (!data.consentToContact) {
          errors.consentToContact = 'You must agree to be contacted by Toorsy regarding your enquiry.';
        }
        break;

      default:
        break;
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }
};
