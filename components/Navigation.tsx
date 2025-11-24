import React, { useState } from 'react';
import { ViewState, User } from '../types';
import { Menu, X, Trophy, User as UserIcon, LogOut } from 'lucide-react';
import { logoutUser } from '../services/storageService';

interface NavigationProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  user: User | null;
  onLogout: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, onChangeView, user, onLogout }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = [
    { label: 'Home', value: ViewState.HOME },
    { label: 'About', value: ViewState.ABOUT },
    { label: 'Pricing', value: ViewState.PRICING },
    { label: 'Gallery', value: ViewState.GALLERY },
    { label: 'Contact', value: ViewState.CONTACT },
  ];

  if (user?.role === 'ADMIN') {
      navItems.push({ label: 'Dashboard', value: ViewState.ADMIN });
  }

  const handleNavClick = (view: ViewState) => {
    onChangeView(view);
    setIsMobileOpen(false);
  };

  const handleLogout = () => {
      logoutUser();
      onLogout();
      setIsMobileOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm shadow-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center cursor-pointer" onClick={() => handleNavClick(ViewState.HOME)}>
            <Trophy className="h-8 w-8 text-green-600 mr-2" />
            <span className="font-extrabold text-2xl tracking-tighter text-gray-900">
                Turf<span className="text-green-600">Pro</span>
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              <button
                key={item.value}
                onClick={() => handleNavClick(item.value)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === item.value
                    ? 'text-green-600 bg-green-50'
                    : 'text-gray-600 hover:text-green-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
            
            <div className="h-6 w-px bg-gray-300 mx-2"></div>

            {user ? (
                <div className="flex items-center space-x-4">
                    <span className="text-sm font-semibold text-gray-700 flex items-center">
                        <UserIcon className="w-4 h-4 mr-1" />
                        {user.name}
                    </span>
                    <button 
                        onClick={handleLogout}
                        className="text-gray-500 hover:text-red-600 text-sm font-medium flex items-center">
                        <LogOut className="w-4 h-4 mr-1" /> Logout
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => handleNavClick(ViewState.LOGIN)}
                    className="text-gray-900 font-medium hover:text-green-600 text-sm">
                    Log In
                </button>
            )}

            <button 
                onClick={() => handleNavClick(ViewState.BOOKING)}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-full font-bold text-sm transition shadow-lg hover:shadow-green-200 transform hover:-translate-y-0.5">
                Book Slot
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              className="text-gray-600 hover:text-green-600 focus:outline-none p-2"
            >
              {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {isMobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 absolute w-full shadow-lg">
          <div className="px-4 pt-2 pb-6 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.value}
                onClick={() => handleNavClick(item.value)}
                className={`block w-full text-left px-3 py-3 rounded-md text-base font-medium ${
                  currentView === item.value
                    ? 'text-green-600 bg-green-50'
                    : 'text-gray-600 hover:text-green-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
            <div className="border-t pt-4 mt-4">
                {user ? (
                    <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-red-600 font-medium flex items-center">
                        <LogOut className="w-4 h-4 mr-2" /> Logout ({user.name})
                    </button>
                ) : (
                    <button onClick={() => handleNavClick(ViewState.LOGIN)} className="w-full text-left px-3 py-2 text-gray-700 font-medium">
                        Log In / Sign Up
                    </button>
                )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};