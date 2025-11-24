export enum ViewState {
  HOME = 'HOME',
  BOOKING = 'BOOKING',
  GALLERY = 'GALLERY',
  CONTACT = 'CONTACT',
  ADMIN = 'ADMIN',
  LOGIN = 'LOGIN',
  ABOUT = 'ABOUT',
  PRICING = 'PRICING'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
}

export interface PricingConfig {
  basePrice: number;
  peakPrice: number;
  peakStartHour: number; // e.g. 18 (6 PM)
  weekendMultiplier: number; // e.g. 1.2
}

export interface TimeSlot {
  id: string;
  startTime: string; // "06:00"
  endTime: string;   // "07:00"
  price: number;
  isBooked: boolean;
  isBlocked: boolean; // For maintenance or admin block
  isPending: boolean; // For soft lock
}

// Matches Google Sheet "Bookings" columns
export interface Booking {
  BookingId: string;
  Date: string; // YYYY-MM-DD
  Slot: string; // slot-06
  Name: string;
  Phone: string;
  Email?: string;
  Amount: number;
  Status: 'CONFIRMED' | 'CANCELLED' | 'PENDING' | 'REJECTED';
  Timestamp: string;
  PaymentId?: string; // UTR or Transaction ID entered by user
  ScreenshotUrl?: string; // Link to Google Drive image
}

export interface Review {
  id: string;
  user: string;
  rating: number;
  comment: string;
}

// Global declaration for Razorpay (Removed as requested, but keeping generic window just in case)
declare global {
  interface Window {
    // Razorpay removed
  }
}