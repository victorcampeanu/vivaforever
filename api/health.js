/**
 * Health Check Endpoint
 * Test: https://your-app.vercel.app/api/health
 */

export default function handler(req, res) {
    res.status(200).json({
        status: 'ok',
        message: 'Quote Card Editor API is running on Vercel',
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL_ENV || 'development'
    });
}


