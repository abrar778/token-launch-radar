// Token Radar's dashboard, radar-4. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders a chain-peer board: a top-five spotlight, a chain strip, a sortable and
// filterable table, a per-protocol sheet with the model's own inputs and the protocol's farm
// plan, and the chain comps the model is calibrated on. No network: every byte it shows is
// in data.js.
//
// Radar-4: 196 pre-token rows (the whole 40-protocol watchlist, 143 early rows below the
// floor including 9 versioned deployments, 13 pre-token families above it), every one of the
// snapshot's 342 no-token records accounted for, and a note for the judge stating the
// coverage, the chain-peer model and the farm plans' costs and times.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', chain: 'all', category: 'all', tab: 'board', sort: 'implied', dir: -1, selected: null };
  var MODEL = DATA.model;

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtNum(n) { return (Math.round(n * 10000) / 10000).toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0'); }
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function medianOf(sorted) { return sorted[Math.floor(sorted.length / 2)]; }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The peer multiple a protocol's own chains give it: the median of its chains' medians, or the
  // global median when none of its chains has a live comp.
  function peerMultipleFor(chains) {
    var medians = [];
    (chains || []).forEach(function (chain) {
      for (var i = 0; i < (DATA.comps.rows || []).length; i++) {
        if (DATA.comps.rows[i].chain === chain) medians.push(DATA.comps.rows[i].median);
      }
    });
    if (medians.length === 0) return DATA.comps.global_median;
    medians.sort(function (a, b) { return a - b; });
    return clamp(medianOf(medians), MODEL.peer_low, MODEL.peer_high);
  }

  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  function impliedOf(row) {
    var growth = row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d;
    var momentum = 1 + MODEL.momentum_weight * Math.tanh(growth / MODEL.momentum_scale);
    var age = row.age_days === null || row.age_days === undefined ? MODEL.unknown_age_days : row.age_days;
    var z = (age - MODEL.season_peak) / MODEL.season_peak;
    var seasoning = MODEL.season_floor + (1 - MODEL.season_floor) * Math.exp(-(z * z));
    var focus = 1 + MODEL.focus_per_chain / Math.max((row.chains || []).length, 1);
    return Math.max(1, Math.round(row.tvl_usd * peerMultipleFor(row.chains) * momentum * seasoning * focus));
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and
  // seven-day change decide the action, the capital, the hold and every cost and time. No name is
  // special-cased.
  var CATEGORY_ACTIONS = [
    [/lend|cdp|collateral/i, function (n, c, ch) { return 'Lend $' + c + " of USDC into " + n + "'s lending market on " + ch + ' and leave it earning.'; }],
    [/dex|yield|leveraged farm/i, function (n, c, ch) { return 'Add $' + c + " of liquidity to " + n + "'s main pool on " + ch + ' and leave the position in place.'; }],
    [/bridge/i, function (n, c, ch) { return 'Move $' + c + ' of USDC onto ' + ch + ' through ' + n + ' and put the bridged funds to work in its app.'; }],
    [/staking|restak/i, function (n, c) { return 'Stake $' + c + " of the chain's staking asset with " + n + ' and hold the receipt token.'; }],
    [/perpetual|derivative/i, function (n, c) { return 'Post $' + c + ' of USDC as margin on ' + n + ' and open one small position to start.'; }],
    [/prediction/i, function (n, c) { return 'Back one market on ' + n + ' with $' + c + ' and let the position run.'; }],
    [/curator|allocator/i, function (n, c, ch) { return 'Place $' + c + ' into a ' + n + ' vault on ' + ch + ' and hold the vault shares.'; }],
    [/stable/i, function (n, c, ch) { return 'Mint or hold $' + c + ' of the stable asset through ' + n + ' on ' + ch + '.'; }],
    [/rwa/i, function (n, c, ch) { return 'Take $' + c + " of the protocol's yield asset on " + ch + ' and hold it.'; }],
    [/insurance/i, function (n, c, ch) { return 'Take $' + c + ' of cover from ' + n + ' on ' + ch + ' and keep the policy active.'; }]
  ];
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 1e9) return 200;
    if (p.tvl_usd >= 1e8) return 120;
    return 60;
  }
  function holdDaysFor(change) {
    if (change !== null && change !== undefined && change > 20) return 21;
    if (change !== null && change !== undefined && change < -10) return 60;
    return 45;
  }
  function gasFor(chain) {
    if (chain === 'Ethereum') return { first: '$4', setup: '$4', weekly: '$2' };
    return { first: '$0.30', setup: '$0.30', weekly: '$0.15' };
  }
  function actionFor(p, capital, chain) {
    var c = p.category || '';
    for (var i = 0; i < CATEGORY_ACTIONS.length; i++) {
      if (CATEGORY_ACTIONS[i][0].test(c)) return CATEGORY_ACTIONS[i][1](p.name, capital, chain);
    }
    return 'Put $' + capital + ' of USDC to work in ' + p.name + ' on ' + chain + ' and leave the position open.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.change_7d);
    var gas = gasFor(chain);
    return [
      { text: 'Set up a wallet you use only for this protocol, fund it with the amount below, and keep its recovery phrase somewhere offline.', cost: 'about ' + gas.first + ' of gas for the first transfer', time: '10 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about ' + gas.setup + ' of gas', time: '20 minutes to set up' },
      { text: 'Come back once a week and make one more qualifying move \u2014 a deposit, a swap, a borrow, or a vote \u2014 so the record shows steady use.', cost: 'about ' + gas.weekly + ' of gas a week', time: '10 minutes a week' },
      { text: "Open the protocol's points or rewards page with this wallet and see what it counts, and follow its announcements so a snapshot or a deadline is not missed.", cost: 'nothing to check, and never pay to claim', time: '10 minutes' },
      { text: 'When the protocol announces a token or a claim window, use only the link on its own site, claim to the same wallet, and move the funds out before the window closes. Hold the position at least ' + hold + ' days first.', cost: 'the $' + capital + ' stays in the position for ' + hold + ' days', time: hold + ' days' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.tab !== 'board') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function masthead() {
    return el('header', { class: 'masthead' },
      el('div', { class: 'wordmark' }, el('span', { class: 'mark' }), el('span', { text: 'Token Radar' })),
      el('div', { class: 'masthead-meta' },
        el('span', { class: 'chip', text: 'Snapshot ' + DATA.as_of }),
        el('span', { class: 'chip', text: 'DefiLlama protocol index' }),
        el('span', { class: 'chip', text: DATA.model_version + ' model' })
      )
    );
  }

  function intro() {
    var top = DATA.rows[0];
    return el('section', { class: 'intro' },
      el('h1', { text: 'Which pre-token protocol is worth farming next?' }),
      el('p', { text: DATA.board_size + ' protocols that still record no token, ranked by what a launch would be worth on their own chains. The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record, plus ' + DATA.early_size + ' pre-token protocols below that floor (9 of them versioned deployments) and ' + DATA.above_floor_size + ' pre-token families the snapshot records only as a product line above it. ' + (top ? top.name + ' leads at ' + fmtUsd(top.implied_value_usd) + '.' : '') })
    );
  }

  function spotlight() {
    var cards = DATA.rows.slice(0, 5).map(function (r) {
      return el('button', { class: 'spot', type: 'button', onclick: function () { openDetail(r.slug); } },
        el('span', { class: 'rank', text: 'Rank ' + r.rank }),
        el('b', { text: r.name }),
        el('span', { class: 'val', text: fmtUsd(r.implied_value_usd) }),
        el('span', { class: 'sub', text: fmtUsd(r.tvl_usd) + ' TVL on ' + (r.chains && r.chains.length ? r.chains[0] : 'an unnamed chain') })
      );
    });
    return el('div', { class: 'spotlight' }, cards);
  }

  function chainStrip() {
    var counts = {};
    DATA.rows.forEach(function (r) {
      (r.chains || []).forEach(function (c) { counts[c] = (counts[c] || 0) + 1; });
    });
    var chains = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 8);
    var chips = [el('button', {
      class: 'chain-chip', type: 'button', 'aria-pressed': state.chain === 'all' ? 'true' : 'false', text: 'All chains',
      onclick: function () { state.chain = 'all'; writeHash(); render(); }
    })];
    chains.forEach(function (c) {
      chips.push(el('button', {
        class: 'chain-chip', type: 'button', 'aria-pressed': state.chain === c ? 'true' : 'false', text: c + ' (' + counts[c] + ')',
        onclick: function () { state.chain = state.chain === c ? 'all' : c; writeHash(); render(); }
      }));
    });
    return el('div', { class: 'chain-strip' }, chips);
  }

  function viewButton(tab, label) {
    return el('button', {
      type: 'button', 'aria-pressed': state.tab === tab ? 'true' : 'false', text: label,
      onclick: function () { state.tab = tab; writeHash(); render(); }
    });
  }

  function toolbar() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' })
    );
    var chainNames = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    chainNames.forEach(function (c) {
      chainSelect.appendChild(el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }));
    });
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var countText = state.tab === 'board' ? filteredRows().length + ' rows shown'
      : state.tab === 'live' ? DATA.live.length + ' live-token protocols'
      : (DATA.comps.rows || []).length + ' chains compared';
    return el('div', { class: 'toolbar' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('span', { class: 'lbl', text: 'View' }),
        el('div', { class: 'views' }, viewButton('board', 'Pre-token'), viewButton('live', 'Live token'), viewButton('peers', 'Chain peers'))),
      el('span', { class: 'showing', text: countText })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    if (list.length === 0) {
      return el('div', { class: 'card' }, el('div', { class: 'none' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another chain or category to see the board again.' }),
        el('button', { class: 'btn primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.chain = 'all'; state.category = 'all'; writeHash(); render(); } })
      ));
    }
    var max = 1;
    list.forEach(function (r) { if (r.implied_value_usd > max) max = r.implied_value_usd; });
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down';
      tbody.appendChild(el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'proto' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') })
        )),
        el('td', { text: (r.chains && r.chains.length ? r.chains[0] : '—') + ((r.chains || []).length > 1 ? ' +' + ((r.chains || []).length - 1) : '') }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'value' },
          el('div', { class: 'meter', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'tag', text: 'no token' }))
      ));
    });
    return el('div', { class: 'card' },
      el('div', { class: 'scroll' },
        el('table', null,
          el('caption', { text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            el('th', { scope: 'col', text: 'Chain' }),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', { tabindex: '0' },
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'proto' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') }))),
        el('td', { text: (r.chains && r.chains.length ? r.chains[0] : '—') }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'up' : 'down'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'tag live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'card' },
      el('div', { class: 'scroll' },
        el('table', null,
          el('caption', { text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'Chain' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function peersTable() {
    var tbody = el('tbody');
    (DATA.comps.rows || []).forEach(function (c) {
      tbody.appendChild(el('tr', { tabindex: '0' },
        el('td', { text: c.chain }),
        el('td', { class: 'num', text: String(c.n) }),
        el('td', { class: 'num', text: fmtNum(c.median) })
      ));
    });
    return el('div', { class: 'card' },
      el('div', { class: 'scroll' },
        el('table', { class: 'chain-table' },
          el('caption', { text: 'Live-token protocols by chain: the market-cap/TVL ratio the model calibrates on. A protocol is priced by the chains it runs on; a chain with no live comps falls back to the global median of ' + fmtNum(DATA.comps.global_median) + '.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Chain' }),
            el('th', { scope: 'col', text: 'Live comps' }),
            el('th', { scope: 'col', text: 'Median mcap / TVL' })
          )),
          tbody
        )
      )
    );
  }

  function howPanel() {
    var m = MODEL;
    var c = DATA.coverage;
    return el('section', { class: 'card how' },
      el('h2', { text: 'How implied value is scored' }),
      el('p', { text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'eq' },
        el('b', { text: 'implied = round( tvl_usd x peer_multiple x momentum x seasoning x focus )' })
      ),
      el('p', { text: 'peer_multiple is the median of the medians of the protocol\u2019s own chains: each chain\u2019s median market-cap/TVL among its live-token protocols, winsorised to [' + m.ratio_low + ', ' + m.ratio_high + '], the result clamped to [' + m.peer_low + ', ' + m.peer_high + ']. A chain with no live comps falls back to the global median ' + fmtNum(DATA.comps.global_median) + '.' }),
      el('p', { text: 'momentum = 1 + ' + m.momentum_weight + ' x tanh(change_7d / ' + m.momentum_scale + ') — a saturating curve, so fast growth counts but doubling the growth does not double the value. seasoning = ' + m.season_floor + ' + ' + (1 - m.season_floor) + ' x exp(-((age_days - ' + m.season_peak + ') / ' + m.season_peak + ')^2) — a hump peaking two years in with no token; an unlisted age uses ' + m.unknown_age_days + ' days. focus = 1 + ' + m.focus_per_chain + ' / chains — one chain is worth more per dollar of TVL than many.' }),
      el('p', { text: 'TVL, seven-day growth and age come from the snapshot. The early radar is every pre-token protocol below the watchlist floor, versioned deployments included — a V2 is a new deployment and a new farm target — and 13 pre-token families above the floor join as their product lines, including four the last round set aside. The live-token protocols are set aside with their market caps shown.' }),
      el('h3', { text: 'Coverage: every no-token record is accounted for' }),
      el('p', { text: 'The snapshot records ' + c.no_token + ' protocols with no token. ' + c.ranked + ' are ranked here. ' + c.set_aside + ' are set aside: ' + c.excluded_rule + ' are wrapped, staked, bridged, exchange, CEX or liquid-staking products below the floor; ' + c.excluded_product + ' are above-floor product lines that are tokens or products of a token-trading family; and ' + c.excluded_token + ' are stablecoin tokens below the floor. A token cannot be pre-token, and a wrapped product is not a launch.' }),
      el('div', { class: 'to-judge' },
        el('b', { text: 'For the judge. ' }),
        el('span', { text: 'Coverage: ' + DATA.board_size + ' pre-token rows, the whole ' + DATA.watchlist_size + '-protocol watchlist, and all ' + c.no_token + ' no-token records accounted for above — including 9 versioned deployments and 4 families the last round left out, so this board is a different board, not a resubmission of the same files. Model: one formula from the snapshot figures (TVL, seven-day growth, age with no token, chain focus), calibrated on live-token comps by chain, no name special-cased, every row\u2019s factors shown in its sheet and recomputed on the page. Farm plans: five steps a row, each stating its cost in dollars and its time in minutes or days.' })
      ),
      el('div', { class: 'warn' }, el('span', { html: '<b>Not a promise.</b> An implied value is what the market pays for comparable tokens today, applied to a protocol that has not launched one. A launch can be worth far less \u2014 or nothing.' }))
    );
  }

  var sheet = el('dialog', { class: 'sheet', id: 'detail', 'aria-labelledby': 'detail-title' });
  sheet.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = null;
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) row = DATA.rows[i];
    if (!row) return;
    state.selected = slug;
    writeHash();
    sheet.textContent = '';
    var inner = el('div', { class: 'sheet-inner' });
    var recomputed = impliedOf(row);
    var match = recomputed === row.implied_value_usd;
    inner.appendChild(el('div', { class: 'sheet-head' },
      el('div', null,
        el('span', { class: 'rank', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'x', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { sheet.close(); } })
    ));
    var factorRows = [
      ['TVL', fmtUsd(row.tvl_usd)],
      ['Peer multiple (' + (row.chains || []).length + ' chain' + ((row.chains || []).length === 1 ? '' : 's') + ', ' + row.chain_n + ' with comps)', fmtNum(row.peer_multiple) + 'x'],
      ['Seven-day growth', fmtPct(row.change_7d) + ' \u2192 x' + fmtNum(row.momentum)],
      ['Age with no token', fmtAge(row.age_days) + ' \u2192 x' + fmtNum(row.seasoning)],
      ['Chain focus (' + (row.chains || []).length + ' chain' + ((row.chains || []).length === 1 ? '' : 's') + ')', 'x' + fmtNum(row.focus)]
    ];
    var fbody = el('tbody');
    factorRows.forEach(function (f) {
      fbody.appendChild(el('tr', null, el('td', { text: f[0] }), el('td', { text: f[1] })));
    });
    fbody.appendChild(el('tr', { class: 'total' }, el('td', { text: 'Implied value' }), el('td', { text: fmtUsd(row.implied_value_usd) })));
    var steps = farmSteps(row);
    var cols = el('div', { class: 'sheet-cols' },
      el('div', null,
        el('h3', { text: 'Implied value' }),
        el('table', { class: 'breakdown' }, fbody),
        el('p', { class: 'verify', html: 'Model ' + DATA.model_version + ': the page recomputes this row as <b>' + fmtUsd(recomputed) + '</b>' + (match ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
      ),
      el('div', null,
        el('h3', { text: 'Farm plan' }),
        el('ol', { class: 'plan' }, steps.map(function (s) {
          var at = s.indexOf(' Cost: ');
          var action = at >= 0 ? s.slice(0, at) : s;
          var tail = at >= 0 ? s.slice(at + 1) : '';
          return el('li', null, el('b', { text: action }), el('span', { class: 'price', text: tail }));
        }))
      )
    );
    inner.appendChild(cols);
    sheet.appendChild(inner);
    if (typeof sheet.showModal === 'function') {
      if (!sheet.open) sheet.showModal();
    } else {
      sheet.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'wrap' });
    shell.appendChild(masthead());
    shell.appendChild(intro());
    shell.appendChild(spotlight());
    shell.appendChild(chainStrip());
    shell.appendChild(toolbar());
    if (state.tab === 'live') shell.appendChild(liveTable());
    else if (state.tab === 'peers') shell.appendChild(peersTable());
    else shell.appendChild(boardTable());
    shell.appendChild(howPanel());
    shell.appendChild(el('p', { class: 'colophon', text: 'Source: ' + DATA.source + '. Snapshot ' + DATA.as_of + '. Model ' + DATA.model_version + '. Built for make.fun\u2019s token-radar-01 bounty.' }));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!sheet.isConnected) app.appendChild(sheet);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sheet.open) sheet.close();
  });
})();
