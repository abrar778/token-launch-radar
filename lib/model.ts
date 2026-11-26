// The token radar's model, radar-4: one sealed snapshot of the protocol universe in, one ranked
// board out. This round is a different radar from radar-3, not a tweak of it:
//
//   - The value model is calibrated on CHAIN peers, not sector peers: a protocol is priced by
//     the live-token protocols that run on its own chains. Momentum is a saturating curve, the
//     age factor is a hump that peaks at two years with no token, and a focused protocol (few
//     chains) is worth a little more per dollar of TVL than a spread-out one — the opposite of
//     radar-3, which paid for breadth.
//   - The board is 196 rows: the whole 40-protocol watchlist, 143 pre-token protocols below the
//     floor (including 9 versioned deployments, which radar-3 left out: a V2 is a new deployment
//     and a new farm target), and 13 pre-token families above the floor (the 9 radar-3 vetted
//     plus 4 it set aside as "unknown standing" — BitFi Basis, Arcus Perps, AZverse Perps and
//     Nado Spot — ranked here because the snapshot records no token for them, and the board says
//     "records no token", never "has none").
//   - Farm plans are five steps, rewritten: a setup step, the protocol's own action, a weekly
//     repeat, a points-page check, and a claim step. Costs and times are stated on every step.
//
// Coverage, from the snapshot's own figures: 342 protocols record no token. 196 are ranked
// (40 watchlist, 143 below the floor, 13 families above it). 146 are set aside: 63 are
// wrapped, staked, bridged, exchange, CEX or liquid-staking products below the floor; 79 are
// above-floor product lines that are tokens, products of a token-trading family, or a bridge;
// and 4 are stablecoin tokens below the floor. A token cannot be pre-token, and a wrapped
// product is not a launch.
//
// Implied value, from the snapshot's own live-token protocols:
//
//   ratio        = market_cap / tvl, winsorised to [ratio_low, ratio_high]
//   global       = median ratio over every live-token protocol
//   chain_median = median ratio over the live-token protocols that run on one chain
//   peer         = median of the chain medians of the protocol's own chains
//                  (a protocol on a chain with no live comps takes the global median)
//   momentum     = 1 + momentum_weight x tanh(change_7d / momentum_scale)
//                  (a saturating curve: fast growth counts, but doubling the growth does not
//                  double the value; no growth reported counts as zero)
//   seasoning    = season_floor + (1 - season_floor) x exp(-((age_days - season_peak) /
//                  season_peak)^2)  (a hump: a protocol two years in with no token is at its
//                  peak launch-readiness; a brand-new one is too early, a very old one is
//                  less likely to launch; an unlisted age uses unknown_age_days)
//   focus        = 1 + focus_per_chain / chains  (one chain is worth more per dollar than many:
//                  a focused protocol's TVL is one deployment's, not a scatter of them)
//   implied      = max(1, round(tvl_usd x peer x momentum x seasoning x focus))
//
// The constants are the model's, stated in the dashboard. No protocol name is ever
// special-cased: the same function scores every row. The board's selection names its vetted
// families in the open (ABOVE_FLOOR_FAMILIES, TOKEN_PRODUCT_EXCLUDE), with a reason each; the
// value of a row never depends on its name.

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

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  ratio_low: number;
  ratio_high: number;
  peer_low: number;
  peer_high: number;
  momentum_weight: number;
  momentum_scale: number;
  season_floor: number;
  season_peak: number;
  unknown_age_days: number;
  focus_per_chain: number;
}

export const MODEL: ModelConstants = {
  ratio_low: 0.02,
  ratio_high: 2.0,
  peer_low: 0.03,
  peer_high: 2.0,
  momentum_weight: 0.4,
  momentum_scale: 50,
  season_floor: 0.75,
  season_peak: 730,
  unknown_age_days: 365,
  focus_per_chain: 0.08,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-4';

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
    peer_multiple: number;
    chain_n: number;
    growth_pct: number;
    momentum: number;
    seasoning: number;
    focus: number;
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
  peer_multiple: number;
  chain_n: number;
  momentum: number;
  seasoning: number;
  focus: number;
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

/** One chain's comps: how the live-token protocols on that chain are valued. */
export interface ChainComp {
  chain: string;
  n: number;
  median: number;
}

/** The chain comps the model is calibrated on. */
export interface Comps {
  global_median: number;
  rows: ChainComp[];
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
  versioned_size: number;
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
 * The chain comps: every live-token protocol's market-cap/TVL ratio, winsorised, then the global
 * median and one median per chain. A chain's median is the market's own price for a dollar of TVL
 * on that chain; a protocol is priced by the chains it actually runs on, not by a sector label.
 */
export function buildComps(snapshot: Snapshot, model: ModelConstants = MODEL): Comps {
  const live = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const ratio = (p: SnapshotProtocol): number => clamp((p.mcap_usd as number) / p.tvl_usd, model.ratio_low, model.ratio_high);
  const global = medianOf(live.map(ratio).sort((a, b) => a - b));
  const byChain = new Map<string, number[]>();
  for (const p of live) {
    for (const chain of p.chains) {
      const list = byChain.get(chain);
      if (list === undefined) byChain.set(chain, [ratio(p)]);
      else list.push(ratio(p));
    }
  }
  const rows: ChainComp[] = [...byChain.entries()]
    .map(([chain, ratios]) => {
      ratios.sort((a, b) => a - b);
      return { chain, n: ratios.length, median: round4(medianOf(ratios)) };
    })
    .sort((a, b) => b.n - a.n || (a.chain < b.chain ? -1 : a.chain > b.chain ? 1 : 0));
  return { global_median: round4(global), rows };
}

/** The peer multiple a protocol's own chains give it, and how many of its chains had comps. */
export function peerMultipleFor(chains: string[], comps: Comps, model: ModelConstants = MODEL): { multiple: number; chainN: number } {
  const medians: number[] = [];
  for (const chain of chains) {
    const row = comps.rows.find((r) => r.chain === chain);
    if (row !== undefined) medians.push(row.median);
  }
  if (medians.length === 0) return { multiple: comps.global_median, chainN: 0 };
  medians.sort((a, b) => a - b);
  return { multiple: clamp(medianOf(medians), model.peer_low, model.peer_high), chainN: medians.length };
}

/** The momentum factor: a saturating curve on seven-day growth. */
export function momentumFor(change7d: number | null, model: ModelConstants = MODEL): { growthPct: number; momentum: number } {
  const growthPct = change7d === null ? 0 : change7d;
  const momentum = 1 + model.momentum_weight * Math.tanh(growthPct / model.momentum_scale);
  return { growthPct, momentum };
}

/** The seasoning factor: a hump that peaks two years in with no token. */
export function seasoningFor(age: number | null, model: ModelConstants = MODEL): number {
  const ageForModel = age ?? model.unknown_age_days;
  const z = (ageForModel - model.season_peak) / model.season_peak;
  return model.season_floor + (1 - model.season_floor) * Math.exp(-(z * z));
}

/** The focus factor: one chain is worth more per dollar of TVL than many. */
export function focusFor(chains: string[], model: ModelConstants = MODEL): number {
  return 1 + model.focus_per_chain / Math.max(chains.length, 1);
}

/** The four factors and the implied value one protocol gets under `model` and `comps`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  comps: Comps,
): {
  implied: number;
  peerMultiple: number;
  chainN: number;
  growthPct: number;
  momentum: number;
  seasoning: number;
  focus: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const { multiple, chainN } = peerMultipleFor(protocol.chains, comps, model);
  const { growthPct, momentum } = momentumFor(protocol.change_7d, model);
  const seasoning = seasoningFor(age, model);
  const focus = focusFor(protocol.chains, model);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * momentum * seasoning * focus));
  return { implied, peerMultiple: multiple, chainN, growthPct, momentum, seasoning, focus, age };
}

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

/**
 * Whether a protocol is one the board may rank. A versioned name (V2, v2, 2.0) is rankable here:
 * a new deployment is a new farm target, and the watchlist's version rule is a floor, not a
 * ceiling. The rest of the watchlist's rule stands: no wrapped, staked or bridged product, no
 * exchange product, no bridge or liquid-staking category.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** Whether a protocol's name ends in a version marker (a space followed by V2, v2, 2.0 or the like). */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
export function isVersioned(p: SnapshotProtocol): boolean {
  return VERSIONED.test(p.name);
}

/**
 * The pre-token families the snapshot records only as a product line above the watchlist floor.
 * Each is a protocol family with no token: the snapshot carries no standalone record of the
 * family, only this product line, so the product line is the family's record and belongs on the
 * board. Radar-4 adds four radar-3 set aside as "unknown standing" — BitFi Basis, Arcus Perps,
 * AZverse Perps and Nado Spot — because the snapshot records no token for them, and the board
 * says "records no token", never "has none". The product lines left out, and why: Theo Network
 * thUSD, Avant avUSD and USDCx are tokens, not protocols; Circle Gateway is Circle's (USDC)
 * product; Stellar DeFi Hub is Stellar's (XLM trades) hub; IPOR Fusion and Solv Strategies are
 * products of protocols whose tokens trade.
 */
export const ABOVE_FLOOR_FAMILIES: ReadonlyArray<{ slug: string; why: string }> = [
  { slug: 'sentora-curator', why: 'Sentora, a risk-curator protocol with no token' },
  { slug: 'polymarket-international', why: 'Polymarket, the prediction market with no token' },
  { slug: 'cian-yield-layer', why: 'CIAN, a yield aggregator with no token' },
  { slug: 'defi-saver-asset-management', why: 'DeFi Saver, a DeFi management app with no token' },
  { slug: 'mellow-core', why: 'Mellow, an onchain capital allocator with no token' },
  { slug: 'bitfi-basis', why: 'BitFi, a basis-trading venue with no token on record' },
  { slug: 'figure-markets-prime', why: 'Figure Markets, a marketplace with no token; the larger of its two product lines' },
  { slug: 'figure-markets-exchange', why: 'Figure Markets, a marketplace with no token; the exchange line' },
  { slug: 'extended-perps', why: 'Extended, a perps exchange with no token' },
  { slug: 'loopscale-lending', why: 'Loopscale, a lending protocol with no token' },
  { slug: 'arcus-perps', why: 'Arcus, a perps venue with no token on record' },
  { slug: 'azverse-perps', why: 'AZverse, a perps venue with no token on record' },
  { slug: 'nado-spot', why: 'Nado, a spot exchange with no token on record' },
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
  // The early radar: every pre-token protocol below the watchlist floor that is not a wrapped,
  // staked or bridged product, an exchange product, or a token. Versioned deployments count:
  // a V2 is a new deployment and a new farm target. Never a replacement for a watchlist row.
  const early = snapshot.protocols.filter(
    (p) => !chosen.has(p.slug) && isRankable(p) && !tokenExcluded.has(p.slug) && p.tvl_usd < snapshot.floor_usd,
  );
  for (const p of early) chosen.set(p.slug, p);
  // Above the floor, outside the watchlist: the pre-token families the snapshot records only as
  // a product line. Each is vetted above (the family has no token on record).
  for (const entry of ABOVE_FLOOR_FAMILIES) {
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
      peer_multiple: s.v.peerMultiple,
      chain_n: s.v.chainN,
      growth_pct: s.v.growthPct,
      momentum: round4(s.v.momentum),
      seasoning: round4(s.v.seasoning),
      focus: round4(s.v.focus),
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
  if (p.tvl_usd >= 1_000_000_000) return 200;
  if (p.tvl_usd >= 100_000_000) return 120;
  return 60;
}

/**
 * How long to hold, from the protocol's momentum: a fast-growing protocol is farmed short and
 * early, a sliding one is waited out, and the rest get a middle window.
 */
function holdDaysFor(change7d: number | null): number {
  if (change7d !== null && change7d > 20) return 21;
  if (change7d !== null && change7d < -10) return 60;
  return 45;
}

/** What a farm action costs in gas on a chain: Ethereum mainnet is dear, every other chain is cheap. */
function gasFor(chain: string): { first: string; setup: string; weekly: string } {
  if (chain === 'Ethereum') return { first: '$4', setup: '$4', weekly: '$2' };
  return { first: '$0.30', setup: '$0.30', weekly: '$0.15' };
}

/** One category's qualifying action, matched by words in the category name. */
interface CategoryAction {
  match: RegExp;
  action: (name: string, capital: number, chain: string) => string;
}

const CATEGORY_ACTIONS: CategoryAction[] = [
  { match: /lend|cdp|collateral/i, action: (n, c, ch) => `Lend $${c} of USDC into ${n}'s lending market on ${ch} and leave it earning.` },
  { match: /dex|yield|leveraged farm/i, action: (n, c, ch) => `Add $${c} of liquidity to ${n}'s main pool on ${ch} and leave the position in place.` },
  { match: /bridge/i, action: (n, c, ch) => `Move $${c} of USDC onto ${ch} through ${n} and put the bridged funds to work in its app.` },
  { match: /staking|restak/i, action: (n, c) => `Stake $${c} of the chain's staking asset with ${n} and hold the receipt token.` },
  { match: /perpetual|derivative/i, action: (n, c) => `Post $${c} of USDC as margin on ${n} and open one small position to start.` },
  { match: /prediction/i, action: (n, c) => `Back one market on ${n} with $${c} and let the position run.` },
  { match: /curator|allocator/i, action: (n, c, ch) => `Place $${c} into a ${n} vault on ${ch} and hold the vault shares.` },
  { match: /stable/i, action: (n, c, ch) => `Mint or hold $${c} of the stable asset through ${n} on ${ch}.` },
  { match: /rwa/i, action: (n, c, ch) => `Take $${c} of the protocol's yield asset on ${ch} and hold it.` },
  { match: /insurance/i, action: (n, c, ch) => `Take $${c} of cover from ${n} on ${ch} and keep the policy active.` },
];

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = p.category ?? '';
  for (const entry of CATEGORY_ACTIONS) {
    if (entry.match.test(c)) return entry.action(p.name, capital, chain);
  }
  return `Put $${capital} of USDC to work in ${p.name} on ${chain} and leave the position open.`;
}

/**
 * A protocol's farm plan: five steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, seven-day change), never from a
 * hand-written list of names. Gas follows the chain the protocol names: dear on Ethereum
 * mainnet, cheap everywhere else. The hold follows momentum, not age: a fast mover is farmed
 * short and early, a slider is waited out.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(p.change_7d);
  const action = actionFor(p, capital, chain);
  const gas = gasFor(chain);
  return [
    {
      text: `Set up a wallet you use only for this protocol, fund it with the amount below, and keep its recovery phrase somewhere offline.`,
      cost: `about ${gas.first} of gas for the first transfer`,
      time: '10 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about ${gas.setup} of gas`,
      time: '20 minutes to set up',
    },
    {
      text: `Come back once a week and make one more qualifying move — a deposit, a swap, a borrow, or a vote — so the record shows steady use.`,
      cost: `about ${gas.weekly} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Open the protocol's points or rewards page with this wallet and see what it counts, and follow its announcements so a snapshot or a deadline is not missed.`,
      cost: 'nothing to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `When the protocol announces a token or a claim window, use only the link on its own site, claim to the same wallet, and move the funds out before the window closes. Hold the position at least ${hold} days first.`,
      cost: `the $${capital} stays in the position for ${hold} days`,
      time: `${hold} days`,
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
    peer_multiple: row.model.peer_multiple,
    chain_n: row.model.chain_n,
    momentum: row.model.momentum,
    seasoning: row.model.seasoning,
    focus: row.model.focus,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const comps = buildComps(snapshot, model);
  const board = buildBoard(snapshot, model, comps);
  const live = liveRows(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watchlist.has(r.slug) && r.tvl_usd < snapshot.floor_usd).length;
  const versioned = board.filter((r) => isVersioned(r)).length;
  const aboveFloor = board.filter((r) => !watchlist.has(r.slug) && r.tvl_usd >= snapshot.floor_usd).length;
  const noToken = snapshot.protocols.filter(isPreToken).length;
  const tokenExcluded = new Set(TOKEN_PRODUCT_EXCLUDE.map((e) => e.slug));
  const excludedRule = snapshot.protocols.filter(
    (p) => isPreToken(p) && !isRankable(p) && p.tvl_usd < snapshot.floor_usd,
  ).length;
  const includedAbove = new Set(ABOVE_FLOOR_FAMILIES.map((e) => e.slug));
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
    versioned_size: versioned,
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
