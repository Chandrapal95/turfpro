import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { TimeSlot } from '../types';
import { getDayData, createBooking } from '../services/api';
import { Calendar, Clock, CheckCircle, Lock, Loader2, QrCode, Upload, Copy, AlertTriangle, Save, Ticket, Sun, Moon } from 'lucide-react';

interface BookingSystemProps {
    onBookingComplete?: () => void;
    onRequestLogin: () => void;
}

interface BookingFormData {
    name: string;
    phone: string;
    transactionId?: string;
}

export const BookingSystem: React.FC<BookingSystemProps> = ({ onBookingComplete, onRequestLogin }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMode, setSuccessMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Data from Google Sheets
  const [bookedSlotIds, setBookedSlotIds] = useState<string[]>([]);
  const [blockedSlotIds, setBlockedSlotIds] = useState<string[]>([]);
  
  // Configuration State (Fetched from backend)
  const [pricing, setPricing] = useState({ basePrice: 800, peakPrice: 1200 });
  const [upiId, setUpiId] = useState("turfpro@upi");
  const [peakStartHour, setPeakStartHour] = useState(18);

  // React Hook Form
  const { register, handleSubmit, formState: { errors }, reset } = useForm<BookingFormData>();
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  // QR Code Generation
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=${upiId}&pn=TurfPro`; 

  // Auto-refresh interval
  useEffect(() => {
    fetchAvailability();
    const interval = setInterval(fetchAvailability, 300000); // 5 mins
    return () => clearInterval(interval);
  }, [selectedDate]);

  const fetchAvailability = async () => {
      setLoadingSlots(true);
      // Use Local Date String YYYY-MM-DD to match Google Sheet Format exactly
      const dateKey = selectedDate.toLocaleDateString('en-CA');
      
      const data = await getDayData(dateKey);
      setBookedSlotIds(data.booked || []);
      setBlockedSlotIds(data.blocked || []);
      
      // Update Config from Backend
      if(data.pricing) {
          if (data.pricing.basePrice) setPricing({ basePrice: Number(data.pricing.basePrice), peakPrice: Number(data.pricing.peakPrice) });
          if (data.pricing.upiId) setUpiId(data.pricing.upiId);
          if (data.pricing.peakStartHour) setPeakStartHour(Number(data.pricing.peakStartHour));
      }
      setLoadingSlots(false);
  };

  // Generate next 14 days
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const getSlotsForDate = () => {
    const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;

    return Array.from({ length: 18 }, (_, i) => {
        const hour = i + 6; // 6 AM to 11 PM
        const slotId = `slot-${hour}`;
        const isPeak = hour >= peakStartHour;
        
        let price = isPeak ? pricing.peakPrice : pricing.basePrice;
        if (isWeekend) price = Math.round(price * 1.2); 

        return {
            id: slotId,
            startTime: `${hour.toString().padStart(2, '0')}:00`,
            endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
            price: price,
            isBooked: bookedSlotIds.includes(slotId), // This includes soft-locked (pending) slots from backend
            isBlocked: blockedSlotIds.includes(slotId),
            isPending: false 
        };
    });
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    if (slot.isBooked || slot.isBlocked) return;
    setSelectedSlot(slot);
    setSuccessMode(false);
    setErrorMsg('');
    // We do NOT reset form fields when just switching slots, to improve UX
  };

  // Client-side image compression
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; // Resize to reasonable width
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to 70% quality JPEG
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setScreenshotFile(file);
          
          try {
             // Preview only
             const reader = new FileReader();
             reader.onload = (ev) => setScreenshotPreview(ev.target?.result as string);
             reader.readAsDataURL(file);
          } catch (err) {
              console.error("Preview error", err);
          }
      }
  };

  const onSubmit = async (data: BookingFormData) => {
    if (!selectedSlot) return;
    if (!screenshotFile) {
        setErrorMsg("Please upload the payment screenshot.");
        return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
        const base64Image = await compressImage(screenshotFile);

        const bookingPayload = {
          date: selectedDate.toLocaleDateString('en-CA'), // YYYY-MM-DD
          slotId: selectedSlot.id,
          name: data.name,
          phone: data.phone,
          amount: selectedSlot.price,
          image: base64Image,
          paymentId: data.transactionId || 'N/A'
        };

        // 1. Submit to Google Sheet (Primary DB)
        const result = await createBooking(bookingPayload);

        if (result.status === 'error') {
            setErrorMsg(result.message || "Booking failed. Please try again.");
            setSubmitting(false);
            fetchAvailability(); 
            return;
        }

        // OPTIMISTIC UPDATE: Instantly lock the slot in UI
        setBookedSlotIds(prev => [...prev, selectedSlot.id]);

        setSubmitting(false);
        setSuccessMode(true);
        reset();
        setScreenshotFile(null);
        setScreenshotPreview(null);
        
        fetchAvailability();

        if(onBookingComplete) onBookingComplete();

    } catch (error) {
        console.error(error);
        setErrorMsg("Error processing booking. Please try again.");
        setSubmitting(false);
    }
  };

  const downloadQR = () => {
      const link = document.createElement('a');
      link.href = qrImageUrl;
      link.download = 'TurfPro_UPI_QR.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // ----- RENDER -----
  
  if (successMode) {
      return (
          <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden p-12 text-center animate-fade-in my-12 border border-green-100 relative">
              <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
              <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-green-100 mb-8">
                <CheckCircle className="h-12 w-12 text-green-600 animate-pulse" />
              </div>
              <h3 className="text-4xl font-extrabold text-gray-900 mb-4">Booking Confirmed!</h3>
              <p className="text-gray-500 mb-10 text-lg">
                  Your slot has been successfully reserved. We will verify your payment and send a confirmation SMS shortly.
              </p>
              <button 
                onClick={() => { setSuccessMode(false); setSelectedSlot(null); }}
                className="w-full sm:w-auto bg-gray-900 text-white px-10 py-4 rounded-xl font-bold hover:bg-black transition shadow-lg transform hover:scale-105">
                Book Another Slot
              </button>
          </div>
      );
  }

  return (
    <div className="max-w-7xl mx-auto py-8">
      {/* 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: Date & Slots */}
          <div className="lg:col-span-2 space-y-8">
              
              {/* Date Selector */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                  <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                    <Calendar className="w-6 h-6 mr-3 text-green-600" /> Select Date
                  </h3>
                  <div className="flex space-x-4 overflow-x-auto pb-6 scrollbar-hide">
                    {dates.map((date) => {
                        const isSelected = date.toLocaleDateString('en-CA') === selectedDate.toLocaleDateString('en-CA');
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        return (
                        <button
                            key={date.toISOString()}
                            onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                            className={`flex-shrink-0 w-24 h-28 rounded-2xl flex flex-col items-center justify-center border-2 transition-all duration-200 ${
                            isSelected 
                                ? 'border-green-500 bg-green-500 text-white shadow-lg shadow-green-200 transform scale-105' 
                                : 'border-gray-100 text-gray-400 hover:border-green-200 hover:bg-green-50'
                            }`}
                        >
                            <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? 'text-green-100' : (isWeekend ? 'text-red-400' : 'text-gray-400')}`}>
                                {date.toLocaleDateString('en-US', { weekday: 'short' })}
                            </span>
                            <span className="text-3xl font-bold mt-2">{date.getDate()}</span>
                            <span className={`text-xs mt-1 ${isSelected ? 'text-green-100' : 'text-gray-400'}`}>
                                {date.toLocaleDateString('en-US', { month: 'short' })}
                            </span>
                        </button>
                        );
                    })}
                </div>
              </div>

              {/* Slots Grid */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 min-h-[400px]">
                  <div className="flex justify-between items-center mb-8">
                      <h3 className="text-xl font-bold text-gray-900 flex items-center">
                        <Clock className="w-6 h-6 mr-3 text-green-600" /> Available Slots
                      </h3>
                      {loadingSlots && <span className="text-sm text-green-600 flex items-center"><Loader2 className="w-4 h-4 animate-spin mr-2"/> updating availability...</span>}
                  </div>

                  {loadingSlots ? (
                      <div className="flex flex-col justify-center items-center h-64 text-gray-400">
                          <Loader2 className="w-12 h-12 text-green-500 animate-spin mb-4" />
                          <p>Checking live availability...</p>
                      </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {getSlotsForDate().map((slot) => {
                            const unavailable = slot.isBooked || slot.isBlocked;
                            const isPeak = slot.price > pricing.basePrice;
                            const isSelected = selectedSlot?.id === slot.id;
                            
                            return (
                                <button
                                    key={slot.id}
                                    disabled={unavailable}
                                    onClick={() => handleSlotSelect(slot)}
                                    className={`
                                        relative overflow-hidden py-4 px-3 rounded-2xl border-2 text-center transition-all duration-200 group
                                        ${unavailable 
                                            ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                                            : isSelected
                                                ? 'bg-gray-900 border-gray-900 text-white shadow-xl transform scale-105 z-10'
                                                : 'bg-white border-gray-100 hover:border-green-500 hover:shadow-md cursor-pointer text-gray-700'
                                        }
                                    `}
                                >
                                    {/* Icon for Peak/Day */}
                                    {!unavailable && (
                                        <div className="absolute top-2 right-2">
                                            {isPeak ? (
                                                <Moon className={`w-3 h-3 ${isSelected ? 'text-yellow-400' : 'text-gray-300'}`} />
                                            ) : (
                                                <Sun className={`w-3 h-3 ${isSelected ? 'text-yellow-400' : 'text-gray-300'}`} />
                                            )}
                                        </div>
                                    )}

                                    <span className="text-base font-extrabold block mb-1">{slot.startTime}</span>
                                    
                                    {unavailable ? (
                                        <span className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-center bg-gray-100 rounded-full py-1 mt-1 mx-2">
                                            {slot.isBlocked ? <Lock className="w-3 h-3 mr-1" /> : 'Booked'}
                                        </span>
                                    ) : (
                                        <span className={`text-sm font-bold ${isSelected ? 'text-green-400' : (isPeak ? 'text-gray-900' : 'text-green-600')}`}>
                                            ₹{slot.price}
                                        </span>
                                    )}
                                    
                                    {/* Selection Ring Animation */}
                                    {isSelected && <div className="absolute inset-0 border-2 border-green-500 rounded-2xl animate-pulse"></div>}
                                </button>
                            )
                        })}
                    </div>
                  )}
                  
                  <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-gray-500 border-t border-gray-100 pt-6">
                      <div className="flex items-center"><span className="w-4 h-4 bg-white border-2 border-gray-200 rounded-md mr-2"></span> Available</div>
                      <div className="flex items-center"><span className="w-4 h-4 bg-gray-900 rounded-md mr-2"></span> Selected</div>
                      <div className="flex items-center"><span className="w-4 h-4 bg-gray-100 border border-gray-100 rounded-md mr-2"></span> Booked</div>
                      <div className="ml-auto flex items-center text-xs bg-yellow-50 px-3 py-1 rounded-full text-yellow-700">
                          <Moon className="w-3 h-3 mr-1" /> Peak Hours: 6PM onwards
                      </div>
                  </div>
              </div>
          </div>

          {/* RIGHT COLUMN: Booking Details (Sticky) */}
          <div className="lg:col-span-1">
              <div className="sticky top-24">
                   <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden relative">
                       {/* Ticket Visual Header */}
                       <div className="h-3 bg-gradient-to-r from-green-400 to-green-600"></div>
                       <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                           <div className="flex items-center">
                               <Ticket className="w-5 h-5 text-green-600 mr-2" />
                               <h3 className="font-bold text-gray-900">Match Ticket</h3>
                           </div>
                           {selectedSlot && <span className="text-[10px] bg-green-100 text-green-800 px-3 py-1 rounded-full font-bold uppercase tracking-wide">Draft</span>}
                       </div>

                       {!selectedSlot ? (
                           <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center min-h-[350px]">
                               <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                   <Clock className="w-8 h-8 opacity-30" />
                               </div>
                               <p className="text-sm font-medium">Select a slot to proceed</p>
                           </div>
                       ) : (
                           <div className="p-6 space-y-6 animate-fade-in">
                               {/* Ticket Stub Details */}
                               <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-4 relative">
                                    {/* Semi-circles for ticket punch effect */}
                                   <div className="absolute -left-2 top-1/2 w-4 h-4 bg-white border-r-2 border-dashed border-gray-200 rounded-full transform -translate-y-1/2"></div>
                                   <div className="absolute -right-2 top-1/2 w-4 h-4 bg-white border-l-2 border-dashed border-gray-200 rounded-full transform -translate-y-1/2"></div>
                                   
                                   <div className="flex justify-between mb-2">
                                       <div>
                                           <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Date</p>
                                           <p className="font-bold text-gray-900">{selectedDate.toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'})}</p>
                                       </div>
                                       <div className="text-right">
                                           <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Time</p>
                                           <p className="font-bold text-green-600 text-lg">{selectedSlot.startTime}</p>
                                       </div>
                                   </div>
                               </div>

                               {/* Form */}
                               <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Player Name</label>
                                        <input
                                        {...register("name", { required: "Name is required" })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm bg-gray-50 focus:bg-white transition"
                                        placeholder="Enter captain's name"
                                        />
                                        {errors.name && <span className="text-red-500 text-xs ml-1">{errors.name.message}</span>}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Phone Number</label>
                                        <input
                                        type="tel"
                                        {...register("phone", { required: "Phone is required", pattern: { value: /^[0-9]{10}$/, message: "Valid 10-digit number required" } })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm bg-gray-50 focus:bg-white transition"
                                        placeholder="9876543210"
                                        />
                                        {errors.phone && <span className="text-red-500 text-xs ml-1">{errors.phone.message}</span>}
                                    </div>

                                    {/* Compact Payment */}
                                    <div className="bg-gray-900 p-5 rounded-2xl text-white relative overflow-hidden">
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-sm font-medium text-gray-300">Total Payable</span>
                                                <span className="text-2xl font-extrabold text-green-400">₹{selectedSlot.price}</span>
                                            </div>
                                            
                                            <div className="bg-white/10 p-3 rounded-lg mb-4 flex justify-between items-center backdrop-blur-sm">
                                                <div className="text-xs text-gray-300 truncate mr-2">
                                                    UPI: <span className="font-mono text-white">{upiId}</span>
                                                </div>
                                                <button type="button" onClick={() => navigator.clipboard.writeText(upiId)} className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-white transition">
                                                    <Copy className="w-3 h-3" />
                                                </button>
                                            </div>
                                            
                                            <button type="button" onClick={downloadQR} className="w-full bg-white text-gray-900 py-2 rounded-lg text-xs font-bold flex items-center justify-center hover:bg-gray-100 mb-4 transition">
                                                <QrCode className="w-3 h-3 mr-2" /> Download Payment QR
                                            </button>

                                            <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition ${screenshotFile ? 'border-green-500 bg-green-500/10' : 'border-gray-600 hover:border-gray-400'}`}>
                                                {screenshotPreview ? (
                                                     <div className="flex flex-col items-center text-green-400 text-xs font-bold">
                                                         <CheckCircle className="w-6 h-6 mb-1" /> 
                                                         <span>Screenshot Attached</span>
                                                         <span className="text-[10px] text-gray-400 font-normal mt-1">Click to change</span>
                                                     </div>
                                                ) : (
                                                    <>
                                                        <Upload className="w-6 h-6 text-gray-400 mb-2" />
                                                        <span className="text-xs text-gray-300">Upload Screenshot</span>
                                                    </>
                                                )}
                                                <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                                            </label>
                                        </div>
                                    </div>

                                    {errorMsg && (
                                        <div className="p-3 rounded-lg text-xs bg-red-50 border border-red-200 text-red-700 font-medium flex items-start">
                                            <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" /> {errorMsg}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full bg-green-600 text-white py-4 rounded-xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-200 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transform hover:scale-[1.02]"
                                    >
                                        {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                                        {submitting ? 'Processing...' : 'Confirm Booking'}
                                    </button>
                               </form>
                           </div>
                       )}
                   </div>
                   
                   {/* Trust Badge */}
                   <div className="mt-6 text-center">
                       <p className="text-xs text-gray-400 flex items-center justify-center">
                           <Lock className="w-3 h-3 mr-1" /> Secure Booking System
                       </p>
                   </div>
              </div>
          </div>
      </div>
    </div>
  );
};