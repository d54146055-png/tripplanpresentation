

import React, { useState } from 'react';
import { ItineraryItem, TripSettings } from '../types';
import { Plus, Trash2, MapPin, Sparkles, Cloud, Sun, CloudRain, Snowflake, Wand2, ExternalLink, Loader2 } from 'lucide-react';
import { generateItinerarySuggestion, generateNextActivitySuggestion, getCoordinatesForLocation } from '../services/geminiService';
import { addItineraryItem, deleteItineraryItem, updateItineraryItem } from '../services/firebaseService';

interface Props {
  items: ItineraryItem[];
  settings: TripSettings;
}

const ItineraryView: React.FC<Props> = ({ items, settings }) => {
  const [selectedDay, setSelectedDay] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAppending, setIsAppending] = useState(false);
  
  // New Item State (for Add and Edit)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<ItineraryItem>>({ time: '09:00', day: 1 });
  
  const [targetAreas, setTargetAreas] = useState('');

  const dayItems = items
    .filter(i => i.day === selectedDay)
    .sort((a, b) => a.time.localeCompare(b.time));

  // Determine number of days from settings if available, else default to 5
  const getDaysCount = () => {
      if (settings.startDate && settings.endDate) {
          const start = new Date(settings.startDate);
          const end = new Date(settings.endDate);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          return diffDays > 0 && diffDays < 30 ? diffDays : 1; 
      }
      return 5;
  };
  const daysList = Array.from({ length: getDaysCount() }, (_, i) => i + 1);

  const handleSaveItem = async () => {
    if (newItem.activity && newItem.time) {
      // Try to fetch coords if missing
      let lat = newItem.lat;
      let lng = newItem.lng;
      if ((!lat || !lng) && newItem.location) {
          const coords = await getCoordinatesForLocation(newItem.location, settings.destination);
          if (coords) {
              lat = coords.lat;
              lng = coords.lng;
          }
      }

      if (editingItemId) {
          await updateItineraryItem(editingItemId, {
              ...newItem,
              lat, lng
          });
      } else {
          await addItineraryItem({
            time: newItem.time!,
            activity: newItem.activity!,
            location: newItem.location || '',
            notes: newItem.notes || '',
            day: selectedDay,
            weather: { temp: 20, condition: 'sunny', icon: '☀️' },
            lat, lng
          });
      }
      setIsModalOpen(false);
      setEditingItemId(null);
      setNewItem({ time: '09:00', day: selectedDay });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this item?")) {
      await deleteItineraryItem(id);
    }
  };

  const openMap = (location: string) => {
    // Generic map search query
    const query = encodeURIComponent(`${location} ${settings.destination}`);
    // Fallback to Google Maps for generic locations if Naver isn't preferred
    // For now, let's stick to Google Maps for international support
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(url, '_blank');
  };

  const getWeatherIcon = (condition?: string) => {
    if (!condition) return <Sun size={14} className="text-orange-400" />;
    const c = condition.toLowerCase();
    if (c.includes('rain')) return <CloudRain size={14} className="text-blue-400" />;
    if (c.includes('snow')) return <Snowflake size={14} className="text-blue-200" />;
    if (c.includes('cloud')) return <Cloud size={14} className="text-gray-400" />;
    return <Sun size={14} className="text-orange-400" />;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
        const suggestedItems = await generateItinerarySuggestion(
            selectedDay,
            settings.destination,
            "Aesthetic spots, hidden gems, good food, must-visit landmarks", 
            targetAreas
        );
        
        if (suggestedItems.length > 0) {
            for (const item of suggestedItems) {
                await addItineraryItem(item);
            }
        } else {
            alert("AI could not generate a plan. Please try again.");
        }
    } catch (e) {
        alert("Error during AI generation.");
    } finally {
        setIsGenerating(false);
        setIsPlanModalOpen(false);
        setTargetAreas('');
    }
  };

  const handleAppendAI = async () => {
      setIsAppending(true);
      const suggestion = await generateNextActivitySuggestion(dayItems, settings.destination);
      if (suggestion) {
          // It returns an item without coords, let's fetch them
          const coords = await getCoordinatesForLocation(suggestion.location, settings.destination);
          await addItineraryItem({
              ...suggestion,
              lat: coords?.lat,
              lng: coords?.lng,
              day: selectedDay 
          });
      } else {
          alert("Couldn't think of anything nearby! Try adding manually.");
      }
      setIsAppending(false);
  };

  return (
    <div className="h-full overflow-y-auto no-scrollbar bg-cream">
      {/* Day Selector */}
      <div className="sticky top-0 z-10 bg-cream/95 backdrop-blur-md border-b border-sand p-4 overflow-x-auto no-scrollbar flex space-x-3 shadow-sm">
        {daysList.map(day => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`flex flex-col items-center justify-center min-w-[3.5rem] h-14 rounded-2xl transition-all ${
              selectedDay === day 
                ? 'bg-cocoa text-white shadow-lg scale-105' 
                : 'bg-white text-gray-400 border border-sand/50'
            }`}
          >
            <span className="text-[10px] uppercase font-bold opacity-80">Day</span>
            <span className="text-lg font-bold font-serif">{day}</span>
          </button>
        ))}
      </div>

      <div className="p-5 space-y-6 pb-32"> 
        {dayItems.length === 0 ? (
          <div className="text-center py-20 opacity-60">
            <div className="w-16 h-16 bg-sand rounded-full mx-auto mb-4 flex items-center justify-center text-cocoa">
               <MapPin className="animate-bounce" />
            </div>
            <p className="mb-6 text-cocoa font-medium">No plans for Day {selectedDay} yet.</p>
            <button 
              onClick={() => setIsPlanModalOpen(true)}
              className="inline-flex items-center px-6 py-3 bg-white border border-sand text-cocoa rounded-xl font-bold hover:bg-sand transition-colors shadow-sm active:scale-95"
            >
              <Wand2 size={18} className="mr-2 text-accent" />
              AI Plan My Day
            </button>
          </div>
        ) : (
          <div className="relative border-l border-dashed border-latte/30 ml-3 space-y-8 pb-4">
            <div className="flex justify-end mb-4 pr-1">
                <button 
                    onClick={handleAppendAI}
                    disabled={isAppending}
                    className="text-xs bg-white border border-sand px-4 py-2 rounded-full text-cocoa hover:bg-sand flex items-center shadow-sm active:scale-95 transition-all"
                >
                    {isAppending ? <Loader2 size={12} className="animate-spin mr-1.5"/> : <Sparkles size={12} className="mr-1.5 text-accent"/>}
                    AI Suggest Next
                </button>
            </div>

            {dayItems.map((item) => (
              <div key={item.id} className="relative pl-8 group" onClick={() => { setEditingItemId(item.id); setNewItem(item); setIsModalOpen(true); }}>
                <div className="absolute -left-[6.5px] top-5 w-3 h-3 bg-cream border-2 border-cocoa rounded-full z-10"></div>
                
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-transparent hover:border-sand/50 transition-all cursor-pointer">
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-serif text-2xl text-cocoa font-medium">{item.time}</span>
                    <div className="flex items-center space-x-2 bg-sand/30 px-3 py-1 rounded-full text-xs text-cocoa font-medium">
                       {getWeatherIcon(item.weather?.condition)}
                       <span>{item.weather?.temp ? `${item.weather.temp}°` : '20°'}</span>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-800 mb-1 leading-tight">{item.activity}</h3>
                  
                  <div 
                    onClick={(e) => { e.stopPropagation(); openMap(item.location); }}
                    className="flex items-center text-latte text-sm mb-3 cursor-pointer hover:text-accent transition-colors group/link"
                  >
                    <MapPin size={14} className="mr-1 flex-shrink-0" />
                    <span className="underline decoration-dotted decoration-latte mr-1 truncate">{item.location}</span>
                    <ExternalLink size={10} className="opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                  
                  {item.notes && (
                    <div className="text-xs text-gray-500 bg-cream p-3 rounded-xl italic border border-sand/30">
                      "{item.notes}"
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => { setEditingItemId(null); setNewItem({ time: '09:00', day: selectedDay }); setIsModalOpen(true); }}
        className="fixed bottom-24 right-6 w-14 h-14 bg-cocoa text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-latte transition-all active:scale-90 z-20"
      >
        <Plus size={28} />
      </button>

      {/* Add Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-cocoa/20 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl animate-[float_0.3s_ease-out]">
            <h2 className="text-xl font-serif font-bold text-cocoa mb-6 text-center">{editingItemId ? 'Edit Plan' : 'New Plan'}</h2>
            
            <div className="space-y-4">
              <div className="flex gap-4">
                 <div className="w-1/3">
                    <label className="block text-xs font-bold text-latte uppercase mb-1">Time</label>
                    <input 
                      type="time" 
                      className="w-full p-3 bg-cream rounded-xl text-cocoa font-bold text-center focus:outline-none"
                      value={newItem.time}
                      onChange={e => setNewItem({...newItem, time: e.target.value})}
                    />
                 </div>
                 <div className="flex-1">
                    <label className="block text-xs font-bold text-latte uppercase mb-1">Activity</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Lunch"
                      className="w-full p-3 bg-cream rounded-xl text-cocoa focus:outline-none"
                      value={newItem.activity || ''}
                      onChange={e => setNewItem({...newItem, activity: e.target.value})}
                    />
                 </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-latte uppercase mb-1">Where?</label>
                <div className="relative">
                    <MapPin size={16} className="absolute left-3 top-3.5 text-latte" />
                    <input 
                    type="text" 
                    placeholder="Location Name"
                    className="w-full p-3 pl-10 bg-cream rounded-xl text-cocoa focus:outline-none"
                    value={newItem.location || ''}
                    onChange={e => setNewItem({...newItem, location: e.target.value})}
                    />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-latte uppercase mb-1">Notes</label>
                <textarea 
                  placeholder="Details..."
                  className="w-full p-3 bg-cream rounded-xl text-cocoa focus:outline-none resize-none h-20"
                  value={newItem.notes || ''}
                  onChange={e => setNewItem({...newItem, notes: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              {editingItemId && (
                  <button onClick={() => { handleDelete(editingItemId); setIsModalOpen(false); }} className="p-3 bg-red-50 text-red-400 rounded-xl hover:bg-red-100">
                      <Trash2 size={20}/>
                  </button>
              )}
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-latte font-medium hover:bg-cream rounded-xl">Cancel</button>
              <button onClick={handleSaveItem} className="flex-1 py-3 bg-cocoa text-white font-bold rounded-xl shadow-lg active:scale-95">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Magic AI Plan Modal */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-cocoa/30 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent to-latte rounded-t-[2rem]"></div>
                
                <h2 className="text-2xl font-serif font-bold text-cocoa mb-2 text-center flex items-center justify-center gap-2">
                    <Sparkles size={24} className="text-accent" />
                    AI Planner
                </h2>
                <p className="text-center text-xs text-gray-400 mb-6">Planning for {settings.destination}</p>

                <div className="bg-cream p-4 rounded-xl border border-sand mb-6">
                    <label className="block text-xs font-bold text-latte uppercase mb-2">Desired Spots / Keywords</label>
                    <textarea 
                        className="w-full bg-white p-3 rounded-lg text-cocoa text-sm focus:outline-none resize-none h-24"
                        placeholder="e.g. City Center, Museums, Famous Cafe..."
                        value={targetAreas}
                        onChange={(e) => setTargetAreas(e.target.value)}
                    />
                </div>

                <button 
                    onClick={handleGenerate}
                    disabled={isGenerating || !targetAreas}
                    className="w-full py-4 bg-cocoa text-white font-bold rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Building Schedule...
                        </>
                    ) : (
                        'Generate Plan'
                    )}
                </button>
                <button onClick={() => setIsPlanModalOpen(false)} className="w-full mt-3 text-xs text-gray-400 py-2 hover:text-cocoa">
                    Back
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default ItineraryView;
