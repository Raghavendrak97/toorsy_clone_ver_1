# TOORSY — Travel Enquiry & Trip Planning Service

**Tagline:** Plan your trip. Get the right ride.  
**Hero headline:** Your trip. Your way.  
**Primary CTA:** Plan My Trip  

TOORSY is an enquiry-based trip-planning service connecting travellers with vetted vehicle operators across India. This repository contains the complete static website ready for **GitHub Pages** deployment and the backend **Google Apps Script** that logs all customer enquiries directly into Google Sheets.

---

## 📁 Repository Structure

```
/
├── index.html                 # Complete website & multi-step enquiry application
├── robots.txt                 # SEO crawler rules
├── sitemap.xml                # SEO sitemap
├── README.md                  # Complete documentation & deployment guide
├── Code.gs                    # Backend code for Google Apps Script
│
├── css/
│   └── styles.css             # Travel-tech responsive styling (mobile-first)
│
├── js/
│   ├── app.js                 # App initialization, navigation, UTM tracking
│   ├── form.js                # Multi-step form controller & review generator
│   ├── mapRoute.js            # Leaflet map component & controller facade
│   ├── map/
│   │   ├── mapConfig.js       # Pluggable OSM tiles, providers, rate limits & hub seeds
│   │   ├── geocodingService.js# Compliant place search (debounced, abortable, cached)
│   │   └── routingService.js  # OSRM road routing engine (hashed, cached, abortable)
│   ├── googleSheets.js        # Google Apps Script Web App API integration & config
│   ├── validation.js          # Field validation & Indian mobile number rules
│   └── analytics.js           # Funnel & event analytics abstraction
│
└── google-apps-script/
    └── Code.gs                # Backup copy of Google Apps Script backend
```

---

## ⚡ 1. Files Belonging to the GitHub Pages Website

The website is a lightweight, mobile-first static web app that requires **zero build step** when published to GitHub Pages:

* `index.html`
* `robots.txt`
* `sitemap.xml`
* `css/styles.css`
* `js/app.js`
* `js/form.js`
* `js/mapRoute.js`
* `js/map/mapConfig.js`
* `js/map/geocodingService.js`
* `js/map/routingService.js`
* `js/googleSheets.js`
* `js/validation.js`
* `js/analytics.js`

To deploy to GitHub Pages:
1. Push this repository to GitHub.
2. In your GitHub repository, navigate to **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select **Deploy from a branch**.
4. Select the `main` branch and `/ (root)` folder.
5. Click **Save**. Your website is live!

---

## 🛠️ 2. Google Apps Script Backend Deployment (Code.gs)

Google Sheet target:
`https://docs.google.com/spreadsheets/d/1m2z_WiD_bztcj0lTSBD3MZeJKAXikfW1WLGAIRjduj4/edit?usp=sharing`

Spreadsheet ID:
`1m2z_WiD_bztcj0lTSBD3MZeJKAXikfW1WLGAIRjduj4`

### Step 1
Open the Google Sheet:
[Open TOORSY Google Sheet](https://docs.google.com/spreadsheets/d/1m2z_WiD_bztcj0lTSBD3MZeJKAXikfW1WLGAIRjduj4/edit?usp=sharing)

### Step 2
In the top menu, go to:
**Extensions** → **Apps Script**

### Step 3
Delete any sample code in the script editor and paste the full contents of `Code.gs` (or `google-apps-script/Code.gs`).

### Step 4
Click the disk icon to **Save** the project (e.g., name it `TOORSY Backend`).

### Step 5
In the top right, click:
**Deploy** → **New deployment**

### Step 6
Click the gear icon next to "Select type" and select:
**Web app**

### Step 7
Set **Execute as**:
`Me (your Google account email)`

### Step 8
Set **Who has access**:
`Anyone` *(Crucial: allows web submissions from GitHub Pages without requiring users to log into Google)*

### Step 9
Click **Deploy**. Grant the necessary Google Sheet read/write permissions when prompted.

### Step 10
Copy the generated **Web App URL** (format: `https://script.google.com/macros/s/AKfycb.../exec`).

---

## 🔗 3. Where to Paste the Apps Script Web App URL

Open `js/googleSheets.js` and paste your URL into `GOOGLE_SCRIPT_URL`:

```javascript
export const CONFIG = {
  // Configured Google Apps Script Web App URL:
  GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyIpuPL1IJEEDDBG00jHcp7K7mmYky49Tyg0DPyGvl19R2_tKj882SrUd8z5QbBk8Id/exec",

  // Update with your actual contact numbers:
  TOORSY_PHONE: "+91 98765 43210",
  TOORSY_WHATSAPP: "+919876543210",

  SPREADSHEET_ID: "1m2z_WiD_bztcj0lTSBD3MZeJKAXikfW1WLGAIRjduj4"
};
```

*(Note: During live preview or testing, you can also paste the URL directly into the website's built-in **⚙️ Google Apps Script Settings** modal without editing code).*

---

## 📊 4. Google Sheets Column Mapping (32 Columns)

When the first enquiry is submitted, `Code.gs` automatically creates the headers in **Row 1**:

1. **Timestamp** — Server timestamp (IST UTC+5:30)
2. **Enquiry ID** — Auto-generated server ID (e.g. `TYS-20261004-0001`)
3. **Lead Status** — Auto-assigned as `NEW`
4. **Full Name**
5. **Mobile Number**
6. **WhatsApp Number**
7. **Email**
8. **Starting Location**
9. **Main Destination**
10. **Additional Destinations** *(Includes intermediate stops, OSRM road distance, estimated driving time, local roaming kilometers, and total estimated trip distance)*
11. **Trip Type**
12. **Trip Start Date**
13. **Trip End Date**
14. **Flexible Dates**
15. **Adults**
16. **Children**
17. **Senior Citizens**
18. **Vehicle Preference**
19. **Local Sightseeing** *(Yes / No / Not Sure)*
20. **Sightseeing Places** *(Includes specific spots + Local Roaming Allowance in km)*
21. **Sightseeing Preference**
22. **Accommodation Required**
23. **Number of Rooms**
24. **Hotel Category**
25. **Hotel Budget**
26. **Special Requirements** *(Contains full granular `[KM Breakdown] Road + Roaming = Total Distance` plus user notes)*
27. **Preferred Contact Method**
28. **Consent To Contact**
29. **UTM Source**
30. **UTM Medium**
31. **UTM Campaign**
32. **Landing Page**

Subsequent submissions append a **NEW ROW** and never overwrite existing entries.

---

## 🧪 5. Testing & Verification Guide

### Test 1 — First Submission
1. Open the website.
2. Click **Plan My Trip**.
3. Fill all steps with sample data (e.g., Bengaluru to Goa, SUV, 4 adults).
4. Review summary on Step 8 and click **Send Enquiry**.
5. Observe the button state switch to `Sending your enquiry...`.
6. Confirm the backend response delivers the **Success Screen** with enquiry ID (e.g. `TYS-20261004-0001`).
7. Open the Google Sheet:
   * **Row 1**: All 32 headers automatically created with bold formatting and frozen row.
   * **Row 2**: Contains your test enquiry with `Lead Status` = `NEW`.

### Test 2 — Duplicate & Second Row Protection
1. Click **Plan Another Trip**.
2. Submit another enquiry with different dates/locations.
3. Open the Google Sheet:
   * **Row 3**: Appended with a new unique Enquiry ID (e.g. `TYS-20261004-0002`).
   * Row 2 is **completely preserved** and not overwritten.

### Test 3 — Failure & Resilience Test
1. In `js/googleSheets.js` or the Settings modal, change the URL to an invalid endpoint.
2. Click **Send Enquiry**.
3. Confirm that the site **DOES NOT** show fake success.
4. Instead, an error alert is shown:  
   *"We couldn't send your enquiry right now. Your information has not been confirmed as submitted. Please try again."*
5. Verify all entered data is retained in the form so the user can easily retry once connectivity is restored.

---

## 🔒 6. Security & Privacy Rules

* **Zero Frontend Secrets**: No Google service accounts, API keys, or passwords are exposed.
* **No Modifying Existing Rows**: The client API only invokes the append logic; users cannot query, modify, or delete existing rows.
* **Internal Data Remains Private**: Customers never see internal lead management statuses (e.g. `DRIVER SEARCH`, `QUOTE RECEIVED`, `LOST`).
* **Cross-Origin (CORS) Safe**: Uses standard CORS-compliant simple POST with JSON payload handled via Google Apps Script echo redirect without failing browser preflights.
