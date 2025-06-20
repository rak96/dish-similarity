# Dish Discovery - AI-Powered Flavor Similarity Finder

Find similar dishes near you using AI! This app analyzes the flavor profile of a dish you've enjoyed and helps you discover similar tastes at nearby restaurants using Cohere's language model and Google Maps.

## Features

- 🍽️ **AI Flavor Analysis**: Uses Cohere LLM to analyze dish flavor profiles.
- 📍 **Google Places Search**: Precisely find the restaurant where you ate the dish using Google Places Autocomplete.
- 🗺️ **Location-Based Search**: Finds nearby restaurants with similar dishes based on your current location.
- 🎯 **Smart Recommendations**: Suggests dishes with similar taste profiles.
- 👨‍🍳 **Specific Dish Analysis**: Select a suggested restaurant and analyze any dish from its menu.

## Setup Instructions

### 1. Environment Setup

Create a `.env.local` file in the root directory. You can do this easily by running:

```bash
npm run setup
```

This will create a `.env.local` file with placeholders. You need to fill in your API keys.

### 2. API Keys Setup

#### Cohere API Key
- Get your key from the [Cohere Dashboard](https://dashboard.cohere.ai/).
- Add it to `COHERE_API_KEY` in `.env.local`.

#### Google Cloud API Key
You need one key from the [Google Cloud Console](https://console.cloud.google.com/) with the **Places API** and **Geocoding API** enabled.

1.  **Get the key** from the Google Cloud Console.
2.  **Enable Billing** for your project (a $200/month free credit is included).
3.  **Add the key to `.env.local` in TWO places:**
    -   `GOOGLE_PLACES_API_KEY`: Used for server-side searches.
    -   `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: Used for the client-side autocomplete search box. **It must be the same key.**

Your `.env.local` should look like this:
```
COHERE_API_KEY=your_cohere_key
GOOGLE_PLACES_API_KEY=your_google_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_key
```

### 3. Install Dependencies & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## How It Works

1. **User Input**: Enter a dish and location you've enjoyed
2. **Location Detection**: App requests user's current location
3. **Flavor Analysis**: Cohere LLM analyzes the dish's flavor profile
4. **Similarity Matching**: AI generates suggestions for similar dishes
5. **Restaurant Search**: Google Places API finds nearby restaurants
6. **Results Display**: Shows flavor analysis, suggestions, and nearby options

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **AI**: Cohere Language Model
- **Location Services**: Google Places API, Browser Geolocation
- **Icons**: Lucide React
- **Styling**: Tailwind CSS

## Deployment

### Vercel Deployment (Recommended)

1. Push your code to GitHub
2. Connect your GitHub repo to Vercel
3. Add environment variables in Vercel dashboard:
   - `COHERE_API_KEY`
   - `GOOGLE_PLACES_API_KEY`
4. Deploy!

The app is optimized for Vercel deployment with:
- Serverless API routes
- Automatic HTTPS
- Global CDN
- Easy environment variable management

### Manual Deployment

```bash
# Build the project
npm run build

# Start production server
npm start
```

## API Endpoints

### `/api/similarity` (POST)
Analyzes dish flavor profile and generates similar dish suggestions.

**Request Body:**
```json
{
  "dish": "Spicy Boys Chicken",
  "location": "Austin, TX",
  "userLocation": {
    "latitude": 30.2672,
    "longitude": -97.7431
  }
}
```

### `/api/nearby` (POST)
Finds nearby restaurants serving similar dishes.

**Request Body:**
```json
{
  "suggestions": [...],
  "userLocation": {
    "latitude": 30.2672,
    "longitude": -97.7431
  },
  "radius": 8000
}
```

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Security Considerations

- API keys are stored securely in environment variables
- Client-side location requests require user permission
- Google Places API key should be restricted to specific APIs
- Consider implementing rate limiting for production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - feel free to use this project for your own applications!

## Support

If you encounter any issues:
1. Check that all API keys are correctly configured
2. Ensure location services are enabled in your browser
3. Verify that Google Places API has proper billing setup
4. Check browser console for detailed error messages

---

**Note**: This app requires active internet connection and location permissions to work properly. The quality of restaurant suggestions depends on the availability of data in your area through Google Places API.
