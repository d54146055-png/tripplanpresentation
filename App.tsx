
import React, { useState, useEffect, useRef } from 'react';
import { AppTab, Expense, ItineraryItem, User, TripSettings, TripMetadata } from './types';
import ItineraryView from './components/ItineraryView';
import ExpenseView from './components/ExpenseView';
import ChatView from './components/ChatView';
import MapView from './components/MapView';
import SetupWizard from './components/SetupWizard';
import { Calendar, CreditCard, MessageCircle, MapPin, Users, Loader2, Download, Upload, Menu, Plus, Trash2, X, ChevronRight, Plane } from 'lucide-react';
import { subscribeToExpenses, subscribeToItinerary, subscribeToUsers, subscribeToTripSettings, exportTripData, importTripData, subscribeToRegistry, createNewTripId, switchTrip, deleteTrip } from './services/storageService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.ITINERARY);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  
  // Real-time Data
  const [tripSettings, setTripSettings] = useState<TripSettings | null>(null);
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // Trip Management State
  const [allTrips, setAllTrips] = useState<TripMetadata[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCreatingNewTrip, setIsCreatingNewTrip] = useState(false);
  
  const importInputRef = useRef<HTMLInputElement>(null);

  // Handle Data Sync
  useEffect(() => {
    // 1. Subscribe to Settings & Registry
    const unsubscribeSettings = subscribeToTripSettings((settings) => {
        setTripSettings(settings);
        setIsLoadingSettings(false);
        // If settings loaded and we were creating a trip, close that mode
        if (settings && isCreatingNewTrip) {
            setIsCreatingNewTrip(false);
        }
    });

    const unsubscribeRegistry = subscribeToRegistry((trips) => {
        setAllTrips(trips);
    });

    // 2. Subscribe to other data
    const unsubscribeItinerary = subscribeToItinerary(setItineraryItems);
    const unsubscribeExpenses = subscribeToExpenses(setExpenses);
    const unsubscribeUsers = subscribeToUsers(setUsers);

    return () => {
      unsubscribeSettings();
      unsubscribeRegistry();
      unsubscribeItinerary();
      unsubscribeExpenses();
      unsubscribeUsers();
    };
  }, [isCreatingNewTrip]);
  
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if(e.target.files && e.target.files[0]) {
          const success = await importTripData(e.target.files[0]);
          if(success) alert("Import successful!");
      }
  }

  const handleCreateNewTrip = () => {
      // 1. Switch to a new blank ID
      const newId = createNewTripId();
      switchTrip(newId);
      // 2. Set UI to create mode (shows SetupWizard)
      setIsCreatingNewTrip(true);
      setIsMenuOpen(false);
  };

  const handleSwitchTrip = (id: string) => {
      switchTrip(id);
      setIsMenuOpen(false);
  };

  const handleDeleteTrip = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (confirm("Are you sure you want to delete this trip permanently?")) {
          deleteTrip(id);
      }
  };
  
  if (isLoadingSettings) {
      return (
          <div className="h-full flex items-center justify-center bg-cream text-cocoa">
              <Loader2 className="animate-spin" size={32}/>
          </div>
      );
  }

  // Logic to determine if we show Setup Wizard
  const showSetup = !tripSettings || isCreatingNewTrip;

  if (showSetup) {
      return (
        <SetupWizard 
            onComplete={(s) => {
                setTripSettings(s);
                setIsCreatingNewTrip(false);
            }} 
            // Allow cancel if we have other trips to go back to
            onCancel={allTrips.length > 0 ? () => {
                // Switch back to the first available trip if cancelling creation
                if (allTrips.length > 0) switchTrip(allTrips[0].id);
                setIsCreatingNewTrip(false);
            } : undefined}
        />
      );
  }

  // Ensure tripSettings is not null for main app
  if (!tripSettings) return null;

  const renderContent = () => {
    switch (activeTab) {
      case AppTab.ITINERARY:
        return <ItineraryView items={itineraryItems} settings={tripSettings} />;
      case AppTab.MAP:
        return <MapView itineraryItems={itineraryItems} settings={tripSettings} />;
      case AppTab.EXPENSES:
        return <ExpenseView expenses={expenses} users={users} settings={tripSettings} />;
      case AppTab.AI_GUIDE:
        return <ChatView settings={tripSettings} />;
      default:
        return <ItineraryView items={itineraryItems} settings={tripSettings} />;
    }
  };

  // Main App
  return (
    <div className="h-full flex flex-col bg-cream text-cocoa font-sans max-w-md mx-auto relative shadow-2xl border-x border-sand/50 overflow-hidden">
      
      {/* Side Menu Drawer */}
      {isMenuOpen && (
          <div className="absolute inset-0 z-50 flex">
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
              <div className="relative w-3/4 bg-cream h-full shadow-2xl flex flex-col animate-[slideRight_0.3s_ease-out] border-r border-sand">
                  <div className="p-6 bg-cocoa text-white">
                      <h2 className="text-xl font-serif font-bold flex items-center gap-2">
                          <Plane size={24} className="text-accent" />
                          My Trips
                      </h2>
                      <p className="text-xs text-white/60 mt-1">Manage your adventures</p>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {allTrips.map(trip => (
                          <div 
                            key={trip.id} 
                            onClick={() => handleSwitchTrip(trip.id)}
                            className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                                trip.id === tripSettings.id 
                                ? 'bg-white border-accent shadow-md' 
                                : 'bg-white/50 border-transparent hover:bg-white hover:border-sand'
                            }`}
                          >
                              <div className="flex justify-between items-start">
                                  <div>
                                      <h3 className={`font-bold ${trip.id === tripSettings.id ? 'text-accent' : 'text-cocoa'}`}>
                                          {trip.destination}
                                      </h3>
                                      <p className="text-xs text-gray-400 mt-1">
                                          {trip.startDate} - {trip.endDate}
                                      </p>
                                  </div>
                                  {trip.id === tripSettings.id && <div className="w-2 h-2 rounded-full bg-accent mt-1.5"></div>}
                              </div>
                              <div className="flex justify-end mt-2">
                                  <button 
                                    onClick={(e) => handleDeleteTrip(e, trip.id)}
                                    className="p-2 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                      <Trash2 size={14} />
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>

                  <div className="p-4 border-t border-sand">
                      <button 
                        onClick={handleCreateNewTrip}
                        className="w-full py-4 bg-cocoa text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-latte transition-colors shadow-lg active:scale-95"
                      >
                          <Plus size={18} /> Plan New Trip
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Header - Fixed */}
      <header className="flex-none bg-cream/95 backdrop-blur-md z-20 px-4 pt-safe-top pb-3 border-b border-sand/30 flex justify-between items-center h-[calc(60px+env(safe-area-inset-top))]">
        <div className="pt-2 flex items-center gap-3">
            <button onClick={() => setIsMenuOpen(true)} className="p-2 -ml-2 text-cocoa hover:bg-sand/30 rounded-xl transition-colors">
                <Menu size={24} />
            </button>
            <div>
                <h1 className="text-xl font-serif font-bold text-cocoa leading-none truncate max-w-[150px]">
                    {tripSettings.destination}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                    <div className="flex -space-x-1">
                        {users.slice(0, 3).map((u, i) => (
                            <div key={i} className="w-5 h-5 rounded-full bg-latte border-2 border-cream text-[9px] flex items-center justify-center text-white uppercase overflow-hidden shadow-sm font-bold">
                                {u.name.charAt(0)}
                            </div>
                        ))}
                        {users.length === 0 && (
                            <div className="w-5 h-5 rounded-full bg-sand/50 border-2 border-cream flex items-center justify-center text-cocoa">
                                <Users size={10} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
        
        {/* Export / Import Controls */}
        <div className="pt-2 flex gap-2">
            <button onClick={exportTripData} className="p-2 bg-white rounded-full shadow-sm text-cocoa hover:text-accent border border-sand/50" title="Export JSON">
                <Download size={18}/>
            </button>
            <button onClick={() => importInputRef.current?.click()} className="p-2 bg-white rounded-full shadow-sm text-cocoa hover:text-accent border border-sand/50" title="Import JSON">
                <Upload size={18}/>
            </button>
            <input type="file" ref={importInputRef} onChange={handleImport} accept=".json" className="hidden"/>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-hidden relative w-full">
        {renderContent()}
      </main>

      {/* Bottom Navigation - Fixed */}
      <nav className="flex-none bg-white/95 backdrop-blur-lg border-t border-sand pb-safe z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-[2rem] h-[calc(70px+env(safe-area-inset-bottom))]">
        <div className="flex justify-around items-start h-full pt-3 px-4">
          <button 
            onClick={() => setActiveTab(AppTab.ITINERARY)}
            className={`flex flex-col items-center justify-center w-16 space-y-1 transition-colors ${activeTab === AppTab.ITINERARY ? 'text-cocoa' : 'text-gray-300 hover:text-latte'}`}
          >
            <Calendar size={22} strokeWidth={activeTab === AppTab.ITINERARY ? 2.5 : 2} />
            <span className="text-[9px] font-bold tracking-wide">PLAN</span>
          </button>

          <button 
            onClick={() => setActiveTab(AppTab.MAP)}
            className={`flex flex-col items-center justify-center w-16 space-y-1 transition-colors ${activeTab === AppTab.MAP ? 'text-cocoa' : 'text-gray-300 hover:text-latte'}`}
          >
            <MapPin size={22} strokeWidth={activeTab === AppTab.MAP ? 2.5 : 2} />
            <span className="text-[9px] font-bold tracking-wide">MAP</span>
          </button>
          
          <button 
            onClick={() => setActiveTab(AppTab.AI_GUIDE)}
            className="flex flex-col items-center justify-center w-16 -mt-8"
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${activeTab === AppTab.AI_GUIDE ? 'bg-cocoa scale-110 ring-4 ring-cream' : 'bg-cocoa hover:bg-latte'}`}>
                <MessageCircle size={26} className="text-white" fill="white" />
            </div>
            <span className={`text-[9px] font-bold mt-2 ${activeTab === AppTab.AI_GUIDE ? 'text-cocoa' : 'text-gray-300'}`}>AI</span>
          </button>

          <button 
            onClick={() => setActiveTab(AppTab.EXPENSES)}
            className={`flex flex-col items-center justify-center w-16 space-y-1 transition-colors ${activeTab === AppTab.EXPENSES ? 'text-cocoa' : 'text-gray-300 hover:text-latte'}`}
          >
            <CreditCard size={22} strokeWidth={activeTab === AppTab.EXPENSES ? 2.5 : 2} />
            <span className="text-[9px] font-bold tracking-wide">MONEY</span>
          </button>
        </div>
      </nav>
      
      <style>{`
        @keyframes slideRight {
            from { transform: translateX(-100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default App;
