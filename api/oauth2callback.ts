// ./api/oauth2callback.ts
import * as dotenv from 'dotenv';
dotenv.config();
import { z } from 'zod';
import { google } from 'googleapis';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createTokenManager } from '../src/services/token-manager';

// Define environment variable schema
const envSchema = z.object({
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
    TURSO_DATABASE_URL: z.string(),
    TURSO_AUTH_TOKEN: z.string(),
    GOOGLE_REDIRECT_URI: z.string(),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const code = req.query.code as string;

        if (!code) {
            console.error('Missing authorization code in query parameters');
            return res.status(400).json({ error: 'Missing authorization code' });
        }

        const oauth2Client = new google.auth.OAuth2(
            env.GOOGLE_CLIENT_ID,
            env.GOOGLE_CLIENT_SECRET,
            env.GOOGLE_REDIRECT_URI
        );

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);

        // Token manager instance
        const tokenManager = createTokenManager(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
        // Save tokens to database
        const db_entry = await tokenManager.initToken('service-sync', tokens);
        console.log('Stored tokens for service-sync:', db_entry);

        res.status(200).json({
            message: 'Authorization successful',
            tokens,
        });
    } catch (error: any) {
        console.error('Error in Google callback:', error);
        res.status(500).json({ error: error.message });
    }
}
