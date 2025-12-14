import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { TimeSlot } from '../types';
import { getDayData, createBooking, FORMSPREE_URL } from '../services/api';
import { Calendar, Clock, CheckCircle, Lock, Trophy, Loader2, QrCode, Upload, Download, Copy, AlertTriangle, X, AlertCircle, Save } from 'lucide-react';

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
          <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden p-8 text-center animate-fade-in my-12 border border-green-100">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6">
                <CheckCircle className="h-10 w-10 text-green-600 animate-pulse" />
              </div>
              <h3 className="text-3xl font-extrabold text-gray-900 mb-2">Booking Confirmed!</h3>
              <p className="text-gray-500 mb-8">
                  Your slot has been successfully reserved. We will verify your payment and send a confirmation SMS shortly.
              </p>
              <button 
                onClick={() => { setSuccessMode(false); setSelectedSlot(null); }}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 transition shadow">
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
          <div className="lg:col-span-2 space-y-6">
              
              {/* Date Selector */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-green-600" /> Select Date
                  </h3>
                  <div className="flex space-x-3 overflow-x-auto pb-4 scrollbar-hide py-2">
                    {dates.map((date) => {
                        const isSelected = date.toLocaleDateString('en-CA') === selectedDate.toLocaleDateString('en-CA');
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        return (
                        <button
                            key={date.toISOString()}
                            onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                            className={`flex-shrink-0 w-20 h-24 rounded-2xl flex flex-col items-center justify-center border transition-all duration-200 ${
                            isSelected 
                                ? 'border-green-600 bg-green-50 text-green-700 shadow-lg transform scale-105 ring-2 ring-green-600 ring-offset-2' 
                                : 'border-gray-200 text-gray-500 hover:border-green-300 hover:bg-gray-50'
                            }`}
                        >
                            <span className={`text-xs font-bold uppercase ${isWeekend ? 'text-red-400' : ''}`}>{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                            <span className="text-2xl font-bold mt-1">{date.getDate()}</span>
                            <span className="text-[10px] mt-1">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                        </button>
                        );
                    })}
                </div>
              </div>

              {/* Slots Grid */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 min-h-[400px]">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center">
                        <Clock className="w-5 h-5 mr-2 text-green-600" /> Available Slots
                      </h3>
                      {loadingSlots && <span className="text-xs text-green-600 flex items-center"><Loader2 className="w-3 h-3 animate-spin mr-1"/> updating...</span>}
                  </div>

                  {loadingSlots ? (
                      <div className="flex justify-center items-center h-40">
                          <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
                      </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
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
                                        py-4 px-2 rounded-xl border text-center transition-all relative group flex flex-col items-center justify-center
                                        ${unavailable 
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                                            : isSelected
                                                ? 'bg-green-600 text-white border-green-600 shadow-lg transform scale-105 ring-2 ring-green-300'
                                                : 'bg-white border-gray-200 hover:border-green-500 hover:bg-green-50 hover:shadow-md cursor-pointer text-gray-800'
                                        }
                                    `}
                                >
                                    <span className="text-base font-bold">{slot.startTime}</span>
                                    {unavailable ? (
                                        <span className="text-[10px] font-medium mt-1 uppercase tracking-wide flex items-center text-gray-400">
                                            {slot.isBlocked ? <Lock className="w-3 h-3 mr-1" /> : 'Booked'}
                                        </span>
                                    ) : (
                                        <span className={`text-xs mt-1 font-bold ${isSelected ? 'text-green-100' : (isPeak ? 'text-orange-500' : 'text-green-600')}`}>
                                            ₹{slot.price}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                  )}
                  
                  <div className="mt-8 flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center"><span className="w-3 h-3 bg-white border border-gray-300 rounded mr-2"></span> Available</div>
                      <div className="flex items-center"><span className="w-3 h-3 bg-green-600 rounded mr-2"></span> Selected</div>
                      <div className="flex items-center"><span className="w-3 h-3 bg-gray-200 rounded mr-2"></span> Booked</div>
                  </div>
              </div>
          </div>

          {/* RIGHT COLUMN: Booking Details (Sticky) */}
          <div className="lg:col-span-1">
              <div className="sticky top-24 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                   <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                       <h3 className="font-bold text-gray-800">Booking Details</h3>
                       {selectedSlot && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-bold">Selected</span>}
                   </div>

                   {!selectedSlot ? (
                       <div className="p-10 text-center text-gray-400 flex flex-col items-center justify-center min-h-[300px]">
                           <Calendar className="w-12 h-12 mb-4 opacity-20" />
                           <p>Please select a date and time slot from the left to proceed.</p>
                       </div>
                   ) : (
                       <div className="p-6 space-y-6 animate-fade-in">
                           {/* Summary */}
                           <div className="flex justify-between items-end border-b border-gray-100 pb-4">
                               <div>
                                   <p className="text-xs text-gray-500 uppercase font-bold">Date</p>
                                   <p className="font-medium text-gray-900">{selectedDate.toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'})}</p>
                               </div>
                               <div className="text-right">
                                   <p className="text-xs text-gray-500 uppercase font-bold">Time</p>
                                   <p className="font-medium text-gray-900">{selectedSlot.startTime} - {selectedSlot.endTime}</p>
                               </div>
                           </div>

                           {/* Form */}
                           <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                                    <input
                                    {...register("name", { required: "Name is required" })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                    placeholder="Enter full name"
                                    />
                                    {errors.name && <span className="text-red-500 text-xs">{errors.name.message}</span>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Number</label>
                                    <input
                                    type="tel"
                                    {...register("phone", { required: "Phone is required", pattern: { value: /^[0-9]{10}$/, message: "Valid 10-digit number required" } })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                    placeholder="9876543210"
                                    />
                                    {errors.phone && <span className="text-red-500 text-xs">{errors.phone.message}</span>}
                                </div>

                                {/* Compact Payment */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-sm font-bold text-gray-700">Total</span>
                                        <span className="text-xl font-extrabold text-green-600">₹{selectedSlot.price}</span>
                                    </div>
                                    
                                    <div className="text-xs text-center text-gray-500 mb-3">
                                        Pay to: <span className="font-mono bg-white px-1 rounded border border-gray-200">{upiId}</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <button type="button" onClick={() => navigator.clipboard.writeText(upiId)} className="text-xs border bg-white py-1 rounded flex items-center justify-center hover:text-green-600">
                                            <Copy className="w-3 h-3 mr-1" /> Copy ID
                                        </button>
                                        <button type="button" onClick={downloadQR} className="text-xs border bg-white py-1 rounded flex items-center justify-center hover:text-green-600">
                                            <QrCode className="w-3 h-3 mr-1" /> Get QR
                                        </button>
                                    </div>

                                    <label className={`flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer hover:bg-white transition ${screenshotFile ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                                        {screenshotPreview ? (
                                             <div className="flex items-center text-green-700 text-xs font-bold">
                                                 <CheckCircle className="w-4 h-4 mr-1" /> Screenshot Added
                                             </div>
                                        ) : (
                                            <>
                                                <Upload className="w-5 h-5 text-gray-400 mb-1" />
                                                <span className="text-xs text-gray-500">Upload Payment Proof</span>
                                            </>
                                        )}
                                        <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                                    </label>
                                </div>

                                {errorMsg && (
                                    <div className="p-3 rounded-lg text-xs bg-red-50 border border-red-200 text-red-700 font-medium flex items-start">
                                        <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" /> {errorMsg}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition shadow-lg flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                                    {submitting ? 'Processing...' : 'Confirm Booking'}
                                </button>
                           </form>
                       </div>
                   )}
              </div>
          </div>
      </div>
    </div>
  );
};