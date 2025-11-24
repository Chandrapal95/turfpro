import { Booking, Review, PricingConfig, User } from "../types";

const BOOKINGS_KEY = 'turfpro_bookings';
const REVIEWS_KEY = 'turfpro_reviews';
const PRICING_KEY = 'turfpro_pricing';
const BLOCKED_KEY = 'turfpro_blocked';
const USER_KEY = 'turfpro_user';

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- Bookings ---

export const getBookings = (): Booking[] => {
  const data = localStorage.getItem(BOOKINGS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveBooking = (booking: Omit<Booking, 'BookingId' | 'Timestamp'>): Booking => {
  const bookings = getBookings();
  const newBooking: Booking = {
    ...booking,
    BookingId: generateId(),
    Timestamp: new Date().toISOString(),
  };
  bookings.push(newBooking);
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  return newBooking;
};

export const updateBookingStatus = (id: string, status: 'CONFIRMED' | 'CANCELLED'): void => {
  const bookings = getBookings();
  const index = bookings.findIndex(b => b.BookingId === id);
  if (index !== -1) {
    bookings[index].Status = status;
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  }
};

// --- Pricing & Config ---

const DEFAULT_PRICING: PricingConfig = {
  basePrice: 800,
  peakPrice: 1200,
  peakStartHour: 18,
  upiId: 'turfpro@upi'
};

export const getPricingConfig = (): PricingConfig => {
  const data = localStorage.getItem(PRICING_KEY);
  return data ? JSON.parse(data) : DEFAULT_PRICING;
};

export const savePricingConfig = (config: PricingConfig) => {
  localStorage.setItem(PRICING_KEY, JSON.stringify(config));
};

// --- Blocked Dates/Slots (Admin) ---

export const getBlockedSlots = (): Record<string, string[]> => {
    // Returns { "2023-10-27": ["slot-10", "slot-11"] }
    const data = localStorage.getItem(BLOCKED_KEY);
    return data ? JSON.parse(data) : {};
};

export const toggleBlockSlot = (date: string, slotId: string) => {
    const blocks = getBlockedSlots();
    if (!blocks[date]) blocks[date] = [];
    
    if (blocks[date].includes(slotId)) {
        blocks[date] = blocks[date].filter(id => id !== slotId);
    } else {
        blocks[date].push(slotId);
    }
    localStorage.setItem(BLOCKED_KEY, JSON.stringify(blocks));
};

// --- Reviews ---

export const getReviews = (): Review[] => {
    const data = localStorage.getItem(REVIEWS_KEY);
    if (data) return JSON.parse(data);
    
    const defaults: Review[] = [
        { id: '1', user: 'Rahul D.', rating: 5, comment: 'Amazing turf quality! The bounce is consistent.' },
        { id: '2', user: 'Vikram S.', rating: 4, comment: 'Great lighting for night matches. Booking was smooth.' },
        { id: '3', user: 'Amit K.', rating: 5, comment: 'Best place for box cricket tournaments.' },
    ];
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(defaults));
    return defaults;
};

// --- Auth (Mock) ---

export const getCurrentUser = (): User | null => {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
};

export const loginUser = (email: string, password: string): Promise<User> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (email === 'admin@turfpro.com' && password === 'admin123') {
                const user: User = { id: 'admin1', name: 'Admin User', email, role: 'ADMIN' };
                localStorage.setItem(USER_KEY, JSON.stringify(user));
                resolve(user);
            } else if (password.length >= 3) {
                const user: User = { id: generateId(), name: email.split('@')[0], email, role: 'USER' };
                localStorage.setItem(USER_KEY, JSON.stringify(user));
                resolve(user);
            } else {
                reject(new Error('Invalid credentials'));
            }
        }, 800); // Simulate network delay
    });
};

export const logoutUser = () => {
    localStorage.removeItem(USER_KEY);
};