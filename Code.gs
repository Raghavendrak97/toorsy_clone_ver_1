/**
 * TOORSY — Google Apps Script Backend (Code.gs)
 * Spreadsheet ID: 1m2z_WiD_bztcj0lTSBD3MZeJKAXikfW1WLGAIRjduj4
 * 
 * CRITICAL DEPLOYMENT SETTINGS:
 * 1. Open Google Sheet: https://docs.google.com/spreadsheets/d/1m2z_WiD_bztcj0lTSBD3MZeJKAXikfW1WLGAIRjduj4/edit
 * 2. Extensions > Apps Script
 * 3. Replace all code with this file and Save.
 * 4. Deploy > New deployment (or Manage deployments > Edit)
 * 5. Select type: Web app
 * 6. Execute as: Me (your Google account)
 * 7. Who has access: Anyone  <-- MUST BE 'Anyone' (NOT 'Only myself')
 * 8. Deploy & Authorize permissions.
 */

var SPREADSHEET_ID = "1m2z_WiD_bztcj0lTSBD3MZeJKAXikfW1WLGAIRjduj4";

var HEADERS = [
  "Timestamp",
  "Enquiry ID",
  "Lead Status",
  "Full Name",
  "Mobile Number",
  "WhatsApp Number",
  "Email",
  "Starting Location",
  "Main Destination",
  "Additional Destinations",
  "Trip Type",
  "Trip Start Date",
  "Trip End Date",
  "Flexible Dates",
  "Adults",
  "Children",
  "Senior Citizens",
  "Vehicle Preference",
  "Local Sightseeing",
  "Sightseeing Places",
  "Sightseeing Preference",
  "Accommodation Required",
  "Number of Rooms",
  "Hotel Category",
  "Hotel Budget",
  "Special Requirements",
  "Preferred Contact Method",
  "Consent To Contact",
  "UTM Source",
  "UTM Medium",
  "UTM Campaign",
  "Landing Page"
];

function doGet(e) {
  if (e && e.parameter && (e.parameter.fullName || e.parameter.data)) {
    var data = {};
    if (e.parameter.data) {
      try {
        data = JSON.parse(e.parameter.data);
      } catch (parseErr) {
        data = e.parameter;
      }
    } else {
      data = e.parameter;
    }
    return processSubmission(data, e.parameter.callback);
  }

  var response = {
    status: "ok",
    message: "Toorsy enquiry API is running and ready.",
    timestamp: new Date().toISOString()
  };
  return jsonResponse(response, e && e.parameter ? e.parameter.callback : null);
}

function doPost(e) {
  var data = {};
  if (e && e.postData && e.postData.contents) {
    try {
      data = JSON.parse(e.postData.contents);
    } catch (jsonErr) {
      data = e.parameter || {};
    }
  } else if (e && e.parameter) {
    data = e.parameter;
  }

  var callback = (e && e.parameter) ? e.parameter.callback : null;
  return processSubmission(data, callback);
}

function processSubmission(data, callback) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    if (!data || Object.keys(data).length === 0) {
      return jsonResponse({
        success: false,
        error: "No enquiry data received."
      }, callback);
    }

    var requiredFields = [
      { key: "fullName", label: "Full Name" },
      { key: "mobileNumber", label: "Mobile Number" },
      { key: "startingLocation", label: "Starting Location" },
      { key: "mainDestination", label: "Main Destination" },
      { key: "tripType", label: "Trip Type" },
      { key: "tripStartDate", label: "Trip Start Date" },
      { key: "tripEndDate", label: "Trip End Date" },
      { key: "adults", label: "Adults" },
      { key: "vehiclePreference", label: "Vehicle Preference" },
      { key: "localSightseeing", label: "Local Sightseeing" },
      { key: "accommodationRequired", label: "Accommodation Required" },
      { key: "preferredContactMethod", label: "Preferred Contact Method" }
    ];

    for (var i = 0; i < requiredFields.length; i++) {
      var field = requiredFields[i];
      var val = data[field.key];
      if (val === undefined || val === null || String(val).trim() === "") {
        return jsonResponse({
          success: false,
          error: "Missing required field: " + field.label
        }, callback);
      }
    }

    if (data.consentToContact !== true && data.consentToContact !== "true" && data.consentToContact !== "Yes") {
      return jsonResponse({
        success: false,
        error: "Consent to contact is required."
      }, callback);
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheets()[0];

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    if (lastRow === 0 || lastCol === 0) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.getRange(1, 1, 1, HEADERS.length)
        .setFontWeight("bold")
        .setBackground("#F3F4F6")
        .setFontColor("#111827");
      sheet.setFrozenRows(1);
      lastRow = 1;
    } else {
      var firstCellVal = sheet.getRange(1, 1).getValue();
      if (!firstCellVal || String(firstCellVal).trim() === "") {
        sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
        sheet.getRange(1, 1, 1, HEADERS.length)
          .setFontWeight("bold")
          .setBackground("#F3F4F6")
          .setFontColor("#111827");
        sheet.setFrozenRows(1);
        lastRow = 1;
      }
    }

    var now = new Date();
    var timestampStr = Utilities.formatDate(now, "GMT+5:30", "yyyy-MM-dd HH:mm:ss");
    var datePrefix = Utilities.formatDate(now, "GMT+5:30", "yyyyMMdd");

    var sequenceNum = Math.max(1, lastRow);
    var sequenceStr = ("0000" + sequenceNum).slice(-4);
    var enquiryId = "TYS-" + datePrefix + "-" + sequenceStr;

    if (lastRow > 1) {
      var existingIds = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
      var idExists = true;
      var counter = sequenceNum;
      while (idExists) {
        idExists = false;
        var testId = "TYS-" + datePrefix + "-" + ("0000" + counter).slice(-4);
        for (var r = 0; r < existingIds.length; r++) {
          if (existingIds[r][0] === testId) {
            idExists = true;
            counter++;
            break;
          }
        }
        if (!idExists) {
          enquiryId = testId;
        }
      }
    }

    var leadStatus = "NEW";

    var roadKm = Number(data.roadDistanceKm) || 0;
    var roamingKm = Number(data.roamingKilometers) || 0;
    var totalKm = Number(data.totalEstimatedKm) || (roadKm + roamingKm);
    var driveTime = String(data.estimatedDrivingTime || "").trim();

    // 1. Column 10: Additional Destinations (Stops + Road Distance + Roaming + Total)
    var additionalDest = String(data.additionalDestinations || "").trim();
    if (!additionalDest) {
      if (Array.isArray(data.stops) && data.stops.length > 0) {
        var cleanStops = data.stops.filter(function(s) { return String(s).trim() !== ""; }).join(" ➔ ");
        if (cleanStops) {
          additionalDest = "Stops: " + cleanStops;
        }
      }
      var kmParts = [];
      if (roadKm > 0) kmParts.push("Road: " + roadKm + " km" + (driveTime ? " (" + driveTime + ")" : ""));
      if (roamingKm > 0) kmParts.push("Roaming: " + roamingKm + " km");
      if (kmParts.length > 0) {
        additionalDest += (additionalDest ? " | " : "") + kmParts.join(" + ") + (totalKm > 0 && roadKm > 0 && roamingKm > 0 ? " = " + totalKm + " km Total" : "");
      }
    } else {
      if (roadKm > 0 && additionalDest.indexOf("Road:") === -1) {
        additionalDest = "Road: " + roadKm + " km" + (driveTime ? " (" + driveTime + ")" : "") + " | " + additionalDest;
      }
      if (roamingKm > 0 && additionalDest.indexOf("Roaming:") === -1) {
        additionalDest += " | Roaming: " + roamingKm + " km";
      }
      if (totalKm > 0 && additionalDest.indexOf("Total:") === -1) {
        additionalDest += " | Total: " + totalKm + " km";
      }
    }

    // 2. Column 20: Sightseeing Places (Places + Local Roaming Allowance)
    var sightseeingPlaces = String(data.sightseeingPlaces || "").trim();
    if (roamingKm > 0 && sightseeingPlaces.indexOf("Roaming") === -1) {
      sightseeingPlaces = (sightseeingPlaces ? sightseeingPlaces + " | " : "") + "Local Roaming Allowance: " + roamingKm + " km";
    }

    // 3. Column 26: Special Requirements (Full Granular Kilometer Breakdown)
    var specialRequirements = String(data.specialRequirements || "").trim();
    if (specialRequirements.indexOf("[KM Breakdown]") === -1 && (roadKm > 0 || roamingKm > 0)) {
      var kmSummary = "[KM Breakdown] Road Distance: " + (roadKm > 0 ? roadKm + " km" : "TBD") + (driveTime ? " (" + driveTime + ")" : "") + " | Local Roaming/Sightseeing: " + roamingKm + " km | Total Est. Distance: " + (totalKm > 0 ? totalKm + " km" : roamingKm + " km");
      specialRequirements = specialRequirements ? kmSummary + " | " + specialRequirements : kmSummary;
    }

    var rowData = [
      timestampStr,
      enquiryId,
      leadStatus,
      String(data.fullName || "").trim(),
      String(data.mobileNumber || "").trim(),
      String(data.whatsappNumber || data.mobileNumber || "").trim(),
      String(data.email || "").trim(),
      String(data.startingLocation || "").trim(),
      String(data.mainDestination || "").trim(),
      additionalDest,
      String(data.tripType || "").trim(),
      String(data.tripStartDate || "").trim(),
      String(data.tripEndDate || "").trim(),
      String(data.flexibleDates || "No").trim(),
      Number(data.adults) || 1,
      Number(data.children) || 0,
      Number(data.seniorCitizens) || 0,
      String(data.vehiclePreference || "").trim(),
      String(data.localSightseeing || "No").trim(),
      sightseeingPlaces,
      String(data.sightseeingPreference || "").trim(),
      String(data.accommodationRequired || "No").trim(),
      data.numberOfRooms ? Number(data.numberOfRooms) : "",
      String(data.hotelCategory || "").trim(),
      String(data.hotelBudget || "").trim(),
      specialRequirements,
      String(data.preferredContactMethod || "WhatsApp").trim(),
      "Yes",
      String(data.utmSource || "").trim(),
      String(data.utmMedium || "").trim(),
      String(data.utmCampaign || "").trim(),
      String(data.landingPage || "").trim()
    ];

    sheet.appendRow(rowData);

    return jsonResponse({
      success: true,
      enquiryId: enquiryId
    }, callback);

  } catch (err) {
    return jsonResponse({
      success: false,
      error: "Error processing enquiry: " + err.toString()
    }, callback);
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(obj, callback) {
  var jsonStr = JSON.stringify(obj);
  if (callback && String(callback).trim() !== "") {
    return ContentService
      .createTextOutput(callback + "(" + jsonStr + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}
