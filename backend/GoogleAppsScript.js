/* 
  PASTE THIS INTO GOOGLE APPS SCRIPT (Extensions > Apps Script)
  THEN DEPLOY AS WEB APP -> WHO HAS ACCESS: ANYONE
*/

const SHEET_ID = ""; // Leave empty to use the sheet this script is bound to
const SS = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
const UPLOAD_FOLDER_NAME = "TurfUploads";

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'getAvailability') {
    return getAvailability(e.parameter.date);
  } else if (action === 'getAllData') {
    return getAllData();
  }
  
  return response({status: 'error', message: 'Invalid action'});
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'createBooking') {
      return createBooking(data);
    } else if (action === 'toggleBlock') {
      return toggleBlock(data);
    } else if (action === 'updatePrice') {
      return updatePrice(data);
    } else if (action === 'approveBooking') {
      return updateBookingStatus(data.bookingId, 'CONFIRMED');
    } else if (action === 'rejectBooking') {
      return updateBookingStatus(data.bookingId, 'REJECTED');
    }
    
    return response({status: 'error', message: 'Invalid action: ' + action});
  } catch (error) {
    return response({status: 'error', message: 'Server Error: ' + error.toString()});
  }
}

// -------------------------------------------------------------------------
// CORE LOGIC
// -------------------------------------------------------------------------

function getAvailability(date) {
  const bookingsSheet = getOrCreateSheet("Bookings");
  const blockedSheet = getOrCreateSheet("Blocked");
  const configSheet = getOrCreateSheet("Config");

  // 1. Get Bookings
  const bRows = bookingsSheet.getDataRange().getValues();
  const bookedSlots = [];
  const now = new Date();
  
  // Iterate rows (skip header)
  for (let i = 1; i < bRows.length; i++) {
    if (!bRows[i][0]) continue; // Skip empty rows

    // CRITICAL FIX: Normalize Date to String for comparison
    const rowDate = normalizeDate(bRows[i][1]); 
    const slotId = bRows[i][2];
    
    // Safety check for status
    const statusRaw = bRows[i][7];
    const status = (statusRaw ? String(statusRaw) : "").toUpperCase();
    
    const timestampStr = bRows[i][8];

    // Check if dates match (String vs String)
    if (rowDate === date) {
      if (status === 'CONFIRMED') {
        bookedSlots.push(slotId);
      } else if (status === 'PENDING') {
        // Soft Lock: Check if < 4 hours old
        let timestamp;
        try {
            timestamp = new Date(timestampStr);
            // If invalid date, treat as booked to be safe
            if(isNaN(timestamp.getTime())) {
                bookedSlots.push(slotId);
                continue;
            }
        } catch(e) {
             bookedSlots.push(slotId);
             continue;
        }

        const diffHours = (now - timestamp) / (1000 * 60 * 60);
        if (diffHours < 4) {
           bookedSlots.push(slotId);
        }
      }
    }
  }

  // 2. Get Blocked Slots
  const blRows = blockedSheet.getDataRange().getValues();
  const blockedSlots = [];
  for (let i = 1; i < blRows.length; i++) {
    // Normalize blocked date too
    const blDate = normalizeDate(blRows[i][0]);
    if (blDate === date) {
      blockedSlots.push(blRows[i][1]);
    }
  }

  // 3. Get Config
  const cRows = configSheet.getDataRange().getValues();
  const pricing = {};
  for(let i = 1; i < cRows.length; i++) {
    pricing[cRows[i][0]] = cRows[i][1];
  }

  return response({
    booked: bookedSlots,
    blocked: blockedSlots,
    pricing: pricing 
  });
}

function createBooking(data) {
  const lock = LockService.getScriptLock();
  // Wait longer for lock to ensure no collisions
  try {
    lock.waitLock(15000); 
    
    const sheet = getOrCreateSheet("Bookings");
    const rows = sheet.getDataRange().getValues();
    const now = new Date();
    
    // 1. Double check availability
    for (let i = 1; i < rows.length; i++) {
      if(!rows[i][0]) continue;

      const rowDate = normalizeDate(rows[i][1]);
      const slotId = rows[i][2];
      
      const statusRaw = rows[i][7];
      const status = (statusRaw ? String(statusRaw) : "").toUpperCase();
      const timestampStr = rows[i][8];

      // Compare using normalized date string
      if (rowDate === data.date && slotId === data.slotId) {
          if (status === 'CONFIRMED') {
            return response({status: 'error', message: 'Slot already booked'});
          }
          if (status === 'PENDING') {
             let timestamp = new Date(timestampStr);
             // If timestamp invalid, assume locked
             if(isNaN(timestamp.getTime())) {
                 return response({status: 'error', message: 'Slot unavailable (System Check)'});
             }
             const diffHours = (now - timestamp) / (1000 * 60 * 60);
             if (diffHours < 4) {
               return response({status: 'error', message: 'Slot is currently on hold'});
             }
          }
      }
    }

    // 2. Upload Image
    let screenshotUrl = 'N/A';
    if (data.image) {
       // Keep simple name to avoid special char issues
       screenshotUrl = uploadToDrive(data.image, "Pay_" + data.slotId + "_" + Date.now());
    }

    // 3. Append Booking
    const id = Math.random().toString(36).substr(2, 9).toUpperCase();
    const timestampStr = now.toISOString();
    
    // Explicitly force date as string with ' prefix if needed, but usually just passing string is enough.
    // We add 'PENDING' explicitly.
    sheet.appendRow([
      id,
      data.date,   // This comes as "YYYY-MM-DD" string from frontend
      data.slotId,
      data.name,
      "'"+data.phone, // Force phone as string to prevent scientific notation
      'N/A', 
      data.amount,
      'PENDING', 
      timestampStr,
      data.paymentId || 'N/A',
      screenshotUrl
    ]);
    
    return response({status: 'success', bookingId: id});
    
  } catch (e) {
    return response({status: 'error', message: e.toString()});
  } finally {
    lock.releaseLock();
  }
}

function updateBookingStatus(bookingId, newStatus) {
   const sheet = getOrCreateSheet("Bookings");
   const rows = sheet.getDataRange().getValues();
   
   for (let i = 1; i < rows.length; i++) {
     if (rows[i][0] == bookingId) { 
       // Column H is index 8 (1-based)
       sheet.getRange(i + 1, 8).setValue(newStatus); 
       return response({status: 'success'});
     }
   }
   return response({status: 'error', message: 'Booking not found'});
}

function getAllData() {
  const bSheet = getOrCreateSheet("Bookings");
  const blSheet = getOrCreateSheet("Blocked");
  const cSheet = getOrCreateSheet("Config");
  
  // Use custom sheetToJson that normalizes dates
  const bookings = sheetToJson(bSheet, true);
  const blocked = sheetToJson(blSheet, true);
  
  // Sort bookings desc
  bookings.sort((a, b) => {
      const dateA = new Date(a.Timestamp);
      const dateB = new Date(b.Timestamp);
      return isNaN(dateA) || isNaN(dateB) ? 0 : dateB - dateA;
  });

  const cRows = cSheet.getDataRange().getValues();
  const config = {};
  for(let i = 1; i < cRows.length; i++) {
    config[cRows[i][0]] = cRows[i][1];
  }
  
  return response({ bookings: bookings, blocked: blocked, config: config });
}

function toggleBlock(data) {
  const sheet = getOrCreateSheet("Blocked");
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    // Normalize date for comparison
    const rDate = normalizeDate(rows[i][0]);
    if (rDate === data.date && rows[i][1] === data.slotId) {
      sheet.deleteRow(i + 1);
      return response({status: 'success', action: 'unblocked'});
    }
  }
  
  sheet.appendRow([data.date, data.slotId, 'Manual Block']);
  return response({status: 'success', action: 'blocked'});
}

function updatePrice(data) {
  const sheet = getOrCreateSheet("Config");
  const rows = sheet.getDataRange().getValues();
  let found = false;
  
  for(let i=1; i<rows.length; i++) {
    if(rows[i][0] === data.key) {
      sheet.getRange(i+1, 2).setValue(data.value);
      found = true;
      break;
    }
  }
  
  if(!found) sheet.appendRow([data.key, data.value]);
  
  return response({status: 'success'});
}

// -------------------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------------------

/**
 * Normalizes any date input (String or Date Object) to "YYYY-MM-DD" string.
 * This is crucial for matching dates between Frontend and Sheet.
 */
function normalizeDate(val) {
  if (!val) return "";
  
  // If it's a Date object (Sheet often returns this)
  if (Object.prototype.toString.call(val) === '[object Date]') {
     const y = val.getFullYear();
     // getMonth is 0-indexed
     const m = ('0' + (val.getMonth() + 1)).slice(-2);
     const d = ('0' + val.getDate()).slice(-2);
     return y + '-' + m + '-' + d;
  }
  
  // If string, handle potential ISO format (2023-01-01T00:00...)
  const str = String(val);
  if (str.includes('T')) return str.split('T')[0];
  return str;
}

function getOrCreateSheet(name) {
  let sheet = SS.getSheetByName(name);
  if (!sheet) {
    sheet = SS.insertSheet(name);
    // Add Headers if new
    if(name === "Bookings") sheet.appendRow(["BookingId", "Date", "Slot", "Name", "Phone", "Email", "Amount", "Status", "Timestamp", "PaymentId", "ScreenshotUrl"]);
    if(name === "Blocked") sheet.appendRow(["Date", "SlotId", "Reason"]);
    if(name === "Config") sheet.appendRow(["Key", "Value"]);
  }
  return sheet;
}

function uploadToDrive(base64Data, fileName) {
  try {
    const folders = DriveApp.getFoldersByName(UPLOAD_FOLDER_NAME);
    let folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(UPLOAD_FOLDER_NAME);
    }
    
    // Handle typical base64 strings with or without prefix
    const parts = base64Data.split(',');
    const dataPart = parts.length > 1 ? parts[1] : parts[0];
    // Default to jpeg if mimetype not found
    let mimeType = 'image/jpeg';
    if(parts.length > 1) {
       const matches = parts[0].match(/:(.*?);/);
       if(matches && matches.length > 1) mimeType = matches[1];
    }

    const data = Utilities.base64Decode(dataPart);
    const blob = Utilities.newBlob(data, mimeType, fileName);
    
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    
    return file.getUrl();
  } catch (e) {
    return "Error Uploading: " + e.toString();
  }
}

function sheetToJson(sheet, normalizeDates = false) {
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];
  
  const headers = data[0];
  const result = [];
  
  for (let i = 1; i < data.length; i++) {
    let row = {};
    for (let j = 0; j < headers.length; j++) {
      let val = data[i][j];
      // Normalize Date columns if requested
      if (normalizeDates && (headers[j] === 'Date' || headers[j] === 'date')) {
         val = normalizeDate(val);
      }
      row[headers[j]] = val;
    }
    result.push(row);
  }
  return result;
}

function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}