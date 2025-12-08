/* 
  PASTE THIS INTO GOOGLE APPS SCRIPT (Extensions > Apps Script)
  THEN DEPLOY AS WEB APP -> WHO HAS ACCESS: ANYONE
  
  IMPORTANT: 
  1. Add columns to "Bookings" sheet if they don't exist:
     Column J: PaymentId
     Column K: ScreenshotUrl
  2. This script will create a "TurfUploads" folder in your Google Drive automatically.
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
  // Handle CORS for POST requests - Google Apps Script requires text/plain to avoid preflight
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

// --- Logic ---

function getAvailability(date) {
  const bookingsSheet = getOrCreateSheet("Bookings");
  const blockedSheet = getOrCreateSheet("Blocked");
  const configSheet = getOrCreateSheet("Config");

  // Get Bookings
  const bRows = bookingsSheet.getDataRange().getValues();
  const bookedSlots = [];
  const now = new Date();
  
  // Skip header, filter by date
  // Data starts at row 1 (index 1) if header exists
  for (let i = 1; i < bRows.length; i++) {
    // Safety check for empty rows
    if (!bRows[i][0]) continue;

    const rowDate = bRows[i][1]; // Date column
    const slotId = bRows[i][2];  // Slot column
    const status = bRows[i][7].toString().toUpperCase();  // Status column (Normalized)
    const timestampStr = bRows[i][8]; // Timestamp column

    if (rowDate === date) {
      if (status === 'CONFIRMED') {
        bookedSlots.push(slotId);
      } else if (status === 'PENDING') {
        // SOFT LOCK LOGIC
        let timestamp;
        try {
            timestamp = new Date(timestampStr);
            if(isNaN(timestamp.getTime())) throw new Error("Invalid Date");
        } catch(e) {
             // If date is unparsable, we block the slot to be safe
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

  // Get Blocked
  const blRows = blockedSheet.getDataRange().getValues();
  const blockedSlots = [];
  for (let i = 1; i < blRows.length; i++) {
    if (blRows[i][0] === date) {
      blockedSlots.push(blRows[i][1]);
    }
  }

  // Get Pricing & Config
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
  try {
    lock.waitLock(10000); 
    
    const sheet = getOrCreateSheet("Bookings");
    const rows = sheet.getDataRange().getValues();
    const now = new Date();
    
    // Double check availability
    for (let i = 1; i < rows.length; i++) {
      if(!rows[i][0]) continue;

      const rowDate = rows[i][1];
      const slotId = rows[i][2];
      const status = rows[i][7].toString().toUpperCase();
      const timestampStr = rows[i][8];

      if (rowDate === data.date && slotId === data.slotId) {
          if (status === 'CONFIRMED') {
            return response({status: 'error', message: 'Slot already booked'});
          }
          if (status === 'PENDING') {
             let timestamp = new Date(timestampStr);
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

    let screenshotUrl = 'N/A';
    if (data.image) {
       screenshotUrl = uploadToDrive(data.image, data.name + "_" + data.date);
    }

    const id = Math.random().toString(36).substr(2, 9);
    const timestampStr = now.toISOString();
    
    sheet.appendRow([
      id,
      data.date,
      data.slotId,
      data.name,
      data.phone,
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
       // Status is in column 8 (Index 7, but allow for offset if header changed)
       // Fixed: Column H is index 8 (1-based) in getRange
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
  
  const bookings = sheetToJson(bSheet);
  const blocked = sheetToJson(blSheet);
  
  // Sort bookings
  bookings.sort((a, b) => {
      const dateA = new Date(a.Timestamp);
      const dateB = new Date(b.Timestamp);
      return isNaN(dateA) || isNaN(dateB) ? 0 : dateB - dateA;
  });

  // Get Config
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
    if (rows[i][0] === data.date && rows[i][1] === data.slotId) {
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

// --- Helpers ---

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
    
    const split = base64Data.split(',');
    const type = split[0].split(';')[0].replace('data:', '');
    const data = Utilities.base64Decode(split[1]);
    const blob = Utilities.newBlob(data, type, fileName);
    
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    
    return file.getUrl();
  } catch (e) {
    return "Error Uploading: " + e.toString();
  }
}

function sheetToJson(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const result = [];
  
  for (let i = 1; i < data.length; i++) {
    let row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    result.push(row);
  }
  return result;
}

function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}