# Dish Discovery Demo Guide

## Quick Start Demo

### 1. First Time Setup

```bash
# Install dependencies
npm install

# Create environment file with template
npm run setup

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### 2. Testing Without API Keys

The app includes fallback mock data for testing:

1. **Open the app** at `http://localhost:3000`
2. **Enter a dish**: "Spicy Boys Chicken"
3. **Enter location**: "Austin, TX"
4. **Allow location access** when prompted
5. **Click "Find Similar Dishes"**

Without API keys configured, you'll see:
- Error message about missing API keys
- But the UI and location detection will work

### 3. Getting Real API Keys

#### Get Cohere API Key (Free tier available)
1. Go to [Cohere Dashboard](https://dashboard.cohere.ai/)
2. Sign up with email or Google
3. Navigate to "API Keys" in the dashboard
4. Click "Create API Key"
5. Copy the key and add to `.env.local`:
   ```
   COHERE_API_KEY=your_actual_cohere_key_here
   ```

#### Get Google Places API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Go to "APIs & Services" → "Library"
4. Enable these APIs:
   - **Places API**
   - **Geocoding API**
5. Go to "APIs & Services" → "Credentials"
6. Click "Create Credentials" → "API Key"
7. Restrict the key to only the enabled APIs (recommended)
8. Add to `.env.local`:
   ```
   GOOGLE_PLACES_API_KEY=your_actual_google_key_here
   ```

### 4. Full Demo with API Keys

Once you have both API keys configured:

1. **Restart the development server**: `npm run dev`
2. **Test with example**: 
   - Dish: "Nashville Hot Chicken"
   - Location: "Nashville, TN"
   - Allow location access
3. **Click "Find Similar Dishes"**

You should see:
- ✅ AI-generated flavor profile analysis
- ✅ Similar dish suggestions (Korean fried chicken, Buffalo wings, etc.)
- ✅ Nearby restaurants with ratings and details

### 5. Demo Examples

Try these combinations:

| Dish | Location | Expected Results |
|------|----------|------------------|
| "Spicy Boys Chicken" | "Austin, TX" | Korean fried chicken, Nashville hot chicken |
| "Ramen Burger" | "New York, NY" | Asian fusion burgers, ramen shops |
| "Tacos al Pastor" | "Los Angeles, CA" | Korean BBQ, Middle Eastern wraps |
| "Pad Thai" | "Bangkok, Thailand" | Vietnamese pho, Chinese lo mein |

### 6. Features to Test

- **Location Services**: Allow/deny location access
- **Responsive Design**: Test on mobile and desktop
- **Loading States**: Watch the "Analyzing flavors..." animation
- **Error Handling**: Try without location access
- **Results Display**: Check flavor profiles and restaurant cards

### 7. Deployment Testing

Deploy to Vercel:

```bash
# Build for production
npm run build

# Or deploy to Vercel
# 1. Push to GitHub
# 2. Connect to Vercel
# 3. Add environment variables in Vercel dashboard
# 4. Deploy!
```

### 8. Troubleshooting

| Issue | Solution |
|-------|----------|
| "Location access needed" | Allow location in browser settings |
| "Failed to analyze dish" | Check Cohere API key in `.env.local` |
| "Failed to find nearby restaurants" | Check Google Places API key |
| Build errors | Run `npm run build` to see specific errors |
| Blank page | Check browser console for JavaScript errors |

### 9. API Usage & Costs

- **Cohere**: Free tier includes 100 API calls/month
- **Google Places**: Free tier includes $200 credit/month
- **Development**: Use mock data to avoid API charges

### 10. Next Steps

- Add more cuisine types
- Implement user favorites
- Add photo integration
- Create restaurant reservations
- Add user reviews and ratings

---

**Pro Tip**: Start with the Cohere API key first - it handles the core AI functionality. Google Places can be added later for restaurant discovery! 