'use strict';
const crypto = require('crypto');
const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const fail = (status, message) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
const text = (v, name, max = 180) => {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max)
    fail(400, name + ' is required (up to ' + max + ' characters).');
  return v.trim();
};
const number = (v, name, min = 1, max = 2147483647) => {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < min || n > max)
    fail(400, name + ' is invalid.');
  return n;
};
const date = (v, name = 'Date') => {
  if (
    typeof v !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    isNaN(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    fail(400, name + ' is invalid.');
  return v;
};
const instant = (v, name) => {
  if (
    typeof v !== 'string' ||
    !/(Z|[+-]\d\d:\d\d)$/.test(v) ||
    isNaN(Date.parse(v))
  )
    fail(400, name + ' must include its timezone.');
  return new Date(v);
};
const day = (v) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
const choice = (v, options, name) => {
  if (!options.includes(v)) fail(400, 'Choose a valid ' + name + '.');
  return v;
};
const digest = (v) =>
  crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');

module.exports = {
  parse,
  fail,
  text,
  number,
  date,
  instant,
  day,
  today,
  choice,
  digest,
};
