/**
 * Generate Quote using OpenAI
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
        const { messages, temperature, top_p, presence_penalty, frequency_penalty, max_tokens } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Invalid request. Expected "messages" array.' });
        }

        // Check API key
        if (!process.env.OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY not configured');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'OpenAI API key not configured. Please add OPENAI_API_KEY to Vercel environment variables.'
            });
        }

        console.log('Generating quote with OpenAI...');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages,
                temperature: temperature || 1.0,
                top_p: top_p || 0.9,
                presence_penalty: presence_penalty || 0.7,
                frequency_penalty: frequency_penalty || 0.6,
                max_tokens: max_tokens || 130,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('OpenAI API Error:', data);
            return res.status(response.status).json({
                error: data.error?.message || 'OpenAI API request failed',
                details: data
            });
        }

        console.log('Quote generated successfully');
        return res.status(200).json(data);

    } catch (error) {
        console.error('Error generating quote:', error);
        return res.status(500).json({
            error: 'Failed to generate quote',
            message: error.message
        });
    }
}


