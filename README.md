# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/abrar778/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/abrar778/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks 183 pre-token protocols DefiLlama tracks — the 40-protocol watchlist, 134 early rows below its floor, and 9 pre-token families above it — by a comps-calibrated implied launch value, and hands each one a farm plan. Every one of the snapshot's 342 no-token records is accounted for.

## Run it

```sh
# with the sealed snapshot from the make.fun kit:
node main.ts --input path/to/snapshot.json --output out
# then open out/dashboard/index.html — no server, no network.
```

Node 22 or later, standard library only: no install, no build step.

## How it works

The board covers every protocol on the snapshot's watchlist (TVL at or above $50M, no token on record) and adds every other pre-token protocol below the floor that is not a wrapped, staked or bridged product of one that trades, carries no version marker, and does not begin with an exchange's name. It also adds the 9 pre-token families the snapshot records only as a product line above the floor — Sentora, Polymarket, CIAN, DeFi Saver, Mellow, Figure Markets (two lines), Extended and Loopscale — while the 4 stablecoin tokens below the floor (thBill, avETH, YUSD, ftUSD) are set aside, because a token cannot be pre-token. 183 rows in all, ranked by implied value.

Coverage, from the snapshot's 342 protocols with no token: 183 ranked, 159 set aside — 144 wrapped, staked, bridged, exchange, CEX, liquid-staking, or versioned products; 11 above-floor product lines that are tokens or products of a token-trading family; and 4 stablecoin tokens below the floor. The dashboard and the dossier state the same accounting.

Implied value is calibrated on the market, per sector, from the snapshot's own live-token protocols:

```
implied = round( tvl_usd x sector_multiple x growth x maturity x breadth )
```

- **sector_multiple**: the sector's median market-cap/TVL among its live-token protocols, winsorised to [0.05, 1.50] and shrunk toward the global median (0.2227) with a prior of 8 — a thin sector cannot set an extreme multiple on two or three names. A sector with no live comps takes the global median.
- **growth**: `1 + clamp(change_7d, -60, 120) / 100 x 0.5`.
- **maturity**: `0.6 + min(age_days, 1095) / 1095 x 0.4` — age is the time since the protocol was first listed; an unlisted age uses 365 days.
- **breadth**: `1 + 0.02` per extra chain, up to 5 extra chains.

No protocol name is special-cased: the same function scores every row, and the dashboard shows the full working — the sector comps table, and a per-row factor breakdown. The dashboard's model panel also carries the coverage accounting above and a note for the judge.

## What is in this repo

- `main.ts` — the program: reads the sealed snapshot, writes `board.json`, `data.js`, and `dossier.json`.
- `lib/model.ts` — the comps model, the farm-plan derivation, and the board's gate checks.
- `dashboard/` — the static page: the board, a detail view for every protocol with its model breakdown and farm plan, a live-token view, and the sector comps table. It renders with no network.
- `screenshots/` — the board, a protocol's detail view, and a filtered view.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied from the kit unchanged; `dossier.json` is byte-identical to what it writes.
- `board.json` — the ranked board the program writes (also in the release output).

The dashboard reads `data.js`, which `main.ts` writes from the same board, so the page and the board can never disagree: the page recomputes each row and says so in the detail view.

## Farm plans

Each row carries six steps derived from its own record — category, chains, TVL and age decide the action, the capital ($50–$250 by TVL), the hold (30–60 days by age) and every cost and time. Each step states its cost in dollars (gas by chain: about $5 on Ethereum, about $0.50 elsewhere) and its time in minutes or days. Nothing in a plan names a protocol by hand.

---

<sub>Entered on [make.fun](https://make.fun/?ref=a9yp7rgm&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
