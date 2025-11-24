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
  // Handle CORS for POST requests
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
  
  return response({status: 'error', message: 'Invalid action'});
}

// --- Logic ---

function getAvailability(date) {
  const bookingsSheet = SS.getSheetByName("Bookings");
  const blockedSheet = SS.getSheetByName("Blocked");
  const configSheet = SS.getSheetByName("Config");

  // Get Bookings
  const bRows = bookingsSheet.getDataRange().getValues();
  const bookedSlots = [];
  const now = new Date();
  
  // Skip header, filter by date
  for (let i = 1; i < bRows.length; i++) {
    const rowDate = bRows[i][1]; // Date column
    const slotId = bRows[i][2];  // Slot column
    const status = bRows[i][7];  // Status column
    const timestamp = new Date(bRows[i][8]); // Timestamp column

    if (rowDate === date) {
      if (status === 'CONFIRMED') {
        bookedSlots.push(slotId);
      } else if (status === 'PENDING') {
        // SOFT LOCK LOGIC: Check if created within last 4 hours
        const diffHours = (now - timestamp) / (1000 * 60 * 60);
        if (diffHours < 4) {
           bookedSlots.push(slotId);
        }
        // If > 4 hours, we treat it as free (expired)
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

  // Get Pricing
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
  // LOCK to prevent double booking race conditions
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // Wait up to 10s
    
    const sheet = SS.getSheetByName("Bookings");
    const rows = sheet.getDataRange().getValues();
    const now = new Date();
    
    // Double check availability (Include Soft Lock Check)
    for (let i = 1; i < rows.length; i++) {
      const rowDate = rows[i][1];
      const slotId = rows[i][2];
      const status = rows[i][7];
      const timestamp = new Date(rows[i][8]);

      if (rowDate === data.date && slotId === data.slotId) {
          if (status === 'CONFIRMED') {
            return response({status: 'error', message: 'Slot already booked'});
          }
          if (status === 'PENDING') {
            const diffHours = (now - timestamp) / (1000 * 60 * 60);
            if (diffHours < 4) {
               return response({status: 'error', message: 'Slot is currently on hold (Pending Approval)'});
            }
          }
      }
    }

    // Upload Image to Drive
    let screenshotUrl = 'N/A';
    if (data.image) {
       screenshotUrl = uploadToDrive(data.image, data.name + "_" + data.date);
    }

    const id = Math.random().toString(36).substr(2, 9);
    const timestampStr = now.toISOString();
    
    // 'BookingId', 'Date', 'Slot', 'Name', 'Phone', 'Email', 'Amount', 'Status', 'Timestamp', 'PaymentId', 'ScreenshotUrl'
    sheet.appendRow([
      id,
      data.date,
      data.slotId,
      data.name,
      data.phone,
      'N/A', // Email removed
      data.amount,
      'PENDING', // Initial status is PENDING
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
   const sheet = SS.getSheetByName("Bookings");
   const rows = sheet.getDataRange().getValues();
   
   for (let i = 1; i < rows.length; i++) {
     if (rows[i][0] == bookingId) { // Column A is ID (index 0)
       // Column H is Status. A=1, B=2 ... H=8.
       // In getRange(row, col), row is 1-based, col is 1-based.
       // rows[i] corresponds to sheet row i+1.
       sheet.getRange(i + 1, 8).setValue(newStatus); 
       return response({status: 'success'});
     }
   }
   return response({status: 'error', message: 'Booking not found'});
}

function getAllData() {
  const bSheet = SS.getSheetByName("Bookings");
  const blSheet = SS.getSheetByName("Blocked");
  
  const bookings = sheetToJson(bSheet);
  const blocked = sheetToJson(blSheet);
  
  // Sort bookings by newest first
  bookings.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
  
  return response({ bookings: bookings, blocked: blocked });
}

function toggleBlock(data) {
  const sheet = SS.getSheetByName("Blocked");
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
  const sheet = SS.getSheetByName("Config");
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

function uploadToDrive(base64Data, fileName) {
  try {
    const folders = DriveApp.getFoldersByName(UPLOAD_FOLDER_NAME);
    let folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(UPLOAD_FOLDER_NAME);
    }
    
    // data:image/png;base64,.....
    const split = base64Data.split(',');
    const type = split[0].split(';')[0].replace('data:', '');
    const data = Utilities.base64Decode(split[1]);
    const blob = Utilities.newBlob(data, type, fileName);
    
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    
    return file.getUrl();
  } catch (e) {
    return "Error: " + e.toString();
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