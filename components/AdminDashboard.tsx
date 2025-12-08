import React, { useState, useEffect } from 'react';
import { getAdminData, toggleBlockSlot, updatePricing, approveBooking, rejectBooking } from '../services/api';
import { generateMarketingCopy, analyzeBusinessInsights } from '../services/geminiService';
import { Booking, PricingConfig } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Calendar as CalendarIcon, DollarSign, Lock, RefreshCw, Check, X, Image, Ban, Loader2, Search, Filter, Sparkles, Download, Copy, ExternalLink, BrainCircuit, Settings, CreditCard, Clock } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'BOOKINGS' | 'SETTINGS' | 'AI_LAB'>('DASHBOARD');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Filtering & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // AI State
  const [aiInsight, setAiInsight] = useState<string>('');
  const [marketingCopy, setMarketingCopy] = useState<string>('');
  const [generatingAI, setGeneratingAI] = useState(false);

  // Settings State
  const [config, setConfig] = useState<PricingConfig>({
      basePrice: 800,
      peakPrice: 1200,
      peakStartHour: 18,
      upiId: 'turfpro@upi'
  });
  const [blockedSlots, setBlockedSlots] = useState<any[]>([]);
  const [blockDate, setBlockDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    const data = await getAdminData();
    setBookings(data.bookings || []);
    setBlockedSlots(data.blocked || []);
    
    // Load config if available
    if (data.config) {
        setConfig(prev => ({
            ...prev,
            ...data.config
        }));
    }
    setLoading(false);
  };

  // Stats Calculation
  const totalRevenue = bookings.reduce((acc, curr) => curr.Status === 'CONFIRMED' ? acc + (Number(curr.Amount) || 0) : acc, 0);
  const confirmedBookings = bookings.filter(b => b.Status === 'CONFIRMED').length;
  const pendingBookings = bookings.filter(b => b.Status === 'PENDING').length;
  
  const getLast7DaysData = () => {
    const data: Record<string, number> = {};
    bookings.forEach(b => {
      if (b.Status === 'CONFIRMED') {
         data[b.Date] = (data[b.Date] || 0) + (Number(b.Amount) || 0);
      }
    });
    return Object.keys(data).slice(-7).map(date => ({
       name: date,
       revenue: data[date]
    }));
  };

  // Handlers
  const handleSaveSettings = async () => {
      setLoading(true);
      try {
        await updatePricing('basePrice', Number(config.basePrice));
        await updatePricing('peakPrice', Number(config.peakPrice));
        await updatePricing('peakStartHour', Number(config.peakStartHour));
        await updatePricing('upiId', config.upiId);
        alert("Settings saved successfully!");
      } catch(e) {
          alert("Failed to save settings.");
      }
      setLoading(false);
  };

  const handleToggleBlock = async (slotId: string) => {
      setLoading(true);
      await toggleBlockSlot(blockDate, slotId);
      await refreshData();
      setLoading(false);
  };

  const handleApprove = async (id: string) => {
      if(!window.confirm("Confirm this booking? This will mark the slot as booked.")) return;
      setActionLoading(id);
      await approveBooking(id);
      await refreshData();
      setActionLoading(null);
  };

  const handleReject = async (id: string) => {
      if(!window.confirm("Reject this booking? This action cannot be undone.")) return;
      setActionLoading(id);
      await rejectBooking(id);
      await refreshData();
      setActionLoading(null);
  };

  const handleExportCSV = () => {
      const headers = ['BookingId', 'Date', 'Slot', 'Name', 'Phone', 'Amount', 'Status', 'Timestamp'];
      const csvContent = [
          headers.join(','),
          ...bookings.map(b => [b.BookingId, b.Date, b.Slot, b.Name, b.Phone, b.Amount, b.Status, b.Timestamp].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookings_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
  };

  // AI Handlers
  const runAIAnalysis = async () => {
      if(!process.env.API_KEY) {
          alert("Please configure your Gemini API Key in the environment variables.");
          return;
      }
      setGeneratingAI(true);
      const result = await analyzeBusinessInsights(bookings, totalRevenue);
      setAiInsight(result);
      setGeneratingAI(false);
  };

  const runMarketingGen = async () => {
      if(!process.env.API_KEY) {
          alert("Please configure your Gemini API Key in the environment variables.");
          return;
      }
      setGeneratingAI(true);
      const result = await generateMarketingCopy(bookings);
      setMarketingCopy(result);
      setGeneratingAI(false);
  };

  // Filter Bookings
  const filteredBookings = bookings.filter(b => {
      const matchesSearch = b.Name.toLowerCase().includes(searchTerm.toLowerCase()) || b.Phone.includes(searchTerm);
      const matchesFilter = filterStatus === 'ALL' || b.Status === filterStatus;
      return matchesSearch && matchesFilter;
  });

  return (
    <div className="bg-gray-50 min-h-screen pb-12 animate-fade-in">
      <div className="bg-white shadow border-b border-gray-200 sticky top-16 z-30">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  Admin Dashboard 
                  <button onClick={refreshData} className="ml-3 p-1 rounded hover:bg-gray-100 transition" title="Refresh Data">
                      <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-green-600' : 'text-gray-500'}`} />
                  </button>
              </h1>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="flex space-x-1 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
                    {['DASHBOARD', 'BOOKINGS', 'SETTINGS', 'AI_LAB'].map((tab) => (
                        <button 
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 rounded-md font-medium text-sm whitespace-nowrap transition-colors flex items-center ${activeTab === tab ? 'bg-gray-900 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
                            {tab === 'AI_LAB' && <Sparkles className="w-4 h-4 mr-2 text-yellow-400" />}
                            {tab.replace('_', ' ')}
                        </button>
                    ))}
                </div>
                <button 
                    onClick={() => window.location.reload()} 
                    className="hidden md:flex bg-white border border-gray-300 text-gray-600 px-3 py-2 rounded-md hover:bg-gray-50 text-sm font-medium items-center">
                    <ExternalLink className="w-4 h-4 mr-2" /> Go to Site
                </button>
              </div>
          </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {activeTab === 'DASHBOARD' && (
           <div className="space-y-8 animate-fade-in">
               {/* Stats Cards */}
               <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                   <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                       <div className="relative z-10">
                           <p className="text-sm font-medium text-gray-500">Confirmed Revenue</p>
                           <p className="text-3xl font-bold text-gray-900 mt-1">₹{totalRevenue.toLocaleString()}</p>
                       </div>
                       <div className="absolute right-4 top-4 bg-green-100 p-3 rounded-full">
                           <TrendingUp className="w-6 h-6 text-green-600" />
                       </div>
                   </div>
                   <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="relative z-10">
                           <p className="text-sm font-medium text-gray-500">Total Bookings</p>
                           <p className="text-3xl font-bold text-gray-900 mt-1">{bookings.length}</p>
                        </div>
                       <div className="absolute right-4 top-4 bg-blue-100 p-3 rounded-full">
                           <CalendarIcon className="w-6 h-6 text-blue-600" />
                       </div>
                   </div>
                   <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="relative z-10">
                           <p className="text-sm font-medium text-gray-500">Confirmed</p>
                           <p className="text-3xl font-bold text-gray-900 mt-1">{confirmedBookings}</p>
                        </div>
                       <div className="absolute right-4 top-4 bg-purple-100 p-3 rounded-full">
                           <Users className="w-6 h-6 text-purple-600" />
                       </div>
                   </div>
                   <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="relative z-10">
                           <p className="text-sm font-medium text-gray-500">Pending Approval</p>
                           <p className="text-3xl font-bold text-orange-600 mt-1">{pendingBookings}</p>
                        </div>
                       <div className="absolute right-4 top-4 bg-orange-100 p-3 rounded-full">
                           <Lock className="w-6 h-6 text-orange-600" />
                       </div>
                   </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   {/* Chart */}
                   <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                       <h3 className="text-lg font-bold text-gray-900 mb-6">Revenue Trend (Last 7 Active Days)</h3>
                       <div className="h-80 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={getLast7DaysData()}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value}`} />
                                <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                <Bar dataKey="revenue" fill="#16a34a" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                         </ResponsiveContainer>
                       </div>
                   </div>

                   {/* Quick AI Insight */}
                   <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                       <div className="flex items-center justify-between mb-4">
                           <h3 className="text-lg font-bold text-gray-900 flex items-center">
                               <Sparkles className="w-5 h-5 mr-2 text-purple-600" /> Business Insight
                           </h3>
                       </div>
                       <div className="flex-1 bg-purple-50 rounded-lg p-4 border border-purple-100 text-sm text-gray-700 overflow-y-auto max-h-[250px] custom-scrollbar">
                           {aiInsight ? (
                               <div className="prose prose-sm max-w-none whitespace-pre-line">
                                   {aiInsight}
                               </div>
                           ) : (
                               <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                                   <BrainCircuit className="w-10 h-10 mb-2 opacity-50" />
                                   <p>Tap below to analyze your turf's performance with AI.</p>
                               </div>
                           )}
                       </div>
                       <button 
                           onClick={runAIAnalysis}
                           disabled={generatingAI}
                           className="mt-4 w-full bg-purple-600 text-white py-2 rounded-lg font-medium hover:bg-purple-700 transition flex items-center justify-center">
                           {generatingAI ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                           {generatingAI ? 'Analyzing...' : 'Generate AI Report'}
                       </button>
                   </div>
               </div>
           </div>
        )}

        {activeTab === 'BOOKINGS' && (
            <div className="space-y-4 animate-fade-in">
                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input 
                            type="text" 
                            placeholder="Search by Name or Phone..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                        />
                    </div>
                    
                    <div className="flex items-center space-x-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-none">
                            <select 
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full appearance-none pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white cursor-pointer"
                            >
                                <option value="ALL">All Status</option>
                                <option value="PENDING">Pending</option>
                                <option value="CONFIRMED">Confirmed</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        </div>
                        
                        <button 
                            onClick={handleExportCSV}
                            className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition shadow-sm">
                            <Download className="w-4 h-4 mr-2" /> Export
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-700">Booking List ({filteredBookings.length})</h3>
                        <div className="text-xs text-gray-500">Latest First</div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-4">Date/Time</th>
                                    <th className="px-6 py-4">Customer</th>
                                    <th className="px-6 py-4">Payment Info</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredBookings.length > 0 ? (
                                    filteredBookings.map((booking, idx) => (
                                        <tr key={idx} className="bg-white hover:bg-gray-50 transition">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900 whitespace-nowrap">{booking.Date}</div>
                                                <div className="text-xs text-gray-500 font-mono">{booking.Slot}</div>
                                                <div className="text-[10px] text-gray-400 mt-1">{new Date(booking.Timestamp).toLocaleDateString()}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{booking.Name}</div>
                                                <div className="text-xs text-gray-500">{booking.Phone}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">₹{booking.Amount}</div>
                                                {booking.PaymentId && <div className="text-xs text-gray-500 truncate max-w-[100px]" title={booking.PaymentId}>ID: {booking.PaymentId}</div>}
                                                {booking.ScreenshotUrl && booking.ScreenshotUrl !== 'N/A' ? (
                                                    <a href={booking.ScreenshotUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center mt-1">
                                                        <Image className="w-3 h-3 mr-1" /> View Screen
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">No image</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                    booking.Status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 
                                                    booking.Status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                    {booking.Status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {actionLoading === booking.BookingId ? (
                                                     <Loader2 className="w-5 h-5 animate-spin text-gray-400 ml-auto" />
                                                ) : (
                                                    <div className="flex justify-end space-x-2">
                                                        {(booking.Status === 'PENDING' || booking.Status.toUpperCase() === 'PENDING') && (
                                                            <>
                                                                <button 
                                                                    onClick={() => handleApprove(booking.BookingId)} 
                                                                    className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 transition flex items-center shadow-sm"
                                                                    title="Approve Booking">
                                                                    <Check className="w-3 h-3 mr-1" /> Approve
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleReject(booking.BookingId)} 
                                                                    className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 transition flex items-center shadow-sm"
                                                                    title="Reject Booking">
                                                                    <X className="w-3 h-3 mr-1" /> Reject
                                                                </button>
                                                            </>
                                                        )}
                                                        {booking.Status === 'CONFIRMED' && (
                                                            <button 
                                                                onClick={() => handleReject(booking.BookingId)} 
                                                                className="p-1.5 bg-gray-50 text-gray-500 rounded-lg hover:bg-red-50 hover:text-red-600 border border-gray-200 transition" 
                                                                title="Cancel Booking">
                                                                <Ban className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            No bookings found matching your filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'SETTINGS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                {/* Site Configuration */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                        <Settings className="w-5 h-5 mr-2 text-gray-600" /> General Settings
                    </h3>
                    <div className="space-y-6">
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                                <CreditCard className="w-4 h-4 mr-2" /> UPI ID (for Payments)
                            </label>
                            <input 
                                type="text" 
                                value={config.upiId}
                                onChange={(e) => setConfig({...config, upiId: e.target.value})}
                                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-green-500 focus:border-green-500 outline-none"
                                placeholder="merchant@upi"
                            />
                            <p className="text-xs text-gray-500 mt-1">This ID will be shown to users during booking.</p>
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                                <Clock className="w-4 h-4 mr-2" /> Peak Hour Start (24h format)
                            </label>
                            <input 
                                type="number" 
                                value={config.peakStartHour}
                                onChange={(e) => setConfig({...config, peakStartHour: Number(e.target.value)})}
                                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-green-500 focus:border-green-500 outline-none"
                                min={0} max={23}
                            />
                            <p className="text-xs text-gray-500 mt-1">Slots from this hour onwards will charge peak price.</p>
                        </div>
                    </div>
                </div>

                {/* Pricing Configuration */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                        <DollarSign className="w-5 h-5 mr-2 text-green-600" /> Pricing Rules
                    </h3>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Base Price (Off-Peak)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-500">₹</span>
                                <input 
                                    type="number" 
                                    value={config.basePrice}
                                    onChange={(e) => setConfig({...config, basePrice: Number(e.target.value)})}
                                    className="w-full pl-8 border border-gray-300 rounded-lg p-2.5 focus:ring-green-500 focus:border-green-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Peak Price (Evening/Weekend)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-500">₹</span>
                                <input 
                                    type="number" 
                                    value={config.peakPrice}
                                    onChange={(e) => setConfig({...config, peakPrice: Number(e.target.value)})}
                                    className="w-full pl-8 border border-gray-300 rounded-lg p-2.5 focus:ring-green-500 focus:border-green-500 outline-none"
                                />
                            </div>
                        </div>

                        <button 
                            onClick={handleSaveSettings}
                            disabled={loading}
                            className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-md mt-2 flex justify-center items-center">
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save All Settings'}
                        </button>
                    </div>
                </div>

                {/* Block Slots */}
                <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <Lock className="w-5 h-5 mr-2 text-red-500" /> Block Slots (Maintenance)
                    </h3>
                    
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Select Date</label>
                        <input 
                            type="date" 
                            value={blockDate}
                            onChange={(e) => setBlockDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-red-500 focus:border-red-500 outline-none max-w-xs"
                        />
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                            {Array.from({length: 18}, (_, i) => i + 6).map(hour => {
                                const slotId = `slot-${hour}`;
                                const isBlocked = blockedSlots.some(b => b.Date === blockDate && b.SlotId === slotId);

                                return (
                                    <button
                                        key={slotId}
                                        onClick={() => handleToggleBlock(slotId)}
                                        className={`text-xs py-2 px-1 rounded border transition-colors ${
                                            isBlocked 
                                            ? 'bg-red-600 text-white border-red-600 font-bold shadow-inner' 
                                            : 'bg-white text-gray-700 hover:border-red-300 hover:bg-red-50'
                                        }`}>
                                        {hour}:00
                                    </button>
                                )
                            })}
                    </div>
                    <p className="text-xs text-gray-400 mt-4 text-center">
                        Red slots are blocked for {blockDate}. Users cannot book them.
                    </p>
                </div>
            </div>
        )}

        {activeTab === 'AI_LAB' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
                {/* Marketing Generator */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                         <h3 className="text-lg font-bold text-gray-900 flex items-center">
                            <Sparkles className="w-5 h-5 mr-2 text-purple-600" /> Marketing Assistant
                        </h3>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Gemini 2.5 Flash</span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-6">
                        Generate catchy social media posts (Instagram/WhatsApp) based on your recent booking data to boost engagement.
                    </p>

                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 min-h-[150px] mb-4 relative">
                        {marketingCopy ? (
                             <p className="text-gray-800 whitespace-pre-wrap text-sm">{marketingCopy}</p>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                                AI generated content will appear here...
                            </div>
                        )}
                        {marketingCopy && (
                            <button 
                                onClick={() => navigator.clipboard.writeText(marketingCopy)}
                                className="absolute top-2 right-2 p-1.5 bg-white rounded-md shadow hover:bg-gray-100 text-gray-500">
                                <Copy className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <button 
                        onClick={runMarketingGen}
                        disabled={generatingAI}
                        className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold hover:bg-black transition flex justify-center items-center shadow-lg">
                        {generatingAI ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2 text-yellow-400" />}
                        Generate Post
                    </button>
                </div>

                {/* Business Intelligence */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl shadow-lg border border-transparent p-6 text-white">
                    <h3 className="text-lg font-bold mb-4 flex items-center">
                        <BrainCircuit className="w-5 h-5 mr-2" /> Deep Analysis
                    </h3>
                    <p className="text-indigo-100 text-sm mb-6">
                        Our AI analyzes your booking patterns, revenue streams, and peak hours to provide actionable strategies for growth.
                    </p>

                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-5 border border-white/20 min-h-[200px] mb-6">
                        {aiInsight ? (
                            <div className="prose prose-invert prose-sm max-w-none">
                                {aiInsight}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-indigo-200">
                                <Sparkles className="w-8 h-8 mb-3 opacity-50" />
                                <p className="text-sm">Ready to analyze {bookings.length} data points.</p>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={runAIAnalysis}
                        disabled={generatingAI}
                        className="w-full bg-white text-indigo-700 py-3 rounded-lg font-bold hover:bg-indigo-50 transition shadow-lg">
                        {generatingAI ? 'Analyzing Data...' : 'Run Full Business Audit'}
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};