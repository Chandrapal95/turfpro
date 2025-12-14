import React, { useState, useEffect } from 'react';
import { WifiOff, Calendar, Clock, User, Phone, Save, Trash2, Lock, Unlock, AlertTriangle, FileText, CheckCircle, Ban } from 'lucide-react';

interface LocalBooking {
  id: string;
  date: string;
  start: string;
  end: string;
  name: string;
  phone: string;
  note: string;
  status: 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
}

const STORAGE_KEY = 'turfpro_local_bookings_v1';
const ADMIN_PASS = 'turf123';

export const OfflineMode: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [bookings, setBookings] = useState<LocalBooking[]>([]);
  
  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Admin State
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setBookings(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load local bookings", e);
      }
    }
  }, []);

  const saveBookings = (newBookings: LocalBooking[]) => {
    setBookings(newBookings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newBookings));
  };

  // Generate Slots 6 AM to 11 PM
  const slots = Array.from({ length: 17 }, (_, i) => {
    const hour = i + 6;
    return {
      start: `${hour.toString().padStart(2, '0')}:00`,
      end: `${(hour + 1).toString().padStart(2, '0')}:00`
    };
  });

  const getBookingsForDate = (date: string) => bookings.filter(b => b.date === date);

  const handleBooking = () => {
    if (!selectedSlot) {
      setMessage({ text: "Please select a time slot.", type: 'error' });
      return;
    }
    if (!name || !phone) {
      setMessage({ text: "Name and Phone are required.", type: 'error' });
      return;
    }

    const todaysBookings = getBookingsForDate(selectedDate);
    const isConflict = todaysBookings.some(
      b => b.start === selectedSlot.start && b.status === 'CONFIRMED'
    );

    if (isConflict) {
      setMessage({ text: "Slot already booked!", type: 'error' });
      return;
    }

    const newBooking: LocalBooking = {
      id: 'LOC-' + Date.now().toString(36),
      date: selectedDate,
      start: selectedSlot.start,
      end: selectedSlot.end,
      name,
      phone,
      note,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString()
    };

    saveBookings([...bookings, newBooking]);
    setMessage({ text: `Booking Confirmed! ID: ${newBooking.id}`, type: 'success' });
    setName('');
    setPhone('');
    setNote('');
    setSelectedSlot(null);
  };

  const handleAdminLogin = () => {
    if (adminPassInput === ADMIN_PASS) {
      setIsAdminUnlocked(true);
      setMessage({ text: "Admin Mode Unlocked", type: 'success' });
    } else {
      setMessage({ text: "Incorrect Password", type: 'error' });
    }
  };

  const cancelBooking = (id: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    const updated = bookings.map(b => b.id === id ? { ...b, status: 'CANCELLED' as const } : b);
    saveBookings(updated);
  };

  const clearDate = () => {
    if (!confirm(`Delete ALL bookings for ${selectedDate}? This cannot be undone.`)) return;
    const kept = bookings.filter(b => b.date !== selectedDate);
    saveBookings(kept);
    setMessage({ text: "Day cleared successfully.", type: 'success' });
  };

  const todaysBookings = getBookingsForDate(selectedDate);
  const confirmedCount = todaysBookings.filter(b => b.status === 'CONFIRMED').length;

  return (
    <div className="bg-slate-100 min-h-screen py-8 px-4 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-2 border border-blue-100">
              <WifiOff className="w-3 h-3 mr-1" /> OFFLINE MODE
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Local Booking Manager</h1>
            <p className="text-slate-500 text-sm mt-1">
              Data is stored in your browser. No internet connection required.
            </p>
          </div>
          <div className="text-right mt-4 md:mt-0">
             <div className="text-sm font-medium text-slate-600 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                Operating Hours: <span className="text-slate-900 font-bold">06:00 - 23:00</span>
             </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Booking Interface */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 1. Date & Slot Selection */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-green-600" /> Select Slot
              </h2>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Date</label>
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {slots.map((slot) => {
                  const booked = todaysBookings.some(b => b.start === slot.start && b.status === 'CONFIRMED');
                  const isSelected = selectedSlot?.start === slot.start;
                  
                  return (
                    <button
                      key={slot.start}
                      disabled={booked}
                      onClick={() => setSelectedSlot(slot)}
                      className={`
                        p-3 rounded-xl border text-center transition flex flex-col justify-center items-center h-20
                        ${booked 
                          ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                          : isSelected
                            ? 'bg-green-600 border-green-600 text-white shadow-md transform scale-105'
                            : 'bg-white border-slate-200 hover:border-green-400 hover:bg-green-50 cursor-pointer'
                        }
                      `}
                    >
                      <span className="text-sm font-bold block">{slot.start}</span>
                      <span className="text-[10px] uppercase mt-1">
                        {booked ? 'Booked' : 'Available'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Customer Details Form */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
               {/* Stripe accent */}
               <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>

               <h2 className="text-lg font-bold mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-green-600" /> Customer Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                    <input 
                      type="tel" 
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition"
                    />
                 </div>
              </div>
              <div className="mb-6">
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes (Optional)</label>
                 <textarea 
                   rows={2}
                   value={note}
                   onChange={e => setNote(e.target.value)}
                   className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition"
                 ></textarea>
              </div>

              {message && (
                <div className={`p-4 rounded-lg mb-4 flex items-center ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {message.type === 'success' ? <CheckCircle className="w-5 h-5 mr-2" /> : <AlertTriangle className="w-5 h-5 mr-2" />}
                  {message.text}
                </div>
              )}

              <button 
                onClick={handleBooking}
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-black transition shadow-lg flex justify-center items-center gap-2">
                <Save className="w-5 h-5" /> Confirm Local Booking
              </button>
            </div>
          </div>

          {/* Right Column: Summary & Admin */}
          <div className="space-y-6">
            
            {/* Daily Summary Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
               <h3 className="text-lg font-bold text-slate-800 mb-2">Today's Overview</h3>
               <p className="text-slate-500 text-sm mb-6 border-b pb-4">{new Date(selectedDate).toDateString()}</p>
               
               <div className="flex justify-between items-center mb-2">
                 <span className="text-slate-600">Confirmed Bookings</span>
                 <span className="text-2xl font-bold text-green-600">{confirmedCount}</span>
               </div>
               
               <div className="mt-6">
                 <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Booking List</h4>
                 <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                    {todaysBookings.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">No bookings for this date.</p>
                    ) : (
                      todaysBookings.sort((a,b) => a.start.localeCompare(b.start)).map(booking => (
                        <div key={booking.id} className={`p-3 rounded-lg border text-sm ${booking.status === 'CANCELLED' ? 'bg-red-50 border-red-100 opacity-60' : 'bg-slate-50 border-slate-100'}`}>
                           <div className="flex justify-between items-start">
                             <span className="font-bold text-slate-700">{booking.start} - {booking.end}</span>
                             <span className={`text-[10px] px-2 py-0.5 rounded-full ${booking.status === 'CONFIRMED' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                               {booking.status}
                             </span>
                           </div>
                           <div className="mt-1 font-medium">{booking.name}</div>
                           <div className="text-xs text-slate-500">{booking.phone}</div>
                           
                           {isAdminUnlocked && booking.status === 'CONFIRMED' && (
                              <button 
                                onClick={() => cancelBooking(booking.id)}
                                className="mt-2 text-xs text-red-600 hover:text-red-800 underline flex items-center">
                                <Ban className="w-3 h-3 mr-1" /> Cancel Booking
                              </button>
                           )}
                        </div>
                      ))
                    )}
                 </div>
               </div>
            </div>

            {/* Admin Panel */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={() => setShowAdminPanel(!showAdminPanel)}>
                 <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center">
                   {isAdminUnlocked ? <Unlock className="w-4 h-4 mr-2 text-green-500" /> : <Lock className="w-4 h-4 mr-2 text-slate-400" />}
                   Admin Actions
                 </h3>
                 <span className="text-xs text-blue-600 hover:underline">{showAdminPanel ? 'Hide' : 'Show'}</span>
              </div>

              {showAdminPanel && (
                <div className="animate-fade-in">
                  {!isAdminUnlocked ? (
                    <div className="space-y-3">
                      <input 
                        type="password" 
                        placeholder="Enter Password (turf123)"
                        value={adminPassInput}
                        onChange={e => setAdminPassInput(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded text-sm"
                      />
                      <button 
                        onClick={handleAdminLogin}
                        className="w-full bg-slate-800 text-white py-2 rounded text-sm font-bold hover:bg-slate-900">
                        Unlock Controls
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                       <button 
                          onClick={clearDate}
                          className="w-full border border-red-200 bg-red-50 text-red-700 py-2 rounded text-sm font-bold hover:bg-red-100 flex items-center justify-center">
                          <Trash2 className="w-4 h-4 mr-2" /> Clear All (This Date)
                       </button>
                       <p className="text-xs text-slate-400 text-center mt-2">
                         Password unlocked for this session.
                       </p>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};