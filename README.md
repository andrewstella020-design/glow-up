# Glow Up

## Run locally (optional, needs Node.js installed)
```
npm install
npm run dev
```

## Deploy to Netlify
1. Create a new GitHub repository and push this whole folder to it.
2. In Netlify: "Add new site" → "Import an existing project" → connect GitHub → pick this repo.
3. Build settings should auto-fill from netlify.toml (build command `npm run build`, publish `dist`). Click Deploy.
4. In Netlify: Site settings → Environment variables → add:
   - Key: `GEMINI_API_KEY`
   - Value: your key from aistudio.google.com (Get API key — no card required)
5. Trigger a redeploy (Deploys tab → Trigger deploy) so the function picks up the new key.

Your Firebase keys are already filled in in `src/firebase.js` — those are safe to be public.
Your Gemini key is NOT public — it only lives in Netlify's environment variables and is used inside `netlify/functions/ai.js`, never in the browser.
