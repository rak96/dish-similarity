import { NextRequest, NextResponse } from 'next/server';
import { CohereClient } from 'cohere-ai';

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { dish, restaurant, userLocation } = await request.json();

    if (!dish || !restaurant || !restaurant.name) {
      return NextResponse.json(
        { error: 'Dish and restaurant information are required' },
        { status: 400 }
      );
    }

    // Generate similar dishes recommendations directly from the dish
    const similarityPrompt = `You are a food expert analyzing the dish "${dish}" from "${restaurant.name}".
    
    Based on this dish, suggest 5-7 similar dishes that someone could find at other restaurants nearby. Consider:
    - Similar flavor profiles and spice levels
    - Comparable cooking methods and textures  
    - Different cuisines that share similar characteristics
    - Dishes with similar ingredients or preparation styles
    
    For each suggestion, provide:
    - Dish name
    - Restaurant type/cuisine where you'd find it
    - Why it's similar to "${dish}"
    - Key characteristics that make it comparable
    
    Format as a JSON array with objects containing: name, cuisine, similarity_reason, characteristics.
    
    Example format:
    [
      {
        "name": "Korean Fried Chicken", 
        "cuisine": "Korean", 
        "similarity_reason": "Similar crispy coating and spicy flavor profile",
        "characteristics": "Crispy, spicy, savory with bold seasoning"
      }
    ]`;

    const similarityResponse = await cohere.generate({
      model: 'command-r-plus',
      prompt: similarityPrompt,
      maxTokens: 600,
      temperature: 0.3,
    });

    let suggestions;
    try {
      // Extract JSON from the response
      const responseText = similarityResponse.generations[0].text.trim();
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        suggestions = parseTextResponse(responseText);
      }
    } catch {
      suggestions = parseTextResponse(similarityResponse.generations[0].text.trim());
    }

    return NextResponse.json({
      originalDish: dish,
      originalRestaurant: restaurant,
      suggestions,
      userLocation,
    });

  } catch (error) {
    console.error('Error in similarity API:', error);
    return NextResponse.json(
      { error: 'Failed to analyze dish similarity' },
      { status: 500 }
    );
  }
}

function parseTextResponse(text: string) {
  // Fallback parser for when JSON parsing fails
  const lines = text.split('\n').filter(line => line.trim());
  const suggestions = [];
  
  let currentSuggestion: Record<string, string> = {};
  
  for (const line of lines) {
    if (line.includes('Dish:') || line.includes('Name:')) {
      if (currentSuggestion.name) {
        suggestions.push(currentSuggestion);
      }
      currentSuggestion = {
        name: line.split(':')[1]?.trim() || '',
        cuisine: '',
        similarity_reason: '',
        characteristics: ''
      };
    } else if (line.includes('Cuisine:') || line.includes('Type:')) {
      currentSuggestion.cuisine = line.split(':')[1]?.trim() || '';
    } else if (line.includes('Similar because:') || line.includes('Similarity:')) {
      currentSuggestion.similarity_reason = line.split(':')[1]?.trim() || '';
    } else if (line.includes('Characteristics:')) {
      currentSuggestion.characteristics = line.split(':')[1]?.trim() || '';
    }
  }
  
  if (currentSuggestion.name) {
    suggestions.push(currentSuggestion);
  }
  
  return suggestions.length > 0 ? suggestions : [
    {
      name: "Similar spicy chicken dishes",
      cuisine: "Various",
      similarity_reason: "Similar flavor profile and spice level",
      characteristics: "Spicy, savory, with bold flavors"
    }
  ];
} 