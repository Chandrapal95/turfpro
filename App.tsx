import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Navigation } from './components/Navigation';
import { BookingSystem } from './components/BookingSystem';
import { AdminDashboard } from './components/AdminDashboard';
import { ViewState, User } from './types';
import { MapPin, Phone, Mail, Star, Quote, ArrowRight, Check, ShieldCheck, Zap, Trophy, AlertTriangle, PlayCircle, Clock, Calendar, User as UserIcon } from 'lucide-react';
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
                      <div className="text-center mb-6">
                          <Trophy className="h-12 w-12 text-green-600 mx-auto" />
                          <h2 className="mt-4 text-3xl font-extrabold text-gray-900">Welcome Back</h2>
                          <p className="mt-2 text-gray-600">Sign in to manage your bookings</p>
                      </div>
                  </div>
                  <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                      <div className="bg-white py-8 px-4 shadow-xl rounded-2xl sm:px-10 border border-gray-100">
                          <form className="space-y-6" onSubmit={handleLogin}>
                              <div>
                                  <label className="block text-sm font-medium text-gray-700">Email address</label>
                                  <div className="mt-1">
                                      <input 
                                        type="email" 
                                        required 
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                        className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" 
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
                                        className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" 
                                      />
                                  </div>
                              </div>
                              
                              {loginError && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg flex items-center"><AlertTriangle className="w-4 h-4 mr-2"/>{loginError}</div>}

                              <div>
                                  <button type="submit" disabled={isLoggingIn} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-green-600 hover:bg-green-700 focus:outline-none transition">
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
                onBookingComplete={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
             />
          </div>
        );
      
      case ViewState.ADMIN:
        return user?.role === 'ADMIN' ? (
            <div className="min-h-screen bg-gray-100">
                <AdminDashboard onNavigate={setCurrentView} />
            </div>
        ) : (
            <div className="min-h-screen flex items-center justify-center text-gray-500">
                Access Denied. Please log in as Admin.
            </div>
        );

      case ViewState.GALLERY:
        const cricketImages = [
            "https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?auto=format&fit=crop&w=1200&q=80", 
            "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1589801258579-18e091f4ae2c?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1607734834519-d8576ae60ea6?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1593341646261-729988220ce6?auto=format&fit=crop&w=1200&q=80"
        ];
        return (
           <div className="bg-white min-h-screen py-16 animate-fade-in">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center mb-16">
                      <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Our Gallery</h2>
                      <p className="mt-4 text-xl text-gray-500 max-w-2xl mx-auto">Take a look at our world-class facilities, pristine turf, and electric atmosphere.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {cricketImages.map((src, idx) => (
                          <div key={idx} className="group relative aspect-w-4 aspect-h-3 rounded-2xl overflow-hidden shadow-lg cursor-pointer">
                             <img src={src} alt="Cricket Turf" className="w-full h-full object-cover transform group-hover:scale-110 transition duration-700" />
                             <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition duration-300"></div>
                          </div>
                      ))}
                  </div>
               </div>
           </div>
        );

      case ViewState.PRICING:
        return (
          <div className="bg-slate-50 min-h-screen py-16 animate-fade-in">
             <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                 <div className="text-center mb-16">
                     <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Transparent Pricing</h2>
                     <p className="mt-4 text-xl text-gray-600">Choose the slot that fits your schedule.</p>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                     {/* Standard Plan */}
                     <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 flex flex-col hover:shadow-2xl transition duration-300">
                         <div className="p-8 bg-gray-50 border-b border-gray-100">
                             <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xl font-bold text-gray-900">Day Match</h3>
                                <Clock className="w-6 h-6 text-gray-400" />
                             </div>
                             <p className="text-sm text-gray-500">Perfect for morning practice and afternoon games.</p>
                         </div>
                         <div className="p-8 flex-grow">
                             <div className="flex items-baseline mb-6">
                                 <span className="text-5xl font-extrabold text-gray-900">₹800</span>
                                 <span className="text-xl text-gray-500 ml-2">/hour</span>
                             </div>
                             <ul className="space-y-4 mb-8">
                                 <li className="flex items-center text-gray-600"><Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0"/> Premium FIFA-grade Turf</li>
                                 <li className="flex items-center text-gray-600"><Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0"/> Clean Changing Rooms</li>
                                 <li className="flex items-center text-gray-600"><Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0"/> Free RO Water</li>
                                 <li className="flex items-center text-gray-600"><Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0"/> Parking Available</li>
                             </ul>
                         </div>
                         <div className="p-8 pt-0">
                            <button onClick={() => setCurrentView(ViewState.BOOKING)} className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold hover:bg-black transition shadow-lg">Book Day Slot</button>
                         </div>
                     </div>

                     {/* Premium Plan */}
                     <div className="bg-gray-900 rounded-3xl shadow-xl overflow-hidden border border-gray-800 flex flex-col relative transform md:-translate-y-4 hover:shadow-green-500/20 hover:shadow-2xl transition duration-300">
                         <div className="absolute top-0 right-0 bg-gradient-to-l from-green-500 to-green-600 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl shadow-md">POPULAR</div>
                         <div className="p-8 bg-gray-800/50 border-b border-gray-700">
                             <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xl font-bold text-white">Night Match</h3>
                                <Zap className="w-6 h-6 text-yellow-400" />
                             </div>
                             <p className="text-sm text-gray-400">Experience the thrill under the lights.</p>
                         </div>
                         <div className="p-8 flex-grow">
                             <div className="flex items-baseline mb-6">
                                 <span className="text-5xl font-extrabold text-white">₹1200</span>
                                 <span className="text-xl text-gray-400 ml-2">/hour</span>
                             </div>
                             <ul className="space-y-4 mb-8">
                                 <li className="flex items-center text-gray-300"><Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0"/> <span className="font-semibold text-white">Professional Floodlights</span></li>
                                 <li className="flex items-center text-gray-300"><Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0"/> Music System Access</li>
                                 <li className="flex items-center text-gray-300"><Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0"/> Live Streaming Support</li>
                                 <li className="flex items-center text-gray-300"><Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0"/> Dugout Seating</li>
                             </ul>
                         </div>
                         <div className="p-8 pt-0">
                            <button onClick={() => setCurrentView(ViewState.BOOKING)} className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-xl font-bold hover:from-green-600 hover:to-green-700 transition shadow-lg shadow-green-900/50">Book Night Slot</button>
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
                      <div className="lg:text-center mb-16">
                          <h2 className="text-base text-green-600 font-bold tracking-wide uppercase">Our Story</h2>
                          <p className="mt-2 text-4xl leading-10 font-extrabold tracking-tight text-gray-900 sm:text-5xl">
                              Built by Cricketers, For Cricketers
                          </p>
                          <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
                              We started with a simple mission: to bring professional-grade sporting facilities to every enthusiast in the city.
                          </p>
                      </div>
                      
                      <div className="mt-16">
                          <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-3 md:gap-x-8 md:gap-y-10">
                              <div className="relative p-6 bg-gray-50 rounded-2xl hover:bg-green-50 transition duration-300">
                                  <dt>
                                      <div className="absolute flex items-center justify-center h-12 w-12 rounded-xl bg-green-600 text-white shadow-lg">
                                          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                                      </div>
                                      <p className="ml-16 text-xl leading-6 font-bold text-gray-900">FIFA Approved Turf</p>
                                  </dt>
                                  <dd className="mt-4 ml-16 text-base text-gray-500">
                                      We use imported, high-density artificial grass that minimizes impact on knees and ankles, allowing you to play longer and safer.
                                  </dd>
                              </div>

                              <div className="relative p-6 bg-gray-50 rounded-2xl hover:bg-green-50 transition duration-300">
                                  <dt>
                                      <div className="absolute flex items-center justify-center h-12 w-12 rounded-xl bg-green-600 text-white shadow-lg">
                                          <Zap className="h-6 w-6" aria-hidden="true" />
                                      </div>
                                      <p className="ml-16 text-xl leading-6 font-bold text-gray-900">Pro Lighting</p>
                                  </dt>
                                  <dd className="mt-4 ml-16 text-base text-gray-500">
                                      Our shadow-less LED floodlights are calibrated for cricket, ensuring you never lose sight of the ball during those intense night chases.
                                  </dd>
                              </div>

                              <div className="relative p-6 bg-gray-50 rounded-2xl hover:bg-green-50 transition duration-300">
                                  <dt>
                                      <div className="absolute flex items-center justify-center h-12 w-12 rounded-xl bg-green-600 text-white shadow-lg">
                                          <Trophy className="h-6 w-6" aria-hidden="true" />
                                      </div>
                                      <p className="ml-16 text-xl leading-6 font-bold text-gray-900">Tournaments</p>
                                  </dt>
                                  <dd className="mt-4 ml-16 text-base text-gray-500">
                                      We regularly host leagues and tournaments. Our facility is equipped with scorer tables, digital scoreboards, and spectator seating.
                                  </dd>
                              </div>
                          </dl>
                      </div>
                  </div>
              </div>
          );

      case ViewState.CONTACT:
        return (
            <div className="bg-slate-50 min-h-screen py-16 animate-fade-in">
                 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                         <h2 className="text-4xl font-extrabold text-gray-900">Get in Touch</h2>
                         <p className="mt-4 text-xl text-gray-600">Have questions? Reach out to us or visit the turf.</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Contact Form */}
                        <div className="space-y-8">
                            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100">
                                <h3 className="text-2xl font-bold mb-6 text-gray-900">Send us a Message</h3>
                                <form onSubmit={handleSubmitContact(handleContactSubmit)} className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Name</label>
                                        <input
                                            {...registerContact("name", { required: "Name is required" })}
                                            className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:ring-green-500 focus:border-green-500 bg-gray-50"
                                            placeholder="Your Name"
                                        />
                                        {contactErrors.name && <span className="text-red-500 text-xs mt-1">{contactErrors.name.message}</span>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                                        <input
                                            type="email"
                                            {...registerContact("email", { 
                                                required: "Email is required",
                                                pattern: {
                                                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                                    message: "Invalid email address"
                                                }
                                            })}
                                            className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:ring-green-500 focus:border-green-500 bg-gray-50"
                                            placeholder="you@example.com"
                                        />
                                        {contactErrors.email && <span className="text-red-500 text-xs mt-1">{contactErrors.email.message}</span>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Message</label>
                                        <textarea
                                            {...registerContact("message", { required: "Message is required" })}
                                            rows={4}
                                            className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:ring-green-500 focus:border-green-500 bg-gray-50"
                                            placeholder="How can we help?"
                                        />
                                        {contactErrors.message && <span className="text-red-500 text-xs mt-1">{contactErrors.message.message}</span>}
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={contactStatus === 'SENDING'}
                                        className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-base font-bold text-white bg-green-600 hover:bg-green-700 focus:outline-none transition transform hover:scale-[1.02]"
                                    >
                                        {contactStatus === 'SENDING' ? 'Sending...' : 'Send Message'}
                                    </button>
                                    {contactStatus === 'SUCCESS' && <div className="p-4 bg-green-50 text-green-700 rounded-xl text-center font-medium">Message sent successfully!</div>}
                                    {contactStatus === 'ERROR' && <div className="p-4 bg-red-50 text-red-700 rounded-xl text-center font-medium">Failed to send message.</div>}
                                </form>
                            </div>
                        </div>

                        {/* Map & Info */}
                        <div className="h-full space-y-8">
                            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100">
                                <h3 className="text-2xl font-bold mb-6 text-gray-900">Contact Information</h3>
                                <div className="space-y-6">
                                    <div className="flex items-start">
                                        <div className="bg-green-100 p-3 rounded-full mr-4">
                                            <MapPin className="w-6 h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-lg">Address</p>
                                            <p className="text-gray-600 leading-relaxed">123 Sports Complex, Near Central Park,<br/>Sector 5, Metropolis - 400001</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start">
                                        <div className="bg-green-100 p-3 rounded-full mr-4">
                                            <Phone className="w-6 h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-lg">Phone</p>
                                            <p className="text-gray-600 font-mono text-lg">+91 98765 43210</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start">
                                        <div className="bg-green-100 p-3 rounded-full mr-4">
                                            <Mail className="w-6 h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-lg">Email</p>
                                            <p className="text-gray-600">bookings@turfpro.com</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="h-80 bg-gray-200 rounded-3xl overflow-hidden shadow-lg relative group">
                                {/* Placeholder Map Image */}
                                <img 
                                    src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80" 
                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition duration-500" 
                                    alt="Map Location" 
                                />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl text-center transform group-hover:scale-105 transition duration-300">
                                        <MapPin className="w-10 h-10 text-red-500 mx-auto mb-2 animate-bounce" />
                                        <p className="font-bold text-gray-900">Locate Us on Maps</p>
                                        <p className="text-xs text-gray-500 mt-1">Click to Open Navigation</p>
                                    </div>
                                </div>
                                <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="absolute inset-0 z-10" aria-label="Open Maps"></a>
                            </div>
                        </div>
                    </div>
                 </div>
            </div>
        );

      case ViewState.HOME:
      default:
        return (
          <div className="animate-fade-in pb-16">
            {/* Modern Hero Section */}
            <div className="relative h-[85vh] min-h-[600px] flex items-center overflow-hidden">
               {/* Background Image with Overlay */}
               <div className="absolute inset-0 z-0">
                  <img 
                    className="w-full h-full object-cover" 
                    src="https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=2000&q=80" 
                    alt="Cricket Stadium Night" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-900/80 to-transparent"></div>
               </div>

               <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                  <div className="max-w-3xl">
                      <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-500/20 border border-green-500/30 text-green-300 text-sm font-bold mb-6 backdrop-blur-sm animate-fade-in">
                          <Star className="w-4 h-4 mr-2 text-green-400 fill-current" />
                          Rated #1 Cricket Turf in the City
                      </div>
                      <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-tight mb-6 drop-shadow-2xl">
                        Unleash Your <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">Inner Champion</span>
                      </h1>
                      <p className="mt-4 text-xl text-gray-300 max-w-2xl leading-relaxed font-light mb-10">
                        Experience the game like never before on our FIFA-approved turf. 
                        Perfect bounce, shadow-less lighting, and premium amenities waiting for your squad.
                      </p>
                      
                      <div className="flex flex-col sm:flex-row gap-4">
                         <button 
                           onClick={() => setCurrentView(ViewState.BOOKING)}
                           className="flex items-center justify-center px-8 py-4 text-lg font-bold rounded-full text-white bg-green-600 hover:bg-green-600 hover:scale-105 transition-all shadow-[0_0_20px_rgba(34,197,94,0.5)]">
                           Book Your Slot
                           <ArrowRight className="ml-2 w-5 h-5" />
                         </button>
                         <button 
                           onClick={() => setCurrentView(ViewState.GALLERY)}
                           className="flex items-center justify-center px-8 py-4 text-lg font-bold rounded-full text-white border-2 border-white/20 hover:bg-white/10 backdrop-blur-sm transition-all">
                           <PlayCircle className="ml-2 w-5 h-5 mr-2" />
                           View Gallery
                         </button>
                      </div>
                  </div>
               </div>
               
               {/* Scroll Indicator */}
               <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce text-white/50">
                  <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2">
                      <div className="w-1 h-2 bg-white rounded-full"></div>
                  </div>
               </div>
            </div>

            {/* Quick Stats Strip */}
            <div className="bg-green-600 py-6 relative z-20 shadow-lg">
                <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-around items-center text-white gap-6 text-center">
                    <div>
                        <div className="text-3xl font-extrabold">5000+</div>
                        <div className="text-sm font-medium text-green-100 opacity-80">Matches Played</div>
                    </div>
                    <div className="w-px h-10 bg-green-500 hidden sm:block"></div>
                    <div>
                        <div className="text-3xl font-extrabold">4.8/5</div>
                        <div className="text-sm font-medium text-green-100 opacity-80">Player Rating</div>
                    </div>
                    <div className="w-px h-10 bg-green-500 hidden sm:block"></div>
                    <div>
                        <div className="text-3xl font-extrabold">24/7</div>
                        <div className="text-sm font-medium text-green-100 opacity-80">Booking Support</div>
                    </div>
                </div>
            </div>

            {/* How It Works */}
            <div className="py-24 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-base font-bold text-green-600 tracking-wide uppercase">Simple Process</h2>
                        <p className="mt-2 text-4xl font-extrabold text-gray-900">How to Book Your Game</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center relative">
                        {/* Connecting Line (Desktop) */}
                        <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-0 transform -translate-y-1/2"></div>
                        
                        {[
                            { icon: Calendar, title: "Pick Date & Time", desc: "Choose from our real-time available slots." },
                            { icon: UserIcon, title: "Enter Details", desc: "Provide your team name and contact info." },
                            { icon: Check, title: "Confirm & Play", desc: "Secure your slot and get ready to win!" }
                        ].map((step, idx) => (
                            <div key={idx} className="relative z-10 bg-gray-50 p-4">
                                <div className="w-20 h-20 mx-auto bg-white rounded-full shadow-lg flex items-center justify-center border-4 border-green-500 mb-6 transform hover:scale-110 transition duration-300">
                                    <step.icon className="w-8 h-8 text-green-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
                                <p className="text-gray-500">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Features Grid */}
            <div className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-extrabold text-gray-900">Why Players Choose Us</h2>
                    </div>

                    <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
                        {[
                            { icon: Star, title: "Premium Turf", desc: "High-quality artificial grass that ensures consistent bounce and reduces injury risk." },
                            { icon: Zap, title: "Night Matches", desc: "Professional LED floodlights provide excellent visibility for late-night games." },
                            { icon: Clock, title: "Instant Booking", desc: "Seamless online booking system with instant confirmation and automated reminders." },
                            { icon: ShieldCheck, title: "Safe & Secure", desc: "24/7 CCTV surveillance and secure parking facilities for all players." },
                            { icon: Trophy, title: "Tournaments", desc: "Regular weekend tournaments with exciting cash prizes and trophies." },
                            { icon: Phone, title: "Support", desc: "Dedicated support team available to assist with any booking queries." }
                        ].map((feature, idx) => (
                             <div key={idx} className="group p-8 bg-gray-50 rounded-3xl border border-gray-100 hover:shadow-xl hover:bg-white transition duration-300">
                                <div className="inline-flex items-center justify-center p-3 bg-green-100 rounded-xl mb-6 group-hover:bg-green-600 transition duration-300">
                                    <feature.icon className="h-6 w-6 text-green-600 group-hover:text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                                <p className="text-gray-500 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Reviews Section */}
            <div className="bg-gray-900 py-24 relative overflow-hidden">
                 {/* Decorative background elements */}
                 <div className="absolute top-0 left-0 w-64 h-64 bg-green-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
                 <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>

                 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                     <h2 className="text-3xl md:text-4xl font-extrabold text-white text-center mb-16">What Captains Are Saying</h2>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                         {reviews.map((review) => (
                             <div key={review.id} className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-8 shadow-lg border border-gray-700/50 hover:border-green-500/50 transition duration-300">
                                 <div className="flex items-center mb-6">
                                     {[...Array(5)].map((_, i) => (
                                         <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-600'}`} />
                                     ))}
                                 </div>
                                 <Quote className="text-gray-600 mb-4 w-8 h-8 opacity-50" />
                                 <p className="text-gray-300 italic mb-6 leading-relaxed">"{review.comment}"</p>
                                 <div className="flex items-center pt-4 border-t border-gray-700/50">
                                     <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white font-bold shadow-lg mr-3">
                                         {review.user.charAt(0)}
                                     </div>
                                     <div>
                                         <p className="text-white font-bold text-sm">{review.user}</p>
                                         <p className="text-xs text-gray-500">Verified Player</p>
                                     </div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
            </div>
            
            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <div className="flex items-center mb-6 md:mb-0">
                            <Trophy className="h-8 w-8 text-green-600 mr-2" />
                            <div className="flex flex-col">
                                <span className="font-extrabold text-2xl text-gray-900 tracking-tight">Turf<span className="text-green-600">Pro</span></span>
                                <span className="text-xs text-gray-400 font-medium tracking-widest">SPORTS ARENA</span>
                            </div>
                        </div>
                        <div className="flex space-x-8 mb-6 md:mb-0">
                             {['Home', 'About', 'Pricing', 'Gallery', 'Contact'].map((item) => (
                                 <button key={item} onClick={() => setCurrentView(ViewState[item.toUpperCase() as keyof typeof ViewState])} className="text-gray-500 hover:text-green-600 transition text-sm font-medium">
                                     {item}
                                 </button>
                             ))}
                        </div>
                        <div className="text-gray-400 text-sm">
                            &copy; {new Date().getFullYear()} TurfPro Sports. <br className="hidden md:block"/>All rights reserved.
                        </div>
                    </div>
                </div>
            </footer>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-white relative font-sans selection:bg-green-100 selection:text-green-800">
      {!isConfigured && (
          <div className="bg-yellow-500 text-white text-center py-3 px-4 font-bold sticky top-0 z-[100] shadow-md flex items-center justify-center text-sm">
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