import { Booking, User, PricingConfig } from '../types';

// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------
// TODO: PASTE YOUR DEPLOYED GOOGLE APPS SCRIPT WEB APP URL BELOW
export const GOOGLE_SCRIPT_URL: string = 'PASTE_YOUR_GOOGLE_SCRIPT_WEB_APP_URL_HERE'; 

// Formspree URL for Backup Emails
export const FORMSPREE_URL = "https://formspree.io/f/movbprqy";

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
 * Fetch availability, blocked slots, and pricing from Google Sheets
 */
export async function getDayData(date: string) {
    if (GOOGLE_SCRIPT_URL.includes('PASTE_YOUR') || GOOGLE_SCRIPT_URL === '') {
        console.warn("Using mock data because GOOGLE_SCRIPT_URL is not set.");
        return getMockDayData(date);
    }

    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAvailability&date=${date}`);
        const data = await response.json();
        return data; // { booked: [], blocked: [], pricing: { basePrice, peakPrice, upiId, etc } }
    } catch (error) {
        console.error("Failed to fetch from Google Sheet:", error);
        return { booked: [], blocked: [], pricing: {} };
    }
}

/**
 * Send booking request to Google Sheets (includes Base64 Screenshot)
 */
export async function createBooking(bookingData: any) {
    if (GOOGLE_SCRIPT_URL.includes('PASTE_YOUR') || GOOGLE_SCRIPT_URL === '') {
        return { status: 'success', bookingId: 'mock-id-' + Date.now() };
    }

    try {
        // Post entire object including the large image string
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'createBooking', ...bookingData })
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Booking Error:", error);
        return { status: 'error', message: 'Network error connecting to Sheet' };
    }
}

/**
 * Admin: Approve Booking
 */
export async function approveBooking(bookingId: string) {
    if (GOOGLE_SCRIPT_URL.includes('PASTE_YOUR') || GOOGLE_SCRIPT_URL === '') return { status: 'success' };
    
    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'approveBooking', bookingId })
    });
    return await response.json();
}

/**
 * Admin: Reject Booking
 */
export async function rejectBooking(bookingId: string) {
    if (GOOGLE_SCRIPT_URL.includes('PASTE_YOUR') || GOOGLE_SCRIPT_URL === '') return { status: 'success' };
    
    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'rejectBooking', bookingId })
    });
    return await response.json();
}

/**
 * Fetch all data for Admin Dashboard
 */
export async function getAdminData() {
    if (GOOGLE_SCRIPT_URL.includes('PASTE_YOUR') || GOOGLE_SCRIPT_URL === '') {
        return { bookings: [], blocked: [], config: { basePrice: 800, peakPrice: 1200, upiId: 'mock@upi', peakStartHour: 18 } };
    }

    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAllData`);
        return await response.json();
    } catch (error) {
        return { bookings: [], blocked: [], config: {} };
    }
}

/**
 * Toggle Block/Unblock a slot
 */
export async function toggleBlockSlot(date: string, slotId: string) {
     if (GOOGLE_SCRIPT_URL.includes('PASTE_YOUR') || GOOGLE_SCRIPT_URL === '') return;

     await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'toggleBlock', date, slotId })
    });
}

/**
 * Update Pricing / Config
 */
export async function updatePricing(key: string, value: number | string) {
    if (GOOGLE_SCRIPT_URL.includes('PASTE_YOUR') || GOOGLE_SCRIPT_URL === '') return;

    await fetch(GOOGLE_SCRIPT_URL, {
       method: 'POST',
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
// MOCK DATA
// ------------------------------------------------------------------
function getMockDayData(date: string) {
    return {
        booked: ['slot-19', 'slot-20'],
        blocked: ['slot-14'],
        pricing: { basePrice: 800, peakPrice: 1200, upiId: 'turf@upi', peakStartHour: 18 }
    };
}