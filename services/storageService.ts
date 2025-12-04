import { Review, User } from "../types";

const REVIEWS_KEY = 'turfpro_reviews';
const USER_KEY = 'turfpro_user';

const generateId = () => Math.random().toString(36).substr(2, 9);

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
            if (email === 'admin@turfpro.com' && password === '1234') {
                const user: User = { id: 'admin1', name: 'Admin User', email, role: 'ADMIN' };
                localStorage.setItem(USER_KEY, JSON.stringify(user));
                resolve(user);
            } else if (password.length >= 3) {
                // Allow generic user login for demo purposes
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