'use strict';
const fail = (message) => {
  const e = new Error(message);
  e.status = 400;
  throw e;
};
const amount = (v) => {
  if (typeof v !== 'string' || !/^\d{1,12}(\.\d{1,4})?$/.test(v))
    fail(
      'Amounts must be non-negative decimal strings with up to four decimals.'
    );
  const [w, f = ''] = v.split('.');
  return BigInt(w) * 10000n + BigInt(f.padEnd(4, '0'));
};
const decimal = (n) =>
  (n / 10000n).toString() + '.' + (n % 10000n).toString().padStart(4, '0');
const rounded = (n, d) => (n + d / 2n) / d;
const bps = (v) => {
  if (!Number.isInteger(v) || v < 0 || v > 10000)
    fail('Rates must be whole basis points between 0 and 10000 (100%).');
  return BigInt(v);
};
const validateRules = (rules) => {
  if (!rules || typeof rules !== 'object' || Array.isArray(rules))
    fail('Provide tax settings.');
  if (
    rules.currency_decimals !== undefined &&
    (!Number.isInteger(rules.currency_decimals) ||
      rules.currency_decimals < 0 ||
      rules.currency_decimals > 4)
  )
    fail('Currency decimal places must be between zero and four.');
  amount(rules.annual_allowance || '0');
  if (
    !Array.isArray(rules.bands) ||
    !rules.bands.length ||
    rules.bands.length > 30
  )
    fail('Provide tax bands, ending with an unlimited band.');
  let last = 0n;
  rules.bands.forEach((band, index) => {
    bps(band.rate_bps);
    if (band.up_to === null) {
      if (index !== rules.bands.length - 1)
        fail('Only the final band may be unlimited.');
    } else {
      const next = amount(band.up_to);
      if (next <= last) fail('Tax bands must have increasing upper limits.');
      last = next;
    }
  });
  if (rules.bands[rules.bands.length - 1].up_to !== null)
    fail('The final tax band must be unlimited.');
  bps(rules.cess_bps || 0);
  amount(rules.rebate_threshold || '0');
  amount(rules.rebate_max || '0');
  if (!Array.isArray(rules.levies || []) || (rules.levies || []).length > 20)
    fail('Use up to 20 statutory levies.');
  const codes = new Set();
  for (const l of rules.levies || []) {
    if (!/^[A-Z][A-Z0-9_]{0,39}$/.test(l.code) || codes.has(l.code))
      fail('Use unique levy codes.');
    codes.add(l.code);
    if (!['DEDUCTION', 'TAX', 'EMPLOYER_CONTRIBUTION'].includes(l.type))
      fail('Choose a levy type.');
    bps(l.rate_bps);
    amount(l.monthly_threshold || '0');
    if (l.monthly_cap !== null && l.monthly_cap !== undefined)
      amount(l.monthly_cap);
  }
  return rules;
};
const validateComponents = (components) => {
  if (
    !Array.isArray(components) ||
    !components.length ||
    components.length > 60
  )
    fail('Provide 1 to 60 compensation components.');
  const codes = new Set(['INCOME_TAX']);
  let earnings = 0n;
  for (const c of components) {
    if (!/^[A-Z][A-Z0-9_]{0,39}$/.test(c.code) || codes.has(c.code))
      fail('Use unique component codes.');
    codes.add(c.code);
    if (typeof c.name !== 'string' || !c.name.trim() || c.name.length > 150)
      fail('Enter a component name.');
    if (
      ![
        'EARNING',
        'DEDUCTION',
        'REIMBURSEMENT',
        'EMPLOYER_CONTRIBUTION',
      ].includes(c.type)
    )
      fail('Choose a component type.');
    const value = amount(c.amount);
    if (c.type === 'EARNING') earnings += value;
  }
  if (!earnings) fail('Compensation must include earnings.');
  return components;
};
exports.validateRules = validateRules;
exports.validateComponents = validateComponents;
exports.calculate = ({
  components,
  rules,
  paidDays,
  periodDays,
  ytdGross = '0',
  ytdTax = '0',
  remainingMonths = 0,
}) => {
  validateRules(rules);
  validateComponents(components);
  const precision =
      rules.currency_decimals === undefined ? 2 : rules.currency_decimals,
    unit = 10n ** BigInt(4 - precision),
    cash = (n) => rounded(n, unit) * unit;
  if (
    !Number.isInteger(periodDays) ||
    periodDays < 1 ||
    periodDays > 31 ||
    !Number.isInteger(paidDays) ||
    paidDays < 0 ||
    paidDays > periodDays
  )
    fail('Paid days must be within the payroll period.');
  if (
    !Number.isInteger(remainingMonths) ||
    remainingMonths < 0 ||
    remainingMonths > 11
  )
    fail('Invalid remaining tax periods.');
  const totals = {
    EARNING: 0n,
    DEDUCTION: 0n,
    REIMBURSEMENT: 0n,
    TAX: 0n,
    EMPLOYER_CONTRIBUTION: 0n,
  };
  let fullGross = 0n;
  const lines = components.map((c) => {
    const raw = amount(c.amount);
    if (c.type === 'EARNING') fullGross += raw;
    const value = cash(
      c.prorate === false
        ? raw
        : rounded(raw * BigInt(paidDays), BigInt(periodDays))
    );
    totals[c.type] += value;
    return {
      code: c.code,
      name: c.name,
      type: c.type,
      amount: decimal(value),
      explanation:
        c.prorate === false
          ? 'Fixed monthly amount'
          : 'Prorated ' + paidDays + '/' + periodDays + ' days',
    };
  });
  const projected =
      amount(ytdGross) + totals.EARNING + fullGross * BigInt(remainingMonths),
    allowance = amount(rules.annual_allowance || '0'),
    taxable = projected > allowance ? projected - allowance : 0n;
  let tax = 0n,
    lower = 0n;
  for (const band of rules.bands) {
    const upper = band.up_to === null ? taxable : amount(band.up_to),
      ceiling = taxable < upper ? taxable : upper;
    if (ceiling > lower)
      tax += rounded((ceiling - lower) * bps(band.rate_bps), 10000n);
    lower = upper;
    if (taxable <= upper) break;
  }
  if (taxable <= amount(rules.rebate_threshold || '0')) {
    const rebate = amount(rules.rebate_max || '0');
    tax = tax > rebate ? tax - rebate : 0n;
  }
  tax += rounded(tax * bps(rules.cess_bps || 0), 10000n);
  const already = amount(ytdTax),
    withholding =
      tax > already
        ? cash(rounded(tax - already, BigInt(remainingMonths + 1)))
        : 0n;
  lines.push({
    code: 'INCOME_TAX',
    name: 'Configured income tax withholding',
    type: 'TAX',
    amount: decimal(withholding),
    explanation:
      'Projected annual tax less year-to-date income tax, spread over remaining pay periods',
  });
  totals.TAX += withholding;
  const codes = new Set(lines.map((c) => c.code));
  for (const levy of rules.levies || []) {
    if (codes.has(levy.code))
      fail('Levy and compensation codes must be distinct.');
    codes.add(levy.code);
    const threshold = amount(levy.monthly_threshold || '0');
    let base = totals.EARNING > threshold ? totals.EARNING - threshold : 0n;
    if (levy.monthly_cap !== null && levy.monthly_cap !== undefined) {
      const cap = amount(levy.monthly_cap);
      if (base > cap) base = cap;
    }
    const value = cash(rounded(base * bps(levy.rate_bps), 10000n));
    lines.push({
      code: levy.code,
      name: levy.code.replace(/_/g, ' '),
      type: levy.type,
      amount: decimal(value),
      explanation: 'Configured monthly levy',
    });
    totals[levy.type] += value;
  }
  const net =
    totals.EARNING + totals.REIMBURSEMENT - totals.DEDUCTION - totals.TAX;
  if (net < 0n)
    fail(
      'Deductions and tax exceed payable earnings. Review the configuration.'
    );
  return {
    gross: decimal(totals.EARNING),
    deductions: decimal(totals.DEDUCTION),
    reimbursements: decimal(totals.REIMBURSEMENT),
    tax: decimal(totals.TAX),
    employer_contributions: decimal(totals.EMPLOYER_CONTRIBUTION),
    net: decimal(net),
    components: lines,
    projection: {
      annual_gross: decimal(projected),
      taxable: decimal(taxable),
      annual_tax: decimal(tax),
      remaining_months: remainingMonths,
      ytd_gross: ytdGross,
      ytd_income_tax: ytdTax,
    },
  };
};

// MySQL JSON normalizes object key order; hash canonical JSON, not insertion order.
exports.fingerprint = (value) => {
  const normalize = (v) =>
    Array.isArray(v)
      ? v.map(normalize)
      : v && typeof v === 'object'
      ? Object.keys(v)
          .sort()
          .reduce((o, k) => {
            o[k] = normalize(v[k]);
            return o;
          }, Object.create(null))
      : v;
  return require('crypto')
    .createHash('sha256')
    .update(JSON.stringify(normalize(JSON.parse(JSON.stringify(value)))))
    .digest('hex');
};
