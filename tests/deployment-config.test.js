'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('../scripts/check-deployment');
const valid = { DB_HOST:'mysql.railway.internal', DB_PORT:'3306', DB_USER:'test', DB_PASSWORD:'test-only', DB_NAME:'mini_hrms', DB_CLIENT:'mysql2', CORS_ORIGINS:'https://example.github.io', PORTAL_SECURITY_KEY:'test-only', TRUST_PROXY:'1' };
test('Railway configuration works without a manually assigned PORT', () => assert.doesNotThrow(() => validate(valid)));
test('Allows multiple HTTPS frontend origins', () => assert.doesNotThrow(() => validate({...valid,CORS_ORIGINS:'https://example.github.io, https://hr.example.com'})));
test('Rejects absent database settings without exposing secret values', () => { assert.throws(() => validate({...valid,DB_HOST:''}), /DB_HOST is required/); });
test('Rejects repository paths in CORS origins', () => assert.throws(() => validate({...valid,CORS_ORIGINS:'https://example.github.io/miniHrmsUI/'}), /HTTPS origins/));
test('Rejects wrong schema, driver, port and proxy configuration', () => {
 for (const change of [{DB_NAME:'railway'},{DB_CLIENT:'mysql'},{PORT:'0'},{DB_PORT:'70000'},{TRUST_PROXY:'true'}]) assert.throws(() => validate({...valid,...change}));
});
test('Requires a signing secret and accepts the existing key fallback', () => {
 assert.throws(() => validate({...valid,PORTAL_SECURITY_KEY:''}), /SECURITY_KEY/);
 assert.doesNotThrow(() => validate({...valid,PORTAL_SECURITY_KEY:'',SECURITY_KEY:'test-only'}));
});

test('Requires the explicit database port', () => assert.throws(() => validate({...valid,DB_PORT:''}), /DB_PORT is required/));
test('Rejects connection URLs without printing credentials', () => {
 const secretUrl = 'mysql://private-user:private-password@host:3306/mini_hrms';
 for (const key of ['DB_HOST','DB_PORT','DB_USER','DB_PASSWORD','DB_NAME']) {
  assert.throws(() => validate({...valid,[key]:secretUrl}), error => !error.message.includes('private-password') && !error.message.includes('private-user') && error.message.includes(key));
 }
});
