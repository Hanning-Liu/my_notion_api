import { google } from 'googleapis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/gmail.send',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.headers.authorization !== `Hanning ${process.env.INTERNAL_API_KEY}`) {
        console.log('Unauthorized access attempt to /api/get-auth-url');
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {
        const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;

        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
            throw new Error('Missing Google OAuth environment variables');
        }

        const oauth2Client = new google.auth.OAuth2(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            GOOGLE_REDIRECT_URI
        );

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: SCOPES,
        });

        res.status(200).json({ authUrl });
    } catch (err: any) {
        console.error('Error generating auth URL:', err);
        res.status(500).json({ error: err.message });
    }
}
