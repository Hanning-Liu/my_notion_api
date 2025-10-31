// ./src/services/token-manager.ts
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { googleOAuthTokens } from '../db/schema';
import { google, Auth } from 'googleapis';
import { sql } from 'drizzle-orm';

type TokenRow = {
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiryDate: number; // ms
    refreshTokenExpiry: number; // ms
    scope: string;
    tokenType: string;
    createdAt: number;
    updatedAt: number;
};

export function createTokenManager(tursoUrl: string, authToken: string) {
    const client = createClient({ url: tursoUrl, authToken });
    const db = drizzle({ client });

    return {
        // initialize token row for the first time (use this from init script)
        async initToken(userId: string, tokenResponse: any) {
            const now = Date.now();
            const accessTokenExpiryMs = tokenResponse.expiry_date;
            const refreshTokenExpiryMs = tokenResponse.refresh_token_expires_in;
            const row: TokenRow = {
                userId,
                accessToken: tokenResponse.access_token,
                refreshToken: tokenResponse.refresh_token,
                expiryDate: accessTokenExpiryMs,
                refreshTokenExpiry: refreshTokenExpiryMs,
                scope: tokenResponse.scope || '',
                tokenType: tokenResponse.token_type || 'Bearer',
                createdAt: now,
                updatedAt: now,
            };

            // upsert pattern: try update then insert if not exist
            const existing = await db.select().from(googleOAuthTokens).where(eq(googleOAuthTokens.userId, userId)).get();
            if (existing) {
                await db.update(googleOAuthTokens)
                    .set({
                        accessToken: row.accessToken,
                        refreshToken: row.refreshToken,
                        expiryDate: sql`${row.expiryDate}`,
                        scope: row.scope,
                        tokenType: row.tokenType,
                        updatedAt: sql`${row.updatedAt}`,
                    })
                    .where(eq(googleOAuthTokens.userId, userId));
            } else {
                await db.insert(googleOAuthTokens).values({
                    ...row,
                    expiryDate: sql`${row.expiryDate}`,
                    refreshTokenExpiry: sql`${row.refreshTokenExpiry}`,
                    createdAt: sql`${row.createdAt}`,
                    updatedAt: sql`${row.updatedAt}`,
                });
            }

            return row;
        },

        // get token row
        async getTokenRow(userId: string): Promise<TokenRow | null> {
            const row = await db
                .select()
                .from(googleOAuthTokens)
                .where(eq(googleOAuthTokens.userId, userId))
                .get();

            if (!row) return null;

            return {
                ...row,
                expiryDate: Number(row.expiryDate),
                refreshTokenExpiry: Number(row.refreshTokenExpiry),
                createdAt: Number(row.createdAt),
                updatedAt: Number(row.updatedAt),
            };
        },

        // set credentials from DB onto oauth2Client
        async setCredentialsToClient(userId: string, oauth2Client: Auth.OAuth2Client) {
            const row = await this.getTokenRow(userId);
            if (!row) throw new Error('No token row found for user: ' + userId);
            oauth2Client.setCredentials({
                access_token: row.accessToken,
                refresh_token: row.refreshToken,
                expiry_date: row.expiryDate,
            });
            return row;
        },

        // Refresh token if expired (or about to expire). Updates DB with returned tokens.
        async refreshIfNeeded(userId: string, oauth2Client: Auth.OAuth2Client) {
            const row = await this.getTokenRow(userId);
            if (!row) throw new Error('No token row found for user: ' + userId);

            // If still valid for > 60s, no refresh required
            const now = Date.now();
            if (row.expiryDate - now > 60 * 1000) {
                // Set existing credentials on client and return
                oauth2Client.setCredentials({
                    access_token: row.accessToken,
                    refresh_token: row.refreshToken,
                    expiry_date: row.expiryDate,
                });
                return { refreshed: false, tokenRow: row };
            }

            // Refresh using the refresh token
            try {
                // 设置当前凭证（包含 refresh_token）
                oauth2Client.setCredentials({
                    access_token: row.accessToken,
                    refresh_token: row.refreshToken,
                    expiry_date: row.expiryDate,
                });

                // 使用 getAccessToken 方法自动处理刷新
                const { token, res } = await oauth2Client.getAccessToken();
                if (!token) {
                    throw new Error('Failed to refresh access token');
                }

                // Manually set new credentials
                const expiryMs = Date.now() + 3600 * 1000; // 1 hour default
                oauth2Client.setCredentials({
                    access_token: token,
                    refresh_token: row.refreshToken,
                    expiry_date: expiryMs,
                });

                // Save new credentials to DB
                await db.update(googleOAuthTokens)
                    .set({
                        accessToken: token,
                        expiryDate: sql`${expiryMs}`,
                        updatedAt: sql`${Date.now()}`,
                    })
                    .where(eq(googleOAuthTokens.userId, userId));

                return { refreshed: true, tokenRow: { ...row, accessToken: token, expiryDate: expiryMs } };
            } catch (err: any) {
                // refresh failed (invalid_grant etc). bubble up for caller handling.
                throw err;
            }
        },
    };
}
