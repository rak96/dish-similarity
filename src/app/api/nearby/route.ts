import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { CohereClient } from 'cohere-ai';

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

interface GooglePlace {
  name: string;
  formatted_address: string;
  rating?: number;
  price_level?: number;
  place_id: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types: string[];
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
}



export async function POST(request: NextRequest) {
  try {
    const { dish, restaurant, latitude, longitude, radius = 5000 } = await request.json();

    if (!dish) {
      return NextResponse.json({ error: 'Dish name is required' }, { status: 400 });
    }

    if (!latitude || !longitude) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 });
    }

    const placesApiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!placesApiKey) {
      return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 });
    }

    const originalDish = dish;
    const sourceRestaurant = restaurant || null;
    const userLocation = `${latitude}, ${longitude}`;

    // If we have a source restaurant, first analyze that dish at that restaurant
    let dishProfile = null;
    if (sourceRestaurant && sourceRestaurant.name !== 'Address not specified') {
      try {
        dishProfile = await analyzeDishAtRestaurant(originalDish, sourceRestaurant.name);
      } catch (error) {
        console.warn('Could not analyze source dish, proceeding with general search:', error);
      }
    }

    // Search for restaurants that serve this type of dish (excluding the source restaurant)
    const searchQueries = [
      `"${originalDish}" restaurant`,
      `${originalDish} food`,
      ...(dishProfile?.cuisineType ? [`${dishProfile.cuisineType} restaurant`] : []),
      'restaurant'  // General search to ensure variety
    ];

    // Process searches in parallel but limit results
    const searchPromises = searchQueries.map(async (query) => {
      try {
        const response = await axios.get(
          'https://maps.googleapis.com/maps/api/place/textsearch/json',
          {
            params: {
              query: query,
              location: `${latitude},${longitude}`,
              radius: radius,
              type: 'restaurant',
              key: placesApiKey,
            },
          }
        );
        return response.data.results?.slice(0, 5) || []; // Limit to 5 per search
      } catch (error) {
        console.error(`Error searching for "${query}":`, error);
        return [];
      }
    });

    const allSearchResults = await Promise.all(searchPromises);
    const allPlaces = allSearchResults.flat();

    // Remove duplicates and limit total results
    const uniquePlaces = allPlaces.filter(
      (place, index, self) =>
        index === self.findIndex((p) => p.place_id === place.place_id)
    ).slice(0, 12); // Limit to 12 restaurants max

    // Get detailed restaurant information including reviews and websites
    const detailedRestaurants = await Promise.all(
      uniquePlaces.slice(0, 8).map(place => getRestaurantDetails(place, placesApiKey))
    );

    // Filter out restaurants we couldn't get details for
    const validRestaurants = detailedRestaurants.filter(r => r !== null);

    if (validRestaurants.length === 0) {
      return NextResponse.json({
        restaurants: [],
        searchLocation: userLocation,
        searchRadius: radius,
        originalDish,
        error: 'No restaurants found with sufficient data for analysis'
      });
    }

    // Filter out the source restaurant from results if provided
    const filteredRestaurants = validRestaurants.filter(r => 
      !sourceRestaurant || 
      !r.name.toLowerCase().includes(sourceRestaurant.name.toLowerCase())
    );

    // Analyze dish availability using detailed restaurant data
    const dishAvailabilityResults = await intelligentDishAnalysis(
      filteredRestaurants,
      originalDish,
      dishProfile
    );

    // Build final results with enhanced data
    const restaurantResults = filteredRestaurants.map((restaurant, index) => {
      const dishAvailability = dishAvailabilityResults[index];

      return {
        name: restaurant.name,
        address: restaurant.address,
        rating: restaurant.rating,
        priceLevel: restaurant.priceLevel,
        placeId: restaurant.placeId,
        location: restaurant.location,
        types: restaurant.types,
        photos: restaurant.photos,
        phone: restaurant.phone,
        website: restaurant.website,
        dishAvailability,
        menuInsights: restaurant.menuInsights,
        tasteProfile: restaurant.tasteProfile,
      };
    });

    // Sort by dish availability confidence, then by rating
    restaurantResults.sort((a, b) => {
      if (a.dishAvailability.confidence !== b.dishAvailability.confidence) {
        return b.dishAvailability.confidence - a.dishAvailability.confidence;
      }
      return (b.rating || 0) - (a.rating || 0);
    });

    return NextResponse.json({
      restaurants: restaurantResults.slice(0, 15),
      searchLocation: userLocation,
      searchRadius: radius,
      originalDish,
      sourceRestaurant: sourceRestaurant?.name || null,
      dishProfile: dishProfile ? {
        cuisineType: dishProfile.cuisineType,
        flavorProfile: dishProfile.flavorProfile,
        cookingStyle: dishProfile.cookingStyle
      } : null,
    });

  } catch (error) {
    console.error('Error in nearby API:', error);
    
    // Provide more detailed error messages
    if (error instanceof Error) {
      if (error.message.includes('Cohere API key')) {
        return NextResponse.json(
          { error: 'Cohere API key not configured. Please add COHERE_API_KEY to environment variables.' },
          { status: 500 }
        );
      }
      if (error.message.includes('Failed to parse analysis')) {
        return NextResponse.json(
          { error: `AI Analysis Failed: ${error.message}` },
          { status: 500 }
        );
      }
      if (error.message.includes('AI failed to analyze')) {
        return NextResponse.json(
          { error: `AI Analysis Incomplete: ${error.message}` },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: `API Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}` },
      { status: 500 }
    );
  }
}

async function analyzeDishAtRestaurant(dishName: string, restaurantName: string) {
  const cohere = new CohereClient({
    token: process.env.COHERE_API_KEY,
  });

  const prompt = `Analyze this specific dish at this restaurant:

Dish: ${dishName}
Restaurant: ${restaurantName}

Provide a detailed profile of this dish including:
- Flavor profile (spicy, sweet, savory, etc.)
- Cooking style and preparation method
- Key ingredients and seasonings
- Texture and presentation
- What makes this version unique
- Cuisine type

Format as a structured analysis.`;

  try {
    const response = await cohere.generate({
      model: 'command-r-plus',
      prompt,
      maxTokens: 300,
      temperature: 0.3,
    });

    const analysis = response.generations[0]?.text?.trim();
    
    // Extract key information for comparison
    return {
      analysis,
      cuisineType: extractCuisineType(analysis),
      flavorProfile: extractFlavorProfile(analysis),
      cookingStyle: extractCookingStyle(analysis)
    };
  } catch (error) {
    console.error('Error analyzing source dish:', error);
    throw error;
  }
}

function extractCuisineType(analysis: string): string {
  // Simple extraction - look for cuisine keywords
  const cuisines = ['American', 'Chinese', 'Italian', 'Mexican', 'Thai', 'Indian', 'Japanese', 'Korean', 'Mediterranean', 'French'];
  for (const cuisine of cuisines) {
    if (analysis.toLowerCase().includes(cuisine.toLowerCase())) {
      return cuisine;
    }
  }
  return 'American'; // default
}

function extractFlavorProfile(analysis: string): string[] {
  const flavors = ['spicy', 'sweet', 'savory', 'tangy', 'sour', 'bitter', 'umami', 'smoky', 'crispy', 'tender'];
  return flavors.filter(flavor => analysis.toLowerCase().includes(flavor));
}

function extractCookingStyle(analysis: string): string {
  const styles = ['fried', 'grilled', 'baked', 'roasted', 'steamed', 'sautéed', 'braised'];
  for (const style of styles) {
    if (analysis.toLowerCase().includes(style)) {
      return style;
    }
  }
  return 'prepared'; // default
}

async function getRestaurantDetails(place: GooglePlace, apiKey: string) {
  try {
    // Get restaurant details including reviews and website
    const detailsResponse = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      {
        params: {
          place_id: place.place_id,
          fields: 'name,formatted_phone_number,website,reviews,types,editorial_summary',
          key: apiKey,
        },
      }
    );

    const details = detailsResponse.data.result;
    
    // Extract menu items and taste descriptors from reviews
    const menuInsights = await extractMenuFromReviews(details.reviews || []);
    const tasteProfile = await extractTasteProfile(details.reviews || [], place.name);

    return {
      name: place.name,
      address: place.formatted_address,
      rating: place.rating,
      priceLevel: place.price_level,
      placeId: place.place_id,
      location: place.geometry.location,
      types: place.types,
      photos: place.photos ? place.photos.slice(0, 1) : [],
      phone: details.formatted_phone_number,
      website: details.website,
      editorialSummary: details.editorial_summary?.overview,
      reviews: details.reviews || [],
      menuInsights,
      tasteProfile,
    };

  } catch (error) {
    console.error(`Error getting details for ${place.name}:`, error);
    return null;
  }
}

async function extractMenuFromReviews(reviews: Array<{ text: string; rating: number }>) {
  if (reviews.length === 0) return { dishes: [], confidence: 0 };

  const reviewTexts = reviews.slice(0, 10).map(r => r.text).join('\n\n');
  
  try {
    const prompt = `Analyze these restaurant reviews to extract specific menu items and dishes mentioned.

Reviews:
${reviewTexts}

Extract ONLY specific dish names, menu items, and food descriptions mentioned in the reviews. 
Return a JSON array of dishes with their descriptions:

Example format:
["Spicy chicken sandwich - crispy and flavorful", "Fish tacos - fresh with tangy sauce", "Caesar salad - large portion"]

Focus on:
- Specific dish names (not just "food" or "meal")
- Descriptive adjectives about taste/texture
- Menu items that reviewers specifically named
- Signature dishes or chef recommendations

Return only the JSON array, no other text:`;

    const response = await cohere.generate({
      model: 'command-r-plus',
      prompt: prompt,
      maxTokens: 300,
      temperature: 0.2,
    });

    const responseText = response.generations[0].text.trim();
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      const dishes = JSON.parse(jsonMatch[0]);
      return {
        dishes: dishes.slice(0, 15), // Limit to 15 dishes
        confidence: dishes.length > 0 ? Math.min(dishes.length * 10, 90) : 10
      };
    }
  } catch (error) {
    console.error('Error extracting menu from reviews:', error);
  }

  return { dishes: [], confidence: 10 };
}

async function extractTasteProfile(reviews: Array<{ text: string; rating: number }>, restaurantName: string) {
  if (reviews.length === 0) return { flavors: [], style: 'Unknown', confidence: 0 };

  const reviewTexts = reviews.slice(0, 8).map(r => r.text).join('\n\n');
  
  try {
    const prompt = `Analyze these restaurant reviews to create a taste/flavor profile for "${restaurantName}".

Reviews:
${reviewTexts}

Based on the reviews, determine:
1. Primary flavors commonly mentioned (spicy, sweet, savory, salty, umami, tangy, etc.)
2. Cooking styles (grilled, fried, steamed, roasted, etc.)
3. Cuisine characteristics (authentic, fusion, comfort food, etc.)
4. Texture descriptions (crispy, tender, creamy, etc.)

Return ONLY a JSON object in this format:
{
  "flavors": ["spicy", "savory", "umami"],
  "style": "Asian fusion with bold flavors",
  "textures": ["crispy", "tender"],
  "specialties": ["spicy dishes", "grilled items"]
}`;

    const response = await cohere.generate({
      model: 'command-r-plus',
      prompt: prompt,
      maxTokens: 200,
      temperature: 0.2,
    });

    const responseText = response.generations[0].text.trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const profile = JSON.parse(jsonMatch[0]);
      return {
        ...profile,
        confidence: reviews.length > 3 ? 80 : 50
      };
    }
  } catch (error) {
    console.error('Error extracting taste profile:', error);
  }

  return { flavors: [], style: 'Unknown', confidence: 20 };
}

async function intelligentDishAnalysis(
  restaurants: Array<{
    name: string;
    menuInsights: { dishes: string[] };
    tasteProfile: { flavors?: string[]; style?: string };
    types: string[];
  }>,
  originalDish: string,
  dishProfile?: { analysis: string; cuisineType: string; flavorProfile: string[]; cookingStyle: string } | null
): Promise<Array<{ hasExactDish: boolean; hasSimilarDish: boolean; confidence: number; reasoning: string }>> {
  if (!process.env.COHERE_API_KEY) {
    throw new Error('Cohere API key not configured');
  }

  // Create comprehensive restaurant profiles for analysis
  const restaurantProfiles = restaurants.map((restaurant, index) => {
    const menuItems = restaurant.menuInsights.dishes.slice(0, 5).join(', ');
    const flavors = restaurant.tasteProfile.flavors?.join(', ') || 'unknown';
    const style = restaurant.tasteProfile.style || 'unknown style';
    
    return `${index + 1}. ${restaurant.name}
   - Menu items: ${menuItems || 'Not specified in reviews'}
   - Taste profile: ${flavors} flavors, ${style}
   - Restaurant type: ${restaurant.types.join(', ')}`;
  }).join('\n\n');

  const dishContext = dishProfile ? `

SOURCE DISH ANALYSIS:
The user had "${originalDish}" at a restaurant and wants to find similar versions elsewhere.
${dishProfile.analysis}

Key characteristics to match:
- Cuisine: ${dishProfile.cuisineType}
- Flavors: ${dishProfile.flavorProfile.join(', ')}
- Cooking style: ${dishProfile.cookingStyle}
` : '';

  const prompt = `You are analyzing restaurants to find where someone could get "${originalDish}" or very similar dishes.${dishContext}

RESTAURANT PROFILES:
${restaurantProfiles}

Your task: For each restaurant, analyze if they likely serve "${originalDish}" or dishes with very similar taste profiles.

Consider:
- Specific menu items mentioned in reviews
- Flavor profiles (spicy, savory, sweet, etc.)
- Cooking styles and cuisine types
- Texture and preparation methods
- Cultural/regional cuisine matches${dishProfile ? '\n- How well they match the reference dish characteristics' : ''}

For each restaurant (1-${restaurants.length}), respond in this EXACT format:
Restaurant 1: hasExact=false, hasSimilar=true, confidence=75, reason=Serves spicy Asian dishes with similar flavor profile
Restaurant 2: hasExact=true, hasSimilar=true, confidence=90, reason=Menu reviews mention this exact dish

Rules:
- hasExact: true only if reviews mention the exact dish name or very close variations
- hasSimilar: true if flavor/style profiles suggest similar dishes are available
- confidence: 0-100 based on strength of menu/taste evidence
- reason: specific evidence from menu items or taste profile (15 words max)

You MUST analyze ALL ${restaurants.length} restaurants. Do not skip any.

Analysis:`;

  const response = await cohere.generate({
    model: 'command-r-plus',
    prompt: prompt,
    maxTokens: 600,
    temperature: 0.1,
  });

  const responseText = response.generations[0].text.trim();
  return parseIntelligentAnalysisResponse(responseText, restaurants);
}

function parseIntelligentAnalysisResponse(
  responseText: string, 
  restaurants: Array<{
    name: string;
    menuInsights: { dishes: string[] };
    tasteProfile: { flavors?: string[]; style?: string };
    types: string[];
  }>
): Array<{ hasExactDish: boolean; hasSimilarDish: boolean; confidence: number; reasoning: string }> {
  const results = [];
  const lines = responseText.split('\n').filter(line => line.trim());

  for (let i = 0; i < restaurants.length; i++) {
    const line = lines.find(l => l.includes(`Restaurant ${i + 1}:`));
    
    if (line) {
      try {
        const hasExact = line.includes('hasExact=true');
        const hasSimilar = line.includes('hasSimilar=true');
        const confidenceMatch = line.match(/confidence=(\d+)/);
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : null;
        const reasonMatch = line.match(/reason=(.+)$/);
        const reasoning = reasonMatch ? reasonMatch[1].trim() : null;

        if (confidence === null || !reasoning) {
          throw new Error(`Failed to parse confidence or reasoning for restaurant ${i + 1}`);
        }

        results.push({
          hasExactDish: hasExact,
          hasSimilarDish: hasSimilar,
          confidence: Math.min(Math.max(confidence, 0), 100),
          reasoning: reasoning
        });
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        throw new Error(`Failed to parse intelligent analysis for restaurant ${i + 1}: ${restaurants[i].name}. Line: ${line}. Error: ${errorMessage}`);
      }
    } else {
      throw new Error(`AI failed to analyze restaurant ${i + 1}: ${restaurants[i].name}. Missing from response.`);
    }
  }

  if (results.length !== restaurants.length) {
    throw new Error(`Analysis incomplete: Expected ${restaurants.length} results, got ${results.length}`);
  }

  return results;
}

// Fallback API endpoint for when Google Places is not available
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  
  if (!lat || !lng) {
    return NextResponse.json(
      { error: 'Latitude and longitude are required' },
      { status: 400 }
    );
  }

  // Mock data for development/testing
  const mockRestaurants = [
    {
      name: "Spice House",
      address: "123 Main St, Your City",
      rating: 4.5,
      priceLevel: 2,
      placeId: "mock_1",
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      types: ["restaurant", "food"],
      photos: [],
      suggestion: {
        dishName: "Spicy Chicken Wings",
        cuisine: "American",
        similarityReason: "Similar spice level and preparation method",
      },
    },
    {
      name: "Dragon Garden",
      address: "456 Oak Ave, Your City",
      rating: 4.2,
      priceLevel: 2,
      placeId: "mock_2",
      location: { lat: parseFloat(lat) + 0.001, lng: parseFloat(lng) + 0.001 },
      types: ["restaurant", "chinese"],
      photos: [],
      suggestion: {
        dishName: "Kung Pao Chicken",
        cuisine: "Chinese",
        similarityReason: "Bold flavors with similar heat profile",
      },
    },
  ];

  return NextResponse.json({
    restaurants: mockRestaurants,
    searchLocation: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
    searchRadius: 5000,
    note: "Using mock data - configure Google Places API for real results",
  });
}