# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/abrar778/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/abrar778/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks 196 pre-token protocols DefiLlama tracks — the 40-protocol watchlist, 143 early rows below its floor (including 9 versioned deployments), and 13 pre-token families above it — by a chain-peer implied launch value, and hands each one a five-step farm plan. Every one of the snapshot's 342 no-token records is accounted for.

This is round 4 of the entry, rebuilt from the kit rather than tweaked: a different value model (chain peers instead of sector peers, a saturating momentum curve, a seasoning hump, a focus premium instead of a breadth bonus), a different board (196 rows, versioned deployments ranked, four more families above the floor), a redesigned dashboard (light paper board, top-five spotlight, chain strip, two-column detail sheet), and rewritten farm plans and judge note.

## Run it

```sh
# with the sealed snapshot from the make.fun kit:
node main.ts --input path/to/snapshot.json --output out
# then open out/dashboard/index.html — no server, no network.
```

Node 22 or later, standard library only: no install, no build step.

## How it works

The board covers every protocol on the snapshot's watchlist (TVL at or above $50M, no token on record) and adds every other pre-token protocol below the floor that is not a wrapped, staked or bridged product of one that trades and does not begin with an exchange's name — versioned deployments included, because a V2 is a new deployment and a new farm target. It also adds the 13 pre-token families the snapshot records only as a product line above the floor — Sentora, Polymarket, CIAN, DeFi Saver, Mellow, BitFi, Figure Markets (two lines), Extended, Loopscale, Arcus, AZverse and Nado — while the 4 stablecoin tokens below the floor (thBill, avETH, YUSD, ftUSD) are set aside, because a token cannot be pre-token. 196 rows in all, ranked by implied value.

Coverage, from the snapshot's 342 protocols with no token: 196 ranked, 146 set aside — 63 wrapped, staked, bridged, exchange, CEX or liquid-staking products below the floor; 79 above-floor product lines that are tokens or products of a token-trading family; and 4 stablecoin tokens below the floor. The dashboard and the dossier state the same accounting.

Implied value is priced on the protocol's own chains, from the snapshot's live-token protocols:

```
implied = round( tvl_usd x peer_multiple x momentum x seasoning x focus )
```

- **peer_multiple**: the median of the medians of the protocol's own chains — each chain's median market-cap/TVL among its live-token protocols, winsorised to [0.02, 2.00], the result clamped to [0.03, 2.00]. A chain with no live comps falls back to the global median. A protocol is priced by where it runs, not by a sector label.
- **momentum**: `1 + 0.4 x tanh(change_7d / 50)` — a saturating curve, so fast growth counts but doubling the growth does not double the value; no growth reported counts as zero.
- **seasoning**: `0.75 + 0.25 x exp(-((age_days - 730) / 730)^2)` — a hump peaking two years in with no token: a brand-new protocol is too early, a very old one is less likely to launch; an unlisted age uses 365 days.
- **focus**: `1 + 0.08 / chains` — one chain is worth more per dollar of TVL than many: a focused protocol's TVL is one deployment's, not a scatter of them.

No protocol name is special-cased: the same function scores every row, and the dashboard shows the full working — the chain-peer table, and a per-row factor breakdown. The dashboard's model panel also carries the coverage accounting above and a note for the judge.

## What is in this repo

- `main.ts` — the program: reads the sealed snapshot, writes `board.json`, `data.js`, and `dossier.json`.
- `lib/model.ts` — the chain-peer model, the farm-plan derivation, and the board's gate checks.
- `dashboard/` — the static page: the board with a top-five spotlight and a chain strip, a detail sheet for every protocol with its model breakdown and farm plan, a live-token view, and the chain-peer table. It renders with no network.
- `screenshots/` — the board, a protocol's detail view, and a filtered view.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied from the kit unchanged; `dossier.json` is byte-identical to what it writes.
- `board.json` — the ranked board the program writes (also in the release output).

The dashboard reads `data.js`, which `main.ts` writes from the same board, so the page and the board can never disagree: the page recomputes each row and says so in the detail sheet.

## Farm plans

Each row carries five steps derived from its own record — category, chains, TVL and seven-day change decide the action, the capital ($60–$200 by TVL), the hold (21–60 days by momentum) and every cost and time. Each step states its cost in dollars (gas by chain: about $4 on Ethereum, about $0.30 elsewhere) and its time in minutes or days. Nothing in a plan names a protocol by hand.

---

<sub>Entered on [make.fun](https://make.fun/?ref=a9yp7rgm&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
