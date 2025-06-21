'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Star, DollarSign, Utensils, Loader2, ChefHat, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';



interface Restaurant {
  name: string;
  address: string;
  rating: number;
  priceLevel: number;
  placeId: string;
  location: { lat: number; lng: number };
  types: string[];
  photos: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  phone?: string;
  website?: string;
  dishAvailability: {
    hasExactDish: boolean;
    hasSimilarDish: boolean;
    confidence: number;
    reasoning: string;
  };
  menuInsights?: {
    dishes: string[];
    confidence: number;
  };
  tasteProfile?: {
    flavors: string[];
    style: string;
    textures?: string[];
    specialties?: string[];
    confidence: number;
  };

}

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface SelectedPlace {
    name: string;
    address: string;
}

const libraries: "places"[] = ['places'];

export default function Home() {
  const [dish, setDish] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [error, setError] = useState('');
  
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [dishToAnalyze, setDishToAnalyze] = useState('');
  const [isAnalyzingDish, setIsAnalyzingDish] = useState(false);
  const [dishAnalysis, setDishAnalysis] = useState('');

  // Debugging states
  const [debugMode, setDebugMode] = useState(false);
  const [fallbackInput, setFallbackInput] = useState('');
  const [useFallback, setUseFallback] = useState(false);

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    libraries,
  });

  useEffect(() => {
    getUserLocation();
    console.log('🚀 Component mounted');
    console.log('🗝️ Google Maps API Key available:', !!apiKey);
    console.log('🗝️ API Key length:', apiKey?.length || 0);
    console.log('📍 Maps loaded:', isLoaded);
    console.log('❌ Load error:', loadError);
    
    // Auto-enable fallback if there's no API key or loading fails
    if (!apiKey || loadError) {
      console.log('⚠️ Auto-enabling fallback due to missing API key or load error');
      setUseFallback(true);
    }
  }, [isLoaded, loadError, apiKey]);

  const getUserLocation = () => {
    console.log('📍 Getting user location...');
    setIsGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          console.log('✅ Location obtained:', location);
          setUserLocation(location);
          setIsGettingLocation(false);
        },
        (error) => {
          console.error('❌ Error getting location:', error);
          setIsGettingLocation(false);
        }
      );
    } else {
      console.log('❌ Geolocation not supported');
      setIsGettingLocation(false);
    }
  };

  const handlePlaceChanged = () => {
    console.log('🏪 Place changed event fired');
    if (autocompleteRef.current !== null) {
      const place = autocompleteRef.current.getPlace();
      console.log('📍 Selected place:', place);
      if (place && place.name && place.formatted_address) {
        const selectedPlace = { name: place.name, address: place.formatted_address };
        console.log('✅ Valid place selected:', selectedPlace);
        setSelectedPlace(selectedPlace);
        setError('');
      } else {
        console.log('⚠️ Invalid place selected');
      }
    } else {
      console.log('❌ Autocomplete ref is null');
    }
  };

  const handleFallbackInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    console.log('📝 Fallback input change:', value);
    setFallbackInput(value);
    
    // Simple parsing for fallback - user can type "Restaurant Name, Address"
    if (value.includes(',')) {
      const [name, address] = value.split(',').map(s => s.trim());
      if (name && address) {
        setSelectedPlace({ name, address });
        console.log('✅ Fallback place parsed:', { name, address });
      }
    } else if (value.trim() && !value.includes(',')) {
      // If no comma, treat as restaurant name only
      setSelectedPlace({ name: value.trim(), address: 'Address not specified' });
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔍 Form submitted');
    console.log('🍽️ Dish:', dish);
    console.log('🏪 Selected place:', selectedPlace);
    console.log('📍 User location:', userLocation);
    
    if (!dish.trim() || !selectedPlace) {
      const errorMsg = 'Please enter a dish and select a valid restaurant.';
      console.log('❌ Validation error:', errorMsg);
      setError(errorMsg);
      return;
    }
    if (!userLocation) {
      const errorMsg = 'Please allow location access to find nearby restaurants.';
      console.log('❌ Location error:', errorMsg);
      setError(errorMsg);
      return;
    }

    setIsLoading(true);
    setError('');
    setSelectedRestaurant(null);
    setRestaurants([]);

    try {
      console.log('📡 Making API call to /api/nearby');
      const nearbyResponse = await axios.post('/api/nearby', {
        dish: dish.trim(),
        restaurant: selectedPlace,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        radius: 8000,
      });
      console.log('✅ Nearby response:', nearbyResponse.data);
      setRestaurants(nearbyResponse.data.restaurants);
    } catch (error) {
      console.error('❌ API Error:', error);
      setError('Failed to find nearby restaurants. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSelectRestaurant = (restaurant: Restaurant) => {
    console.log('🏪 Restaurant selected:', restaurant.name);
    setSelectedRestaurant(restaurant);
    setDishAnalysis('');
    setDishToAnalyze('');
    setTimeout(() => {
      document.getElementById('dish-analysis-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };
  
  const handleAnalyzeDishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishToAnalyze.trim() || !selectedRestaurant) return;
    console.log('🔍 Analyzing dish:', dishToAnalyze, 'at', selectedRestaurant.name);
    setIsAnalyzingDish(true);
    setDishAnalysis('');
    try {
      const response = await axios.post('/api/analyze-dish', {
        dishName: dishToAnalyze,
        restaurantName: selectedRestaurant.name,
        restaurantAddress: selectedRestaurant.address,
      });
      console.log('✅ Dish analysis:', response.data);
      setDishAnalysis(response.data.analysis);
    } catch (error) {
      console.error('❌ Dish analysis error:', error);
      setDishAnalysis("Sorry, we couldn't analyze this dish at the moment.");
    } finally {
      setIsAnalyzingDish(false);
    }
  };

  const getPriceLevel = (level: number) => '$'.repeat(level || 1);

  const shouldUseFallback = useFallback || !apiKey || loadError || !isLoaded;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
            <div className="flex justify-center items-center mb-4">
                <Utensils className="w-8 h-8 text-orange-600 mr-2" />
                <h1 className="text-4xl font-bold text-gray-900">Dish Discovery</h1>
            </div>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Find similar dishes at other restaurants! Tell us about a dish you loved at a specific restaurant, 
                and we&apos;ll help you discover similar versions near you using AI-powered flavor analysis.
            </p>
        </div>

        <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                {/* Debug Panel */}
                <div className="mb-4 p-3 bg-gray-100 rounded-lg text-xs">
                    <button 
                        onClick={() => setDebugMode(!debugMode)}
                        className="text-blue-600 hover:text-blue-800"
                    >
                        {debugMode ? 'Hide' : 'Show'} Debug Info
                    </button>
                    {debugMode && (
                        <div className="mt-2 space-y-1">
                            <div>🗝️ API Key: {apiKey ? `Present (${apiKey.length} chars)` : 'Missing'}</div>
                            <div>📍 Maps Loaded: {isLoaded ? 'Yes' : 'No'}</div>
                            <div>❌ Load Error: {loadError ? `Yes - ${loadError.message}` : 'No'}</div>
                            <div>🏪 Selected Place: {selectedPlace ? selectedPlace.name : 'None'}</div>
                            <div>📍 User Location: {userLocation ? 'Available' : 'Not available'}</div>
                            <div>🔄 Using Fallback: {shouldUseFallback ? 'Yes' : 'No'}</div>
                            <button 
                                onClick={() => setUseFallback(!useFallback)}
                                className="mt-2 px-2 py-1 bg-blue-500 text-white rounded text-xs"
                            >
                                Toggle Fallback Input
                            </button>
                        </div>
                    )}
                </div>

                {/* API Key Warning */}
                {!apiKey && (
                    <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 rounded-lg flex items-center">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                        <div className="text-sm text-yellow-800">
                            <strong>Google Maps API Key Missing:</strong> Using fallback input. 
                            Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file for restaurant search.
                        </div>
                    </div>
                )}

                <form onSubmit={handleSearchSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label htmlFor="dish" className="block text-sm font-medium text-gray-700">
                                What dish did you have?
                            </label>
                            <input
                                type="text"
                                id="dish"
                                value={dish}
                                onChange={(e) => {
                                    console.log('🍽️ Dish input change:', e.target.value);
                                    setDish(e.target.value);
                                }}
                                placeholder="e.g., Fried Chicken, Big Mac, Carne Asada Tacos"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                disabled={isLoading}
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                                Where did you have it?
                            </label>
                            
                            {shouldUseFallback ? (
                                // Fallback input
                                <div>
                                    <input
                                        type="text"
                                        value={fallbackInput}
                                        onChange={handleFallbackInputChange}
                                        placeholder="Where did you have this dish? (e.g., KFC, Local Diner Name, etc.)"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                        disabled={isLoading}
                                    />
                                    <div className="text-xs text-gray-500 mt-1">
                                        Manual input mode. For better results, configure Google Maps API key.
                                    </div>
                                </div>
                            ) : (
                                // Google Maps Autocomplete
                                <Autocomplete
                                    onLoad={(ref) => {
                                        console.log('🗺️ Autocomplete loaded:', ref);
                                        autocompleteRef.current = ref;
                                    }}
                                    onPlaceChanged={handlePlaceChanged}
                                    options={{ 
                                        fields: ["name", "formatted_address"],
                                        types: ["establishment"] 
                                    }}
                                >
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        id="location"
                                        placeholder="Where did you have this dish? (e.g., KFC, Local Diner, etc.)"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                        disabled={isLoading}
                                        onChange={(e) => {
                                            console.log('🏪 Restaurant input change:', e.target.value);
                                        }}
                                        onFocus={() => {
                                            console.log('🎯 Restaurant input focused');
                                        }}
                                        onBlur={() => {
                                            console.log('👋 Restaurant input blurred');
                                        }}
                                    />
                                </Autocomplete>
                            )}
                            
                            {loadError && (
                                <div className="text-red-600 text-sm">
                                    Error loading maps: {loadError.message}
                                </div>
                            )}
                            {selectedPlace && (
                                <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                                    ✓ Selected: {selectedPlace.name}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                            <MapPin className="w-5 h-5 text-gray-500 mr-2" />
                            <span className="text-sm text-gray-600">
                                {userLocation 
                                ? 'Location detected - ready to find nearby restaurants!' 
                                : 'Location access needed to find nearby restaurants'
                                }
                            </span>
                        </div>
                        {!userLocation && (
                        <button
                            type="button"
                            onClick={getUserLocation}
                            disabled={isGettingLocation}
                            className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                        >
                            {isGettingLocation ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                            'Enable Location'
                            )}
                        </button>
                        )}
                    </div>
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-600 text-sm">{error}</p>
        </div>
                    )}
                    <button
                        type="submit"
                        disabled={isLoading || !userLocation}
                        className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white py-4 px-6 rounded-lg font-semibold hover:from-orange-700 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
                    >
                        {isLoading ? (
                            <><Loader2 className="w-5 h-5 animate-spin mr-2" />Analyzing flavors...</>
                        ) : (
                            <><Search className="w-5 h-5 mr-2" />Find Similar Dishes</>
                        )}
                    </button>
                </form>
            </div>
            {(restaurants.length > 0 || isLoading) && (
            <div className="space-y-8">
              {restaurants.length > 0 && (
                <div className="bg-white rounded-2xl shadow-xl p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    {selectedPlace && selectedPlace.name !== 'Address not specified' 
                      ? `Restaurants serving ${dish} like ${selectedPlace.name}`
                      : `Restaurants serving ${dish}`}
                  </h2>
                  <p className="text-gray-600 mb-4 -mt-4">
                    {selectedPlace && selectedPlace.name !== 'Address not specified'
                      ? `Found restaurants that might serve ${dish} similar to how ${selectedPlace.name} prepares it. Click on a restaurant to analyze a specific dish from their menu.`
                      : 'Click on a restaurant to analyze a specific dish from their menu.'}
                  </p>
                  <div className="space-y-4">
                    {restaurants.map((restaurant, index) => (
                      <div 
                        key={index} 
                        className={`border rounded-lg p-6 transition-all duration-300 cursor-pointer ${
                          selectedRestaurant?.placeId === restaurant.placeId 
                            ? 'bg-orange-50 border-orange-400 shadow-lg scale-105' 
                            : 'border-gray-200 hover:shadow-md hover:border-orange-300'
                        }`}
                        onClick={() => handleSelectRestaurant(restaurant)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-lg text-gray-900">{restaurant.name}</h3>
                            <p className="text-gray-600 text-sm">{restaurant.address}</p>
                          </div>
                          <div className="flex items-center space-x-2 text-sm">
                            {restaurant.rating && (
                              <div className="flex items-center">
                                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                <span className="ml-1 text-gray-700">{restaurant.rating}</span>
                              </div>
                            )}
                            {restaurant.priceLevel && (
                              <div className="flex items-center text-green-600">
                                <DollarSign className="w-4 h-4" />
                                <span>{getPriceLevel(restaurant.priceLevel)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-3">
                          {/* Dish Availability Status */}
                          <div className={`rounded-lg p-4 ${
                            restaurant.dishAvailability.hasExactDish 
                              ? 'bg-green-100 border-2 border-green-300' 
                              : restaurant.dishAvailability.hasSimilarDish 
                                ? 'bg-yellow-100 border-2 border-yellow-300'
                                : 'bg-gray-100 border-2 border-gray-300'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                {restaurant.dishAvailability.hasExactDish ? (
                                  <div className="flex items-center text-green-700">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                    <span className="font-semibold text-sm">Likely has exact dish</span>
                                  </div>
                                ) : restaurant.dishAvailability.hasSimilarDish ? (
                                  <div className="flex items-center text-yellow-700">
                                    <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                                    <span className="font-semibold text-sm">Likely has similar dish</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center text-gray-700">
                                    <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                                    <span className="font-semibold text-sm">May have related dishes</span>
                                  </div>
                                )}
                              </div>
                              <div className="text-xs font-medium px-2 py-1 rounded-full bg-white">
                                {restaurant.dishAvailability.confidence}% confidence
                              </div>
                            </div>
                            <p className="text-xs text-gray-600">
                              {restaurant.dishAvailability.reasoning}
                            </p>
                          </div>



                          {/* Menu Insights from Reviews */}
                          {restaurant.menuInsights && restaurant.menuInsights.dishes.length > 0 && (
                            <div className="bg-blue-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-sm text-blue-800">Menu Items from Reviews</h4>
                                <span className="text-xs text-blue-600">{restaurant.menuInsights.confidence}% confidence</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {restaurant.menuInsights.dishes.slice(0, 3).map((dish, dishIndex) => (
                                  <span key={dishIndex} className="text-xs bg-white px-2 py-1 rounded-full text-blue-700 border border-blue-200">
                                    {dish.length > 40 ? dish.substring(0, 40) + '...' : dish}
                                  </span>
                                ))}
                                {restaurant.menuInsights.dishes.length > 3 && (
                                  <span className="text-xs bg-white px-2 py-1 rounded-full text-blue-700 border border-blue-200">
                                    +{restaurant.menuInsights.dishes.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Taste Profile */}
                          {restaurant.tasteProfile && restaurant.tasteProfile.flavors?.length > 0 && (
                            <div className="bg-purple-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-sm text-purple-800">Taste Profile</h4>
                                <span className="text-xs text-purple-600">{restaurant.tasteProfile.confidence}% confidence</span>
                              </div>
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-1">
                                  {restaurant.tasteProfile.flavors.map((flavor, flavorIndex) => (
                                    <span key={flavorIndex} className="text-xs bg-white px-2 py-1 rounded-full text-purple-700 border border-purple-200">
                                      {flavor}
                                    </span>
                                  ))}
                                </div>
                                {restaurant.tasteProfile.style && (
                                  <p className="text-xs text-purple-700 italic">
                                    Style: {restaurant.tasteProfile.style}
                                  </p>
                                )}
                                {restaurant.tasteProfile.specialties && restaurant.tasteProfile.specialties.length > 0 && (
                                  <p className="text-xs text-purple-700">
                                    Specialties: {restaurant.tasteProfile.specialties.join(', ')}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedRestaurant && (
                <div id="dish-analysis-section" className="bg-white rounded-2xl shadow-xl p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyze a Dish from {selectedRestaurant.name}</h2>
                  <p className="text-gray-600 mb-6">Want to know more about a specific item on their menu? Let our AI analyze it for you.</p>
                  <form onSubmit={handleAnalyzeDishSubmit} className="space-y-4">
                    <input
                      type="text"
                      value={dishToAnalyze}
                      onChange={(e) => setDishToAnalyze(e.target.value)}
                      placeholder="e.g., Pad Thai, The 'Special' Burger"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      disabled={isAnalyzingDish}
                    />
                    <button
                      type="submit"
                      disabled={isAnalyzingDish || !dishToAnalyze.trim()}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
                    >
                      {isAnalyzingDish ? (
                        <><Loader2 className="w-5 h-5 animate-spin mr-2" />Analyzing Dish...</>
                      ) : (
                        <><ChefHat className="w-5 h-5 mr-2" />Analyze This Dish</>
                      )}
                    </button>
                  </form>
                  {dishAnalysis && (
                     <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
                       <h3 className="text-xl font-bold text-gray-900 mb-3">Analysis of {dishToAnalyze}</h3>
                       <div className="prose prose-gray max-w-none">
                         <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{dishAnalysis}</p>
                       </div>
                     </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
