import { NextRequest, NextResponse } from 'next/server';
import { CohereClient } from 'cohere-ai';

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { dishName, restaurantName, restaurantAddress } = await request.json();

    if (!dishName || !restaurantName) {
      return NextResponse.json(
        { error: 'Dish name and restaurant name are required' },
        { status: 400 }
      );
    }

    const prompt = `Provide a detailed flavor profile analysis for the dish "${dishName}" from the restaurant "${restaurantName}" located at "${restaurantAddress}". 
    
    Describe its likely:
    - Key ingredients and components
    - Primary flavors (e.g., sweet, spicy, savory, umami, sour, bitter)
    - Texture profile (e.g., crispy, tender, creamy)
    - Cooking method (e.g., fried, grilled, stewed)
    - A note on its authenticity or style (e.g., traditional, modern fusion)
    - A possible drink pairing suggestion
    
    Keep the analysis concise, engaging, and informative, as if you are a food critic.`;

    const response = await cohere.generate({
      model: 'command',
      prompt: prompt,
      maxTokens: 400,
      temperature: 0.4,
    });

    const analysis = response.generations[0].text.trim();

    return NextResponse.json({ analysis });

  } catch (error) {
    console.error('Error in analyze-dish API:', error);
    return NextResponse.json(
      { error: 'Failed to analyze dish' },
      { status: 500 }
    );
  }
} 