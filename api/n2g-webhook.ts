import type { VercelRequest, VercelResponse } from '@vercel/node';
import { syncEvents } from '../src/index';  // adjust path as needed

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        // Optionally: validate the webhook signature / origin from Notion
        const event = req.body;
        console.log('🔔 Received Notion webhook event:', event);

        await syncEvents();  // Run your existing sync logic

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('Webhook handler error:', err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
