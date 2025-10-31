// ./api/n2g-webhook.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { syncEvents } from '../src/index';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        if (req.body?.verification_token) {
            console.log('🔔 Notion verification token received');
            return res.status(200).json({ success: true });
        }

        await syncEvents();
        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('Webhook handler error:', err);

        // If it's a token error, surface a descriptive message for easier debugging
        if (err?.message?.includes('invalid_grant') || (err?.response && err.response.data && err.response.data.error === 'invalid_grant')) {
            return res.status(500).json({ error: 'Google refresh token invalid or revoked. Please re-init with the oauth init script.' });
        }

        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
