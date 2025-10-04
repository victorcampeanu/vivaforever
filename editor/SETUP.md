# Editor Setup for Vercel

## What was fixed:

1. **Moved `vercel.json` to root** - Vercel needs this at the repository root
2. **Updated API paths** - Changed `BACKEND_URL` in `app.js` to `/editor` to match the folder structure
3. **Configured routing** - API calls now go to `/editor/api/*`

## Deployment Steps:

### 1. Deploy to Vercel

```bash
# If not already connected, connect this repo to Vercel
vercel

# Or deploy directly
vercel --prod
```

### 2. Set Environment Variable

In your Vercel project dashboard:

- Go to **Settings** → **Environment Variables**
- Add: `OPENAI_API_KEY` = `your_openai_api_key_here`
- Make sure it's enabled for **Production**, **Preview**, and **Development**
- Redeploy after adding the key

### 3. Access Your Editor

- Main site: `https://your-domain.vercel.app/`
- Editor: `https://your-domain.vercel.app/editor/`

## Testing Locally

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Set local env variable
echo "OPENAI_API_KEY=your_key_here" > .env

# Run dev server
vercel dev
```

Then visit `http://localhost:3000/editor/`

## API Endpoints

- Generate Quote: `POST /editor/api/generate-quote`
- Generate Image: `POST /editor/api/generate-image`
- Health Check: `GET /editor/api/health`

## Troubleshooting

**API returns 500 error:**

- Check that `OPENAI_API_KEY` is set in Vercel environment variables
- Redeploy after adding environment variables

**API returns 404:**

- Ensure `vercel.json` is at repository root
- Check that files are in `editor/api/` folder

**CORS errors:**

- Headers are configured in `vercel.json`
- Should work automatically on same domain
