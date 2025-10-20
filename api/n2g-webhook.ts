import type { VercelRequest, VercelResponse } from '@vercel/node';
import { syncEvents } from '../src/index';  // adjust path as needed
import { createHmac, timingSafeEqual } from "crypto"

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        // Check for Notion verification token
        if (req.body?.verification_token) {
            console.log('🔔 Notion verification token received:', req.body.verification_token);
            // Do NOT return the token, just return 200 OK
            return res.status(200).json({ success: true });
        }

        await syncEvents();  // Run your existing sync logic
        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('Webhook handler error:', err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
