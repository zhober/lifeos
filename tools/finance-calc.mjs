// Exact minor-unit arithmetic for explicitly scoped financial worksheets; no market/tax APIs.
import { ensure, textValue } from './record-data.mjs';
import { dateOrNull, stable } from './store.mjs';

export const FINANCE_KINDS = ['cashflow', 'balances', 'budget', 'goal', 'debt', 'scenario'];
export const FLOW_TYPES = ['income', 'expense', 'refund', 'transfer', 'debt_in', 'debt_out', 'investment_in', 'investment_out', 'other'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const alias = value => textValue(value) && /^[a-z][a-z0-9_-]{0,79}$/.test(value);
export const minor = value => value == null || Number.isSafeInteger(value) && value >= 0;
const number = value => { ensure(value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER), 'Financial result exceeds safe integer range.'); return Number(value); };
const sum = values => number(values.reduce((total, value) => total + BigInt(value), 0n));
const quality = value => ['complete', 'partial', 'unknown'].includes(value);
const bounded = (value, max) => Number.isInteger(value) && value >= 1 && value <= max;

export function decimalMoney(input) {
  ensure(object(input) && /^[A-Z]{3}$/.test(input.currency) && Number.isInteger(input.scale) && input.scale >= 0 && input.scale <= 4, 'Declare currency and scale 0..4.');
  ensure(typeof input.decimal === 'string' && /^\d+(?:\.\d+)?$/.test(input.decimal) && input.decimal.length <= 40, 'Use an unsigned plain decimal string, not floats, separators or exponent notation.');
  const [whole, fraction = ''] = input.decimal.split('.');
  ensure(fraction.length <= input.scale, 'Decimal precision exceeds the declared minor-unit scale.');
  const amount = BigInt(whole) * 10n ** BigInt(input.scale) + BigInt(fraction.padEnd(input.scale, '0') || '0');
  return { currency: input.currency, scale: input.scale, amount_minor: number(amount) };
}

export function validateWorksheet(kind, d) {
  ensure(FINANCE_KINDS.includes(kind) && object(d), 'Declare a supported financial worksheet kind and details.');
  ensure(/^[A-Z]{3}$/.test(d.currency) && Number.isInteger(d.scale) && d.scale >= 0 && d.scale <= 4, 'Worksheet needs explicit currency and scale 0..4.');
  const amount = (field, required = false) => ensure(minor(d[field]) && (!required || d[field] != null), field + ' needs a safe nonnegative minor integer or null.');
  const allowed = {
    cashflow: ['currency', 'scale', 'from', 'to', 'rows', 'coverage', 'cash_scope', 'opening_minor', 'closing_minor', 'aggregate_categories_disjoint'],
    balances: ['currency', 'scale', 'as_of', 'items', 'coverage'], budget: ['currency', 'scale', 'from', 'to', 'limit_minor', 'spent_minor', 'status', 'spending_coverage'],
    goal: ['currency', 'scale', 'target_minor', 'current_minor', 'monthly_contribution_minor', 'status', 'as_of', 'target_on'],
    debt: ['currency', 'scale', 'principal_minor', 'monthly_payment_minor', 'annual_rate_bps', 'rate_basis', 'upfront_fee_minor', 'max_months'],
    scenario: ['currency', 'scale', 'starting_minor', 'monthly_income_minor', 'monthly_expense_minor', 'one_off_minor', 'months', 'assumptions', 'starting_range_minor', 'monthly_income_range_minor', 'monthly_expense_range_minor', 'one_off_range_minor'],
  };
  ensure(Object.keys(d).every(key => allowed[kind].includes(key)), 'Unsupported worksheet field; preserve other details in scoped source artifacts instead.');
  const period = () => { dateOrNull(d.from); dateOrNull(d.to); ensure(d.from && d.to && d.from <= d.to, 'Declare an ordered exact worksheet period.'); };
  if (kind === 'cashflow') {
    period(); ensure(Array.isArray(d.rows) && object(d.coverage) && ['income', 'expenses', 'cash_flow'].every(field => quality(d.coverage[field])), 'Rows and income/expenses/cash-flow coverage are required.');
    for (const row of d.rows) {
      ensure(object(row) && FLOW_TYPES.includes(row.type) && ['actual', 'planned'].includes(row.status), 'Cash-flow row needs type and actual/planned status.');
      ensure(Object.keys(row).every(key => ['flow_id', 'type', 'status', 'scope', 'on', 'from', 'to', 'category', 'amount_minor', 'currency', 'scale', 'cash_effect', 'source_indexes'].includes(key)), 'Unsupported cash-flow row field.');
      ensure(row.cash_effect === null || typeof row.cash_effect === 'boolean', 'Declare actual cash effect as true/false or unknown null.');
      if (row.source_indexes !== undefined) ensure(Array.isArray(row.source_indexes) && row.source_indexes.every(index => Number.isSafeInteger(index) && index >= 0), 'Row source indexes must be nonnegative integers.');
      ensure(['event', 'aggregate'].includes(row.scope), 'Declare individual event versus aggregate scope.');
      if (row.scope === 'aggregate') { dateOrNull(row.from); dateOrNull(row.to); ensure(row.from && row.to && row.from <= row.to && row.on == null, 'Aggregate rows need actual period bounds, not an invented payment date.'); }
      else ensure(row.from == null && row.to == null, 'An individual event uses its actual date, not aggregate period bounds.');
      ensure(row.flow_id == null || alias(row.flow_id), 'Use an anonymous canonical flow ID, not an account number.');
      ensure(minor(row.amount_minor), 'Cash-flow amounts are safe nonnegative minor integers or null.'); dateOrNull(row.on);
      ensure(row.category == null || alias(row.category), 'Category is a stable anonymous identifier or null.');
      ensure(row.currency === undefined || row.currency === d.currency, 'A row currency differs from the worksheet.');
      ensure(row.scale === undefined || row.scale === d.scale, 'A row scale differs from the worksheet.');
    }
    amount('opening_minor'); amount('closing_minor');
    ensure(d.aggregate_categories_disjoint === undefined || typeof d.aggregate_categories_disjoint === 'boolean', 'Category partition confirmation must be explicit when supplied.');
    ensure(d.cash_scope === 'consolidated_cash', 'Cash-flow reconciliation currently supports consolidated own cash, not individual transfer legs.');
  } else if (kind === 'balances') {
    dateOrNull(d.as_of); ensure(Array.isArray(d.items), 'Balance worksheet needs an item list.');
    for (const row of d.items) {
      ensure(object(row) && alias(row.item_id) && ['asset', 'liability'].includes(row.side) && ['item', 'aggregate'].includes(row.scope), 'Balance items need anonymous ID, side and item/aggregate scope.');
      ensure(Object.keys(row).every(key => ['item_id', 'side', 'scope', 'as_of', 'amount_minor', 'currency', 'scale', 'source_indexes'].includes(key)), 'Unsupported balance item field.');
      if (row.source_indexes !== undefined) ensure(Array.isArray(row.source_indexes) && row.source_indexes.every(index => Number.isSafeInteger(index) && index >= 0), 'Item source indexes must be nonnegative integers.');
      ensure(minor(row.amount_minor), 'Balance amounts are safe minor integers or null.'); dateOrNull(row.as_of);
      ensure(row.currency === undefined || row.currency === d.currency, 'A balance currency differs from the worksheet.');
      ensure(row.scale === undefined || row.scale === d.scale, 'A balance scale differs from the worksheet.');
    }
    ensure(['assets', 'liabilities'].every(field => quality(d.coverage?.[field])), 'Declare assets/liabilities coverage.');
  } else if (kind === 'budget') {
    period(); amount('limit_minor'); amount('spent_minor'); ensure(quality(d.spending_coverage) && ['proposed', 'accepted'].includes(d.status), 'Budget needs status and actual spending coverage.');
  } else if (kind === 'goal') {
    amount('target_minor'); amount('current_minor'); amount('monthly_contribution_minor'); ensure(['proposed', 'accepted'].includes(d.status), 'Goal needs proposal/acceptance status.'); dateOrNull(d.as_of); dateOrNull(d.target_on);
  } else if (kind === 'debt') {
    amount('principal_minor'); amount('monthly_payment_minor'); amount('upfront_fee_minor');
    ensure(d.annual_rate_bps == null || Number.isSafeInteger(d.annual_rate_bps) && d.annual_rate_bps >= 0 && d.annual_rate_bps <= 100000, 'Annual rate must be stated in basis points, not an inferred APR.');
    ensure(d.rate_basis === 'nominal_annual_monthly', 'Debt helper models nominal annual interest with monthly compounding only.');
    ensure(bounded(d.max_months, 1200), 'Debt horizon is an explicit 1..1200 months.');
  } else {
    for (const field of ['starting_minor', 'monthly_income_minor', 'monthly_expense_minor', 'one_off_minor']) {
      amount(field); const ranged = field.replace(/_minor$/, '_range_minor'), values = d[ranged];
      if (values != null) ensure(d[field] == null && Array.isArray(values) && values.length === 2 && values.every(value => value != null && minor(value)) && values[0] <= values[1], 'Supply an ordered minor-unit range or exact value, not both.');
    }
    ensure(bounded(d.months, 1200), 'Scenario horizon is an explicit 1..1200 months.');
    ensure(Array.isArray(d.assumptions) && d.assumptions.length > 0 && d.assumptions.every(textValue), 'Scenario needs explicit assumptions.');
  }
  return d;
}

export function worksheetFields(kind, d, basis, extra = []) {
  if (basis === 'hypothetical') return [...new Set(extra)].sort();
  const fields = ['currency', ...extra, ...Object.entries(d).filter(([key, value]) => value != null && !['rows', 'items', 'coverage', 'assumptions'].includes(key)).map(([key]) => key)];
  if (d.from || d.to || d.as_of || d.target_on || d.rows?.some(row => row.on || row.from) || d.items?.some(row => row.as_of)) fields.push('dates');
  if (kind === 'cashflow') {
    if (d.rows.some(row => row.type === 'income') || d.coverage.income === 'complete' || d.coverage.cash_flow === 'complete') fields.push('income');
    if (d.rows.some(row => ['expense', 'refund'].includes(row.type)) || d.coverage.expenses === 'complete' || d.coverage.cash_flow === 'complete') fields.push('expenses');
    if (d.rows.some(row => ['debt_in', 'debt_out'].includes(row.type))) fields.push('debts');
    if (d.rows.some(row => ['investment_in', 'investment_out'].includes(row.type))) fields.push('assets', 'investments');
    if (d.opening_minor != null || d.closing_minor != null) fields.push('assets');
  } else if (kind === 'balances') {
    if (d.items.some(row => row.side === 'asset') || d.coverage.assets === 'complete') fields.push('assets');
    if (d.items.some(row => row.side === 'liability') || d.coverage.liabilities === 'complete') fields.push('debts');
  } else if (kind === 'budget') { fields.push('budget'); if (d.spent_minor != null) fields.push('expenses'); }
  else if (kind === 'goal') { fields.push('goals'); if (d.current_minor != null) fields.push('assets'); if (d.monthly_contribution_minor != null) fields.push('budget'); }
  else if (kind === 'debt') fields.push('debts');
  else {
    fields.push('goals'); if (d.starting_minor != null || d.starting_range_minor != null) fields.push('assets'); if (d.monthly_income_minor != null || d.monthly_income_range_minor != null) fields.push('income'); if (d.monthly_expense_minor != null || d.one_off_minor != null || d.monthly_expense_range_minor != null || d.one_off_range_minor != null) fields.push('expenses');
  }
  return [...new Set(fields)].sort();
}

function cashflow(d) {
  const groups = new Map(), gaps = [], planned = [], ignored = [], duplicates = [];
  for (const [index, row] of d.rows.entries()) {
    if (row.status !== 'actual') { planned.push(index); continue; }
    if (!row.flow_id) { gaps.push({ row: index, type: row.type, reason: 'unresolved_flow_identity' }); continue; }
    const group = groups.get(row.flow_id) ?? []; group.push({ row, index }); groups.set(row.flow_id, group);
  }
  const usable = [];
  for (const [id, group] of groups) {
    const signatures = new Set(group.map(({ row }) => stable({ type: row.type, scope: row.scope, on: row.on ?? null, from: row.from ?? null, to: row.to ?? null, category: row.category ?? null, cash_effect: row.cash_effect, amount_minor: row.amount_minor ?? null })));
    if (signatures.size > 1) { for (const item of group) gaps.push({ row: item.index, type: item.row.type, reason: 'conflicting_flow_identity', flow_id: id }); continue; }
    if (group.length > 1) duplicates.push({ flow_id: id, rows: group.map(item => item.index) });
    const item = group[0], row = item.row;
    if (row.scope === 'event' && !row.on) { gaps.push({ row: item.index, type: row.type, reason: 'unknown_occurrence' }); continue; }
    if (row.scope === 'aggregate' && (row.from !== d.from || row.to !== d.to)) { gaps.push({ row: item.index, type: row.type, reason: 'aggregate_period_mismatch' }); continue; }
    if (row.scope === 'event' && (row.on < d.from || row.on > d.to)) { ignored.push(item.index); continue; }
    if (row.amount_minor == null || row.type === 'other') { gaps.push({ row: item.index, type: row.type, reason: row.type === 'other' ? 'unclassified_flow' : 'unknown_amount' }); continue; }
    usable.push(row);
  }
  const overlap = new Set();
  for (const type of FLOW_TYPES) {
    const rows = usable.filter(row => row.type === type), aggregates = rows.filter(row => row.scope === 'aggregate'), events = rows.filter(row => row.scope === 'event');
    if (aggregates.length && events.length || aggregates.length > 1 && (!d.aggregate_categories_disjoint || aggregates.some(row => !row.category) || new Set(aggregates.map(row => row.category)).size !== aggregates.length)) {
      overlap.add(type); gaps.push({ type, reason: 'aggregate_event_or_category_overlap' });
    }
  }
  const eligible = usable.filter(row => !overlap.has(row.type));
  for (const row of eligible.filter(row => row.cash_effect === null && row.type !== 'transfer')) gaps.push({ type: row.type, reason: 'unknown_cash_effect', flow_id: row.flow_id });
  const totals = Object.fromEntries(FLOW_TYPES.filter(type => type !== 'other').map(type => [type, sum(eligible.filter(row => row.type === type).map(row => row.amount_minor))]));
  const cashTotals = Object.fromEntries(FLOW_TYPES.filter(type => type !== 'other').map(type => [type, sum(eligible.filter(row => row.type === type && row.cash_effect === true).map(row => row.amount_minor))]));
  const spending = number(BigInt(totals.expense) - BigInt(totals.refund));
  const cashNet = number(BigInt(cashTotals.income) + BigInt(cashTotals.refund) + BigInt(cashTotals.debt_in) + BigInt(cashTotals.investment_in) - BigInt(cashTotals.expense) - BigInt(cashTotals.debt_out) - BigInt(cashTotals.investment_out));
  const affected = type => gaps.some(gap => gap.reason !== 'unknown_cash_effect' && (type.includes(gap.type) || gap.type === 'other'));
  const incomeComplete = d.coverage.income === 'complete' && !affected(['income']);
  const spendingComplete = d.coverage.expenses === 'complete' && !affected(['expense', 'refund']);
  const cashComplete = d.coverage.cash_flow === 'complete' && gaps.length === 0;
  const surplus = incomeComplete && spendingComplete ? number(BigInt(totals.income) - BigInt(spending)) : null;
  const closing = cashComplete && d.opening_minor != null ? number(BigInt(d.opening_minor) + BigInt(cashNet)) : null;
  return { period: { from: d.from, to: d.to }, recorded_totals_minor: totals, recorded_cash_totals_minor: cashTotals, recorded_net_spending_minor: spending, recorded_cash_change_minor: cashNet,
    complete_period_income_minor: incomeComplete ? totals.income : null, complete_period_net_spending_minor: spendingComplete ? spending : null,
    complete_period_cash_change_minor: cashComplete ? cashNet : null, complete_period_surplus_minor: surplus,
    savings_rate_basis_points: surplus !== null && totals.income > 0 ? number(BigInt(surplus) * 10000n / BigInt(totals.income)) : null,
    expected_closing_minor: closing, reconciliation_difference_minor: closing !== null && d.closing_minor != null ? number(BigInt(d.closing_minor) - BigInt(closing)) : null,
    usable_rows: eligible.length, planned_rows: planned, outside_period_rows: ignored, duplicates, gaps, coverage: d.coverage,
    note: 'Recorded economic categories and cash effects are separate; own consolidated transfers are excluded. Borrowing/investment principal are not earned income. A reconciliation difference is not an automatic adjustment.' };
}

function balances(d) {
  const result = {}, gaps = [], duplicates = [];
  const sideConflict = new Set(d.items.filter(row => d.items.some(other => other.item_id === row.item_id && other.side !== row.side)).map(row => row.item_id));
  for (const [side, coverage] of [['asset', 'assets'], ['liability', 'liabilities']]) {
    const groups = new Map();
    for (const row of d.items.filter(row => row.side === side)) { const group = groups.get(row.item_id) ?? []; group.push(row); groups.set(row.item_id, group); }
    const usable = []; let incomplete = false;
    for (const [id, rows] of groups) {
      if (sideConflict.has(id)) { gaps.push({ side, item_id: id, reason: 'conflicting_balance_side' }); incomplete = true; continue; }
      if (new Set(rows.map(row => stable({ side: row.side, scope: row.scope, as_of: row.as_of ?? null, amount_minor: row.amount_minor ?? null }))).size > 1) { gaps.push({ side, item_id: id, reason: 'conflicting_balance_identity' }); incomplete = true; continue; }
      if (rows.length > 1) duplicates.push({ side, item_id: id });
      const row = rows[0];
      if (!d.as_of || row.as_of !== d.as_of || row.amount_minor == null) { gaps.push({ side, item_id: id, reason: 'unknown_amount_or_unmatched_valuation_date' }); incomplete = true; continue; }
      usable.push(row);
    }
    const aggregate = usable.filter(row => row.scope === 'aggregate'), items = usable.filter(row => row.scope === 'item');
    if (aggregate.length > 1 || aggregate.length && items.length) { gaps.push({ side, reason: 'aggregate_and_items_overlap' }); result[side] = { recorded_subtotal_minor: null, complete_total_minor: null }; continue; }
    const value = sum(usable.map(row => row.amount_minor));
    result[side] = { recorded_subtotal_minor: value, complete_total_minor: d.as_of && d.coverage[coverage] === 'complete' && !incomplete ? value : null };
  }
  const a = result.asset, l = result.liability;
  return { as_of: d.as_of ?? null, assets: a, liabilities: l,
    net_of_recorded_balances_minor: a.recorded_subtotal_minor !== null && l.recorded_subtotal_minor !== null ? number(BigInt(a.recorded_subtotal_minor) - BigInt(l.recorded_subtotal_minor)) : null,
    complete_net_worth_minor: a.complete_total_minor !== null && l.complete_total_minor !== null ? number(BigInt(a.complete_total_minor) - BigInt(l.complete_total_minor)) : null,
    gaps, duplicates, note: 'Values use one declared valuation date and currency; unrecorded assets/debts are unknown and aggregate totals are not added to their components.' };
}

export function calculateWorksheet(kind, d) {
  validateWorksheet(kind, d); let result;
  if (kind === 'cashflow') result = cashflow(d);
  else if (kind === 'balances') result = balances(d);
  else if (kind === 'budget') result = { period: { from: d.from, to: d.to }, status: d.status, spending_coverage: d.spending_coverage,
    remaining_against_reported_spending_minor: d.limit_minor != null && d.spent_minor != null ? number(BigInt(d.limit_minor) - BigInt(d.spent_minor)) : null,
    complete_period_remaining_minor: d.spending_coverage === 'complete' && d.limit_minor != null && d.spent_minor != null ? number(BigInt(d.limit_minor) - BigInt(d.spent_minor)) : null };
  else if (kind === 'goal') {
    const remaining = d.target_minor != null && d.current_minor != null ? (BigInt(d.target_minor) > BigInt(d.current_minor) ? BigInt(d.target_minor) - BigInt(d.current_minor) : 0n) : null;
    result = { status: d.status, remaining_minor: remaining === null ? null : number(remaining), months_at_fixed_contribution: remaining === null ? null : remaining === 0n ? 0 : d.monthly_contribution_minor > 0 ? number((remaining + BigInt(d.monthly_contribution_minor) - 1n) / BigInt(d.monthly_contribution_minor)) : null,
      note: 'Conditional fixed-contribution estimate without investment returns, inflation or unspecified withdrawals; not an actual saving outcome.' };
  } else if (kind === 'debt') {
    if ([d.principal_minor, d.monthly_payment_minor, d.annual_rate_bps, d.upfront_fee_minor].some(value => value == null)) result = { outcome: 'missing_inputs', months: null, interest_minor: null, total_cash_minor: null };
    else {
      let principal = BigInt(d.principal_minor), interest = 0n, paid = 0n, months = 0, outcome = 'horizon_reached';
      while (principal > 0n && months < d.max_months) {
        const charge = (principal * BigInt(d.annual_rate_bps) + 60000n) / 120000n;
        if (BigInt(d.monthly_payment_minor) <= charge) { outcome = 'payment_does_not_amortize'; break; }
        const payment = principal + charge < BigInt(d.monthly_payment_minor) ? principal + charge : BigInt(d.monthly_payment_minor);
        principal = principal + charge - payment; interest += charge; paid += payment; months++;
      }
      if (principal === 0n) outcome = 'repaid_in_model';
      result = { outcome, months, remaining_principal_minor: number(principal), interest_minor: number(interest), paid_in_model_minor: number(paid), total_cash_minor: number(paid + BigInt(d.upfront_fee_minor)),
        note: 'Conditional monthly nominal-rate model; interest rounded half up to minor units each month, fee paid upfront, no variable rates, penalties, extra fees or real payments inferred.' };
    }
  } else {
    const range = field => d[field] != null ? [d[field], d[field]] : d[field.replace(/_minor$/, '_range_minor')] ?? null;
    const [start, income, expense, oneOff] = ['starting_minor', 'monthly_income_minor', 'monthly_expense_minor', 'one_off_minor'].map(range);
    const bounds = start && income && expense && oneOff ? [number(BigInt(start[0]) + BigInt(d.months) * (BigInt(income[0]) - BigInt(expense[1])) - BigInt(oneOff[1])), number(BigInt(start[1]) + BigInt(d.months) * (BigInt(income[1]) - BigInt(expense[0])) - BigInt(oneOff[0]))] : null;
    result = { months: d.months, assumptions: d.assumptions, projected_ending_minor: bounds && bounds[0] === bounds[1] ? bounds[0] : null, projected_ending_range_minor: bounds,
      note: 'Conditional fixed cash-flow scenario/range, not realized wealth, an investment return or a calibrated probability.' };
  }
  return { kind, currency: d.currency, scale: d.scale, ...result };
}
