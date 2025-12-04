import { Booking, User, PricingConfig } from '../types';

// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------
// Using the URL you provided. Ensure the script at this URL matches the code in backend/GoogleAppsScript.js
export const GOOGLE_SCRIPT_URL: string = 'https://script.google.com/macros/s/AKfycbzuwQSvDn4Q2rF5D3tjNb7Ny2TOcgWnBj2Go3Iq9dYaZ49RXwUCJ5VhcjoV8GTyY1iAvQ/exec'; 

// Formspree URL for Backup Emails
export const FORMSPREE_URL = "https://formspree.io/f/xeoyzogl";

// Mock User for local auth state
const MOCK_ADMIN: User = {
    id: 'admin1',
    name: 'Admin Owner',
    email: 'admin@turfpro.com',
    role: 'ADMIN'
};

// ------------------------------------------------------------------
// API CALLS
// ------------------------------------------------------------------

/**
 * Helper to handle fetch responses that might be text or JSON
 */
async function handleResponse(response: Response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("Non-JSON response from server:", text);
        // If we get "OK", it means the wrong (simple) backend script is deployed.
        if (text.includes("OK")) {
             return { status: 'error', message: 'Backend Version Mismatch: Please redeploy the complex Google Apps Script provided in the code.' };
        }
        return { status: 'error', message: 'Server Error: ' + text.substring(0, 100) };
    }
}

/**
 * Fetch availability, blocked slots, and pricing from Google Sheets
 */
export async function getDayData(date: string) {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes('PASTE_YOUR')) {
        console.log("Using Mock Data for Availability");
        return getMockDayData(date);
    }

    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAvailability&date=${date}`);
        return await handleResponse(response);
    } catch (error) {
        console.error("Failed to fetch from Google Sheet:", error);
        return { booked: [], blocked: [], pricing: {} };
    }
}

/**
 * Send booking request to Google Sheets (includes Base64 Screenshot)
 */
export async function createBooking(bookingData: any) {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes('PASTE_YOUR')) {
        console.log("Mock Booking Created");
        return { status: 'success', bookingId: 'mock-id-' + Date.now() };
    }

    try {
        // IMPORTANT: Google Apps Script POST requests MUST use text/plain content type 
        // to avoid browser Preflight (OPTIONS) requests which GAS does not support.
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            redirect: "follow",
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
            body: JSON.stringify({ action: 'createBooking', ...bookingData })
        });
        return await handleResponse(response);
    } catch (error) {
        console.error("Booking Error:", error);
        return { status: 'error', message: 'Network error connecting to Sheet' };
    }
}

/**
 * Admin: Approve Booking
 */
export async function approveBooking(bookingId: string) {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes('PASTE_YOUR')) return { status: 'success' };
    
    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: 'approveBooking', bookingId })
    });
    return await handleResponse(response);
}

/**
 * Admin: Reject Booking
 */
export async function rejectBooking(bookingId: string) {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes('PASTE_YOUR')) return { status: 'success' };
    
    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: 'rejectBooking', bookingId })
    });
    return await handleResponse(response);
}

/**
 * Fetch all data for Admin Dashboard
 */
export async function getAdminData() {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes('PASTE_YOUR')) {
        return getMockAdminData();
    }

    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAllData`);
        return await handleResponse(response);
    } catch (error) {
        return { bookings: [], blocked: [], config: {} };
    }
}

/**
 * Toggle Block/Unblock a slot
 */
export async function toggleBlockSlot(date: string, slotId: string) {
     if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes('PASTE_YOUR')) return;

     await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: 'toggleBlock', date, slotId })
    });
}

/**
 * Update Pricing / Config
 */
export async function updatePricing(key: string, value: number | string) {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes('PASTE_YOUR')) return;

    await fetch(GOOGLE_SCRIPT_URL, {
       method: 'POST',
       redirect: "follow",
       headers: { "Content-Type": "text/plain;charset=utf-8" },
       body: JSON.stringify({ action: 'updatePrice', key, value })
   });
}

// ------------------------------------------------------------------
// AUTH
// ------------------------------------------------------------------

export const loginUser = (email: string, password: string): Promise<User> => {
    return new Promise((resolve, reject) => {
        if (email.toLowerCase().includes('admin') && password === '1234') {
            resolve(MOCK_ADMIN);
        } else {
            reject(new Error("Invalid Credentials"));
        }
    });
};

// ------------------------------------------------------------------
// MOCK DATA GENERATORS
// ------------------------------------------------------------------
function getMockDayData(date: string) {
    return {
        booked: ['slot-19', 'slot-20'],
        blocked: ['slot-14'],
        pricing: { basePrice: 800, peakPrice: 1200, upiId: 'turf@upi', peakStartHour: 18 }
    };
}

function getMockAdminData() {
    const today = new Date();
    const mockBookings = [];
    
    // Generate 15 bookings for the past 5 days
    for(let i=0; i<15; i++) {
        const d = new Date();
        d.setDate(today.getDate() - (i % 5));
        
        mockBookings.push({
            BookingId: `mock-${i}`,
            Date: d.toLocaleDateString('en-CA'),
            Slot: `slot-${17 + (i%5)}`,
            Name: `Customer ${i+1}`,
            Phone: `98765432${i.toString().padStart(2, '0')}`,
            Amount: (17 + (i%5)) >= 18 ? 1200 : 800,
            Status: i < 2 ? 'PENDING' : (i % 4 === 0 ? 'CANCELLED' : 'CONFIRMED'),
            Timestamp: d.toISOString(),
            PaymentId: `UPI-${Math.random().toString(36).substr(2,6)}`,
            ScreenshotUrl: 'N/A'
        });
    }

    return { 
        bookings: mockBookings, 
        blocked: [], 
        config: { basePrice: 800, peakPrice: 1200, upiId: 'mock@upi', peakStartHour: 18 } 
    };
}