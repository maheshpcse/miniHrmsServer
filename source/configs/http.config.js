'use strict';
const production = process.env.NODE_ENV === 'production';
// Use the public domain from Railway if CORS_ORIGINS is not set
const defaultOrigin = process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '';
const corsOriginsEnv = process.env.CORS_ORIGINS || defaultOrigin || '';
const origins = corsOriginsEnv.split(',').map(s => s.trim()).filter(Boolean);
if (production && !origins.length) throw new Error('CORS_ORIGINS is required in production.');
for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || (production && url.protocol !== 'https:')) throw new Error('CORS_ORIGINS must contain exact HTTPS origins without paths.');
}
module.exports = {
    trustProxy: Number(process.env.TRUST_PROXY || 0),
    cors: {
        origin(origin, callback) {
            if (!origin || origins.includes(origin) || (!production && !origins.length)) return callback(null, true);
            const error = new Error('This browser origin is not allowed.'); error.status = 403; callback(error);
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 600
    }
};

