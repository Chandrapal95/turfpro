import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Navigation } from './components/Navigation';
import { BookingSystem } from './components/BookingSystem';
import { AdminDashboard } from './components/AdminDashboard';
import { ViewState, User } from './types';
import { MapPin, Phone, Mail, Star, Quote, ArrowRight, Instagram, Facebook, Twitter, Send, Check, ShieldCheck, Zap, Trophy, AlertTriangle } from 'lucide-react';
import { getReviews, getCurrentUser, loginUser, logoutUser } from './services/storageService';
import { GOOGLE_SCRIPT_URL } from './services/api';

interface ContactFormData {
    name: string;
    email: string;
    message: string;
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.HOME);
  const [user, setUser] = useState<User | null>(null);
  const [reviews, setReviews] = useState(getReviews());
  const [isConfigured, setIsConfigured] = useState(true);
  
  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Contact Form State
  const { register: registerContact, handleSubmit: handleSubmitContact, reset: resetContact, formState: { errors: contactErrors } } = useForm<ContactFormData>();
  const [contactStatus, setContactStatus] = useState<'IDLE' | 'SENDING' | 'SUCCESS' | 'ERROR'>('IDLE');

  useEffect(() => {
      const currentUser = getCurrentUser();
      setUser(currentUser);
      
      // Check if backend URL is configured
      if (GOOGLE_SCRIPT_URL.includes('PASTE_YOUR') || GOOGLE_SCRIPT_URL === '') {
          setIsConfigured(false);
      }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoggingIn(true);
      setLoginError('');
      try {
          const loggedInUser = await loginUser(loginEmail, loginPass);
          setUser(loggedInUser);
          setCurrentView(ViewState.HOME);
      } catch (err) {
          setLoginError('Invalid email or password');
      } finally {
          setIsLoggingIn(false);
      }
  };

  const handleLogout = () => {
      setUser(null);
      setCurrentView(ViewState.HOME);
  };

  const handleContactSubmit = async (data: ContactFormData) => {
    setContactStatus('SENDING');
    try {
        await fetch("https://formspree.io/f/movbprqy", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
                ...data,
                _subject: 'New Contact Message - TurfPro',
                _replyto: data.email
            })
        });
        setContactStatus('SUCCESS');
        resetContact();
    } catch (error) {
        setContactStatus('ERROR');
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case ViewState.LOGIN:
          return (
              <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                  <div className="sm:mx-auto sm:w-full sm:max-w-md">
                      <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
                      <p className="mt-2 text-center text-sm text-gray-600">
                          Or <a href="#" className="font-medium text-green-600 hover:text-green-500">create a new account</a>
                      </p>
                  </div>
                  <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                      <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                          <form className="space-y-6" onSubmit={handleLogin}>
                              <div>
                                  <label className="block text-sm font-medium text-gray-700">Email address</label>
                                  <div className="mt-1">
                                      <input 
                                        type="email" 
                                        required 
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" 
                                      />
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-gray-700">Password</label>
                                  <div className="mt-1">
                                      <input 
                                        type="password" 
                                        required 
                                        value={loginPass}
                                        onChange={(e) => setLoginPass(e.target.value)}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" 
                                      />
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500">
                                      Hint: Use <b>admin@turfpro.com</b> / <b>1234</b> for Admin access.
                                  </div>
                              </div>
                              
                              {loginError && <div className="text-red-500 text-sm">{loginError}</div>}

                              <div>
                                  <button type="submit" disabled={isLoggingIn} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                                      {isLoggingIn ? 'Signing in...' : 'Sign in'}
                                  </button>
                              </div>
                          </form>
                      </div>
                  </div>
              </div>
          );

      case ViewState.BOOKING:
        return (
          <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6">
             <BookingSystem 
                onRequestLogin={() => setCurrentView(ViewState.LOGIN)}
                onBookingComplete={() => {/* Optional: Redirect or Toast */}} 
             />
          </div>
        );
      
      case ViewState.ADMIN:
        return user?.role === 'ADMIN' ? <AdminDashboard /> : (
            <div className="min-h-screen flex items-center justify-center text-gray-500">
                Access Denied. Please log in as Admin.
            </div>
        );

      case ViewState.GALLERY:
        const cricketImages = [
            "https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?auto=format&fit=crop&w=800&q=80", 
            "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1589801258579-18e091f4ae2c?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1607734834519-d8576ae60ea6?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1593341646261-729988220ce6?auto=format&fit=crop&w=800&q=80"
        ];
        return (
           <div className="bg-white min-h-screen py-12 animate-fade-in">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center mb-12">
                      <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">Our Gallery</h2>
                      <p className="mt-4 text-xl text-gray-500">Experience the best turf quality in the city.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {cricketImages.map((src, idx) => (
                          <div key={idx} className="aspect-w-4 aspect-h-3 overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 group">
                             <img src={src} alt="Cricket Turf" className="w-full h-full object-cover transform group-hover:scale-110 transition duration-700" />
                          </div>
                      ))}
                  </div>
               </div>
           </div>
        );

      case ViewState.PRICING:
        return (
          <div className="bg-gray-50 min-h-screen py-12 animate-fade-in">
             <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                 <div className="text-center mb-16">
                     <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">Simple, Transparent Pricing</h2>
                     <p className="mt-4 text-lg text-gray-600">No hidden fees. Pay for what you play.</p>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                     {/* Standard Plan */}
                     <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 transform hover:scale-105 transition duration-300">
                         <div className="p-8 bg-gray-50 border-b border-gray-100">
                             <h3 className="text-xl font-bold text-gray-900">Day Hours</h3>
                             <p className="text-sm text-gray-500 mt-1">6:00 AM - 6:00 PM</p>
                         </div>
                         <div className="p-8">
                             <div className="flex items-baseline mb-4">
                                 <span className="text-5xl font-extrabold text-gray-900">₹800</span>
                                 <span className="text-xl text-gray-500 ml-2">/hour</span>
                             </div>
                             <ul className="space-y-4 mb-8">
                                 <li className="flex items-center text-gray-600"><Check className="w-5 h-5 text-green-500 mr-2"/> Premium Grass Turf</li>
                                 <li className="flex items-center text-gray-600"><Check className="w-5 h-5 text-green-500 mr-2"/> Changing Rooms</li>
                                 <li className="flex items-center text-gray-600"><Check className="w-5 h-5 text-green-500 mr-2"/> Free Parking</li>
                             </ul>
                             <button onClick={() => setCurrentView(ViewState.BOOKING)} className="w-full bg-gray-800 text-white py-3 rounded-lg font-bold hover:bg-gray-900 transition">Book Now</button>
                         </div>
                     </div>

                     {/* Premium Plan */}
                     <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-green-500 relative transform hover:scale-105 transition duration-300">
                         <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">POPULAR</div>
                         <div className="p-8 bg-green-50 border-b border-green-100">
                             <h3 className="text-xl font-bold text-gray-900">Peak Hours</h3>
                             <p className="text-sm text-green-700 mt-1">6:00 PM - 11:00 PM</p>
                         </div>
                         <div className="p-8">
                             <div className="flex items-baseline mb-4">
                                 <span className="text-5xl font-extrabold text-gray-900">₹1200</span>
                                 <span className="text-xl text-gray-500 ml-2">/hour</span>
                             </div>
                             <ul className="space-y-4 mb-8">
                                 <li className="flex items-center text-gray-600"><Check className="w-5 h-5 text-green-500 mr-2"/> <span className="font-bold">LED Floodlights</span></li>
                                 <li className="flex items-center text-gray-600"><Check className="w-5 h-5 text-green-500 mr-2"/> Music System Access</li>
                                 <li className="flex items-center text-gray-600"><Check className="w-5 h-5 text-green-500 mr-2"/> Dugout Seating</li>
                             </ul>
                             <button onClick={() => setCurrentView(ViewState.BOOKING)} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-lg">Book Premium Slot</button>
                         </div>
                     </div>
                 </div>
             </div>
          </div>
        );

      case ViewState.ABOUT:
          return (
              <div className="bg-white min-h-screen py-16 animate-fade-in">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                      <div className="lg:text-center mb-12">
                          <h2 className="text-base text-green-600 font-semibold tracking-wide uppercase">Our Story</h2>
                          <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                              Built by Cricketers, For Cricketers
                          </p>
                          <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
                              TurfPro was established in 2023 with a mission to provide professional-grade sporting facilities to enthusiasts and aspiring athletes.
                          </p>
                      </div>
                      
                      <div className="mt-10">
                          <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
                              <div className="relative">
                                  <dt>
                                      <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white">
                                          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                                      </div>
                                      <p className="ml-16 text-lg leading-6 font-medium text-gray-900">FIFA Approved Turf</p>
                                  </dt>
                                  <dd className="mt-2 ml-16 text-base text-gray-500">
                                      We use imported, high-density artificial grass that minimizes impact on knees and ankles.
                                  </dd>
                              </div>
                              <div className="relative">
                                  <dt>
                                      <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white">
                                          <Zap className="h-6 w-6" aria-hidden="true" />
                                      </div>
                                      <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Professional Lighting</p>
                                  </dt>
                                  <dd className="mt-2 ml-16 text-base text-gray-500">
                                      Shadow-less LED floodlights ensure perfect visibility for fast-paced night matches.
                                  </dd>
                              </div>
                          </dl>
                      </div>
                  </div>
              </div>
          );

      case ViewState.CONTACT:
        return (
            <div className="bg-gray-50 min-h-screen py-12 animate-fade-in">
                 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                         <h2 className="text-3xl font-bold text-gray-900">Get in Touch</h2>
                         <p className="mt-4 text-gray-600">Have questions? Reach out to us or visit the turf.</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Contact Form */}
                        <div className="space-y-8">
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-xl font-bold mb-6">Send us a Message</h3>
                                <form onSubmit={handleSubmitContact(handleContactSubmit)} className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Name</label>
                                        <input
                                            {...registerContact("name", { required: "Name is required" })}
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500"
                                        />
                                        {contactErrors.name && <span className="text-red-500 text-xs">{contactErrors.name.message}</span>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Email</label>
                                        <input
                                            type="email"
                                            {...registerContact("email", { 
                                                required: "Email is required",
                                                pattern: {
                                                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                                    message: "Invalid email address"
                                                }
                                            })}
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500"
                                        />
                                        {contactErrors.email && <span className="text-red-500 text-xs">{contactErrors.email.message}</span>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Message</label>
                                        <textarea
                                            {...registerContact("message", { required: "Message is required" })}
                                            rows={4}
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500"
                                        />
                                        {contactErrors.message && <span className="text-red-500 text-xs">{contactErrors.message.message}</span>}
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={contactStatus === 'SENDING'}
                                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none"
                                    >
                                        {contactStatus === 'SENDING' ? 'Sending...' : 'Send Message'}
                                    </button>
                                    {contactStatus === 'SUCCESS' && <p className="text-green-600 text-sm text-center">Message sent successfully!</p>}
                                    {contactStatus === 'ERROR' && <p className="text-red-600 text-sm text-center">Failed to send message.</p>}
                                </form>
                            </div>
                        </div>

                        {/* Map & Info */}
                        <div className="h-full space-y-8">
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-xl font-bold mb-6">Contact Information</h3>
                                <div className="space-y-6">
                                    <div className="flex items-start">
                                        <MapPin className="w-6 h-6 text-green-600 mt-1 mr-4" />
                                        <div>
                                            <p className="font-medium text-gray-900">Address</p>
                                            <p className="text-gray-600">123 Sports Complex, Near Central Park,<br/>Sector 5, Metropolis - 400001</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start">
                                        <Phone className="w-6 h-6 text-green-600 mt-1 mr-4" />
                                        <div>
                                            <p className="font-medium text-gray-900">Phone</p>
                                            <p className="text-gray-600">+91 98765 43210</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start">
                                        <Mail className="w-6 h-6 text-green-600 mt-1 mr-4" />
                                        <div>
                                            <p className="font-medium text-gray-900">Email</p>
                                            <p className="text-gray-600">bookings@turfpro.com</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="h-64 bg-white rounded-2xl flex items-center justify-center relative overflow-hidden shadow-sm border border-gray-200">
                                <div className="absolute inset-0 bg-cover bg-center opacity-90" style={{backgroundImage: "url('https://images.unsplash.com/photo-1593341646261-729988220ce6?auto=format&fit=crop&w=800&q=80')"}}></div>
                                <div className="relative z-10 text-center bg-white p-6 rounded-xl shadow-xl">
                                    <MapPin className="w-10 h-10 text-red-500 mx-auto mb-2 animate-bounce" />
                                    <p className="font-bold text-gray-800">Google Map Integration</p>
                                    <p className="text-xs text-gray-500 mt-1">(Geolocation Enabled)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                 </div>
            </div>
        );

      case ViewState.HOME:
      default:
        return (
          <div className="animate-fade-in">
            {/* Hero Section */}
            <div className="relative bg-gray-900 h-[600px] overflow-hidden">
               <div className="absolute inset-0">
                  <img 
                    className="w-full h-full object-cover opacity-60 transform scale-105" 
                    src="https://images.unsplash.com/photo-1631194758628-71ec7c35137e?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80" 
                    alt="Cricket Stadium Night" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent"></div>
               </div>
               <div className="relative max-w-7xl mx-auto px-4 py-24 sm:px-6 lg:px-8 h-full flex flex-col justify-center">
                  <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-6 drop-shadow-lg">
                    Play Like A <span className="text-green-500">Pro</span>
                  </h1>
                  <p className="mt-4 text-xl text-gray-200 max-w-2xl drop-shadow-md">
                    Premium approved grass, floodlights, and professional amenities. 
                    Book your slot now and experience cricket like never before.
                  </p>
                  <div className="mt-10 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                     <button 
                       onClick={() => setCurrentView(ViewState.BOOKING)}
                       className="px-8 py-3 border border-transparent text-base font-medium rounded-full text-white bg-green-600 hover:bg-green-700 md:text-lg md:px-10 shadow-lg hover:shadow-green-500/50 transition transform hover:scale-105">
                       Book Now
                     </button>
                     <button 
                       onClick={() => setCurrentView(ViewState.GALLERY)}
                       className="px-8 py-3 border border-white text-base font-medium rounded-full text-white hover:bg-white hover:text-gray-900 md:text-lg md:px-10 transition backdrop-blur-sm bg-white/10">
                       View Gallery
                     </button>
                  </div>
               </div>
            </div>

            {/* Features */}
            <div className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h2 className="text-base font-semibold text-green-600 tracking-wide uppercase">Why Choose Us</h2>
                        <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                            World-Class Facilities
                        </p>
                    </div>

                    <div className="mt-10">
                        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="pt-6">
                                <div className="flow-root bg-gray-50 rounded-2xl px-6 pb-8 h-full border border-gray-100 hover:shadow-lg transition">
                                    <div className="-mt-6">
                                        <div className="inline-flex items-center justify-center p-3 bg-green-500 rounded-xl shadow-lg">
                                            <Star className="h-6 w-6 text-white" />
                                        </div>
                                        <h3 className="mt-8 text-lg font-bold text-gray-900 tracking-tight">Premium Turf</h3>
                                        <p className="mt-5 text-base text-gray-500">
                                            High-quality artificial grass that ensures consistent bounce and reduces injury risk.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6">
                                <div className="flow-root bg-gray-50 rounded-2xl px-6 pb-8 h-full border border-gray-100 hover:shadow-lg transition">
                                    <div className="-mt-6">
                                        <div className="inline-flex items-center justify-center p-3 bg-green-500 rounded-xl shadow-lg">
                                            <Quote className="h-6 w-6 text-white" />
                                        </div>
                                        <h3 className="mt-8 text-lg font-bold text-gray-900 tracking-tight">Night Matches</h3>
                                        <p className="mt-5 text-base text-gray-500">
                                            Professional LED floodlights provide excellent visibility for late-night games.
                                        </p>
                                    </div>
                                </div>
                            </div>

                             <div className="pt-6">
                                <div className="flow-root bg-gray-50 rounded-2xl px-6 pb-8 h-full border border-gray-100 hover:shadow-lg transition">
                                    <div className="-mt-6">
                                        <div className="inline-flex items-center justify-center p-3 bg-green-500 rounded-xl shadow-lg">
                                            <ArrowRight className="h-6 w-6 text-white" />
                                        </div>
                                        <h3 className="mt-8 text-lg font-bold text-gray-900 tracking-tight">Instant Booking</h3>
                                        <p className="mt-5 text-base text-gray-500">
                                            Seamless online booking system with instant confirmation and automated reminders.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reviews */}
            <div className="bg-gray-900 py-24 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
                 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                     <h2 className="text-3xl font-extrabold text-white text-center mb-12">Player Reviews</h2>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                         {reviews.map((review) => (
                             <div key={review.id} className="bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-700 hover:border-green-500 transition duration-300">
                                 <div className="flex items-center mb-4">
                                     {[...Array(5)].map((_, i) => (
                                         <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-600'}`} />
                                     ))}
                                 </div>
                                 <p className="text-gray-300 italic mb-6 leading-relaxed">"{review.comment}"</p>
                                 <div className="flex items-center">
                                     <div className="h-8 w-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-xs mr-3">
                                         {review.user.charAt(0)}
                                     </div>
                                     <p className="text-white font-bold text-sm">{review.user}</p>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
            </div>
            
            {/* Footer */}
            <footer className="bg-gray-50 border-t border-gray-200 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
                    <div className="flex items-center mb-4 md:mb-0">
                        <Trophy className="h-6 w-6 text-green-600 mr-2" />
                        <span className="font-bold text-xl text-gray-900">Turf<span className="text-green-600">Pro</span></span>
                    </div>
                    <div className="text-gray-500 text-sm">
                        &copy; 2023 TurfPro Sports. All rights reserved.
                    </div>
                </div>
            </footer>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-white relative">
      {!isConfigured && (
          <div className="bg-yellow-500 text-white text-center py-2 px-4 font-bold sticky top-0 z-[100] shadow-md flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              SETUP REQUIRED: Please configure the Google Apps Script URL in services/api.ts
          </div>
      )}
      <Navigation 
        currentView={currentView} 
        onChangeView={setCurrentView} 
        user={user}
        onLogout={handleLogout}
      />
      {renderContent()}
    </div>
  );
};

export default App;