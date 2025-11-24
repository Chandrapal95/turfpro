import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { TimeSlot } from '../types';
import { getDayData, createBooking, FORMSPREE_URL } from '../services/api';
import { Calendar, Clock, CheckCircle, Lock, Trophy, Loader2, QrCode, Upload, Download, Copy, AlertTriangle, X, AlertCircle } from 'lucide-react';

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
  const [bookingStep, setBookingStep] = useState<'SLOTS' | 'FORM' | 'CONFIRMATION'>('SLOTS');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Data from Google Sheets
  const [bookedSlotIds, setBookedSlotIds] = useState<string[]>([]);
  const [blockedSlotIds, setBlockedSlotIds] = useState<string[]>([]);
  const [pricing, setPricing] = useState({ basePrice: 800, peakPrice: 1200 });
  const PEAK_START_HOUR = 18;

  // React Hook Form
  const { register, handleSubmit, formState: { errors }, reset } = useForm<BookingFormData>();
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  // --- CONFIG: REPLACE THESE WITH YOUR ACTUAL DETAILS ---
  const UPI_ID = "turfpro@upi";
  const QR_IMAGE_URL = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=" + UPI_ID + "&pn=TurfPro"; 

  // Fetch Availability when Date changes
  useEffect(() => {
      fetchAvailability();
  }, [selectedDate]);

  const fetchAvailability = async () => {
      setLoadingSlots(true);
      const dateKey = selectedDate.toISOString().split('T')[0];
      
      const data = await getDayData(dateKey);
      setBookedSlotIds(data.booked || []);
      setBlockedSlotIds(data.blocked || []);
      if(data.pricing && data.pricing.basePrice) {
          setPricing({ basePrice: data.pricing.basePrice, peakPrice: data.pricing.peakPrice });
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
        const isPeak = hour >= PEAK_START_HOUR;
        
        let price = isPeak ? pricing.peakPrice : pricing.basePrice;
        if (isWeekend) price = Math.round(price * 1.2); 

        return {
            id: slotId,
            startTime: `${hour.toString().padStart(2, '0')}:00`,
            endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
            price: price,
            isBooked: bookedSlotIds.includes(slotId),
            isBlocked: blockedSlotIds.includes(slotId),
            isPending: false 
        };
    });
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    if (slot.isBooked || slot.isBlocked) return;
    setSelectedSlot(slot);
    setBookingStep('FORM');
    setErrorMsg('');
    setScreenshotFile(null);
    setScreenshotPreview(null);
    reset();
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
             // Preview only for now, compression happens on submit
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
          date: selectedDate.toISOString().split('T')[0],
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
            console.error("Booking failed:", result.message);
            setErrorMsg(result.message || "Booking failed. Please try again.");
            setSubmitting(false);
            fetchAvailability(); 
            return;
        }

        // 2. Submit to Formspree (Backup)
        try {
            await fetch(FORMSPREE_URL, {
                method: "POST",
                headers: {"Content-Type": "application/json", "Accept": "application/json"},
                body: JSON.stringify({
                    name: data.name,
                    phone: data.phone,
                    _subject: `Booking Request: ${bookingPayload.date} @ ${selectedSlot.startTime}`,
                    slot: selectedSlot.startTime,
                    price: bookingPayload.amount,
                    bookingId: result.bookingId,
                    status: 'PENDING APPROVAL'
                })
            });
        } catch (e) { console.error("Email trigger failed", e); }

        setSubmitting(false);
        setBookingStep('CONFIRMATION');
        if(onBookingComplete) onBookingComplete();

    } catch (error) {
        console.error(error);
        setErrorMsg("Error processing booking. Please try again.");
        setSubmitting(false);
    }
  };

  const handleCopyUPI = () => {
      navigator.clipboard.writeText(UPI_ID);
      alert("UPI ID Copied!");
  };

  const downloadQR = () => {
      const link = document.createElement('a');
      link.href = QR_IMAGE_URL;
      link.download = 'TurfPro_UPI_QR.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-green-600 p-8 text-white text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        <h2 className="text-3xl font-extrabold mb-2 relative z-10">Book Your Turf</h2>
        <p className="opacity-90 relative z-10 font-medium">Live Scheduling System</p>
      </div>

      <div className="p-4 sm:p-8">
        
        {/* Step 1: Slot Selection */}
        {bookingStep === 'SLOTS' && (
          <div className="space-y-8 animate-fade-in">
            {/* Date Selector */}
            <div>
                 <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-green-600" /> Select Date
                 </h3>
                 <div className="flex space-x-3 overflow-x-auto pb-4 scrollbar-hide py-2">
                    {dates.map((date) => {
                        const isSelected = date.toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0];
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

            {/* Time Slots Grid */}
            <div className="min-h-[300px]">
              <div className="flex justify-between items-end mb-4">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-green-600" /> Available Slots
                  </h3>
                  {loadingSlots && <span className="text-xs text-green-600 flex items-center"><Loader2 className="w-3 h-3 animate-spin mr-1"/> checking...</span>}
              </div>

              {loadingSlots ? (
                  <div className="flex justify-center items-center h-40">
                      <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
                  </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {getSlotsForDate().map((slot) => {
                        const unavailable = slot.isBooked || slot.isBlocked;
                        const isPeak = slot.price > pricing.basePrice;
                        return (
                            <button
                                key={slot.id}
                                disabled={unavailable}
                                onClick={() => handleSlotSelect(slot)}
                                className={`
                                    py-3 px-1 rounded-xl border text-center transition-all relative group
                                    ${unavailable 
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                                        : isPeak 
                                            ? 'bg-orange-50/50 border-orange-200 hover:border-orange-500 hover:shadow-md cursor-pointer text-gray-800'
                                            : 'bg-white border-gray-200 hover:border-green-500 hover:shadow-md cursor-pointer text-gray-800'
                                    }
                                `}
                            >
                                <div className="text-sm font-bold">{slot.startTime}</div>
                                {unavailable ? (
                                    <div className="text-[10px] font-medium mt-1 uppercase tracking-wide flex justify-center items-center text-gray-500">
                                        {slot.isBlocked ? <Lock className="w-3 h-3" /> : 'Booked'}
                                    </div>
                                ) : (
                                    <div className={`text-xs mt-1 font-bold ${isPeak ? 'text-orange-600' : 'text-green-600'}`}>
                                        ₹{slot.price}
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
              )}
            </div>
            
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start">
               <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
               <p className="text-sm text-blue-800 leading-relaxed">
                   <strong>Note:</strong> Peak hours ({PEAK_START_HOUR}:00 onwards) and Weekends have higher rates.
               </p>
            </div>
          </div>
        )}

        {/* Step 2: Customer Details & Payment */}
        {bookingStep === 'FORM' && selectedSlot && (
          <div className="max-w-lg mx-auto animate-fade-in">
            <button onClick={() => setBookingStep('SLOTS')} className="mb-6 text-sm text-gray-500 hover:text-green-600 flex items-center transition font-medium">
                &larr; Back to Slots
            </button>
            
            <div className="bg-gray-50 rounded-xl p-6 mb-8 border border-gray-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Trophy className="w-24 h-24 text-gray-900" />
                </div>
                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Booking Summary</h4>
                <div className="space-y-1 relative z-10">
                    <div className="flex justify-between items-end">
                        <span className="text-2xl font-bold text-gray-900">{selectedDate.toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'})}</span>
                    </div>
                    <div className="text-lg text-gray-700 font-medium">
                        {selectedSlot.startTime} - {selectedSlot.endTime}
                    </div>
                    <div className="pt-4 mt-4 border-t border-gray-200 flex justify-between items-center">
                        <span className="text-gray-600 font-medium">Amount to Pay</span>
                        <span className="text-3xl font-extrabold text-green-600">₹{selectedSlot.price}</span>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Personal Info */}
              <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
                    <input
                      {...register("name", { required: "Name is required" })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      placeholder="Enter full name"
                    />
                    {errors.name && <span className="text-red-500 text-xs">{errors.name.message}</span>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                    <input
                      type="tel"
                      {...register("phone", { 
                          required: "Phone is required",
                          pattern: {
                              value: /^[0-9]{10}$/,
                              message: "Please enter a valid 10-digit phone number"
                          }
                      })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      placeholder="e.g. 9876543210"
                    />
                     {errors.phone && <span className="text-red-500 text-xs">{errors.phone.message}</span>}
                  </div>
              </div>

              {/* Manual UPI Payment UI */}
              <div className="bg-white border-2 border-green-100 rounded-xl p-6">
                  <h4 className="font-bold text-gray-900 mb-4 flex items-center">
                    <QrCode className="w-5 h-5 mr-2 text-green-600" /> Scan & Pay
                  </h4>
                  
                  <div className="flex flex-col items-center mb-6">
                      <img src={QR_IMAGE_URL} alt="UPI QR" className="w-48 h-48 border rounded-lg shadow-sm mb-4" />
                      <button type="button" onClick={downloadQR} className="text-xs flex items-center text-gray-600 hover:text-green-600 font-medium border px-3 py-1.5 rounded-full">
                          <Download className="w-3 h-3 mr-1" /> Download QR
                      </button>
                  </div>

                  <div className="flex items-center space-x-2 bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4">
                      <div className="flex-1 font-mono text-sm text-gray-700 text-center">{UPI_ID}</div>
                      <button type="button" onClick={handleCopyUPI} className="p-2 text-gray-500 hover:text-green-600">
                          <Copy className="w-4 h-4" />
                      </button>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Upload Payment Screenshot *</label>
                        <div className="flex items-center justify-center w-full">
                            <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 ${screenshotFile ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                                <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4">
                                    {screenshotPreview ? (
                                        <div className="relative group">
                                            <img src={screenshotPreview} alt="Preview" className="h-20 object-contain rounded" />
                                            <div className="mt-2 text-xs text-green-600 font-medium flex items-center">
                                                <CheckCircle className="w-3 h-3 mr-1" /> Ready
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload className="w-8 h-8 text-gray-400 mb-1" />
                                            <p className="text-xs text-gray-500">Click to upload screenshot</p>
                                        </>
                                    )}
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                            </label>
                        </div>
                      </div>

                      <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">UPI Transaction ID (Optional)</label>
                          <input
                            type="text"
                            {...register("transactionId")}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
                            placeholder="Enter UTR / Ref No."
                          />
                      </div>
                  </div>
              </div>

              {errorMsg && (
                  <div className="p-4 rounded-md text-sm bg-red-50 border border-red-200 text-red-700 font-medium">
                      {errorMsg}
                  </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-black transition shadow-xl mt-2 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
              >
                {submitting ? (
                   <span className="flex items-center">
                     <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                     Compressing & Uploading...
                   </span>
                ) : (
                    `Submit Booking Request`
                )}
              </button>
              
              <p className="text-xs text-center text-gray-500 mt-2">
                  <AlertTriangle className="w-3 h-3 inline mr-1 text-orange-500" />
                  Your slot will be held for 4 hours until Admin confirms payment.
              </p>
            </form>
          </div>
        )}

        {/* Step 3: Success */}
        {bookingStep === 'CONFIRMATION' && (
           <div className="text-center py-12 animate-fade-in">
              <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-yellow-100 mb-8">
                <Clock className="h-12 w-12 text-yellow-600 animate-pulse" />
              </div>
              <h3 className="text-3xl font-extrabold text-gray-900 mb-4">Request Submitted!</h3>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                  Your booking request for <span className="font-bold text-gray-800">{selectedSlot?.startTime}</span> on <span className="font-bold text-gray-800">{selectedDate.toLocaleDateString()}</span> has been received.
                  <br/><br/>
                  <span className="text-sm bg-yellow-50 text-yellow-800 px-3 py-1 rounded border border-yellow-200">
                      Status: Pending Approval
                  </span>
                  <br/><br/>
                  We will verify your payment and confirm your slot via SMS/WhatsApp within 4 hours.
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <button 
                    onClick={() => {
                        setBookingStep('SLOTS');
                        setSelectedSlot(null);
                        setScreenshotFile(null);
                        setScreenshotPreview(null);
                        reset();
                        if(onBookingComplete) onBookingComplete();
                    }}
                    className="bg-gray-800 text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-900 transition shadow">
                    Return to Home
                  </button>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};