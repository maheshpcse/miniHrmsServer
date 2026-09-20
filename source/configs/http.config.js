'use strict';
const production = process.env.NODE_ENV === 'production';
const origins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
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
