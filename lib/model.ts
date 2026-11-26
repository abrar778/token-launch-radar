// The token radar's model: one sealed snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// every other pre-token protocol the snapshot shows: the early rows below the watchlist floor, and
// the pre-token families the snapshot records only as a product line above the floor. A protocol
// is pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol),
// and rankable when it is also not a wrapped, staked or bridged product of one that trades,
// carries no version marker and does not begin with an exchange's name. A stablecoin or yield
// token is set aside, not ranked: a token cannot be pre-token. The snapshot's live-token
// protocols are kept apart and shown as the market's own values, never mixed into the ranked board.
//
// Coverage, from the snapshot's own figures: 342 protocols record no token. 183 are ranked
// (the 40 on the watchlist, 134 early rows below the floor, 9 pre-token families above it).
// 159 are set aside: 144 fail the strict rule (wrapped, staked, bridged, exchange, CEX,
// liquid-staking, or versioned products), 11 are above-floor product lines that are tokens or
// products of a token-trading family, and 4 are stablecoin tokens below the floor. The board is
// every standalone pre-token protocol the snapshot shows, and the set-aside is named, not hidden.
//
// Implied value is comps-calibrated, per sector, from the snapshot's own live-token protocols:
//
//   ratio        = market_cap / tvl, winsorised to [clamp_low, clamp_high]
//   global       = median ratio over every live-token protocol
//   category     = median ratio over the live-token protocols of one category
//   multiple     = (n x category + prior_n x global) / (n + prior_n), clamped
//                  (a category with no live comps takes the global median outright)
//   base         = tvl_usd x multiple
//   growthMult   = 1 + clamp(change_7d, growth_floor, growth_cap) / 100 x growth_weight
//   maturityMult = maturity_floor + min(age_days, maturity_days) / maturity_days x maturity_range
//                  (age_days unknown: unknown_age_days)
//   breadthMult  = 1 + breadth_per_chain x min(chains - 1, breadth_max_extra)
//   implied      = max(1, round(base x growthMult x maturityMult x breadthMult))
//
// The constants are the model's, stated in the dashboard and changeable in the model sandbox. No
// protocol name is ever special-cased: the same function scores every row. The board's selection
// names its few vetted families in the open (ABOVE_FLOOR_INCLUDE, TOKEN_PRODUCT_EXCLUDE), with a
// reason each; the value of a row never depends on its name.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  clamp_low: number;
  clamp_high: number;
  prior_n: number;
  breadth_per_chain: number;
  breadth_max_extra: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  clamp_low: 0.05,
  clamp_high: 1.5,
  prior_n: 8,
  breadth_per_chain: 0.02,
  breadth_max_extra: 5,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    category_median: number | null;
    category_n: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_multiple: number;
  category_n: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One sector's comps: how the live-token protocols of a category are valued. */
export interface CategoryComp {
  category: string;
  n: number;
  median: number;
  multiple: number;
}

/** The sector comps the model is calibrated on. */
export interface Comps {
  global_median: number;
  prior_n: number;
  rows: CategoryComp[];
}

/** How the snapshot's no-token records split into ranked rows and set-aside ones. */
export interface Coverage {
  no_token: number;
  ranked: number;
  set_aside: number;
  excluded_rule: number;
  excluded_product: number;
  excluded_token: number;
}

/** Everything the dashboard needs: the board, the live set, the comps and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  above_floor_size: number;
  live_size: number;
  coverage: Coverage;
  comps: Comps;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Clamp `x` into [low, high]. */
function clamp(x: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, x));
}

/** Round to four decimal places. */
function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/** The lower median of a sorted array (deterministic for even lengths). */
function medianOf(sorted: number[]): number {
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The sector comps: every live-token protocol's market-cap/TVL ratio, winsorised, then the global
 * median and one shrunk multiple per category. A category's multiple is its own median pulled toward
 * the global median by a prior of `prior_n` phantom protocols, so a thin category cannot set an
 * extreme multiple on two or three names.
 */
export function buildComps(snapshot: Snapshot, model: ModelConstants = MODEL): Comps {
  const live = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const ratio = (p: SnapshotProtocol): number => clamp((p.mcap_usd as number) / p.tvl_usd, model.clamp_low, model.clamp_high);
  const global = medianOf(live.map(ratio).sort((a, b) => a - b));
  const byCategory = new Map<string, number[]>();
  for (const p of live) {
    const key = p.category ?? '(uncategorised)';
    const list = byCategory.get(key);
    if (list === undefined) byCategory.set(key, [ratio(p)]);
    else list.push(ratio(p));
  }
  const rows: CategoryComp[] = [...byCategory.entries()]
    .map(([category, ratios]) => {
      ratios.sort((a, b) => a - b);
      const med = medianOf(ratios);
      const shrunk = (ratios.length * med + model.prior_n * global) / (ratios.length + model.prior_n);
      return { category, n: ratios.length, median: round4(med), multiple: round4(clamp(shrunk, model.clamp_low, model.clamp_high)) };
    })
    .sort((a, b) => b.n - a.n || (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));
  return { global_median: round4(global), prior_n: model.prior_n, rows };
}

/** The multiple one category gets, and the median and count behind it. */
export function multipleFor(category: string | null, comps: Comps): { multiple: number; median: number | null; n: number } {
  if (category === null) return { multiple: comps.global_median, median: null, n: 0 };
  const row = comps.rows.find((r) => r.category === category);
  if (row === undefined) return { multiple: comps.global_median, median: null, n: 0 };
  return { multiple: row.multiple, median: row.median, n: row.n };
}

/** The four multipliers and the implied value one protocol gets under `model` and `comps`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  comps: Comps,
): {
  implied: number;
  multiple: number;
  categoryMedian: number | null;
  categoryN: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  breadthMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const { multiple, median, n } = multipleFor(protocol.category, comps);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = clamp(rawGrowth, model.growth_floor, model.growth_cap);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (clamp(ageForModel, 0, model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_extra);
  const breadthMult = 1 + model.breadth_per_chain * extraChains;
  const base = protocol.tvl_usd * multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * breadthMult));
  return { implied, multiple, categoryMedian: median, categoryN: n, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are a wrapped, staked or bridged product of another protocol, never a launch of their own. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A name beginning with an exchange's name is the exchange's product, not a protocol of its own. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** A name carrying a whole word wrapped, staked or staking is a product of a token that trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: the watchlist's own rule, without its TVL floor. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/**
 * The pre-token families the snapshot records only as a product line above the watchlist floor.
 * Each is a protocol family with no token: the snapshot carries no standalone record of the
 * family, only this product line, so the product line is the family's record and belongs on the
 * board. The family, not the product name, is what has no token.
 *
 * The other above-floor rankable product lines are left out, and why: Theo Network thUSD,
 * Avant avUSD and USDCx are tokens, not protocols; Circle Gateway is Circle's (USDC) product and
 * Stellar DeFi Hub is Stellar's (XLM trades); IPOR Fusion and Solv Strategies are products of
 * protocols whose tokens trade; BitFi Basis, Arcus Perps, AZverse Perps and Nado Spot are of
 * unknown standing, and where the record leaves doubt the board leaves the row out.
 */
export const ABOVE_FLOOR_INCLUDE: ReadonlyArray<{ slug: string; why: string }> = [
  { slug: 'sentora-curator', why: 'Sentora, a risk-curator protocol with no token' },
  { slug: 'polymarket-international', why: 'Polymarket, the prediction market with no token' },
  { slug: 'cian-yield-layer', why: 'CIAN, a yield aggregator with no token' },
  { slug: 'defi-saver-asset-management', why: 'DeFi Saver, a DeFi management app with no token' },
  { slug: 'mellow-core', why: 'Mellow, an onchain capital allocator with no token' },
  { slug: 'figure-markets-prime', why: 'Figure Markets, a marketplace with no token; the larger of its two product lines' },
  { slug: 'figure-markets-exchange', why: 'Figure Markets, a marketplace with no token; the exchange line' },
  { slug: 'extended-perps', why: 'Extended, a perps exchange with no token' },
  { slug: 'loopscale-lending', why: 'Loopscale, a lending protocol with no token' },
];

/**
 * Stablecoin and yield tokens the snapshot records as protocols: each IS a token, not a protocol
 * waiting to launch one, so it is set aside, not ranked. A token cannot be pre-token.
 */
export const TOKEN_PRODUCT_EXCLUDE: ReadonlyArray<{ slug: string; why: string }> = [
  { slug: 'theo-network-thbill', why: 'thBill is Theo Network\u2019s stablecoin, a token' },
  { slug: 'avant-aveth', why: 'avETH is Avant\u2019s yield token, a token' },
  { slug: 'aegis-yusd', why: 'YUSD is Aegis\u2019s stablecoin, a token' },
  { slug: 'flying-tulip-ftusd', why: 'ftUSD is Flying Tulip\u2019s stablecoin, a token' },
];

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL, comps: Comps = buildComps(snapshot, model)): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  const tokenExcluded = new Set(TOKEN_PRODUCT_EXCLUDE.map((e) => e.slug));
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped. A stablecoin
  // or yield token is set aside, not ranked: a token cannot be pre-token. Never a replacement for
  // a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && !tokenExcluded.has(p.slug) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);
  // Above the floor, outside the watchlist: the pre-token families the snapshot records only as
  // a product line. Each is vetted above (the family has no token); the product lines that are
  // tokens, products of a token-trading family, or of unknown standing are left out.
  for (const entry of ABOVE_FLOOR_INCLUDE) {
    const p = index.get(entry.slug);
    if (p !== undefined && !chosen.has(entry.slug) && isRankable(p)) chosen.set(entry.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, comps);
    return { p, v };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      base_multiple: s.v.multiple,
      category_median: s.v.categoryMedian,
      category_n: s.v.categoryN,
      growth_pct: s.v.growthPct,
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      breadth_multiplier: round4(s.v.breadthMult),
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** What a farm action costs in gas on a chain: Ethereum mainnet is dear, every other chain is cheap. */
function gasFor(chain: string): { first: string; setup: string; weekly: string } {
  if (chain === 'Ethereum') return { first: '$5', setup: '$5', weekly: '$3' };
  return { first: '$0.50', setup: '$0.50', weekly: '$0.25' };
}

/** One category's qualifying action, matched by words in the category name. */
interface CategoryAction {
  match: RegExp;
  action: (name: string, capital: number, chain: string) => string;
}

const CATEGORY_ACTIONS: CategoryAction[] = [
  { match: /lend|cdp|collateral/i, action: (n, c, ch) => `Supply $${c} of USDC to ${n} on ${ch} and keep the position open.` },
  { match: /dex|yield|leveraged farm/i, action: (n, c, ch) => `Provide $${c} of liquidity to ${n}'s main pool on ${ch} and keep the position open.` },
  { match: /bridge/i, action: (n, c, ch) => `Bridge $${c} of USDC to ${ch} through ${n} and use the bridged funds in its app.` },
  { match: /staking|restak/i, action: (n, c, ch) => `Stake $${c} of the chain's staking asset through ${n} and keep the receipt.` },
  { match: /perpetual|derivative/i, action: (n, c, ch) => `Deposit $${c} of USDC as margin on ${n} and open one small hedge.` },
  { match: /prediction/i, action: (n, c) => `Fund $${c} and place one market position on ${n}.` },
  { match: /curator|allocator/i, action: (n, c, ch) => `Deposit $${c} into a ${n} vault on ${ch} and keep the shares.` },
  { match: /stable/i, action: (n, c, ch) => `Mint or deposit $${c} of the stable asset through ${n} on ${ch}.` },
  { match: /rwa/i, action: (n, c, ch) => `Mint $${c} of the protocol's yield asset on ${ch} and hold it.` },
  { match: /insurance/i, action: (n, c, ch) => `Buy $${c} of cover from ${n} on ${ch} and keep the policy.` },
];

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = p.category ?? '';
  for (const entry of CATEGORY_ACTIONS) {
    if (entry.match.test(c)) return entry.action(p.name, capital, chain);
  }
  return `Deposit $${capital} of USDC into ${p.name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 * Gas follows the chain the protocol names: dear on Ethereum mainnet, cheap everywhere else.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const gas = gasFor(chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `about ${gas.first} of gas for the first transaction`,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about ${gas.setup} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: `about ${gas.weekly} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays locked for ${hold} days, with no fee but no use elsewhere`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_multiple: row.model.base_multiple,
    category_n: row.model.category_n,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const comps = buildComps(snapshot, model);
  const board = buildBoard(snapshot, model, comps);
  const live = liveRows(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watchlist.has(r.slug) && r.tvl_usd < snapshot.floor_usd).length;
  const aboveFloor = board.filter((r) => !watchlist.has(r.slug) && r.tvl_usd >= snapshot.floor_usd).length;
  const noToken = snapshot.protocols.filter(isPreToken).length;
  const excludedRule = snapshot.protocols.filter((p) => isPreToken(p) && !isRankable(p)).length;
  const includedAbove = new Set(ABOVE_FLOOR_INCLUDE.map((e) => e.slug));
  const excludedProduct = snapshot.protocols.filter(
    (p) => isRankable(p) && p.tvl_usd >= snapshot.floor_usd && !watchlist.has(p.slug) && !includedAbove.has(p.slug),
  ).length;
  const excludedToken = TOKEN_PRODUCT_EXCLUDE.filter((e) => {
    const p = snapshot.protocols.find((q) => q.slug === e.slug);
    return p !== undefined && isRankable(p) && p.tvl_usd < snapshot.floor_usd;
  }).length;
  const coverage: Coverage = {
    no_token: noToken,
    ranked: board.length,
    set_aside: noToken - board.length,
    excluded_rule: excludedRule,
    excluded_product: excludedProduct,
    excluded_token: excludedToken,
  };
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    above_floor_size: aboveFloor,
    live_size: live.length,
    coverage,
    comps,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
