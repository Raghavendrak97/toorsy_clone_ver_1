/**
 * TOORSY — Google Apps Script Backend Communication & Configuration
 * 
 * Configured Endpoint:
 * https://script.google.com/macros/s/AKfycbyIpuPL1IJEEDDBG00jHcp7K7mmYky49Tyg0DPyGvl19R2_tKj882SrUd8z5QbBk8Id/exec
 */

export const CONFIG = {
  // Configured Google Apps Script Web App URL:
  GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyIpuPL1IJEEDDBG00jHcp7K7mmYky49Tyg0DPyGvl19R2_tKj882SrUd8z5QbBk8Id/exec",

  // Contact placeholders
  TOORSY_PHONE: "+91 00000 00000",
  TOORSY_WHATSAPP: "+910000000000",

  SPREADSHEET_ID: "1m2z_WiD_bztcj0lTSBD3MZeJKAXikfW1WLGAIRjduj4"
};

/**
 * Returns active script URL (allows overriding via localStorage for easy testing/dev)
 */
export function getActiveScriptUrl() {
  if (typeof window !== 'undefined') {
    const savedUrl = localStorage.getItem('toorsy_active_script_url');
    if (savedUrl && savedUrl.trim() !== '') {
      return savedUrl.trim();
    }
  }
  return CONFIG.GOOGLE_SCRIPT_URL;
}

/**
 * Saves a new script URL to localStorage (used by the settings modal/tester)
 */
export function setActiveScriptUrl(url) {
  if (typeof window !== 'undefined') {
    if (url && url.trim()) {
      localStorage.setItem('toorsy_active_script_url', url.trim());
    } else {
      localStorage.removeItem('toorsy_active_script_url');
    }
  }
}

// Session cache to prevent accidental double-submissions
const submittedClientIds = new Set();

/**
 * Generate a client submission ID for deduplication
 */
export function generateClientSubmissionId() {
  return 'CSUB-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

/**
 * Submits enquiry payload to Google Apps Script.
 * Uses a resilient multi-tier cross-origin strategy:
 * Tier 1: Standard simple CORS POST via fetch (Content-Type: text/plain)
 * Tier 2: JSONP fallback via dynamic script tag (bypasses browser CORS & iframe redirect policies)
 * 
 * @param {Record<string, any>} payload 
 * @returns {Promise<{ success: boolean, enquiryId?: string, error?: string }>}
 */
export async function submitEnquiryToGoogleSheets(payload) {
  const scriptUrl = getActiveScriptUrl();

  // Validate script URL is configured
  if (!scriptUrl || scriptUrl.includes("PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE")) {
    return {
      success: false,
      error: "Google Apps Script Web App URL has not been configured yet. Please configure your Web App URL in settings to connect to Google Sheets."
    };
  }

  // Client duplicate submission prevention
  const clientId = payload.clientSubmissionId || generateClientSubmissionId();
  if (submittedClientIds.has(clientId)) {
    return {
      success: false,
      error: "This enquiry has already been submitted. Please plan a new trip or refresh the page."
    };
  }

  // Try Strategy 1: Standard POST with text/plain
  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      if (result && result.success && result.enquiryId) {
        submittedClientIds.add(clientId);
        return {
          success: true,
          enquiryId: result.enquiryId
        };
      } else if (result && result.error) {
        return { success: false, error: result.error };
      }
    } else if (response.status === 403 || response.status === 401) {
      return getPermissionErrorHelp();
    }
  } catch (postErr) {
    console.warn("[TOORSY] Strategy 1 (POST fetch) encountered an issue, trying Strategy 2 (JSONP)...", postErr);
  }

  // Try Strategy 2: JSONP GET (bypasses browser CORS redirect limitations)
  try {
    const jsonpResult = await submitViaJsonp(scriptUrl, payload);
    if (jsonpResult && jsonpResult.success && jsonpResult.enquiryId) {
      submittedClientIds.add(clientId);
      return {
        success: true,
        enquiryId: jsonpResult.enquiryId
      };
    } else if (jsonpResult && jsonpResult.error) {
      return { success: false, error: jsonpResult.error };
    }
  } catch (jsonpErr) {
    console.error("[TOORSY Submission Error - JSONP]", jsonpErr);
  }

  // If both strategies failed, it is almost certainly a Google Apps Script deployment permission error (403 Forbidden)
  return getPermissionErrorHelp();
}

/**
 * Executes submission using JSONP dynamic script tag
 */
function submitViaJsonp(url, payload) {
  return new Promise((resolve, reject) => {
    const callbackName = 'toorsy_jsonp_' + Math.random().toString(36).substring(2, 9);
    const timeoutDuration = 15000;
    let timer = null;

    // Build URL with callback and stringified payload
    const serializedData = encodeURIComponent(JSON.stringify(payload));
    const separator = url.includes('?') ? '&' : '?';
    const requestUrl = `${url}${separator}callback=${callbackName}&data=${serializedData}`;

    const script = document.createElement('script');
    script.src = requestUrl;
    script.async = true;

    // Cleanup function
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      delete window[callbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    // Callback handler
    window[callbackName] = (response) => {
      cleanup();
      resolve(response);
    };

    // Error handler
    script.onerror = () => {
      cleanup();
      reject(new Error("JSONP script load error (likely 403 permission error or invalid URL)"));
    };

    // Timeout handler
    timer = setTimeout(() => {
      cleanup();
      reject(new Error("Submission timed out waiting for Google Apps Script response."));
    }, timeoutDuration);

    document.head.appendChild(script);
  });
}

/**
 * Returns clear diagnostic help when Google Apps Script permissions block the request
 */
function getPermissionErrorHelp() {
  return {
    success: false,
    error: "Google Apps Script Permission Error (403 / Access Denied). In your Apps Script editor, click Deploy > Manage deployments > Edit (pencil icon) > set 'Who has access' to 'Anyone' (not 'Only myself') > Deploy. Then try again."
  };
}
