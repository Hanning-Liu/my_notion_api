// ./scripts/init-oauth.ts
import * as dotenv from 'dotenv';
dotenv.config();
import { google } from 'googleapis';
import { createTokenManager } from '../services/token-manager';

const env = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL!,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN!,
    GOOGLE_REDIRECT_URL: process.env.GOOGLE_REDIRECT_URI!,
};

if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URL) {
    console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URL in your .env');
    process.exit(1);
}

async function main() {
    const oauth2Client = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URL);

    // scope for calendar events creation
    const SCOPES = ['https://www.googleapis.com/auth/calendar'];

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES,
    });

    console.log('1) Visit this URL in a browser and grant access:\n\n', authUrl);
    console.log('\n2) Copy the code and paste it here.\n');

    // read code from stdin
    process.stdout.write('Enter code: ');
    const stdinBuf = await new Promise<string>(resolve => {
        let data = '';
        process.stdin.on('data', chunk => (data += chunk));
        process.stdin.on('end', () => resolve(data.trim()));
    });

    const code = stdinBuf.trim();
    if (!code) {
        console.error('No code provided, exiting.');
        process.exit(1);
    }

    const tokenResponse = await oauth2Client.getToken(code);
    const tokens = tokenResponse.tokens;

    const tm = createTokenManager(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
    const row = await tm.initToken('service-sync', tokens);

    console.log('Token row created/updated:', row);
    console.log('✅ Done. Commit nothing secrets to the repo. Store env vars in Vercel settings.');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
