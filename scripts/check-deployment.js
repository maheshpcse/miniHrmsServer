'use strict';
function validate(env) {
    const errors = [];
    for (const name of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'CORS_ORIGINS']) {
        if (!env[name] || !env[name].trim()) errors.push(name + ' is required');
    }
    if (!(env.PORTAL_SECURITY_KEY || env.SECURITY_KEY || '').trim()) errors.push('PORTAL_SECURITY_KEY or SECURITY_KEY is required');
    if (env.DB_NAME !== 'mini_hrms') errors.push('DB_NAME must be mini_hrms');
    if (env.DB_CLIENT !== 'mysql2') errors.push('DB_CLIENT must be mysql2 for Railway');
    for (const name of ['DB_PORT', 'PORT']) {
        if (env[name] !== undefined && (!/^\d+$/.test(env[name]) || Number(env[name]) < 1 || Number(env[name]) > 65535)) errors.push(name + ' must be a valid port');
    }
    for (const origin of (env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)) {
        try { const url = new URL(origin); if (url.protocol !== 'https:' || url.origin !== origin) throw new Error(); }
        catch (_) { errors.push('CORS_ORIGINS must contain HTTPS origins without paths or trailing slashes'); }
    }
    if (env.TRUST_PROXY !== undefined && !/^\d+$/.test(env.TRUST_PROXY)) errors.push('TRUST_PROXY must be a nonnegative integer');
    if (errors.length) throw new Error('Deployment configuration invalid:\n- ' + errors.join('\n- '));
}
module.exports = { validate };
if (require.main === module) {
    try { validate(process.env); console.log('Deployment configuration is valid.'); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
