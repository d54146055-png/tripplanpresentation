

import { GoogleGenAI, Type } from "@google/genai";
import { ItineraryItem, ParsedLocation, TripSettings } from "../types";

// Fixed: Strictly following guidelines for GoogleGenAI initialization
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// NEW: Detect destination details for the Setup Wizard
export const detectDestinationInfo = async (input: string): Promise<Partial<TripSettings> | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the travel destination "${input}". 
      Return a JSON object with:
      - standardized destination name (City, Country)
      - local currency code (ISO 4217, e.g. JPY, GBP, KRW)
      - approximate exchange rate to TWD (Taiwan Dollar). e.g., if 1 USD = 32 TWD, return 32. If 1 JPY = 0.21 TWD, return 0.21.
      - primary language spoken
      - central latitude and longitude of the city/area.
      
      Return JSON only.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            destination: { type: Type.STRING },
            currencyCode: { type: Type.STRING },
            currencyRate: { type: Type.NUMBER },
            language: { type: Type.STRING },
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER }
          },
          required: ["destination", "currencyCode", "currencyRate", "language", "lat", "lng"]
        }
      }
    });

    return JSON.parse(response.text || "null");
  } catch (error) {
    console.error("Destination Detection Error:", error);
    return null;
  }
};

export const generateItinerarySuggestion = async (day: number, destination: string, context: string, areas?: string): Promise<Omit<ItineraryItem, 'id'>[]> => {
  try {
    const userRequest = areas 
      ? `USER REQUESTED LOCATIONS: "${areas}". YOU MUST INCLUDE THESE SPOTS. Arrange them in the most logical geographic order to minimize travel time.` 
      : 'Suggest a popular, logical route for a first-time visitor.';

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Plan a realistic 1-day itinerary for Day ${day} of a trip to ${destination}.
      ${userRequest}
      Context/Vibe: ${context}.
      
      RULES:
      1. If user provided locations, build the schedule AROUND them. Fill gaps with lunch/coffee nearby.
      2. Provide realistic Start/End times.
      3. "Location" must be a specific place name recognizable by Google Maps/Naver Maps.
      4. Include specific Latitude (lat) and Longitude (lng) for every item. THIS IS CRITICAL.
      
      Return a JSON array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              time: { type: Type.STRING, description: "Time in HH:MM format" },
              activity: { type: Type.STRING, description: "Activity title" },
              location: { type: Type.STRING, description: "Specific Place Name" },
              notes: { type: Type.STRING, description: "Tips or Transport info" },
              lat: { type: Type.NUMBER, description: "Latitude" },
              lng: { type: Type.NUMBER, description: "Longitude" },
              weather: {
                type: Type.OBJECT,
                properties: {
                  temp: { type: Type.NUMBER },
                  condition: { type: Type.STRING },
                  icon: { type: Type.STRING }
                }
              }
            },
            required: ["time", "activity", "location", "lat", "lng", "weather"]
          }
        }
      }
    });

    const items = JSON.parse(response.text || "[]");
    return items.map((item: any) => ({
      ...item,
      day
    }));
  } catch (error) {
    console.error("Gemini Itinerary Error:", error);
    return [];
  }
};

export const generateNextActivitySuggestion = async (dayItems: ItineraryItem[], destination: string): Promise<Omit<ItineraryItem, 'id'> | null> => {
  try {
    const existingContext = dayItems.map(i => `${i.time}: ${i.activity} at ${i.location}`).join('\n');
    const lastItem = dayItems[dayItems.length - 1];
    const startTime = lastItem ? lastItem.time : "09:00";
    const day = lastItem ? lastItem.day : 1;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on this existing itinerary for a day in ${destination}:
      ${existingContext}
      
      Suggest ONE single next activity that fits logically in terms of location and time (after ${startTime}).
      Return as JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            time: { type: Type.STRING, description: "Time in HH:MM format (24h)" },
            activity: { type: Type.STRING, description: "Short title of activity" },
            location: { type: Type.STRING, description: "Specific Name of the place" },
            notes: { type: Type.STRING, description: "Why this fits next" },
            weather: {
              type: Type.OBJECT,
              properties: {
                temp: { type: Type.NUMBER },
                condition: { type: Type.STRING },
                icon: { type: Type.STRING }
              }
            }
          },
          required: ["time", "activity", "location"]
        }
      }
    });

    const item = JSON.parse(response.text || "{}");
    if (!item.activity) return null;
    return { ...item, day };

  } catch (error) {
    console.error("Next Activity Error:", error);
    return null;
  }
};

export const getCoordinatesForLocation = async (locationName: string, destination: string): Promise<{lat: number, lng: number} | null> => {
    if (!locationName) return null;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Get the accurate latitude and longitude for "${locationName}" in ${destination}.
            Return JSON with lat and lng numbers. If unknown, return null.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        lat: { type: Type.NUMBER },
                        lng: { type: Type.NUMBER }
                    },
                    required: ["lat", "lng"]
                }
            }
        });
        const res = JSON.parse(response.text || "{}");
        if (res.lat && res.lng) return res;
        return null;
    } catch (e) {
        console.error("Geocoding error:", e);
        return null;
    }
}

export const parseLocationsFromText = async (text: string, destination: string): Promise<ParsedLocation[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract all specific travel locations/places in ${destination} mentioned in this text. 
      IMPORTANT: Provide accurate Latitude and Longitude for each.
      Return a JSON array. 
      Text: "${text.substring(0, 5000)}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER },
              description: { type: Type.STRING, description: "Brief snippet about this place" }
            },
            required: ["name", "lat", "lng"]
          }
        }
      }
    });
    
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Parsing locations error:", error);
    return [];
  }
};

export interface RouteOption {
  id: number;
  label: string; 
  steps: string[]; 
  duration: string; 
  cost?: string;
}

export const calculateRoute = async (from: string, to: string, destination: string): Promise<RouteOption[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Calculate 3 distinct travel routes from "${from}" to "${to}" in ${destination}.
      Options should vary (e.g., Fastest, Cheapest, Walking).
      Format the duration smartly.
      Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              label: { type: Type.STRING, description: "e.g. Option 1 (Fastest)" },
              steps: { type: Type.ARRAY, items: { type: Type.STRING } },
              duration: { type: Type.STRING, description: "e.g. 1 hr 20 mins" },
              cost: { type: Type.STRING, description: "Estimated cost" }
            },
            required: ["id", "label", "steps", "duration"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Route calculation error:", e);
    return [];
  }
};

export const parseActivityFromText = async (text: string, destination: string): Promise<Partial<ItineraryItem>> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this text and extract a single travel itinerary activity item for a trip to ${destination}.
      Text: "${text}"
      Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            time: { type: Type.STRING },
            activity: { type: Type.STRING },
            location: { type: Type.STRING },
            notes: { type: Type.STRING }
          },
          required: ["activity", "location", "time"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { activity: "New Activity", time: "10:00" };
  }
}

export const chatWithTravelGuide = async (
  message: string, 
  destination: string,
  location?: { lat: number; lng: number }
) => {
  try {
    const prompt = location 
      ? `(User is currently at ${location.lat}, ${location.lng}) ${message}`
      : message;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: `You are a savvy local guide for ${destination}. 
        You help tourists find great food, transport, and hidden gems. 
        Be extremely helpful and concise.`,
        tools: [{ googleSearch: {} }],
      }
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const mapChunks = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        source: {
          title: chunk.web.title || "Web Reference",
          uri: chunk.web.uri
        }
      }));

    return {
      text: response.text || "",
      mapChunks: mapChunks
    };

  } catch (error) {
    console.error("Chat Error:", error);
    return {
      text: "Connection failed. Please try again.",
      mapChunks: []
    };
  }
};
