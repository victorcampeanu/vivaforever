# Quote Card Editor

A web-based tool for creating and editing inspirational quote cards with AI-powered quote and image generation.

## Live App

🚀 **[https://quote-editor-rc.vercel.app/](https://quote-editor-rc.vercel.app/)**

## Features

- Create custom quote cards with dual quotes and author attribution
- AI-powered Romanian quote generation (OpenAI GPT-4)
- AI-powered background image generation (DALL-E)
- Live canvas preview
- Template system for quick designs
- Export as PNG
- Social media preview (Facebook & X/Twitter)
- Customizable fonts, colors, and styling
- Background image upload and manipulation

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (Canvas API)
- **Backend:** Vercel Serverless Functions
- **AI:** OpenAI API (GPT-4o-mini, DALL-E 3)
- **Hosting:** Vercel (with auto-deploy from GitHub)

## Project Structure

```
quote-editor/
├── api/                    # Vercel serverless functions
│   ├── health.js          # Health check endpoint
│   ├── generate-quote.js  # AI quote generation
│   └── generate-image.js  # AI image generation
├── css/
│   └── styles.css         # All styles
├── js/
│   └── app.js             # Main application logic
├── index.html             # HTML structure
└── vercel.json            # Vercel configuration
```

## Development

To run locally:

```bash
# Install Vercel CLI
npm i -g vercel

# Run dev server
vercel dev

# Open http://localhost:3000
```

## Deployment

Automatically deploys to Vercel when pushing to GitHub.

**Environment Variables Required:**

- `OPENAI_API_KEY` - Your OpenAI API key

## License

MIT
