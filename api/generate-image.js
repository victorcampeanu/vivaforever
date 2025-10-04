/**
 * Generate Background Image using OpenAI DALL-E
 * Vercel Serverless Function
 */

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { prompt, size, quality } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Invalid request. Expected "prompt" string.' });
        }

        // Check API key
        if (!process.env.OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY not configured');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'OpenAI API key not configured. Please add OPENAI_API_KEY to Vercel environment variables.'
            });
        }

        console.log('Generating image with DALL-E...');
        console.log('Prompt:', prompt);

        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'dall-e-3',
                prompt: prompt,
                size: size || '1024x1024',
                quality: quality || 'standard',
                n: 1,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('OpenAI DALL-E Error:', data);
            return res.status(response.status).json({
                error: data.error?.message || 'Image generation failed',
                details: data
            });
        }

        // Download image and convert to base64
        if (data.data?.[0]?.url) {
            try {
                console.log('Converting image to base64...');
                const imageUrl = data.data[0].url;
                const imageResponse = await fetch(imageUrl);

                if (!imageResponse.ok) {
                    throw new Error('Failed to download image');
                }

                const arrayBuffer = await imageResponse.arrayBuffer();
                const base64 = Buffer.from(arrayBuffer).toString('base64');

                data.data[0].b64_json = base64;
                data.data[0].data_url = `data:image/png;base64,${base64}`;

                console.log('Image converted successfully');
            } catch (err) {
                console.warn('Could not convert image to base64:', err);
                // Continue with URL if conversion fails
            }
        }

        console.log('Image generated successfully');
        return res.status(200).json(data);

    } catch (error) {
        console.error('Error generating image:', error);
        return res.status(500).json({
            error: 'Failed to generate image',
            message: error.message
        });
    }
}


