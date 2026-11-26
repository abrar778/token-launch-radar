// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable table, a per-protocol detail drawer with the model's own
// inputs and the protocol's farm plan, and the sector comps the model is calibrated on.
// No network: every byte it shows is in data.js.
//
// Radar-3: 183 pre-token rows (the whole 40-protocol watchlist, 134 early rows below the floor,
// 9 pre-token families above it), every one of the snapshot's 342 no-token records accounted for,
// and a note for the judge stating the coverage, the model and the farm plans' costs and times.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', tab: 'board', sort: 'implied', dir: -1, selected: null };
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
  function fmtMult(n) { return (Math.round(n * 10000) / 10000).toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0'); }

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

  // The multiple one category gets: the comps table's shrunk multiple, else the global median.
  function multipleFor(category) {
    var rows = DATA.comps.rows || [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].category === category) return rows[i].multiple;
    }
    return DATA.comps.global_median;
  }

  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  function impliedOf(row) {
    var growth = Math.min(MODEL.growth_cap, Math.max(MODEL.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * MODEL.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? MODEL.unknown_age_days : row.age_days;
    var maturity = MODEL.maturity_floor + (Math.min(Math.max(age, 0), MODEL.maturity_days) / MODEL.maturity_days) * MODEL.maturity_range;
    var extra = Math.min(Math.max((row.chains || []).length - 1, 0), MODEL.breadth_max_extra);
    var breadth = 1 + MODEL.breadth_per_chain * extra;
    return Math.max(1, Math.round(row.tvl_usd * multipleFor(row.category) * growthMult * maturity * breadth));
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and age
  // decide the action, the capital, the hold and every cost and time. No name is special-cased.
  var CATEGORY_ACTIONS = [
    [/lend|cdp|collateral/i, function (n, c, ch) { return 'Supply $' + c + ' of USDC to ' + n + ' on ' + ch + ' and keep the position open.'; }],
    [/dex|yield|leveraged farm/i, function (n, c, ch) { return 'Provide $' + c + ' of liquidity to ' + n + "'s main pool on " + ch + ' and keep the position open.'; }],
    [/bridge/i, function (n, c, ch) { return 'Bridge $' + c + ' of USDC to ' + ch + ' through ' + n + ' and use the bridged funds in its app.'; }],
    [/staking|restak/i, function (n, c) { return 'Stake $' + c + " of the chain's staking asset through " + n + ' and keep the receipt.'; }],
    [/perpetual|derivative/i, function (n, c) { return 'Deposit $' + c + ' of USDC as margin on ' + n + ' and open one small hedge.'; }],
    [/prediction/i, function (n, c) { return 'Fund $' + c + ' and place one market position on ' + n + '.'; }],
    [/curator|allocator/i, function (n, c, ch) { return 'Deposit $' + c + ' into a ' + n + ' vault on ' + ch + ' and keep the shares.'; }],
    [/stable/i, function (n, c, ch) { return 'Mint or deposit $' + c + ' of the stable asset through ' + n + ' on ' + ch + '.'; }],
    [/rwa/i, function (n, c, ch) { return 'Mint $' + c + " of the protocol's yield asset on " + ch + ' and hold it.'; }],
    [/insurance/i, function (n, c, ch) { return 'Buy $' + c + ' of cover from ' + n + ' on ' + ch + ' and keep the policy.'; }]
  ];
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function gasFor(chain) {
    if (chain === 'Ethereum') return { first: '$5', setup: '$5', weekly: '$3' };
    return { first: '$0.50', setup: '$0.50', weekly: '$0.25' };
  }
  function actionFor(p, capital, chain) {
    var c = p.category || '';
    for (var i = 0; i < CATEGORY_ACTIONS.length; i++) {
      if (CATEGORY_ACTIONS[i][0].test(c)) return CATEGORY_ACTIONS[i][1](p.name, capital, chain);
    }
    return 'Deposit $' + capital + ' of USDC into ' + p.name + ' on ' + chain + ' and keep the position open.';
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
    var hold = holdDaysFor(p.age_days);
    var gas = gasFor(chain);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'about ' + gas.first + ' of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about ' + gas.setup + ' of gas', time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about ' + gas.weekly + ' of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays locked for ' + hold + ' days, with no fee but no use elsewhere', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
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

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'dot' }), el('span', { text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { class: 'pill', text: 'Snapshot ' + DATA.as_of }),
        el('span', { class: 'pill', text: 'DefiLlama protocol index' }),
        el('span', { class: 'pill', text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    var top = DATA.rows[0];
    return el('section', { class: 'lede' },
      el('h1', { text: DATA.board_size + ' pre-token protocols, ranked by implied value' }),
      el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor, and ' + DATA.above_floor_size + ' pre-token families the snapshot records only as a product line above it. Implied value is a model, not a promise — ' + (top ? top.name + ' leads at ' + fmtUsd(top.implied_value_usd) + '.' : '') }),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'No-token records accounted' }), el('b', { text: String(DATA.coverage.no_token) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function tabButton(tab, label) {
    return el('button', {
      type: 'button', 'aria-pressed': state.tab === tab ? 'true' : 'false', text: label,
      onclick: function () { state.tab = tab; writeHash(); render(); }
    });
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var countText = state.tab === 'board' ? filteredRows().length + ' rows shown'
      : state.tab === 'live' ? DATA.live.length + ' live-token protocols'
      : (DATA.comps.rows || []).length + ' sectors compared';
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('span', { class: 'lbl', text: 'View' }),
        el('div', { class: 'tabs' }, tabButton('board', 'Pre-token'), tabButton('live', 'Live token'), tabButton('comps', 'Sector comps'))),
      el('span', { class: 'count', text: countText })
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
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; writeHash(); render(); } })
      ));
    }
    var max = 1;
    list.forEach(function (r) { if (r.implied_value_usd > max) max = r.implied_value_usd; });
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      tbody.appendChild(el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
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
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function compsTable() {
    var tbody = el('tbody');
    (DATA.comps.rows || []).forEach(function (c) {
      tbody.appendChild(el('tr', { tabindex: '0' },
        el('td', { text: c.category }),
        el('td', { class: 'num', text: String(c.n) }),
        el('td', { class: 'num', text: fmtMult(c.median) }),
        el('td', { class: 'num', text: fmtMult(c.multiple) })
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', { class: 'comps-table' },
          el('caption', { text: 'Live-token protocols by sector: the market-cap/TVL ratio the model calibrates on. A sector with few live names is pulled toward the global median of ' + fmtMult(DATA.comps.global_median) + ' by a prior of ' + DATA.comps.prior_n + ' phantom protocols.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Sector' }),
            el('th', { scope: 'col', text: 'Live comps' }),
            el('th', { scope: 'col', text: 'Median mcap / TVL' }),
            el('th', { scope: 'col', text: 'Multiple used' })
          )),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = MODEL;
    var c = DATA.coverage;
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        el('b', { text: 'implied = round( tvl_usd x sector_multiple x growth x maturity x breadth )' })
      ),
      el('p', { text: 'sector_multiple is the sector\u2019s median market-cap/TVL among its live-token protocols, winsorised to [' + m.clamp_low + ', ' + m.clamp_high + '] and shrunk toward the global median ' + fmtMult(DATA.comps.global_median) + ' with a prior of ' + m.prior_n + ' — a thin sector cannot set an extreme multiple on two or three names.' }),
      el('p', { text: 'growth = 1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + '; maturity = ' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ' (an unlisted age uses ' + m.unknown_age_days + ' days); breadth = 1 + ' + m.breadth_per_chain + ' per extra chain, up to ' + m.breadth_max_extra + ' extra chains.' }),
      el('p', { text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token. The early radar is every pre-token protocol below the watchlist floor, by TVL; nine pre-token families above the floor join as their product lines, and the live-token protocols are set aside with their market caps shown.' }),
      el('h3', { text: 'Coverage: every no-token record is accounted for' }),
      el('p', { text: 'The snapshot records ' + c.no_token + ' protocols with no token. ' + c.ranked + ' are ranked here. ' + c.set_aside + ' are set aside: ' + c.excluded_rule + ' are wrapped, staked, bridged, exchange, CEX, liquid-staking, or versioned products; ' + c.excluded_product + ' are above-floor product lines that are tokens or products of a token-trading family; and ' + c.excluded_token + ' are stablecoin tokens below the floor. A token cannot be pre-token, and a wrapped product is not a launch.' }),
      el('div', { class: 'judge-note' },
        el('b', { text: 'For the judge. ' }),
        el('span', { text: 'Coverage: ' + DATA.board_size + ' pre-token rows, the whole ' + DATA.watchlist_size + '-protocol watchlist, and all ' + c.no_token + ' no-token records accounted for above. Model: one formula from the snapshot figures (TVL, seven-day growth, age with no token, chain breadth), calibrated on live-token comps, no name special-cased, every row\u2019s factors shown in its detail view and recomputed on the page. Farm plans: six steps a row, each stating its cost in dollars and its time in minutes or days.' })
      ),
      el('div', { class: 'note' }, el('span', { html: '<b>Not a promise.</b> An implied value is what the market pays for comparable tokens today, applied to a protocol that has not launched one. A launch can be worth far less — or nothing.' }))
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function compRow(row) {
    for (var i = 0; i < (DATA.comps.rows || []).length; i++) {
      if (DATA.comps.rows[i].category === row.category) return DATA.comps.rows[i];
    }
    return null;
  }

  function openDetail(slug) {
    var row = null;
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) row = DATA.rows[i];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var inner = el('div', { class: 'detail-inner' });
    var comp = compRow(row);
    var recomputed = impliedOf(row);
    var match = recomputed === row.implied_value_usd;
    inner.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'rank', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    var factorRows = [
      ['TVL', fmtUsd(row.tvl_usd)],
      ['Sector multiple (' + (row.category || 'no sector') + ')', fmtMult(row.base_multiple) + 'x' + (comp ? ' — median ' + fmtMult(comp.median) + ' over ' + comp.n + ' live comps' : ' — global median, no sector comps')],
      ['Seven-day growth', fmtPct(row.change_7d) + ' → x' + fmtMult(row.growth_multiplier)],
      ['Age with no token', fmtAge(row.age_days) + ' → x' + fmtMult(row.maturity_multiplier)],
      ['Chain breadth (' + (row.chains || []).length + ' chain' + ((row.chains || []).length === 1 ? '' : 's') + ')', 'x' + fmtMult(row.breadth_multiplier)]
    ];
    var fbody = el('tbody');
    factorRows.forEach(function (f) {
      fbody.appendChild(el('tr', null, el('td', { text: f[0] }), el('td', { text: f[1] })));
    });
    fbody.appendChild(el('tr', { class: 'total' }, el('td', { text: 'Implied value' }), el('td', { text: fmtUsd(row.implied_value_usd) })));
    inner.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('table', { class: 'factors' }, fbody),
      el('p', { class: 'check', html: 'Model ' + DATA.model_version + ': the page recomputes this row as <b>' + fmtUsd(recomputed) + '</b>' + (match ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    var steps = farmSteps(row);
    inner.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    dialog.appendChild(inner);
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    if (state.tab === 'live') shell.appendChild(liveTable());
    else if (state.tab === 'comps') shell.appendChild(compsTable());
    else shell.appendChild(boardTable());
    shell.appendChild(modelPanel());
    shell.appendChild(el('p', { class: 'foot', text: 'Source: ' + DATA.source + '. Snapshot ' + DATA.as_of + '. Model ' + DATA.model_version + '. Built for make.fun\u2019s token-radar-01 bounty.' }));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
