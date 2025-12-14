import React, { useState, useEffect } from 'react';
import { getAdminData, toggleBlockSlot, updatePricing, approveBooking, rejectBooking } from '../services/api';
import { generateMarketingCopy, analyzeBusinessInsights } from '../services/geminiService';
import { Booking, PricingConfig, ViewState } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Calendar as CalendarIcon, DollarSign, Lock, RefreshCw, Check, X, Image, Ban, Loader2, Search, Filter, Sparkles, Download, Copy, ExternalLink, BrainCircuit, Settings, CreditCard, Clock, WifiOff } from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (view: ViewState) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
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
    const matchesSearch = b.Name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          b.Phone.includes(searchTerm) ||
                          b.BookingId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || b.Status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-white flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center space-x-2 text-green-400 font-bold text-2xl">
             <Trophy className="w-8 h-8" />
             <span>Turf<span className="text-white">Admin</span></span>
          </div>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2">
           <button onClick={() => setActiveTab('DASHBOARD')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition ${activeTab === 'DASHBOARD' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <TrendingUp className="w-5 h-5" /> <span>Dashboard</span>
           </button>
           <button onClick={() => setActiveTab('BOOKINGS')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition ${activeTab === 'BOOKINGS' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <CalendarIcon className="w-5 h-5" /> <span>Bookings</span>
           </button>
           <button onClick={() => setActiveTab('AI_LAB')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition ${activeTab === 'AI_LAB' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <BrainCircuit className="w-5 h-5" /> <span>AI Insights</span>
           </button>
           <button onClick={() => setActiveTab('SETTINGS')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition ${activeTab === 'SETTINGS' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <Settings className="w-5 h-5" /> <span>Settings</span>
           </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
           <button onClick={() => onNavigate(ViewState.HOME)} className="w-full flex items-center space-x-2 text-slate-400 hover:text-white transition">
              <ExternalLink className="w-4 h-4" /> <span>Back to Site</span>
           </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <header className="bg-white shadow-sm py-4 px-8 flex justify-between items-center sticky top-0 z-20">
           <h2 className="text-xl font-bold text-gray-800 capitalize">{activeTab.replace('_', ' ').toLowerCase()}</h2>
           <button onClick={refreshData} disabled={loading} className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </header>

        <main className="p-8">
            {activeTab === 'DASHBOARD' && (
                <div className="space-y-8 animate-fade-in">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center">
                            <div className="p-4 rounded-xl bg-green-50 text-green-600 mr-4">
                                <DollarSign className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Total Revenue</p>
                                <p className="text-2xl font-extrabold text-gray-900">₹{totalRevenue.toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center">
                            <div className="p-4 rounded-xl bg-blue-50 text-blue-600 mr-4">
                                <Check className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Confirmed Bookings</p>
                                <p className="text-2xl font-extrabold text-gray-900">{confirmedBookings}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center">
                            <div className="p-4 rounded-xl bg-yellow-50 text-yellow-600 mr-4">
                                <Clock className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Pending Requests</p>
                                <p className="text-2xl font-extrabold text-gray-900">{pendingBookings}</p>
                            </div>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-6">Revenue Trend (Last 7 Days)</h3>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={getLast7DaysData()}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                                    <Tooltip 
                                        cursor={{fill: '#f3f4f6'}}
                                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                                    />
                                    <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'BOOKINGS' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex flex-col md:flex-row gap-4 justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Search by name, phone or ID..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="w-5 h-5 text-gray-400" />
                            <select 
                                value={filterStatus} 
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="py-2.5 px-4 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none bg-white text-gray-700"
                            >
                                <option value="ALL">All Status</option>
                                <option value="CONFIRMED">Confirmed</option>
                                <option value="PENDING">Pending</option>
                                <option value="CANCELLED">Cancelled</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                            <button onClick={handleExportCSV} className="flex items-center px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-black transition text-sm font-bold">
                                <Download className="w-4 h-4 mr-2" /> Export
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Date/Time</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Customer</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Amount</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Payment</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredBookings.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-gray-400">No bookings found.</td>
                                        </tr>
                                    ) : (
                                        filteredBookings.map((booking) => (
                                            <tr key={booking.BookingId} className="hover:bg-gray-50 transition group">
                                                <td className="p-4">
                                                    <div className="font-bold text-gray-900">{booking.Date}</div>
                                                    <div className="text-xs text-gray-500">{booking.Slot}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-medium text-gray-900">{booking.Name}</div>
                                                    <div className="text-xs text-gray-500">{booking.Phone}</div>
                                                </td>
                                                <td className="p-4 font-mono font-medium">₹{booking.Amount}</td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold
                                                        ${booking.Status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 
                                                          booking.Status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 
                                                          booking.Status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                                        {booking.Status}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-xs text-gray-500">{booking.PaymentId}</div>
                                                    {booking.ScreenshotUrl && booking.ScreenshotUrl !== 'N/A' && (
                                                        <a href={booking.ScreenshotUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center mt-1">
                                                            <Image className="w-3 h-3 mr-1" /> View Screen
                                                        </a>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    {booking.Status === 'PENDING' && (
                                                        <div className="flex justify-end gap-2">
                                                            <button 
                                                                onClick={() => handleApprove(booking.BookingId)} 
                                                                disabled={!!actionLoading}
                                                                className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
                                                                title="Approve"
                                                            >
                                                                {actionLoading === booking.BookingId ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4" />}
                                                            </button>
                                                            <button 
                                                                onClick={() => handleReject(booking.BookingId)} 
                                                                disabled={!!actionLoading}
                                                                className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                                                                title="Reject"
                                                            >
                                                                {actionLoading === booking.BookingId ? <Loader2 className="w-4 h-4 animate-spin"/> : <X className="w-4 h-4" />}
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'SETTINGS' && (
                <div className="max-w-4xl space-y-8 animate-fade-in">
                    {/* Pricing Config */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                            <CreditCard className="w-5 h-5 mr-2 text-green-600" /> Pricing & Payments
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Base Price (Day)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-gray-400">₹</span>
                                    <input 
                                        type="number" 
                                        value={config.basePrice}
                                        onChange={e => setConfig({...config, basePrice: Number(e.target.value)})}
                                        className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Peak Price (Night/Weekend)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-gray-400">₹</span>
                                    <input 
                                        type="number" 
                                        value={config.peakPrice}
                                        onChange={e => setConfig({...config, peakPrice: Number(e.target.value)})}
                                        className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Peak Start Hour (24h)</label>
                                <input 
                                    type="number" 
                                    value={config.peakStartHour}
                                    onChange={e => setConfig({...config, peakStartHour: Number(e.target.value)})}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                                />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">UPI ID (Merchant)</label>
                                <input 
                                    type="text" 
                                    value={config.upiId}
                                    onChange={e => setConfig({...config, upiId: e.target.value})}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button onClick={handleSaveSettings} className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-green-700 transition flex items-center">
                                <Save className="w-4 h-4 mr-2" /> Save Changes
                            </button>
                        </div>
                    </div>

                    {/* Block Slots */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                            <Ban className="w-5 h-5 mr-2 text-red-500" /> Maintenance & Blocking
                        </h3>
                        <div className="flex items-center gap-4 mb-6">
                            <input 
                                type="date" 
                                value={blockDate}
                                onChange={e => setBlockDate(e.target.value)}
                                className="px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <p className="text-sm text-gray-500">Select date to manage availability manually.</p>
                        </div>
                        
                        <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                             {Array.from({length: 18}, (_, i) => i + 6).map(hour => {
                                 const slotId = `slot-${hour}`;
                                 const isBlocked = blockedSlots.some(b => b.Date === blockDate && b.SlotId === slotId);
                                 return (
                                     <button 
                                        key={slotId}
                                        onClick={() => handleToggleBlock(slotId)}
                                        className={`py-2 px-1 rounded-lg text-xs font-bold border transition ${isBlocked ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-200 text-gray-600 hover:border-green-500'}`}
                                     >
                                        {hour}:00
                                        <div className="mt-1">{isBlocked ? 'BLOCKED' : 'OPEN'}</div>
                                     </button>
                                 )
                             })}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'AI_LAB' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
                    {/* Insights Generator */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center mb-4">
                            <div className="bg-purple-100 p-2 rounded-lg mr-3">
                                <Sparkles className="w-6 h-6 text-purple-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">Business Analyst</h3>
                        </div>
                        <p className="text-gray-500 mb-6 text-sm">
                            Analyze booking trends and revenue data to get actionable advice on how to grow your business.
                        </p>
                        
                        <button 
                            onClick={runAIAnalysis}
                            disabled={generatingAI}
                            className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition shadow-lg shadow-purple-200 mb-6 flex justify-center items-center"
                        >
                            {generatingAI ? <Loader2 className="animate-spin w-5 h-5" /> : 'Generate Insights'}
                        </button>
                        
                        {aiInsight && (
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-gray-800 text-sm leading-relaxed whitespace-pre-line">
                                {aiInsight}
                            </div>
                        )}
                    </div>

                    {/* Copy Generator */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                         <div className="flex items-center mb-4">
                            <div className="bg-pink-100 p-2 rounded-lg mr-3">
                                <TrendingUp className="w-6 h-6 text-pink-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">Marketing Assistant</h3>
                        </div>
                        <p className="text-gray-500 mb-6 text-sm">
                            Generate catchy social media captions to fill your empty slots for the weekend.
                        </p>
                        
                        <button 
                            onClick={runMarketingGen}
                            disabled={generatingAI}
                            className="w-full py-3 bg-pink-600 text-white rounded-xl font-bold hover:bg-pink-700 transition shadow-lg shadow-pink-200 mb-6 flex justify-center items-center"
                        >
                             {generatingAI ? <Loader2 className="animate-spin w-5 h-5" /> : 'Write Post'}
                        </button>

                         {marketingCopy && (
                            <div className="bg-pink-50 p-4 rounded-xl border border-pink-100 relative group">
                                <p className="text-gray-800 text-sm whitespace-pre-line">{marketingCopy}</p>
                                <button 
                                    onClick={() => navigator.clipboard.writeText(marketingCopy)}
                                    className="absolute top-2 right-2 p-1 bg-white rounded-md shadow-sm text-gray-400 hover:text-gray-900 opacity-0 group-hover:opacity-100 transition"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </main>
      </div>
    </div>
  );
};