'use strict';
function validate(env) {
    const errors = [];

    // Database connection variables must be provided individually. A full
    // connection URL (e.g. mysql://user:pass@host:port/db) will break the
    // Knex/Objection MySQL client, which expects discrete host/port/user/
    // password/database values.
    for (const name of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
        const value = env[name];
        if (!value || !value.trim()) {
            errors.push(name + ' is required and must be set to an individual value (not a connection URL). ' +
                'In Railway, reference the MySQL service variable directly, e.g. ${{ mysql.MYSQL' + name.replace('DB_', '') + ' }} or the equivalent PG* variable exposed by the MySQL plugin.');
        }
    }

    if (env.DB_HOST && env.DB_HOST.includes('://')) {
        errors.push('DB_HOST must be a plain hostname (e.g. junction.proxy.rlwy.net), not a full connection URL. ' +
            'Got: "' + env.DB_HOST + '". Split the URL into DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_NAME.');
    }

    for (const name of ['DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
        if (env[name] && env[name].includes('://')) {
            errors.push(name + ' appears to contain a full connection URL instead of an individual value. Got: "' + env[name] + '".');
        }
    }

    for (const name of ['CORS_ORIGINS']) {
        if (!env[name] || !env[name].trim()) errors.push(name + ' is required');
    }
    if (!(env.PORTAL_SECURITY_KEY || env.SECURITY_KEY || '').trim()) errors.push('PORTAL_SECURITY_KEY or SECURITY_KEY is required');
    if (env.DB_NAME && env.DB_NAME !== 'mini_hrms') errors.push('DB_NAME must be mini_hrms, got "' + env.DB_NAME + '"');
    if (env.DB_CLIENT !== 'mysql2') errors.push('DB_CLIENT must be mysql2 for Railway');
    for (const name of ['DB_PORT', 'PORT']) {
        if (env[name] !== undefined && (!/^\d+$/.test(env[name]) || Number(env[name]) < 1 || Number(env[name]) > 65535)) errors.push(name + ' must be a valid port number (1-65535), got "' + env[name] + '"');
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
