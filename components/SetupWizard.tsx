
import React, { useState, useRef } from 'react';
import { TripSettings } from '../types';
import { detectDestinationInfo } from '../services/geminiService';
import { updateTripSettings, importTripData } from '../services/storageService';
import { Plane, Calendar, Globe, Coins, CheckCircle, Loader2, ArrowRight, MapPin, Upload, X } from 'lucide-react';

interface Props {
  onComplete: (settings: TripSettings) => void;
  onCancel?: () => void; // Added cancel prop
}

const SetupWizard: React.FC<Props> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState(0); // 0: Destination, 1: Confirmation
  
  const [inputDestination, setInputDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedSettings, setDetectedSettings] = useState<Partial<TripSettings> | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const success = await importTripData(e.target.files[0]);
        if (success) {
            // Import logic handles page reload or state update internally in storageService usually, 
            // but in SetupWizard specifically, we might want to just let the parent app handle the re-render.
            // For now, reload is safe to force sync.
            window.location.reload();
        }
    }
  };

  const handleAnalyze = async () => {
    if (!inputDestination || !startDate || !endDate) return;

    setIsAnalyzing(true);
    
    const info = await detectDestinationInfo(inputDestination);
    
    if (info) {
        setDetectedSettings({
            ...info,
            startDate,
            endDate
        });
        setStep(1);
    } else {
        alert("Could not detect destination details. Please check your spelling or internet connection.");
    }
    setIsAnalyzing(false);
  };

  const handleConfirm = async () => {
      if (detectedSettings && detectedSettings.destination) {
          const finalSettings = { ...detectedSettings } as TripSettings;
          await updateTripSettings(finalSettings);
          onComplete(finalSettings);
      }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 bg-cream text-cocoa relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[30%] bg-sand rounded-full opacity-20 blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[30%] bg-accent rounded-full opacity-10 blur-3xl"></div>
      
      {/* Cancel Button (Visible only if onCancel provided) */}
      {onCancel && (
          <button 
            onClick={onCancel}
            className="absolute top-6 left-6 p-2 bg-white/50 backdrop-blur-sm rounded-full text-gray-500 hover:bg-white z-50 transition-colors"
          >
              <X size={24} />
          </button>
      )}

      {/* Step 0: Destination Input (Now the default start screen) */}
      {step === 0 && (
          <div className="w-full max-w-sm animate-[float_0.5s_ease-out]">
            <div className="text-center mb-10">
                <div className="w-20 h-20 bg-cocoa text-white rounded-3xl mx-auto flex items-center justify-center shadow-xl mb-4 transform -rotate-6">
                    <Plane size={40} />
                </div>
                <h1 className="text-3xl font-serif font-bold mb-2">New Trip</h1>
                <p className="text-latte text-sm">Where is your next adventure?</p>
            </div>

            <div className="space-y-6 bg-white p-6 rounded-[2rem] shadow-xl border border-sand/50">
                <div>
                    <label className="block text-xs font-bold text-latte uppercase mb-1 ml-1">Destination</label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-3.5 text-gray-400" size={18}/>
                        <input 
                            value={inputDestination}
                            onChange={e => setInputDestination(e.target.value)}
                            placeholder="e.g. Tokyo, London, Paris"
                            className="w-full bg-cream pl-10 pr-4 py-3 rounded-xl font-bold text-lg text-cocoa focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-latte uppercase mb-1 ml-1">Start Date</label>
                        <input 
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full bg-cream px-4 py-3 rounded-xl font-bold text-sm text-cocoa focus:outline-none"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-latte uppercase mb-1 ml-1">End Date</label>
                        <input 
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full bg-cream px-4 py-3 rounded-xl font-bold text-sm text-cocoa focus:outline-none"
                        />
                    </div>
                </div>

                <button 
                    onClick={handleAnalyze}
                    disabled={!inputDestination || !startDate || !endDate || isAnalyzing}
                    className="w-full py-4 bg-cocoa text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                >
                    {isAnalyzing ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                    {isAnalyzing ? "Analyzing..." : "Next"}
                </button>
                
                {/* Import Option moved here */}
                <div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                    <button 
                        onClick={handleImportClick}
                        className="w-full text-center text-xs text-gray-400 font-bold hover:text-cocoa flex items-center justify-center gap-1 mt-2"
                    >
                        <Upload size={10} /> Restore from backup
                    </button>
                </div>
            </div>
          </div>
      )}

      {/* Step 1: Confirmation */}
      {step === 1 && detectedSettings && (
          <div className="w-full max-w-sm animate-[float_0.5s_ease-out]">
             <div className="text-center mb-8">
                <h2 className="text-2xl font-serif font-bold text-cocoa">Trip Configured!</h2>
                <p className="text-latte text-sm">We've set up everything for you.</p>
             </div>

             <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-sand/50 space-y-4">
                 <div className="flex items-center gap-4 p-4 bg-cream rounded-xl border border-sand">
                     <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-accent shadow-sm">
                         <Globe size={20}/>
                     </div>
                     <div>
                         <p className="text-xs text-gray-400 font-bold uppercase">Destination</p>
                         <p className="text-lg font-bold text-cocoa">{detectedSettings.destination}</p>
                     </div>
                 </div>

                 <div className="flex items-center gap-4 p-4 bg-cream rounded-xl border border-sand">
                     <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-600 shadow-sm">
                         <Coins size={20}/>
                     </div>
                     <div>
                         <p className="text-xs text-gray-400 font-bold uppercase">Currency</p>
                         <p className="text-lg font-bold text-cocoa">{detectedSettings.currencyCode} <span className="text-sm text-gray-400">(Rate: {detectedSettings.currencyRate})</span></p>
                     </div>
                 </div>

                 <div className="flex items-center gap-4 p-4 bg-cream rounded-xl border border-sand">
                     <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-500 shadow-sm">
                         <Calendar size={20}/>
                     </div>
                     <div>
                         <p className="text-xs text-gray-400 font-bold uppercase">Dates</p>
                         <p className="text-base font-bold text-cocoa">{startDate} ~ {endDate}</p>
                     </div>
                 </div>

                 <button 
                    onClick={handleConfirm}
                    className="w-full py-4 bg-accent text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all mt-4"
                >
                    <CheckCircle />
                    Start Exploring
                </button>
                
                <button onClick={() => setStep(0)} className="w-full text-center text-gray-400 text-xs font-bold hover:text-cocoa">Back</button>
             </div>
          </div>
      )}
    </div>
  );
};

export default SetupWizard;
