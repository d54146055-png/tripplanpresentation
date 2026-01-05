
import { ItineraryItem, Expense, User, ChatMessage, MapMarker, TripSettings, TripMetadata } from '../types';

const REGISTRY_KEY = 'seoulmate_trips_registry';
const LAST_TRIP_KEY = 'seoulmate_last_trip_id';

// Default to a timestamp-based ID if none exists, or load the last active one
let currentTripId = localStorage.getItem(LAST_TRIP_KEY) || '';

// --- Observer System ---
type Listener<T> = (data: T) => void;
const observers: Record<string, Function[]> = {
  itinerary: [],
  expenses: [],
  users: [],
  chat: [],
  markers: [],
  settings: [],
  registry: [] // New observer for trip list
};

const notify = (key: string, data: any) => {
  if (observers[key]) {
    observers[key].forEach(callback => callback(data));
  }
};

const subscribeLocal = <T>(key: string, callback: Listener<T>, defaultValue: any = []) => {
  if (!observers[key]) observers[key] = [];
  observers[key].push(callback);
  
  // Initial data load
  const currentData = getLocal<T>(key, defaultValue);
  callback(currentData);
  
  return () => {
    observers[key] = observers[key].filter(cb => cb !== callback);
  };
};

const getLocal = <T>(key: string, defaultValue: any = []): T => {
  if (!currentTripId && key !== 'registry') return defaultValue;
  try {
    const storageKey = key === 'registry' ? REGISTRY_KEY : `${currentTripId}_${key}`;
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

const setLocal = (key: string, data: any) => {
  if (!currentTripId && key !== 'registry') return;
  const storageKey = key === 'registry' ? REGISTRY_KEY : `${currentTripId}_${key}`;
  localStorage.setItem(storageKey, JSON.stringify(data));
  notify(key, data);
};

// --- TRIP MANAGEMENT (New) ---

export const getTripRegistry = (): TripMetadata[] => {
    return getLocal<TripMetadata[]>('registry', []);
};

export const subscribeToRegistry = (callback: (trips: TripMetadata[]) => void) => {
    return subscribeLocal<TripMetadata[]>('registry', callback, []);
};

export const createNewTripId = () => {
    const newId = `trip_${Date.now()}`;
    return newId;
};

export const switchTrip = (tripId: string) => {
    currentTripId = tripId;
    localStorage.setItem(LAST_TRIP_KEY, tripId);
    
    // Notify all subscribers that data has "changed" (because the trip ID changed)
    notify('settings', getLocal('settings', null));
    notify('itinerary', getLocal('itinerary', []));
    notify('expenses', getLocal('expenses', []));
    notify('users', getLocal('users', []));
    notify('chat', getLocal('chat', []));
    notify('markers', getLocal('markers', []));
};

export const deleteTrip = (tripId: string) => {
    const registry = getTripRegistry();
    const updatedRegistry = registry.filter(t => t.id !== tripId);
    setLocal('registry', updatedRegistry);

    // Cleanup local storage for that trip
    const keysToRemove = ['settings', 'itinerary', 'expenses', 'users', 'chat', 'markers'];
    keysToRemove.forEach(k => localStorage.removeItem(`${tripId}_${k}`));

    // If we deleted the current trip, switch to another one or reset
    if (currentTripId === tripId) {
        if (updatedRegistry.length > 0) {
            switchTrip(updatedRegistry[0].id);
        } else {
            currentTripId = '';
            localStorage.removeItem(LAST_TRIP_KEY);
            // Refresh empty state
            switchTrip(''); 
        }
    }
};

// --- DATA EXPORT / IMPORT ---
export const exportTripData = () => {
    if (!currentTripId) return;
    const data = {
        metadata: {
            id: currentTripId,
            version: 'v2'
        },
        settings: getLocal('settings', null),
        itinerary: getLocal('itinerary', []),
        expenses: getLocal('expenses', []),
        users: getLocal('users', []),
        chat: getLocal('chat', []),
        markers: getLocal('markers', [])
    };
    
    const settings = data.settings as TripSettings | null;
    const filename = settings ? `trip-${settings.destination.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json` : 'trip-backup.json';
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const importTripData = async (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                
                // Create a new ID for the imported trip to avoid conflicts
                const newId = createNewTripId();
                const oldId = currentTripId; // Backup current
                currentTripId = newId; // Switch context to save

                if (data.settings) setLocal('settings', data.settings);
                if (data.itinerary) setLocal('itinerary', data.itinerary);
                if (data.expenses) setLocal('expenses', data.expenses);
                if (data.users) setLocal('users', data.users);
                if (data.chat) setLocal('chat', data.chat);
                if (data.markers) setLocal('markers', data.markers);

                // Add to registry
                if (data.settings) {
                    const registry = JSON.parse(localStorage.getItem(REGISTRY_KEY) || '[]');
                    registry.push({
                        id: newId,
                        destination: data.settings.destination,
                        startDate: data.settings.startDate,
                        endDate: data.settings.endDate
                    });
                    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
                    notify('registry', registry);
                }

                // Switch to the new imported trip
                switchTrip(newId);
                resolve(true);
            } catch (err) {
                console.error("Import failed", err);
                alert("Invalid file format");
                // Restore if failed
                resolve(false);
            }
        };
        reader.readAsText(file);
    });
};

// --- Trip Settings ---
export const subscribeToTripSettings = (callback: (settings: TripSettings | null) => void) => {
    return subscribeLocal<TripSettings | null>('settings', callback, null);
};

export const updateTripSettings = async (settings: TripSettings) => {
    // Ensure we have a valid ID when saving settings
    if (!currentTripId) {
        currentTripId = createNewTripId();
        localStorage.setItem(LAST_TRIP_KEY, currentTripId);
    }
    setLocal('settings', settings);

    // Update Registry
    const registry = getTripRegistry();
    const existingIndex = registry.findIndex(t => t.id === currentTripId);
    const meta: TripMetadata = {
        id: currentTripId,
        destination: settings.destination,
        startDate: settings.startDate,
        endDate: settings.endDate
    };

    if (existingIndex >= 0) {
        registry[existingIndex] = meta;
    } else {
        registry.push(meta);
    }
    setLocal('registry', registry);
};

// --- Itinerary ---
export const subscribeToItinerary = (callback: (items: ItineraryItem[]) => void) => {
    return subscribeLocal<ItineraryItem[]>('itinerary', callback);
};

export const addItineraryItem = async (item: Omit<ItineraryItem, 'id'>) => {
    const items = getLocal<ItineraryItem[]>('itinerary', []);
    const newItem = { ...item, id: Date.now().toString() } as ItineraryItem;
    setLocal('itinerary', [...items, newItem]);
};

export const deleteItineraryItem = async (id: string) => {
    const items = getLocal<ItineraryItem[]>('itinerary', []);
    setLocal('itinerary', items.filter(i => i.id !== id));
};

export const updateItineraryItem = async (id: string, updates: Partial<ItineraryItem>) => {
    const items = getLocal<ItineraryItem[]>('itinerary', []);
    const updated = items.map(i => i.id === id ? { ...i, ...updates } : i);
    setLocal('itinerary', updated);
};

// --- Map Markers ---
export const subscribeToMarkers = (callback: (markers: MapMarker[]) => void) => {
    return subscribeLocal<MapMarker[]>('markers', callback);
};

export const addMapMarker = async (marker: Omit<MapMarker, 'id'>) => {
    const items = getLocal<MapMarker[]>('markers', []);
    const newItem = { ...marker, id: Date.now().toString() } as MapMarker;
    setLocal('markers', [...items, newItem]);
};

export const clearAllMarkers = async () => {
    setLocal('markers', []);
};

// --- Expenses ---
export const subscribeToExpenses = (callback: (expenses: Expense[]) => void) => {
    return subscribeLocal<Expense[]>('expenses', callback);
};

export const addExpenseItem = async (item: Omit<Expense, 'id'>) => {
    const items = getLocal<Expense[]>('expenses', []);
    const newItem = { ...item, id: Date.now().toString() } as Expense;
    setLocal('expenses', [newItem, ...items]);
};

export const deleteExpenseItem = async (id: string) => {
    const items = getLocal<Expense[]>('expenses', []);
    setLocal('expenses', items.filter(i => i.id !== id));
};

// --- Users ---
export const subscribeToUsers = (callback: (users: User[]) => void) => {
    return subscribeLocal<User[]>('users', callback);
};

export const addUser = async (name: string) => {
    const items = getLocal<User[]>('users', []);
    if (!items.find(u => u.name === name)) {
        const newItem = { id: Date.now().toString(), name };
        setLocal('users', [...items, newItem]);
    }
};

export const updateUser = async (id: string, newName: string) => {
    const items = getLocal<User[]>('users', []);
    const updated = items.map(u => u.id === id ? { ...u, name: newName } : u);
    setLocal('users', updated);
};

export const deleteUser = async (id: string) => {
    const items = getLocal<User[]>('users', []);
    setLocal('users', items.filter(u => u.id !== id));
};

// --- Chat ---
export const subscribeToChat = (callback: (messages: ChatMessage[]) => void) => {
    const loadLocalChat = (data: ChatMessage[]) => {
        // Sort by timestamp just in case
        const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
        callback(sorted);
    };
    return subscribeLocal<ChatMessage[]>('chat', loadLocalChat);
};

export const sendChatMessage = async (message: Omit<ChatMessage, 'id'>) => {
    const items = getLocal<ChatMessage[]>('chat', []);
    const newItem = { ...message, id: Date.now().toString() } as ChatMessage;
    // Keep last 50 messages to save local storage space
    const updated = [...items, newItem].slice(-50);
    setLocal('chat', updated);
};
