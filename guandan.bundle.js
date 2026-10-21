(() => {
  // engine/ranks.js
  var RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  var JOKER_BLACK = "BJ";
  var JOKER_RED = "RJ";
  var SUITS = ["S", "H", "D", "C"];
  var SEQ_RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  function isJokerRank(rank) {
    return rank === JOKER_BLACK || rank === JOKER_RED;
  }
  function isWildCard(card2, levelRank) {
    return !isJokerRank(card2.rank) && card2.rank === levelRank && card2.suit === "H";
  }
  function singleStrength(rank, levelRank) {
    if (rank === JOKER_RED) return 100;
    if (rank === JOKER_BLACK) return 99;
    if (rank === levelRank) return 80;
    const i = RANKS.indexOf(rank);
    if (i < 0) throw new Error(`未知点数: ${rank}`);
    return i;
  }
  function parseLevel(levelRank) {
    if (!RANKS.includes(levelRank)) throw new Error(`非法级牌: ${levelRank}`);
    return levelRank;
  }

  // engine/cards.js
  var _id = 1;
  function card(rank, suit, id) {
    return { rank, suit, id: id != null ? id : _id++ };
  }
  function formatCard(c) {
    if (c.rank === JOKER_RED) return "RJ";
    if (c.rank === JOKER_BLACK) return "BJ";
    return `${c.rank}${c.suit}`;
  }
  function makeDeck() {
    const deck = [];
    for (let copy = 0; copy < 2; copy++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) deck.push(card(rank, suit));
      }
      deck.push(card(JOKER_BLACK, "J"));
      deck.push(card(JOKER_RED, "J"));
    }
    return deck;
  }
  function shuffle(arr, rng = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function dealFourHands(deck = shuffle(makeDeck())) {
    if (deck.length !== 108) throw new Error("掼蛋必须 108 张");
    return [0, 1, 2, 3].map((i) => deck.slice(i * 27, i * 27 + 27));
  }
  function countByRank(list) {
    const m = /* @__PURE__ */ new Map();
    for (const c of list) m.set(c.rank, (m.get(c.rank) || 0) + 1);
    return m;
  }

  // engine/combos.js
  var TYPES = {
    PASS: "pass",
    SINGLE: "single",
    PAIR: "pair",
    TRIPLE: "triple",
    FULLHOUSE: "fullhouse",
    STRAIGHT: "straight",
    PAIR_SEQ: "pairSeq",
    TRIPLE_SEQ: "tripleSeq",
    BOMB: "bomb",
    STRAIGHT_FLUSH: "straightFlush"
  };
  function passCombo() {
    return { type: TYPES.PASS, rank: null, length: 0, size: 0 };
  }
  function split(cards, levelRank) {
    const wilds = [];
    const jokers = [];
    const naturals = [];
    for (const c of cards) {
      if (isJokerRank(c.rank)) jokers.push(c);
      else if (isWildCard(c, levelRank) && wilds.length < 2) wilds.push(c);
      else naturals.push(c);
    }
    return { wilds, jokers, naturals, wildCount: wilds.length };
  }
  function groupNaturals(naturals) {
    const m = /* @__PURE__ */ new Map();
    for (const c of naturals) {
      if (!m.has(c.rank)) m.set(c.rank, []);
      m.get(c.rank).push(c);
    }
    return m;
  }
  function combo(type, rank, extras = {}) {
    return { type, rank, ...extras };
  }
  function asSingle(cards, levelRank) {
    if (cards.length !== 1) return null;
    return combo(TYPES.SINGLE, cards[0].rank, { length: 1, size: 1 });
  }
  function asPair(cards, levelRank) {
    if (cards.length !== 2) return null;
    const { wilds, jokers, naturals } = split(cards, levelRank);
    if (jokers.length === 2 && wilds.length === 0 && naturals.length === 0) {
      if (jokers[0].rank === jokers[1].rank) {
        return combo(TYPES.PAIR, jokers[0].rank, { length: 2, size: 2 });
      }
      return null;
    }
    if (jokers.length) return null;
    if (naturals.length === 2 && naturals[0].rank === naturals[1].rank) {
      return combo(TYPES.PAIR, naturals[0].rank, { length: 2, size: 2 });
    }
    if (naturals.length === 1 && wilds.length === 1) {
      return combo(TYPES.PAIR, naturals[0].rank, { length: 2, size: 2, wilds: 1 });
    }
    if (naturals.length === 0 && wilds.length === 2) {
      return combo(TYPES.PAIR, levelRank, { length: 2, size: 2, wilds: 2 });
    }
    return null;
  }
  function asTriple(cards, levelRank) {
    if (cards.length !== 3) return null;
    const { wilds, jokers, naturals } = split(cards, levelRank);
    if (jokers.length) return null;
    const g = groupNaturals(naturals);
    if (g.size > 1) return null;
    if (g.size === 1) {
      const rank = [...g.keys()][0];
      if (g.get(rank).length + wilds.length === 3) {
        return combo(TYPES.TRIPLE, rank, { length: 3, size: 3, wilds: wilds.length });
      }
      return null;
    }
    return null;
  }
  function asBomb(cards, levelRank) {
    const n = cards.length;
    if (n < 4) return null;
    const { wilds, jokers, naturals } = split(cards, levelRank);
    if (jokers.length === 4 && n === 4 && wilds.length === 0 && naturals.length === 0) {
      return combo(TYPES.BOMB, JOKER_RED, { length: 4, size: 4, bombSize: 4, rocket: true });
    }
    if (jokers.length) return null;
    const g = groupNaturals(naturals);
    if (g.size > 1) return null;
    if (g.size === 1) {
      const rank = [...g.keys()][0];
      const cnt = g.get(rank).length + wilds.length;
      if (cnt === n && n >= 4) {
        return combo(TYPES.BOMB, rank, { length: n, size: n, bombSize: n, wilds: wilds.length });
      }
      return null;
    }
    return null;
  }
  function asFullHouse(cards, levelRank) {
    if (cards.length !== 5) return null;
    const { wilds, jokers, naturals } = split(cards, levelRank);
    if (jokers.length) return null;
    const g = groupNaturals(naturals);
    const ranks = [...g.keys()];
    if (ranks.length > 2) return null;
    const tryAssign = (tripleRank, pairRank) => {
      var _a, _b;
      if (tripleRank === pairRank) return null;
      const haveT = ((_a = g.get(tripleRank)) == null ? void 0 : _a.length) || 0;
      const haveP = ((_b = g.get(pairRank)) == null ? void 0 : _b.length) || 0;
      let w = wilds.length;
      const needT = Math.max(0, 3 - haveT);
      const needP = Math.max(0, 2 - haveP);
      if (needT + needP === w && haveT <= 3 && haveP <= 2) {
        return combo(TYPES.FULLHOUSE, tripleRank, { length: 5, size: 5, pairRank, wilds: w });
      }
      return null;
    };
    if (ranks.length === 2) {
      const [a, b] = ranks;
      return tryAssign(a, b) || tryAssign(b, a);
    }
    if (ranks.length === 1) {
      const r = ranks[0];
      const have = g.get(r).length;
      if (have === 3 && wilds.length === 2) {
        return combo(TYPES.FULLHOUSE, r, { length: 5, size: 5, pairRank: levelRank, wilds: 2 });
      }
      if (have === 4 && wilds.length === 1) {
        return null;
      }
      return null;
    }
    return null;
  }
  function sequenceWindows(len) {
    const out = [];
    for (let start = 0; start + len <= SEQ_RANKS.length; start++) {
      out.push(SEQ_RANKS.slice(start, start + len));
    }
    return out;
  }
  function asStraight(cards, levelRank) {
    const n = cards.length;
    if (n !== 5) return null;
    const { wilds, jokers, naturals } = split(cards, levelRank);
    if (jokers.length) return null;
    if (naturals.length === 0) return null;
    if (naturals.some((c, i, a) => a.findIndex((x) => x.rank === c.rank) !== i)) return null;
    const used = new Set(naturals.map((c) => c.rank));
    if (used.size + wilds.length !== n) return null;
    for (const win of sequenceWindows(n)) {
      const missing = win.filter((r) => !used.has(r));
      const extra = [...used].filter((r) => !win.includes(r));
      if (extra.length) continue;
      if (missing.length === wilds.length) {
        return combo(TYPES.STRAIGHT, win[n - 1], { length: n, size: n, low: win[0], wilds: wilds.length });
      }
    }
    return null;
  }
  function asStraightFlush(cards, levelRank) {
    var _a, _b;
    if (cards.length !== 5) return null;
    const { wilds, jokers, naturals } = split(cards, levelRank);
    if (jokers.length) return null;
    const suits = new Set(naturals.map((c) => c.suit));
    if (suits.size > 1) return null;
    const suit = ((_a = naturals[0]) == null ? void 0 : _a.suit) || ((_b = wilds[0]) == null ? void 0 : _b.suit);
    if (naturals.some((c, i, a) => a.findIndex((x) => x.rank === c.rank) !== i)) return null;
    const st = asStraight(cards, levelRank);
    if (!st) return null;
    return combo(TYPES.STRAIGHT_FLUSH, st.rank, {
      length: 5,
      size: 5,
      low: st.low,
      suit,
      wilds: wilds.length
    });
  }
  function asPairSeq(cards, levelRank) {
    var _a;
    const n = cards.length;
    if (n !== 6) return null;
    const pairs = 3;
    const { wilds, jokers, naturals } = split(cards, levelRank);
    if (jokers.length) return null;
    const g = groupNaturals(naturals);
    for (const [, arr] of g) if (arr.length > 2) return null;
    for (const win of sequenceWindows(pairs)) {
      let need = 0;
      let ok = true;
      for (const r of win) {
        const have = ((_a = g.get(r)) == null ? void 0 : _a.length) || 0;
        if (have > 2) {
          ok = false;
          break;
        }
        need += 2 - have;
      }
      for (const r of g.keys()) {
        if (!win.includes(r)) {
          ok = false;
          break;
        }
      }
      if (ok && need === wilds.length) {
        return combo(TYPES.PAIR_SEQ, win[pairs - 1], {
          length: pairs,
          size: n,
          low: win[0],
          wilds: wilds.length
        });
      }
    }
    return null;
  }
  function asTripleSeq(cards, levelRank) {
    var _a;
    const n = cards.length;
    if (n !== 6) return null;
    const trips = 2;
    const { wilds, jokers, naturals } = split(cards, levelRank);
    if (jokers.length) return null;
    const g = groupNaturals(naturals);
    for (const [, arr] of g) if (arr.length > 3) return null;
    for (const win of sequenceWindows(trips)) {
      let need = 0;
      let ok = true;
      for (const r of win) {
        const have = ((_a = g.get(r)) == null ? void 0 : _a.length) || 0;
        if (have > 3) {
          ok = false;
          break;
        }
        need += 3 - have;
      }
      for (const r of g.keys()) {
        if (!win.includes(r)) {
          ok = false;
          break;
        }
      }
      if (ok && need === wilds.length) {
        return combo(TYPES.TRIPLE_SEQ, win[trips - 1], {
          length: trips,
          size: n,
          low: win[0],
          wilds: wilds.length
        });
      }
    }
    return null;
  }
  var TRY_ORDER = [
    asStraightFlush,
    asBomb,
    asTripleSeq,
    asPairSeq,
    asStraight,
    asFullHouse,
    asTriple,
    asPair,
    asSingle
  ];
  function classify(cards, levelRank) {
    if (!cards || cards.length === 0) return passCombo();
    for (const fn of TRY_ORDER) {
      const c = fn(cards, levelRank);
      if (c) return c;
    }
    return null;
  }
  function interpretAs(cards, type, levelRank) {
    if (type === TYPES.PASS) return cards.length === 0 ? passCombo() : null;
    const map = {
      [TYPES.SINGLE]: asSingle,
      [TYPES.PAIR]: asPair,
      [TYPES.TRIPLE]: asTriple,
      [TYPES.FULLHOUSE]: asFullHouse,
      [TYPES.STRAIGHT]: asStraight,
      [TYPES.PAIR_SEQ]: asPairSeq,
      [TYPES.TRIPLE_SEQ]: asTripleSeq,
      [TYPES.BOMB]: asBomb,
      [TYPES.STRAIGHT_FLUSH]: asStraightFlush
    };
    const fn = map[type];
    if (!fn) return null;
    return fn(cards, levelRank);
  }
  function isBombLike(combo2) {
    return combo2 && (combo2.type === TYPES.BOMB || combo2.type === TYPES.STRAIGHT_FLUSH);
  }

  // engine/compare.js
  function bombWeight(combo2) {
    var _a;
    if (!combo2) return 0;
    if (combo2.type === TYPES.BOMB && (combo2.rocket || combo2.rank === "RJ")) return 100;
    if (combo2.type === TYPES.STRAIGHT_FLUSH) return 5.5;
    if (combo2.type === TYPES.BOMB) return (_a = combo2.bombSize) != null ? _a : combo2.size;
    return 0;
  }
  function compareRank(aRank, bRank, levelRank) {
    return singleStrength(aRank, levelRank) - singleStrength(bRank, levelRank);
  }
  function compareCombos(a, b, levelRank) {
    var _a, _b;
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    if (a.type === TYPES.PASS && b.type === TYPES.PASS) return 0;
    if (a.type === TYPES.PASS) return -1;
    if (b.type === TYPES.PASS) return 1;
    const aB = isBombLike(a);
    const bB = isBombLike(b);
    if (aB && bB) {
      const dw = bombWeight(a) - bombWeight(b);
      if (dw !== 0) return dw;
      return compareRank(a.rank, b.rank, levelRank);
    }
    if (aB && !bB) return 1;
    if (!aB && bB) return -1;
    if (a.type !== b.type) return NaN;
    if (((_a = a.length) != null ? _a : a.size) !== ((_b = b.length) != null ? _b : b.size)) return NaN;
    if (a.size !== b.size && a.type !== TYPES.BOMB) return NaN;
    return compareRank(a.rank, b.rank, levelRank);
  }
  function beats(a, b, levelRank) {
    if (!a || a.type === TYPES.PASS) return false;
    if (!b || b.type === TYPES.PASS) return true;
    const c = compareCombos(a, b, levelRank);
    if (Number.isNaN(c)) return false;
    return c > 0;
  }

  // engine/rulesets.js
  var RULESETS = {
    SUQIAN: "suqian",
    OFFICIAL_2022: "official2022"
  };
  function rulesetConfig(id = RULESETS.SUQIAN) {
    if (id === RULESETS.OFFICIAL_2022) {
      return {
        id,
        name: "官方竞技 2022",
        passARequiresDoubleDown: false,
        failPassAResetTo2: false,
        afterPassA: "endMatch",
        endMatchOnAnyWinAtA: true,
        bombsBeatStraightFlushFrom: 6
      };
    }
    return {
      id: RULESETS.SUQIAN,
      name: "宿迁地方规则",
      passARequiresDoubleDown: true,
      failPassAResetTo2: true,
      afterPassA: "resetIfNotDoubleDown",
      endMatchOnAnyWinAtA: false,
      bombsBeatStraightFlushFrom: 6
    };
  }

  // engine/state.js
  function createMatch({
    ruleset = RULESETS.SUQIAN,
    levelRank = "2",
    defenderTeam = 0
  } = {}) {
    parseLevel(levelRank);
    return {
      ruleset,
      config: rulesetConfig(ruleset),
      levelRank,
      defenderTeam,
      teamLevel: [levelRank, levelRank],
      matchOver: false,
      winnerTeam: null,
      history: []
    };
  }
  function createRound(match, { dealerSeat = 0, hands = null, rng } = {}) {
    const dealt = hands || dealFourHands(shuffle(makeDeck(), rng));
    return {
      match,
      hands: dealt,
      currentSeat: dealerSeat,
      leadSeat: dealerSeat,
      lastCombo: null,
      lastPlayer: null,
      passCount: 0,
      finished: [],
      tricks: [],
      tributeEatenByHead: false
    };
  }

  // engine/legal.js
  function legalMoves(hand, previous, levelRank, leading = false) {
    const moves = [];
    if (!leading && previous) moves.push({ cards: [], combo: passCombo() });
    const groups = /* @__PURE__ */ new Map();
    const wilds = [];
    for (const c of hand) {
      if (!isJokerRank(c.rank) && isWildCard(c, levelRank)) wilds.push(c);
      else {
        if (!groups.has(c.rank)) groups.set(c.rank, []);
        groups.get(c.rank).push(c);
      }
    }
    const emit = (cards) => {
      const combo2 = classify(cards, levelRank);
      if (!combo2) return;
      if (leading || !previous || previous.type === TYPES.PASS || beats(combo2, previous, levelRank)) {
        moves.push({ cards, combo: combo2 });
      }
    };
    for (const [, arr] of groups) {
      for (let k = 1; k <= arr.length; k++) emit(arr.slice(0, k));
      for (let w = 1; w <= Math.min(2, wilds.length); w++) {
        for (let k = 1; k <= arr.length; k++) {
          if (k + w >= 2) emit(arr.slice(0, k).concat(wilds.slice(0, w)));
        }
      }
    }
    if (wilds.length) {
      for (let w = 1; w <= Math.min(2, wilds.length); w++) emit(wilds.slice(0, w));
    }
    const ranks = [...groups.keys()];
    for (let i = 0; i < ranks.length; i++) {
      for (let j = 0; j < ranks.length; j++) {
        if (i === j) continue;
        const tRank = ranks[i];
        const pRank = ranks[j];
        const tArr = groups.get(tRank);
        const pArr = groups.get(pRank);
        for (let tw = 0; tw <= Math.min(2, wilds.length); tw++) {
          const tNeed = 3 - tw;
          if (tNeed < 1 || tArr.length < tNeed) continue;
          const leftW = wilds.length - tw;
          for (let pw = 0; pw <= leftW; pw++) {
            if (tw + pw > 2) continue;
            const pNeed = 2 - pw;
            if (pNeed < 1 || pArr.length < pNeed) continue;
            const pile = tArr.slice(0, tNeed).concat(pArr.slice(0, pNeed)).concat(wilds.slice(0, tw + pw));
            if (pile.length === 5) emit(pile);
          }
        }
      }
    }
    const byRank = groups;
    for (let i = 0; i + 5 <= SEQ_RANKS.length; i++) {
      const win = SEQ_RANKS.slice(i, i + 5);
      const cards = [];
      let need = 0;
      let ok = true;
      for (const r of win) {
        const arr = byRank.get(r) || [];
        if (arr.length) cards.push(arr[0]);
        else need += 1;
      }
      if (need <= wilds.length && cards.length + need === 5) {
        emit(cards.concat(wilds.slice(0, need)));
      }
      for (const suit of ["S", "H", "D", "C"]) {
        const pile = [];
        let wneed = 0;
        for (const r of win) {
          const arr = (byRank.get(r) || []).filter((c) => c.suit === suit);
          if (arr.length) pile.push(arr[0]);
          else wneed += 1;
        }
        if (wneed <= wilds.length && pile.length + wneed === 5) {
          emit(pile.concat(wilds.slice(0, wneed)));
        }
      }
    }
    {
      const jk = hand.filter((c) => isJokerRank(c.rank));
      if (jk.length === 4) emit(jk.slice());
    }
    if (!leading && previous && previous.size > 0 && previous.size <= 8 && previous.size !== 6 && hand.length <= 16) {
      const n = hand.length;
      const target = previous.size;
      const rec = (i, chosen) => {
        if (chosen.length === target) {
          emit(chosen.slice());
          return;
        }
        if (i >= n || chosen.length + (n - i) < target) return;
        chosen.push(hand[i]);
        rec(i + 1, chosen);
        chosen.pop();
        rec(i + 1, chosen);
      };
      rec(0, []);
    }
    const seen = /* @__PURE__ */ new Set();
    return moves.filter((m) => {
      const key = m.cards.map((c) => c.id).sort().join(",") + ":" + m.combo.type;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // search/index.js
  function uniqueMoves(moves) {
    const seen = /* @__PURE__ */ new Set();
    return moves.filter((m) => {
      var _a;
      const key = m.cards.map((c) => c.id).sort().join(",") + ":" + (((_a = m.combo) == null ? void 0 : _a.type) || "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function emitIf(hand, cards, previous, levelRank, leading, out) {
    const combo2 = classify(cards, levelRank);
    if (!combo2 || combo2.type === TYPES.PASS) return;
    if (leading || !previous || previous.type === TYPES.PASS || beats(combo2, previous, levelRank)) {
      out.push({ cards, combo: combo2 });
    }
  }
  function extraStructureMoves(hand, previous, levelRank, leading) {
    const out = [];
    const wilds = hand.filter((c) => !isJokerRank(c.rank) && isWildCard(c, levelRank));
    const byRank = /* @__PURE__ */ new Map();
    for (const c of hand) {
      if (isJokerRank(c.rank)) continue;
      if (isWildCard(c, levelRank)) continue;
      if (!byRank.has(c.rank)) byRank.set(c.rank, []);
      byRank.get(c.rank).push(c);
    }
    const pick = (rank, n, used) => {
      const arr = (byRank.get(rank) || []).filter((c) => !used.has(c.id));
      return arr.slice(0, n);
    };
    const tryWindow = (win, copies) => {
      const used = /* @__PURE__ */ new Set();
      const cards = [];
      let need = 0;
      for (const r of win) {
        const got = pick(r, copies, used);
        got.forEach((c) => used.add(c.id));
        cards.push(...got);
        need += copies - got.length;
      }
      if (need > wilds.length) return;
      cards.push(...wilds.slice(0, need));
      emitIf(hand, cards, previous, levelRank, leading, out);
    };
    for (let i = 0; i + 3 <= SEQ_RANKS.length; i++) {
      tryWindow(SEQ_RANKS.slice(i, i + 3), 2);
    }
    for (let i = 0; i + 2 <= SEQ_RANKS.length; i++) {
      tryWindow(SEQ_RANKS.slice(i, i + 2), 3);
    }
    return uniqueMoves(out);
  }
  function generateCandidates(ctx) {
    const hand = ctx.hand || [];
    const previous = ctx.previous || null;
    const levelRank = ctx.levelRank || "2";
    const leading = Boolean(ctx.leading);
    const base = legalMoves(hand, previous, levelRank, leading);
    const extra = extraStructureMoves(hand, previous, levelRank, leading);
    return uniqueMoves(base.concat(extra));
  }
  function heuristicEval(move, ctx = {}) {
    var _a;
    if (!move || !move.combo) return -1e9;
    const c = move.combo;
    if (c.type === TYPES.PASS) return 0;
    let v = (c.size || 0) * 2;
    if (isBombLike(c)) v += 8 + (c.bombSize || 5);
    if (c.type === TYPES.PAIR_SEQ || c.type === TYPES.TRIPLE_SEQ) v += 12;
    if (c.type === TYPES.STRAIGHT) v += 6;
    if ((((_a = ctx.hand) == null ? void 0 : _a.length) || 0) === c.size) v += 80;
    return v;
  }
  function cloneCtx(ctx, move) {
    const hand = (ctx.hand || []).filter((c) => !move.cards.some((x) => x.id === c.id));
    return { ...ctx, hand, leading: false, previous: move.combo };
  }
  function shortRollout(ctx, move, depth = 2) {
    var _a;
    let score = heuristicEval(move, ctx);
    let cur = cloneCtx(ctx, move);
    for (let d = 0; d < depth; d++) {
      const cands = generateCandidates(cur);
      if (!cands.length) break;
      let best = cands[0];
      let bestV = heuristicEval(best, cur);
      for (const m of cands) {
        const v = heuristicEval(m, cur);
        if (v > bestV) {
          bestV = v;
          best = m;
        }
      }
      score += bestV * 0.3;
      if (((_a = best.combo) == null ? void 0 : _a.type) === TYPES.PASS) break;
      cur = cloneCtx(cur, best);
    }
    return score;
  }
  function beamSearch(ctx, { beam = 8, timeMs = 35 } = {}) {
    const t0 = Date.now();
    const cands = generateCandidates(ctx);
    const scored = [];
    for (const m of cands) {
      if (Date.now() - t0 > timeMs) break;
      scored.push({ move: m, value: shortRollout(ctx, m, 1) });
    }
    scored.sort((a, b) => b.value - a.value);
    return scored.slice(0, beam);
  }

  // belief/index.js
  var STYLES = ["tight", "normal", "loose", "aggressive", "conservative"];
  var STYLE_PRIORS = {
    tight: { pass: 0.55, follow: 0.35, bomb: 0.1 },
    normal: { pass: 0.4, follow: 0.45, bomb: 0.15 },
    loose: { pass: 0.25, follow: 0.5, bomb: 0.25 },
    aggressive: { pass: 0.2, follow: 0.45, bomb: 0.35 },
    conservative: { pass: 0.6, follow: 0.32, bomb: 0.08 }
  };
  function remainingCardCounts(playedCards = []) {
    const total = /* @__PURE__ */ new Map();
    for (const c of makeDeck()) {
      const k = `${c.rank}:${c.suit}`;
      total.set(k, (total.get(k) || 0) + 1);
    }
    for (const c of playedCards) {
      const k = `${c.rank}:${c.suit}`;
      if (total.has(k)) total.set(k, Math.max(0, total.get(k) - 1));
    }
    return total;
  }
  function remainingByRank(playedCards = []) {
    const m = new Map(RANKS.map((r) => [r, 8]));
    m.set(JOKER_BLACK, 2);
    m.set(JOKER_RED, 2);
    for (const c of playedCards) {
      m.set(c.rank, Math.max(0, (m.get(c.rank) || 0) - 1));
    }
    return m;
  }
  function trackKeyCards(playedCards = [], levelRank = "2") {
    let twos = 0;
    let levels = 0;
    let wilds = 0;
    let black = 0;
    let red = 0;
    let bombsGone = 0;
    for (const c of playedCards) {
      if (c.rank === "2") twos += 1;
      if (c.rank === levelRank && !isJokerRank(c.rank)) levels += 1;
      if (isWildCard(c, levelRank)) wilds += 1;
      if (c.rank === JOKER_BLACK) black += 1;
      if (c.rank === JOKER_RED) red += 1;
    }
    return {
      twosLeft: Math.max(0, 8 - twos),
      levelLeft: Math.max(0, 8 - levels),
      wildsLeft: Math.max(0, 2 - wilds),
      blackJokerLeft: Math.max(0, 2 - black),
      redJokerLeft: Math.max(0, 2 - red),
      bombsGone,
      levelRank
    };
  }
  function recordBombPlayed(keyState, combo2) {
    const next = { ...keyState };
    if (combo2 && (combo2.type === TYPES.BOMB || combo2.type === TYPES.STRAIGHT_FLUSH)) {
      next.bombsGone = (next.bombsGone || 0) + 1;
    }
    return next;
  }
  function opponentRemainingCounts(startCounts = [27, 27, 27, 27], playedBySeat = [[], [], [], []]) {
    return startCounts.map((n, i) => {
      var _a;
      return Math.max(0, n - (((_a = playedBySeat[i]) == null ? void 0 : _a.length) || 0));
    });
  }
  function updateActionWeights(prior, action) {
    const w = { ...prior };
    const lr = 0.12;
    if (action === "pass") w.pass = Math.min(0.9, w.pass + lr);
    if (action === "follow") w.follow = Math.min(0.9, w.follow + lr);
    if (action === "bomb") w.bomb = Math.min(0.85, w.bomb + lr);
    const s = w.pass + w.follow + w.bomb;
    w.pass /= s;
    w.follow /= s;
    w.bomb /= s;
    return w;
  }
  function stylePrior(style = "normal") {
    const s = STYLES.includes(style) ? style : "normal";
    return { style: s, ...STYLE_PRIORS[s] };
  }
  function inferOpponentModel(history = [], style = "normal") {
    let w = stylePrior(style);
    for (const ev of history) {
      if (ev == null ? void 0 : ev.action) w = { style: w.style, ...updateActionWeights(w, ev.action) };
    }
    return w;
  }
  function buildBelief(ctx = {}) {
    const played = ctx.playedCards || [];
    const bySeat = ctx.playedBySeat || [[], [], [], []];
    const start = ctx.startCounts || [27, 27, 27, 27];
    const keys = trackKeyCards(played, ctx.levelRank || "2");
    let bombs = keys;
    for (const t of ctx.tricks || []) bombs = recordBombPlayed(bombs, t.combo);
    return {
      remainingByRank: Object.fromEntries(remainingByRank(played)),
      remainingCounts: remainingCardCounts(played),
      keyCards: bombs,
      opponentCounts: opponentRemainingCounts(start, bySeat),
      models: [0, 1, 2, 3].map(
        (seat) => {
          var _a, _b;
          return inferOpponentModel(((_a = ctx.histories) == null ? void 0 : _a[seat]) || [], ((_b = ctx.styles) == null ? void 0 : _b[seat]) || "normal");
        }
      )
    };
  }

  // ml/weights.json
  var weights_default = {
    bias: 0.1,
    w: {
      size: 0.35,
      isBomb: -1.8,
      isSF: -2.2,
      isPass: -0.2,
      isPairSeq: 0.9,
      isTripleSeq: 1,
      isStraight: 0.55,
      goOut: 4.5,
      smallLead: 0.2,
      control: 0.4,
      wasteBomb: -8,
      crushPartner: -6,
      firstLeadBomb: -7,
      exposeVsTwo: -3.5,
      splitStruct: -2.8,
      keepTrash: -2
    }
  };

  // ml/features.js
  var FEATURE_NAMES = [
    "size",
    "isBomb",
    "isSF",
    "isPass",
    "isPairSeq",
    "isTripleSeq",
    "isStraight",
    "goOut",
    "smallLead",
    "control",
    "wasteBomb",
    "crushPartner",
    "firstLeadBomb",
    "exposeVsTwo",
    "splitStruct",
    "keepTrash"
  ];
  function extractFeatures(ctx, move) {
    var _a;
    const combo2 = (move == null ? void 0 : move.combo) || { type: TYPES.PASS, size: 0 };
    const handLen = ((_a = ctx.hand) == null ? void 0 : _a.length) || 0;
    const size = combo2.size || 0;
    const bomb = isBombLike(combo2);
    const isBomb = combo2.type === TYPES.BOMB ? 1 : 0;
    const isSF = combo2.type === TYPES.STRAIGHT_FLUSH ? 1 : 0;
    const prev = ctx.previous;
    const wasteBomb = isBomb && prev && prev.type === TYPES.FULLHOUSE && combo2.rank === prev.rank && (combo2.bombSize || size) === 4 ? 1 : 0;
    const crushPartner = bomb && ctx.partnerCombo && ctx.partnerCombo.type === TYPES.STRAIGHT && !ctx.winningNow ? 1 : 0;
    const firstLeadBomb = ctx.firstLeadOfDeal && bomb && handLen > size ? 1 : 0;
    const exposeVsTwo = (ctx.enemyShort || 99) <= 2 && size === 3 && combo2.type === TYPES.TRIPLE && handLen > 3 ? 1 : 0;
    const splitStruct = ctx.wouldSplitStructure ? 1 : 0;
    const keepTrash = handLen <= 2 && combo2.type === TYPES.PASS ? 1 : 0;
    return {
      size,
      isBomb,
      isSF,
      isPass: combo2.type === TYPES.PASS ? 1 : 0,
      isPairSeq: combo2.type === TYPES.PAIR_SEQ ? 1 : 0,
      isTripleSeq: combo2.type === TYPES.TRIPLE_SEQ ? 1 : 0,
      isStraight: combo2.type === TYPES.STRAIGHT ? 1 : 0,
      goOut: handLen === size && size > 0 ? 1 : 0,
      smallLead: ctx.leading && !bomb ? 1 : 0,
      control: ctx.leading ? 0.5 : 0,
      wasteBomb,
      crushPartner,
      firstLeadBomb,
      exposeVsTwo,
      splitStruct,
      keepTrash
    };
  }

  // ml/score.js
  function linearValue(feat, w = weights_default) {
    let s = w.bias || 0;
    for (const name of FEATURE_NAMES) {
      s += (feat[name] || 0) * (w.w[name] || 0);
    }
    return s;
  }
  function policyScore(ctx, move, w = weights_default) {
    const feat = extractFeatures(ctx, move);
    let s = linearValue(feat, w);
    if (feat.wasteBomb || feat.firstLeadBomb || feat.crushPartner) {
      s -= 50;
    }
    if (isBombLike(move.combo) && ctx.forbidBomb) s -= 50;
    return { score: s, features: feat };
  }

  // meta/index.js
  function phaseOf(remainingInHand) {
    if (remainingInHand >= 20) return "early";
    if (remainingInHand >= 10) return "mid";
    if (remainingInHand >= 3) return "late";
    return "lastCards";
  }

  // policy/shape.js
  function minPlays(hand, levelRank = "2") {
    if (!(hand == null ? void 0 : hand.length)) return 0;
    const whole = classify(hand, levelRank);
    if (whole && whole.type !== TYPES.PASS) return 1;
    if (hand.length > 16) return 3;
    let moves = [];
    try {
      moves = generateCandidates({ hand, previous: null, levelRank, leading: true });
    } catch {
      return 3;
    }
    for (const m of moves) {
      const ids = new Set(m.cards.map((c) => c.id));
      const rest = hand.filter((c) => !ids.has(c.id));
      if (!rest.length) return 1;
      const r = classify(rest, levelRank);
      if (r && r.type !== TYPES.PASS) return 2;
    }
    return 3;
  }
  function restAfter(hand, move) {
    const ids = new Set(((move == null ? void 0 : move.cards) || []).map((c) => c.id));
    return (hand || []).filter((c) => !ids.has(c.id));
  }
  function usesWild(move, levelRank) {
    return ((move == null ? void 0 : move.cards) || []).some((c) => isWildCard(c, levelRank));
  }
  function wildFillers(move, levelRank) {
    const cs = (move == null ? void 0 : move.cards) || [];
    const w = cs.filter((c) => isWildCard(c, levelRank)).length;
    if (!w) return 0;
    if (cs.every((c) => c.rank === levelRank)) return 0;
    return w;
  }

  // policy/lookahead.js
  var ALL = [...RANKS, "BJ", "RJ"];
  function unseenCounts(ctx) {
    const n = {};
    for (const r of RANKS) n[r] = 8;
    n.BJ = 2;
    n.RJ = 2;
    let levelHearts = 2;
    const lv = ctx.levelRank || "2";
    for (const c of [...ctx.hand || [], ...ctx.playedCards || []]) {
      if (n[c.rank] != null) n[c.rank] -= 1;
      if (c.rank === lv && c.suit === "H") levelHearts -= 1;
    }
    return { n, levelHearts: Math.max(0, levelHearts) };
  }
  function enemyCounts(ctx) {
    var _a;
    const seat = (_a = ctx.seat) != null ? _a : 0;
    const counts = ctx.remainingSeatCounts || [];
    return [(seat + 1) % 4, (seat + 3) % 4].map((s) => Number.isFinite(counts[s]) ? counts[s] : 27).filter((x) => x > 0);
  }
  function higherUnits(combo2, ctx, U) {
    const lv = ctx.levelRank || "2";
    const st = (r) => singleStrength(r, lv);
    const s0 = st(combo2.rank);
    const need = combo2.type === TYPES.SINGLE ? 1 : combo2.type === TYPES.PAIR ? 2 : combo2.type === TYPES.TRIPLE ? 3 : 0;
    if (!need) return Infinity;
    let h = 0;
    for (const r of ALL) {
      if (st(r) <= s0) continue;
      const have = U.n[r] || 0;
      const wild = r === "BJ" || r === "RJ" ? 0 : U.levelHearts;
      if (have >= need) h += have - need + 1;
      else if (have + wild >= need && have > 0) h += 1;
    }
    return h;
  }
  function safety(move, ctx) {
    var _a;
    if (!((_a = move == null ? void 0 : move.cards) == null ? void 0 : _a.length)) return null;
    const combo2 = move.combo;
    const enemies = enemyCounts(ctx);
    if (!enemies.length) return "sure";
    const U = unseenCounts(ctx);
    const size = move.cards.length;
    let worst = "sure";
    for (const n of enemies) {
      if (isBombLike(combo2)) {
        const rocket = combo2.type === TYPES.BOMB && (combo2.rocket || combo2.rank === "RJ");
        if (!rocket && n >= 4) worst = "likely";
        continue;
      }
      if (n >= size) {
        const h = higherUnits(combo2, ctx, U);
        if (h > 0) return null;
      }
      if (n >= 4) worst = "likely";
    }
    return worst;
  }
  function winProb(move, ctx) {
    const s = safety(move, ctx);
    if (s === "sure") return 1;
    if (s === "likely") return 0.85;
    const combo2 = move == null ? void 0 : move.combo;
    if (!combo2 || isBombLike(combo2)) return 0.8;
    const U = unseenCounts(ctx);
    const h = higherUnits(combo2, ctx, U);
    if (!Number.isFinite(h)) return 0.3;
    const E = enemyCounts(ctx).reduce((a, b) => a + b, 0);
    const total = Object.values(U.n).reduce((a, b) => a + b, 0) || 1;
    const f = Math.min(0.95, E / total);
    return Math.pow(1 - f, h);
  }
  var ORDER = { sure: 2, likely: 1 };
  function worse(a, b) {
    if (!a || !b) return null;
    return ORDER[a] <= ORDER[b] ? a : b;
  }
  function finishLine(hand, ctx, depth = 2, cache = /* @__PURE__ */ new Map()) {
    var _a;
    if (!hand.length) return "sure";
    const lv = ctx.levelRank || "2";
    const key = hand.map((c) => c.id).sort().join(",") + "|" + depth;
    if (cache.has(key)) return cache.get(key);
    let res = null;
    if (minPlays(hand, lv) <= 1) res = "sure";
    else if (depth > 0 && hand.length <= 12) {
      let moves = [];
      try {
        moves = generateCandidates({ hand, previous: null, levelRank: lv, leading: true }) || [];
      } catch {
        moves = [];
      }
      const sub = { ...ctx, hand };
      for (const m of moves) {
        if (!((_a = m.cards) == null ? void 0 : _a.length) || m.cards.length === hand.length) continue;
        if (isBombLike(m.combo) && Math.min(...enemyCounts(ctx), 27) >= 6) continue;
        const s = safety(m, sub);
        if (!s) continue;
        const r = finishLine(restAfter(hand, m), ctx, depth - 1, cache);
        const t = worse(s, r);
        if (t && (!res || ORDER[t] > ORDER[res])) res = t;
        if (res === "sure") break;
      }
    }
    cache.set(key, res);
    return res;
  }
  function moveFinish(move, ctx, cache) {
    var _a;
    if (!((_a = move == null ? void 0 : move.cards) == null ? void 0 : _a.length)) return null;
    const hand = ctx.hand || [];
    const rest = restAfter(hand, move);
    if (!rest.length) return "sure";
    if (rest.length > 12) return null;
    {
      const lv = ctx.levelRank || "2";
      const g = generateCandidates({ hand: rest, previous: null, levelRank: lv, leading: true }) || [];
      const restBomb = g.find((m) => m.cards.length === rest.length && isBombLike(m.combo));
      if (restBomb) {
        const em0 = Math.min(...enemyCounts(ctx), 27);
        const canGoOutOver = em0 <= 27 && enemyCounts(ctx).some((c) => c > 0 && c === move.cards.length) && safety(move, ctx) !== "sure";
        if (!isBombLike(move.combo) && !canGoOutOver) return "bombBack";
        if (isBombLike(move.combo)) {
          if (compareCombos(restBomb.combo, move.combo, lv) > 0) return "bombBack";
          return safety(move, ctx) ? "likely" : null;
        }
      }
    }
    const s = safety(move, ctx);
    if (!s) return null;
    const r = finishLine(rest, ctx, rest.length <= 8 ? 2 : 1, cache);
    return worse(s, r);
  }
  function feedAfter(move, ctx) {
    var _a;
    const seat = (_a = ctx.seat) != null ? _a : 0;
    const pc = (ctx.remainingSeatCounts || [])[(seat + 2) % 4];
    if (!(pc === 1 || pc === 2)) return null;
    const rest = restAfter(ctx.hand || [], move);
    if (!rest.length) return null;
    const lv = ctx.levelRank || "2";
    const cnt = /* @__PURE__ */ new Map();
    for (const c of rest) cnt.set(c.rank, (cnt.get(c.rank) || 0) + 1);
    const smallSingle = rest.some((c) => singleStrength(c.rank, lv) <= 8 && !isWildCard(c, lv));
    const pair = [...cnt.entries()].some(([r, n]) => n >= 2 && n < 4 && singleStrength(r, lv) <= 10);
    if (pc === 1 && smallSingle) return "single";
    if (pc === 2 && (pair || smallSingle)) return pair ? "pair" : "single";
    return null;
  }

  // policy/filters.js
  function isPass(move) {
    return !move || !move.combo || move.combo.type === TYPES.PASS;
  }
  function emptiesHand(move, hand) {
    return move.cards && hand && move.cards.length === hand.length && move.cards.length > 0;
  }
  function detectStructures(hand, _levelRank) {
    const cnt = countByRank(hand);
    const pairRanks = [];
    const tripRanks = [];
    for (const [r, n] of cnt) {
      if (n >= 2) pairRanks.push(r);
      if (n >= 3) tripRanks.push(r);
    }
    const runRanks = (ranks, need) => {
      const order = ["A", ...RANKS];
      const on = order.map((r) => ranks.includes(r) && !isJokerRank(r));
      const out = /* @__PURE__ */ new Set();
      let i = 0;
      while (i < order.length) {
        if (!on[i]) {
          i++;
          continue;
        }
        let j = i;
        while (j + 1 < order.length && on[j + 1]) j++;
        if (j - i + 1 >= need) for (let k = i; k <= j; k++) out.add(order[k]);
        i = j + 1;
      }
      return [...out];
    };
    const seqPairs = runRanks(pairRanks, 3);
    const seqTrips = runRanks(tripRanks, 2);
    return {
      pairRanks,
      tripRanks,
      hasAirplane: tripRanks.length >= 2,
      hasPairSeq: pairRanks.length >= 3,
      // 跟牌时用的“真实”结构：连续 ≥3 对 / ≥2 连三张
      seq: { pairRanks: seqPairs, tripRanks: seqTrips, hasAirplane: seqTrips.length >= 2, hasPairSeq: seqPairs.length >= 3 }
    };
  }
  function moveBreaksStructure(move, struct0, follow = false) {
    if (isPass(move) || isBombLike(move.combo)) return false;
    const struct = follow && struct0.seq ? struct0.seq : struct0;
    const t = move.combo.type;
    if (t === TYPES.PAIR_SEQ || t === TYPES.TRIPLE_SEQ || t === TYPES.STRAIGHT || t === TYPES.STRAIGHT_FLUSH) {
      return false;
    }
    if ((t === TYPES.SINGLE || t === TYPES.PAIR) && struct.hasAirplane) {
      return move.cards.some((c) => struct.tripRanks.includes(c.rank));
    }
    if ((t === TYPES.SINGLE || t === TYPES.PAIR) && struct.hasPairSeq) {
      return move.cards.some((c) => struct.pairRanks.includes(c.rank));
    }
    return false;
  }
  function enemyShortCount(ctx) {
    var _a;
    const counts = ctx.remainingSeatCounts || ctx.opponentCounts || [27, 27, 27, 27];
    const seat = (_a = ctx.seat) != null ? _a : 0;
    const enemies = [(seat + 1) % 4, (seat + 3) % 4];
    return Math.min(...enemies.map((s) => {
      var _a2;
      return (_a2 = counts[s]) != null ? _a2 : 27;
    }));
  }
  function winningNow(ctx, move) {
    if (emptiesHand(move, ctx.hand)) return true;
    if (ctx.winningNow) return true;
    return false;
  }
  var ORDINARY = /* @__PURE__ */ new Set([
    TYPES.SINGLE,
    TYPES.PAIR,
    TYPES.TRIPLE,
    TYPES.FULLHOUSE,
    TYPES.STRAIGHT,
    TYPES.PAIR_SEQ,
    TYPES.TRIPLE_SEQ
  ]);
  function resolvePartnerCombo(ctx) {
    var _a;
    if (ctx.partnerCombo) return ctx.partnerCombo;
    const seat = (_a = ctx.seat) != null ? _a : 0;
    if (ctx.lastPlaySeat != null && ctx.previous && ctx.lastPlaySeat === (seat + 2) % 4) {
      return ctx.previous;
    }
    return null;
  }
  function rankIdx(rank) {
    return RANKS.indexOf(rank);
  }
  function isSmallOrdinary(prev, levelRank) {
    if (!prev || !ORDINARY.has(prev.type)) return false;
    const r = prev.rank;
    if (!r || isJokerRank(r) || r === levelRank) return false;
    const i = rankIdx(r);
    if (prev.type === TYPES.SINGLE) {
      return i >= 0 && r !== "A";
    }
    if (prev.type === TYPES.PAIR) {
      return i >= 0 && r !== "A";
    }
    if (prev.type === TYPES.TRIPLE || prev.type === TYPES.FULLHOUSE) {
      return i >= 0 && i <= rankIdx("J");
    }
    return false;
  }
  var FORBID_TRACE = { rule: null };
  function isForbidden(move, ctx, allMoves) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
    if (isPass(move)) return false;
    const combo2 = move.combo;
    const bomb = isBombLike(combo2);
    const others = (allMoves || []).filter((m) => m !== move && !isPass(m));
    const onlyWay = others.length === 0;
    const last = emptiesHand(move, ctx.hand);
    const win = winningNow(ctx, move);
    const prev = ctx.previous;
    const partner = resolvePartnerCombo(ctx);
    const canPass = (allMoves || []).some(isPass) || Boolean(prev) && prev.type !== TYPES.PASS && !ctx.leading;
    const sameTypeFollow = Boolean(
      prev && (allMoves || []).some((m) => m !== move && !isPass(m) && m.combo && m.combo.type === prev.type)
    );
    if (ctx.firstLeadOfDeal && bomb && !onlyWay && !last && !win) return FORBID_TRACE.rule = "L191", true;
    if (combo2.type === TYPES.BOMB && (combo2.bombSize || combo2.size) === 4 && prev && prev.type === TYPES.FULLHOUSE && combo2.rank === prev.rank) {
      if (!onlyWay && !last && !win) return FORBID_TRACE.rule = "L201", true;
    }
    const enemyLast = enemyShortCount(ctx) <= 1;
    if (bomb && prev && isSmallOrdinary(prev, ctx.levelRank) && !last && !win && !enemyLast && !(!partner && bombFinishOk(move, ctx, others, moveFinish(move, ctx)))) {
      if (canPass || sameTypeFollow || !onlyWay) return FORBID_TRACE.rule = "L208", true;
    }
    if (combo2.type === TYPES.STRAIGHT_FLUSH && prev && prev.type === TYPES.SINGLE && (prev.rank === "8" || prev.rank === "9") && !enemyLast) {
      if (!last && !win && (canPass || !onlyWay)) return FORBID_TRACE.rule = "L219", true;
    }
    if (bomb && partner && (ORDINARY.has(partner.type) || isBombLike(partner)) && !win && !last) {
      if (canPass || sameTypeFollow || !onlyWay) return FORBID_TRACE.rule = "L230", true;
    }
    if (bomb && prev && !ctx.leading && !partner && !last && !win && !((f0) => f0 === "sure" || f0 && enemyShortCount(ctx) <= 1 && !others.some((m) => !isBombLike(m.combo) && moveFinish(m, ctx)) || bombFinishOk(move, ctx, others, f0))(moveFinish(move, ctx))) {
      const cnt = countByRank(ctx.hand || []);
      const lv0 = ctx.levelRank || "2";
      const bombIds = new Set((allMoves || []).filter((m) => m.combo && isBombLike(m.combo) && (enemyShortCount(ctx) <= 1 || !(m.cards || []).some((c) => isWildCard(c, lv0)))).flatMap((m) => (m.cards || []).map((c) => c.id)));
      const touches = (m) => (m.cards || []).some((c) => (cnt.get(c.rank) || 0) >= 4 || bombIds.has(c.id));
      if (others.some((m) => !isBombLike(m.combo) && !touches(m))) return FORBID_TRACE.rule = "L242", true;
      const seat0 = (_a = ctx.seat) != null ? _a : 0;
      const cts = ctx.remainingSeatCounts || [];
      const lastN = ctx.lastPlaySeat != null ? cts[ctx.lastPlaySeat] : null;
      const pc0 = cts[(seat0 + 2) % 4];
      if (lastN != null && lastN >= 6 && !(pc0 === 1 || pc0 === 2) && enemyShortCount(ctx) >= 2) return FORBID_TRACE.rule = "L248", true;
    }
    if (ctx.leading && !bomb && !last && !win && (enemyShortCount(ctx) <= 3 || [1, 2].includes((_c = ctx.remainingSeatCounts) == null ? void 0 : _c[(((_b = ctx.seat) != null ? _b : 0) + 2) % 4]))) {
      const cnt = countByRank(ctx.hand || []);
      const touches = (m) => (m.cards || []).some((c) => (cnt.get(c.rank) || 0) >= 4);
      if (touches(move) && others.some((m) => isBombLike(m.combo) || !touches(m))) return FORBID_TRACE.rule = "L256", true;
    }
    if (!bomb && partner && ORDINARY.has(partner.type) && !ctx.leading && prev && !last && !win) {
      if (!partnerOverrideOk(move, ctx, prev)) return FORBID_TRACE.rule = "L262", true;
    }
    if (combo2.type === TYPES.TRIPLE && !(prev && prev.type === TYPES.TRIPLE && !ctx.leading) && // 跟三张只能用三张：不算“拆三条”
    enemyShortCount(ctx) <= 2 && (((_d = ctx.hand) == null ? void 0 : _d.length) || 0) > 3 && !onlyWay && !last && !winningNow(ctx, move)) {
      const natTriple = ctx.leading && (countByRank(ctx.hand || []).get(combo2.rank) || 0) === 3 && !(allMoves || []).some((m) => {
        var _a2, _b2;
        return (((_a2 = m.combo) == null ? void 0 : _a2.type) === TYPES.FULLHOUSE || ((_b2 = m.combo) == null ? void 0 : _b2.type) === TYPES.TRIPLE_SEQ) && m.combo.rank === combo2.rank;
      });
      if (!ctx.leading || (((_e = ctx.hand) == null ? void 0 : _e.length) || 0) > 6 && !natTriple) return FORBID_TRACE.rule = "L278", true;
    }
    if (!ctx.leading && prev && (combo2.type === TYPES.SINGLE || combo2.type === TYPES.PAIR) && (enemyShortCount(ctx) >= 3 || enemyShortCount(ctx) <= 1 && !partner) && !last && !win) {
      const lvB = ctx.levelRank || "2";
      const n = (ctx.hand || []).filter((c) => c.rank === combo2.rank && !isWildCard(c, lvB)).length;
      if ((n || 0) >= 4) return FORBID_TRACE.rule = "L293", true;
    }
    if (!ctx.leading && prev && !bomb && !partner && !last && !win && (((_f = move.cards) == null ? void 0 : _f.length) || 0) >= 3 && enemyShortCount(ctx) >= 3) {
      const cnt = countByRank(ctx.hand || []);
      const lv1 = ctx.levelRank || "2";
      if ((move.cards || []).some((c) => !isWildCard(c, lv1) && (cnt.get(c.rank) || 0) >= 4)) return FORBID_TRACE.rule = "L300", true;
    }
    const partnerLast = ctx.leading && (((_i = (_h = ctx.remainingSeatCounts) == null ? void 0 : _h[(((_g = ctx.seat) != null ? _g : 0) + 2) % 4]) != null ? _i : 27) === 1 || // 对家剩 2 张：允许拆三张/对子结构送对
    ((_l = (_k = ctx.remainingSeatCounts) == null ? void 0 : _k[(((_j = ctx.seat) != null ? _j : 0) + 2) % 4]) != null ? _l : 27) === 2 && ((_m = move.combo) == null ? void 0 : _m.type) === TYPES.PAIR || // 敌报双且手中无孤单：允许拆对出单
    enemyShortCount(ctx) === 2 && [...countByRank(ctx.hand || []).values()].every((n) => n >= 2));
    const struct = ctx._struct || detectStructures(ctx.hand || [], ctx.levelRank);
    if (moveBreaksStructure(move, struct, true) && !partnerLast && // 跟牌拦截报双/报单敌家时允许拆结构
    !(!ctx.leading && prev && enemyShortCount(ctx) <= 2 && !partner) && // 压搭档拦截：下家敌人张数恰等于这手（压上即走完），允许拆结构顶住
    !(!ctx.leading && prev && partner && !bomb && nextEnemyIs(ctx, Array.isArray(prev == null ? void 0 : prev.cards) && prev.cards.length || (prev == null ? void 0 : prev.size) || 1) && partnerOverrideOk(move, ctx, prev)) && !onlyWay && !last && !winningNow(ctx, move)) {
      return FORBID_TRACE.rule = "L323", true;
    }
    return false;
  }
  function nextEnemyIs(ctx, n) {
    var _a, _b;
    const cts = ctx.remainingSeatCounts || [];
    return ((_b = cts[(((_a = ctx.seat) != null ? _a : 0) + 1) % 4]) != null ? _b : 27) === n;
  }
  function bombFinishOk(move, ctx, others, f0) {
    if (!f0 || enemyShortCount(ctx) > 3) return false;
    const ids = new Set((move.cards || []).map((x) => x.id));
    const rest = (ctx.hand || []).filter((c) => !ids.has(c.id));
    if (minPlays(rest, ctx.levelRank || "2") > 2) return false;
    return !(others || []).some((m) => !isBombLike(m.combo) && moveFinish(m, ctx));
  }
  function partnerOverrideOk(move, ctx, prev) {
    var _a, _b, _c, _d, _e;
    const hand = ctx.hand || [];
    const lv = ctx.levelRank || "2";
    const ids = new Set((move.cards || []).map((c) => c.id));
    const rest = hand.filter((c) => !ids.has(c.id));
    if (!rest.length) return true;
    const natCnt = (r) => hand.filter((c) => c.rank === r && (isJokerRank(c.rank) || !isWildCard(c, lv))).length;
    const breaksNatBomb = !isBombLike(move.combo) && (move.cards || []).some((c) => !isJokerRank(c.rank) && !isWildCard(c, lv) && natCnt(c.rank) >= 4 && natCnt(c.rank) - (move.cards || []).filter((x) => x.rank === c.rank && !isWildCard(x, lv)).length < 4);
    if (minPlays(rest, lv) <= 1 && !breaksNatBomb) return true;
    {
      const f = moveFinish(move, ctx);
      if (f === "sure") return true;
    }
    const seat = (_a = ctx.seat) != null ? _a : 0;
    const counts = ctx.remainingSeatCounts || [];
    const partnerCount = (_b = counts[(seat + 2) % 4]) != null ? _b : 27;
    const nextEnemy = (_c = counts[(seat + 1) % 4]) != null ? _c : 27;
    const partnerFirst = /partner/i.test(((_d = ctx.persona) == null ? void 0 : _d.style) || "") || /护搭档|partner/i.test(((_e = ctx.persona) == null ? void 0 : _e.brief) || "");
    if (partnerFirst) return false;
    const size = Array.isArray(prev == null ? void 0 : prev.cards) && prev.cards.length || (prev == null ? void 0 : prev.size) || ((prev == null ? void 0 : prev.type) === "pair" ? 2 : 1);
    const cnt = countByRank(hand);
    const breaksBomb = (move.cards || []).some((c) => (cnt.get(c.rank) || 0) >= 4);
    const partnerWeak = (prev == null ? void 0 : prev.rank) && !["A", "BJ", "RJ", lv].includes(prev.rank) && rankIdx(prev.rank) < rankIdx("J");
    if (partnerCount === 1) return nextEnemy === size && partnerWeak && !breaksBomb;
    return nextEnemy <= 2 && nextEnemy >= size && !breaksBomb;
  }

  // policy/handplan.js
  var MAX_CARDS = 14;
  var NAT = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "BJ", "RJ"];
  function comboKey(m) {
    var _a, _b, _c;
    return `${(_a = m.combo) == null ? void 0 : _a.type}:${(_b = m.combo) == null ? void 0 : _b.rank}:${(_c = m.cards) == null ? void 0 : _c.length}`;
  }
  function idsKey(hand) {
    return hand.map((c) => c.id).sort().join(",");
  }
  var SINGLE_ORDER = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  function playCost(m, lv, cnt0) {
    const c = m.combo;
    if (isBombLike(c)) return 0.3;
    let cost = 1;
    const used = /* @__PURE__ */ new Map();
    for (const x of m.cards) if (!isWildCard(x, lv)) used.set(x.rank, (used.get(x.rank) || 0) + 1);
    for (const [r, k] of used) {
      const n2 = cnt0.get(r) || 0;
      if (n2 >= 4 && r !== "BJ" && r !== "RJ") cost += 1.5;
      else if (n2 > k) cost += 0.05;
    }
    const n = m.cards.length;
    const wild = m.cards.some((x) => isWildCard(x, lv));
    if (wild && n <= 3) cost += 0.25;
    if (c.type === TYPES.SINGLE) cost += 0.01 * Math.max(0, 14 - (SINGLE_ORDER.indexOf(c.rank) + 2));
    if (c.type === TYPES.SINGLE && (c.rank === lv || c.rank === "BJ" || c.rank === "RJ")) cost = 0.8;
    if (c.type === TYPES.PAIR && (c.rank === "BJ" || c.rank === "RJ")) cost = 0.8;
    return cost;
  }
  function roleOf(m, lv) {
    const c = m.combo;
    if (isBombLike(c)) return "bomb";
    const r = c.rank;
    if ((c.type === TYPES.SINGLE || c.type === TYPES.PAIR || c.type === TYPES.TRIPLE) && (r === lv || r === "BJ" || r === "RJ")) return "control";
    if (m.cards.length >= 3) return "unit";
    return "small";
  }
  function orderKey(m, lv) {
    const nat = m.cards.filter((x) => !isWildCard(x, lv)).map((x) => NAT.indexOf(x.rank));
    const low = nat.length ? Math.min(...nat) : 99;
    const role = roleOf(m, lv);
    return (role === "bomb" ? 2e3 : role === "control" ? 1e3 + singleStrength(m.combo.rank, lv) : 0) + low;
  }
  function decompose(hand, lv = "2", cache = /* @__PURE__ */ new Map(), opts = {}) {
    const freeWild = !!opts.freeWild;
    if (!(hand == null ? void 0 : hand.length)) return { comps: [], plays: 0, cost: 0 };
    if (hand.length > MAX_CARDS) return null;
    const t0 = Date.now();
    const cnt0 = /* @__PURE__ */ new Map();
    for (const x of hand) if (!isWildCard(x, lv)) cnt0.set(x.rank, (cnt0.get(x.rank) || 0) + 1);
    const rec = (h) => {
      var _a;
      if (!h.length) return { list: [], cost: 0 };
      const k = idsKey(h);
      if (cache.has(k)) return cache.get(k);
      const nat = h.filter((c) => !isWildCard(c, lv));
      const anchor = (nat.length ? nat : h).reduce((a, b) => NAT.indexOf(b.rank) < NAT.indexOf(a.rank) ? b : a);
      let moves = [];
      try {
        moves = generateCandidates({ hand: h, previous: null, levelRank: lv, leading: true }) || [];
      } catch {
        moves = [];
      }
      moves = moves.filter((m) => {
        var _a2, _b;
        return ((_a2 = m.cards) == null ? void 0 : _a2.length) && m.cards.some((c) => c.id === anchor.id) && (freeWild || !m.cards.some((c) => isWildCard(c, lv)) || isBombLike(m.combo) || m.cards.length === h.length || [TYPES.SINGLE, TYPES.PAIR, TYPES.TRIPLE].includes((_b = m.combo) == null ? void 0 : _b.type) && m.combo.rank === lv && m.cards.every((c) => c.rank === lv));
      });
      let best = null;
      for (const m of moves) {
        if (Date.now() - t0 > 25) break;
        const ids = new Set(m.cards.map((c) => c.id));
        const r2 = rec(h.filter((c) => !ids.has(c.id)));
        if (!r2) continue;
        const cost = r2.cost + playCost(m, lv, cnt0);
        if (!best || cost < best.cost - 1e-9) best = { list: [m, ...r2.list], cost };
      }
      if (!best) best = { list: [{ cards: [anchor], combo: { type: TYPES.SINGLE, rank: anchor.rank } }, ...((_a = rec(h.filter((c) => c.id !== anchor.id))) == null ? void 0 : _a.list) || []], cost: 99 };
      cache.set(k, best);
      return best;
    };
    const r = rec(hand);
    const comps = r.list.map((m) => ({ move: m, key: comboKey(m), role: roleOf(m, lv), order: orderKey(m, lv) }));
    comps.sort((a, b) => a.order - b.order);
    return { comps, plays: comps.length, cost: r.cost };
  }
  var SEQ = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  function decomposeCounts(hand, lv = "2", cache = /* @__PURE__ */ new Map(), base = null) {
    if (!(hand == null ? void 0 : hand.length)) return { comps: [], plays: 0, cost: 0 };
    const cnt = new Array(13).fill(0);
    let bj = 0, rj = 0, wild = 0;
    for (const c of hand) {
      if (c.rank === "BJ") bj++;
      else if (c.rank === "RJ") rj++;
      else if (isWildCard(c, lv)) wild++;
      else cnt[SEQ.indexOf(c.rank)]++;
    }
    const cnt0 = base || cnt.slice();
    const card2 = (r2, n) => Array.from({ length: n }, () => ({ rank: r2, suit: "S" }));
    const mk = (type, rank, ranksN) => ({ combo: { type, rank }, cards: ranksN.flatMap(([r2, n]) => card2(r2, n)) });
    const costOf = (type, used) => {
      if (type === TYPES.BOMB) return 0.3;
      let cost2 = 1;
      for (const [i, k] of used) {
        if (cnt0[i] >= 4) cost2 += 1.5;
        else if (cnt0[i] > k) cost2 += 0.05;
      }
      if (type === TYPES.SINGLE) {
        const i = used[0][0];
        if (SEQ[i] === lv) return 0.8;
        cost2 += 0.01 * Math.max(0, 14 - (i + 2));
      }
      return cost2;
    };
    const t0 = Date.now();
    let nodes = 0;
    const rec = (v) => {
      let i = 0;
      while (i < 13 && !v[i]) i++;
      if (i === 13) return { list: [], cost: 0 };
      const k = v.join(",");
      const hit = cache.get(k);
      if (hit) return hit;
      nodes++;
      const opts = [];
      const c = v[i];
      const R = SEQ[i];
      if (c >= 4) opts.push([TYPES.BOMB, R, [[i, c]]]);
      opts.push([TYPES.SINGLE, R, [[i, 1]]]);
      if (c >= 2) opts.push([TYPES.PAIR, R, [[i, 2]]]);
      if (c >= 3) opts.push([TYPES.TRIPLE, R, [[i, 3]]]);
      for (let j = 0; j < 13; j++) {
        if (j === i) continue;
        if (c >= 3 && v[j] >= 2) opts.push([TYPES.FULLHOUSE, R, [[i, 3], [j, 2]]]);
        if (c >= 2 && v[j] >= 3) opts.push([TYPES.FULLHOUSE, SEQ[j], [[j, 3], [i, 2]]]);
      }
      if (i + 4 < 13 && [1, 2, 3, 4].every((d) => v[i + d] >= 1)) opts.push([TYPES.STRAIGHT, SEQ[i + 4], [0, 1, 2, 3, 4].map((d) => [i + d, 1])]);
      if (i + 2 < 13 && c >= 2 && v[i + 1] >= 2 && v[i + 2] >= 2) opts.push([TYPES.PAIR_SEQ, SEQ[i + 2], [0, 1, 2].map((d) => [i + d, 2])]);
      if (i + 1 < 13 && c >= 3 && v[i + 1] >= 3) opts.push([TYPES.TRIPLE_SEQ, SEQ[i + 1], [[i, 3], [i + 1, 3]]]);
      let best = null;
      for (const [type, rank, used] of opts) {
        if (best && (Date.now() - t0 > 30 || nodes > 2e4)) break;
        const w = v.slice();
        for (const [j, n] of used) w[j] -= n;
        const r2 = rec(w);
        const cost2 = r2.cost + costOf(type, used);
        if (!best || cost2 < best.cost - 1e-9) best = { list: [mk(type, rank, used.map(([j, n]) => [SEQ[j], n])), ...r2.list], cost: cost2 };
      }
      cache.set(k, best);
      return best;
    };
    const r = rec(cnt);
    const list = r.list.slice();
    let cost = r.cost;
    if (bj === 2 && rj === 2) {
      list.push({ combo: { type: TYPES.BOMB, rank: "RJ" }, cards: [...card2("BJ", 2), ...card2("RJ", 2)] });
      cost += 0.3;
    } else for (const [R, n] of [["BJ", bj], ["RJ", rj]]) {
      if (n === 2) {
        list.push(mk(TYPES.PAIR, R, [[R, 2]]));
        cost += 0.8;
      } else if (n === 1) {
        list.push(mk(TYPES.SINGLE, R, [[R, 1]]));
        cost += 0.8;
      }
    }
    for (let w = 0; w < wild; w++) {
      list.push({ combo: { type: TYPES.SINGLE, rank: lv }, cards: [{ rank: lv, suit: "H" }] });
      cost += 0.8;
    }
    const comps = list.map((m) => ({ move: m, key: comboKey(m), role: roleOf(m, lv), order: orderKey(m, lv) }));
    comps.sort((a, b) => a.order - b.order);
    return { comps, plays: comps.length, cost, counts: cnt0 };
  }

  // policy/index.js
  var LA_CACHE = /* @__PURE__ */ new WeakMap();
  function laCache(ctx) {
    let c = LA_CACHE.get(ctx);
    if (!c) {
      c = /* @__PURE__ */ new Map();
      LA_CACHE.set(ctx, c);
    }
    return c;
  }
  function reasonFor(move, ctx, tags) {
    var _a;
    const c = move.combo;
    const parts = [];
    if (isPass(move)) parts.push("当前跟牌没有合适同型，选择过牌保留结构。");
    else {
      parts.push(`建议出 ${labelCombo(c)}。`);
    }
    if (tags.includes("goOut")) parts.push("手中仅剩 1–2 张，能走则走，避免留垃圾牌。");
    if (tags.includes("noFirstBomb")) parts.push("新开局首轮领出不应亮炸弹，留给关键时刻。");
    if (tags.includes("noWasteJ")) parts.push("四张 J 去压三带二是典型炸弹浪费。");
    if (tags.includes("noSFon8")) parts.push("同花顺去压 8/9 单张收益极差。");
    if (tags.includes("vsTwo")) parts.push("对方只剩 2 张，避免拆三张散牌把自己暴露。");
    if (tags.includes("partner")) parts.push("搭档刚出普通牌，不要用炸弹/同花顺砸队友。");
    if (tags.includes("keepStruct")) parts.push("保留连对/钢板（飞机）完整性，无必要不拆。");
    if (tags.includes("control")) parts.push("结合余牌与级牌，优先控场或安全过渡。");
    if (ctx.levelRank) parts.push(`当前级牌为 ${ctx.levelRank}（仅红桃级牌为逢人配）。`);
    if ((_a = ctx.belief) == null ? void 0 : _a.keyCards) {
      const k = ctx.belief.keyCards;
      parts.push(`关键牌估计：2 余 ${k.twosLeft}，级牌余 ${k.levelLeft}，大王余 ${k.redJokerLeft}。`);
    }
    const remain = Array.isArray(ctx.hand) ? ctx.hand.length : 0;
    const phaseCn = { early: "开局", mid: "中盘", late: "残局", lastCards: "收尾" };
    const phase = phaseCn[phaseOf(remain)];
    if (phase) parts.push(`当前阶段：${phase}。`);
    return parts.join("");
  }
  function labelCombo(c) {
    if (!c || c.type === TYPES.PASS) return "过牌";
    const map = {
      single: "单张",
      pair: "对子",
      triple: "三张",
      fullhouse: "三带二",
      straight: "顺子",
      pairSeq: "连对",
      tripleSeq: "钢板",
      bomb: `${c.bombSize || c.size} 炸`,
      straightFlush: "同花顺"
    };
    return `${map[c.type] || c.type}${c.rank ? " " + c.rank : ""}`;
  }
  function rankCounts(hand) {
    const m = /* @__PURE__ */ new Map();
    for (const c of hand || []) m.set(c.rank, (m.get(c.rank) || 0) + 1);
    return m;
  }
  function breaksNaturalBomb(move, hand, levelRank) {
    var _a;
    if (!((_a = move == null ? void 0 : move.cards) == null ? void 0 : _a.length) || isBombLike(move.combo)) return false;
    const nat = /* @__PURE__ */ new Map();
    for (const c of hand) if (isJokerRank(c.rank) || !isWildCard(c, levelRank)) nat.set(c.rank, (nat.get(c.rank) || 0) + 1);
    const used = /* @__PURE__ */ new Map();
    for (const c of move.cards) if (isJokerRank(c.rank) || !isWildCard(c, levelRank)) used.set(c.rank, (used.get(c.rank) || 0) + 1);
    for (const [r, u] of used) {
      const n = nat.get(r) || 0;
      if (n >= 4 && n - u < 4) return true;
    }
    return false;
  }
  function isOrphanSingleMove(move, byRank) {
    var _a;
    return ((_a = move == null ? void 0 : move.combo) == null ? void 0 : _a.type) === TYPES.SINGLE && (byRank.get(move.combo.rank) || 0) === 1;
  }
  function isControlRank(rank, levelRank) {
    return rank === levelRank || rank === "BJ" || rank === "RJ" || rank === "A";
  }
  function handHasBomb(byRank) {
    for (const n of byRank.values()) if (n >= 4) return true;
    return false;
  }
  function partnerOwnsPrevious(ctx, partner) {
    var _a, _b;
    const prev = ctx.previous;
    if (!partner || !prev || prev.type === TYPES.PASS) return false;
    if (ctx.lastPlaySeat != null && ctx.seat != null) {
      return ctx.lastPlaySeat === (ctx.seat + 2) % 4;
    }
    return partner.type === prev.type && ((_a = partner.rank) != null ? _a : null) === ((_b = prev.rank) != null ? _b : null);
  }
  function scoreMove(move, ctx, allMoves) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R, _S, _T, _U, _V, _W, _X, _Y, _Z, __, _$, _aa, _ba, _ca, _da, _ea, _fa, _ga;
    const tags = [];
    if (isForbidden(move, ctx, allMoves)) return { score: -1e6, tags: ["forbidden"] };
    const struct = ctx._struct || detectStructures(ctx.hand || [], ctx.levelRank);
    const featCtx = {
      ...ctx,
      wouldSplitStructure: moveBreaksStructure(move, struct),
      enemyShort: enemyShortCount(ctx)
    };
    let { score } = policyScore(featCtx, move);
    score += heuristicEval(move, ctx) * 0.15;
    const hand = ctx.hand || [];
    const byRank = rankCounts(hand);
    const enemyShort = ctx.leading ? liveEnemyMin(ctx) : enemyShortCount(ctx);
    const hasBomb = handHasBomb(byRank);
    const levelRank = ctx.levelRank || "2";
    const partner = resolvePartnerCombo(ctx);
    const partnerFirst = /partner/i.test(((_a = ctx.persona) == null ? void 0 : _a.style) || "") || /护搭档|partner/i.test(((_b = ctx.persona) == null ? void 0 : _b.brief) || "");
    if (emptiesHand(move, ctx.hand)) {
      score += 200;
      tags.push("goOut");
    }
    if (ctx.firstLeadOfDeal && !isBombLike(move.combo) && !isPass(move)) {
      score += 8;
      tags.push("noFirstBomb");
    }
    if (((_c = move.combo) == null ? void 0 : _c.type) === TYPES.BOMB && ((_d = ctx.previous) == null ? void 0 : _d.type) === TYPES.FULLHOUSE) {
      tags.push("noWasteJ");
    }
    if (((_e = ctx.previous) == null ? void 0 : _e.type) === TYPES.SINGLE && (ctx.previous.rank === "8" || ctx.previous.rank === "9")) {
      tags.push("noSFon8");
    }
    if (!ctx.leading && partnerOwnsPrevious(ctx, partner)) {
      if (isBombLike(move.combo)) {
        score -= 120;
        tags.push("noBombPartner");
      } else if (partnerFirst) {
        if (isPass(move)) {
          score += 120;
          tags.push("letPartner");
        } else {
          score -= 90;
          tags.push("noStealPartner");
        }
      }
    }
    const poolHasBomb = (allMoves || []).some((m) => isBombLike(m.combo));
    if (!ctx.leading && enemyShort <= 1) {
      if (isBombLike(move.combo)) {
        const bestNB = Math.max(0, ...(allMoves || []).filter((m) => !isPass(m) && !isBombLike(m.combo) && !usesWild(m, levelRank)).map((m) => winProb(m, ctx)));
        const wildBomb = usesWild(move, levelRank);
        score += Math.round(130 * (1 - (wildBomb ? 0.9 : 0.6) * bestNB));
        tags.push("mustBomb");
      } else if (isPass(move) && (hasBomb || poolHasBomb)) {
        score -= 100;
        tags.push("mustBomb");
      }
    }
    if (!isPass(move) && !isBombLike(move.combo) && enemyShort >= 3 && breaksNaturalBomb(move, hand, levelRank)) {
      const sameAlt = (allMoves || []).some((m) => {
        var _a2;
        return m !== move && ((_a2 = m.combo) == null ? void 0 : _a2.type) === move.combo.type && !isBombLike(m.combo) && !breaksNaturalBomb(m, hand, levelRank);
      });
      if (sameAlt) {
        score -= 60;
        tags.push("bombBreakAlt");
      } else if (1 + minPlays(restAfter(hand, move), levelRank) > minPlays(hand, levelRank)) {
        score -= 35;
        tags.push("bombBreakNoGain");
      }
    }
    if (!isPass(move) && ((_f = move.combo) == null ? void 0 : _f.type) === TYPES.FULLHOUSE && move.combo.pairRank && !emptiesHand(move, ctx.hand)) {
      const attachCost = (m) => {
        const pr = m.combo.pairRank;
        const nP = hand.filter((c) => c.rank === pr && !isWildCard(c, levelRank)).length;
        return (nP === 3 ? 12 : 0) + (pr === levelRank || isJokerRank(pr) ? 15 : 0) + 0.6 * Math.min(singleStrength(pr, levelRank), 16);
      };
      const same = (allMoves || []).filter((m) => {
        var _a2;
        return ((_a2 = m.combo) == null ? void 0 : _a2.type) === TYPES.FULLHOUSE && m.combo.rank === move.combo.rank && m.combo.pairRank && !emptiesHand(m, ctx.hand);
      });
      const minC = Math.min(attachCost(move), ...same.map(attachCost));
      const d = attachCost(move) - minC;
      if (d > 0) {
        score -= d;
        tags.push("fhAttach");
      }
    }
    if (ctx.leading && enemyShort >= 4 && !isPass(move) && !isBombLike(move.combo) && ((_g = move.combo) == null ? void 0 : _g.type) !== TYPES.SINGLE && ((_h = move.combo) == null ? void 0 : _h.rank) != null) {
      const st = (m) => Math.min(singleStrength(m.combo.rank, levelRank), 16);
      const same = (allMoves || []).filter((m) => {
        var _a2;
        return ((_a2 = m.combo) == null ? void 0 : _a2.type) === move.combo.type && m.cards.length === move.cards.length && !isBombLike(m.combo) && m.combo.rank != null;
      });
      const d = st(move) - Math.min(st(move), ...same.map(st));
      if (d > 0) {
        score -= Math.min(12, 0.8 * d);
        tags.push("leadSmallSame");
      }
    }
    const partnerCountS = (_j = (ctx.remainingSeatCounts || [])[(((_i = ctx.seat) != null ? _i : 0) + 2) % 4]) != null ? _j : 27;
    const bombRanks0 = new Set([...byRank.entries()].filter(([, n]) => n >= 4).map(([r]) => r));
    const touchesBomb0 = (m) => (m.cards || []).some((c) => bombRanks0.has(c.rank));
    const unfollowable = (m) => {
      var _a2;
      return m && !isPass(m) && !isBombLike(m.combo) && !touchesBomb0(m) && (((_a2 = m.cards) == null ? void 0 : _a2.length) || 0) > enemyShort;
    };
    const shapeFirst = ctx.leading && enemyShort <= 2 && (partnerCountS >= 3 || partnerCountS === 0 || partnerCountS === 2 && enemyShort <= 1) && (allMoves || []).some(unfollowable);
    const bigPlanLead = ctx.leading && R7("R7_NOSB", 1) && !!bigPlanFor(ctx);
    if (ctx.leading && hasBomb && !shapeFirst) {
      if (!bigPlanLead && isOrphanSingleMove(move, byRank) && !isControlRank(move.combo.rank, levelRank)) {
        score += 60;
        tags.push("holdBombLead");
      }
      if (isBombLike(move.combo) && enemyShort > 1) {
        if (enemyShort >= 4 && !emptiesHand(move, ctx.hand) && bombClearOk(hand, move, levelRank)) {
          tags.push("bombClear");
        } else {
          score -= 80;
          tags.push("holdBombLead");
        }
      }
      if (((_k = move.combo) == null ? void 0 : _k.type) === TYPES.STRAIGHT || ((_l = move.combo) == null ? void 0 : _l.type) === TYPES.PAIR_SEQ || ((_m = move.combo) == null ? void 0 : _m.type) === TYPES.TRIPLE_SEQ) {
        score -= 55;
        tags.push("holdBombLead");
      }
    }
    if (ctx.leading && enemyShort <= 2 && isBombLike(move.combo) && !emptiesHand(move, ctx.hand)) {
      const alt = (allMoves || []).some((m) => {
        var _a2;
        return !isBombLike(m.combo) && (((_a2 = m.cards) == null ? void 0 : _a2.length) || 0) > enemyShort;
      });
      if (alt) {
        score -= 120;
        tags.push("keepBombForControl");
      }
    }
    if (shapeFirst && unfollowable(move)) {
      score += 60 + 25 * Math.min(move.cards.length, 6);
      const restN = minPlays(restAfter(ctx.hand, move), levelRank);
      score -= 20 * restN;
      if (restN <= 1 && ((_n = move.combo) == null ? void 0 : _n.rank)) score += 4 * singleStrength(move.combo.rank, levelRank);
      if (partnerCountS === 2 && ((_o = move.combo) == null ? void 0 : _o.type) === TYPES.PAIR) score += 100 - 3 * Math.min(singleStrength(move.combo.rank, levelRank), 15);
      tags.push("shortEnemyShape");
    }
    if (ctx.leading && enemyShort <= 2) {
      if (((_p = move.combo) == null ? void 0 : _p.type) === TYPES.TRIPLE && !shapeFirst) {
        if (hand.length <= 6) {
          score += enemyShort <= 1 ? 140 : 80;
          tags.push("shortEnemyTriple");
        } else {
          score -= 55;
          tags.push("noSplitTriple");
        }
      }
      if ((((_q = move.combo) == null ? void 0 : _q.type) === TYPES.PAIR || ((_r = move.combo) == null ? void 0 : _r.type) === TYPES.SINGLE) && (byRank.get(move.combo.rank) || 0) >= 3) {
        score -= 80;
        tags.push("keepTripleIntact");
      }
      const pushOrphan = !shapeFirst && (hasBomb || enemyShort <= 1 || enemyShort <= 2 && hand.length >= 7);
      if (pushOrphan && isOrphanSingleMove(move, byRank) && !isControlRank(move.combo.rank, levelRank)) {
        if (enemyShort <= 1 && hand.length <= 6 && !hasBomb) {
          score -= 15;
        } else {
          const strength = singleStrength(move.combo.rank, levelRank);
          score += 50 + Math.max(0, 14 - strength) * 3;
          tags.push("shortEnemyLead");
        }
      }
      if (((_s = move.combo) == null ? void 0 : _s.type) === TYPES.SINGLE && isControlRank(move.combo.rank, levelRank) && hand.length > 4) {
        score -= 55;
        tags.push("noLeadControl");
      }
    }
    const hasLevel = (byRank.get(levelRank) || 0) > 0;
    const hasOrphanNonLevel = [...byRank.entries()].some(
      ([r, n]) => n === 1 && r !== levelRank && !isControlRank(r, levelRank)
    );
    if (ctx.leading && !hasBomb && (((_t = move.combo) == null ? void 0 : _t.type) === TYPES.PAIR_SEQ || ((_u = move.combo) == null ? void 0 : _u.type) === TYPES.STRAIGHT || ((_v = move.combo) == null ? void 0 : _v.type) === TYPES.TRIPLE_SEQ)) {
      if (hasLevel && hasOrphanNonLevel && ((_w = move.combo) == null ? void 0 : _w.type) === TYPES.STRAIGHT) {
        score -= 20;
        tags.push("holdLevelOverStraight");
      } else {
        score += 95;
        tags.push("keepShape");
      }
    }
    if (ctx.leading && !bigPlanLead && hasBomb && isOrphanSingleMove(move, byRank) && !isControlRank(move.combo.rank, levelRank)) {
      const strength = singleStrength(move.combo.rank, levelRank);
      score += Math.max(0, 12 - strength) * 2;
    }
    if (ctx.leading && ((_x = move.combo) == null ? void 0 : _x.type) === TYPES.SINGLE && move.combo.rank === levelRank) {
      const hasNonLevelOrphan = [...byRank.entries()].some(
        ([r, n]) => n === 1 && r !== levelRank && !isControlRank(r, levelRank)
      );
      const hasSmallOrphan = [...byRank.entries()].some(([r, n]) => {
        if (n !== 1 || r === levelRank) return false;
        return singleStrength(r, levelRank) < singleStrength(levelRank, levelRank);
      });
      if (hasSmallOrphan || hasNonLevelOrphan) {
        score -= 50;
        tags.push("holdLevel");
      }
    }
    const stoppingShort = !ctx.leading && !!ctx.previous && enemyShort <= 2 && !partnerOwnsPrevious(ctx, partner);
    if (stoppingShort && !isPass(move) && !isBombLike(move.combo)) {
      score += 40;
      tags.push("stopShort");
    }
    const feedShape = ctx.leading && (partnerCountS === 1 && ((_y = move.combo) == null ? void 0 : _y.type) === TYPES.SINGLE || partnerCountS === 2 && ((_z = move.combo) == null ? void 0 : _z.type) === TYPES.PAIR);
    if (moveBreaksStructure(move, struct, !ctx.leading || Boolean(handPlanFor(ctx)) && !feedShape) && !emptiesHand(move, ctx.hand) && !stoppingShort) {
      score -= 35;
      tags.push("keepStruct");
    }
    if (!ctx.leading && !isPass(move) && ((_A = move.combo) == null ? void 0 : _A.type) === TYPES.SINGLE && ((_B = ctx.previous) == null ? void 0 : _B.type) === TYPES.SINGLE) {
      score += singleStrength(move.combo.rank, levelRank) * 0.05;
      tags.push("followUp");
    }
    const seatCounts = ctx.remainingSeatCounts || [];
    const partnerCount = (_D = seatCounts[(((_C = ctx.seat) != null ? _C : 0) + 2) % 4]) != null ? _D : 27;
    const cappedStrength = (r) => Math.min(singleStrength(r, levelRank), 15);
    const toBeatPartner = !ctx.leading && partnerOwnsPrevious(ctx, partner);
    let winThenGood = null;
    if (!ctx.leading && !isPass(move) && !isBombLike(move.combo) && ctx.previous && !partner && !emptiesHand(move, ctx.hand) && minPlays(hand, levelRank) > 1) {
      const rest0 = restAfter(hand, move);
      winThenGood = (rest0.length <= 12 ? finishLine(rest0, ctx, rest0.length <= 8 ? 2 : 1, laCache(ctx)) : null) || feedAfter(move, ctx);
      if (winThenGood) tags.push(`winThen:${winThenGood}`);
    }
    if (!ctx.leading && isBombLike(move.combo) && ctx.previous && isBombLike(ctx.previous) && !partner && enemyShort >= 4 && !emptiesHand(move, ctx.hand) && !moveFinish(move, ctx, laCache(ctx))) {
      score -= 60;
      tags.push("noCounterBomb");
    }
    if (!ctx.leading && isBombLike(move.combo) && ctx.previous && ORDINARY.has(ctx.previous.type) && enemyShort >= 4 && !emptiesHand(move, ctx.hand)) {
      score -= 150;
      tags.push("saveBomb");
    }
    const earlyMidFollow = !ctx.leading && !!ctx.previous && !partner && !toBeatPartner && enemyShort >= 6 && hand.length >= 10 && (ctx.previous.type === TYPES.SINGLE || ctx.previous.type === TYPES.PAIR);
    const followCost = (m) => earlyFollowCost(m, ctx.previous, hand, levelRank);
    if (!ctx.leading && !toBeatPartner && !isPass(move) && (((_E = move.combo) == null ? void 0 : _E.type) === TYPES.SINGLE || ((_F = move.combo) == null ? void 0 : _F.type) === TYPES.PAIR) && ((_G = ctx.previous) == null ? void 0 : _G.type) === move.combo.type) {
      const st = cappedStrength(move.combo.rank);
      if (enemyShort <= 2) score += st * 3;
      else score += (15 - st) * 2;
      if (move.combo.type === TYPES.SINGLE && (byRank.get(move.combo.rank) || 0) >= 2 && // 早中盘只认“可用的孤单”（非级牌/王/逢人配）；只剩王、级牌孤单时拆对跟不算浪费
      (allMoves || []).some((m) => isOrphanSingleMove(m, byRank) && (!earlyMidFollow || followCost(m) === 0))) {
        score -= enemyShort <= 1 ? 0 : 40;
      } else if (
        // 敌家都 ≥3 张、没有孤单能跟：拆对/三张出单不如过牌（拿到牌权也走不完时）
        move.combo.type === TYPES.SINGLE && enemyShort >= 3 && !winThenGood && (hand.filter((c) => c.rank === move.combo.rank && !(c.rank === levelRank && c.suit === "H")).length >= 2 || move.combo.rank === levelRank && (byRank.get(levelRank) || 0) >= 2)
      ) {
        score -= earlyMidFollow ? 10 : 30;
        tags.push("breakNoOrphan");
      }
      const need0 = move.combo.type === TYPES.SINGLE ? 1 : 2;
      if (enemyShort >= 3 && (byRank.get(move.combo.rank) || 0) === 3 && (allMoves || []).some((m) => {
        var _a2;
        return ((_a2 = m.combo) == null ? void 0 : _a2.type) === move.combo.type && !usesWild(m, levelRank) && (byRank.get(m.combo.rank) || 0) === need0;
      })) {
        score -= 25;
        tags.push("keepTripleFollow");
      }
      tags.push("followSize");
    }
    if (!ctx.leading && enemyShort >= 4 && ((_H = move.combo) == null ? void 0 : _H.type) === TYPES.SINGLE && (move.combo.rank === levelRank || move.combo.rank === "BJ" || move.combo.rank === "RJ") && !emptiesHand(move, ctx.hand) && !winThenGood) {
      const tempo = hand.length <= 12 || partnerCountS <= 7;
      const bigPrev = ((_I = ctx.previous) == null ? void 0 : _I.type) === TYPES.SINGLE && singleStrength(ctx.previous.rank, levelRank) >= singleStrength("J", levelRank);
      score -= tempo ? bigPrev ? 15 : 45 : 80;
      tags.push(tempo ? "keepControlSoft" : "keepControl");
    }
    if (!ctx.leading && ctx.previous && !partner && !toBeatPartner && !isPass(move) && !isBombLike(move.combo) && !emptiesHand(move, ctx.hand) && (hand.length <= 12 || partnerCountS <= 7) && enemyShort >= 3 && move.combo.type === TYPES.SINGLE && ctx.previous.type === TYPES.SINGLE && isJokerRank(move.combo.rank) && singleStrength(ctx.previous.rank, levelRank) >= singleStrength("J", levelRank)) {
      score += winThenGood ? 40 : 20;
      tags.push("tempoTake");
    }
    if (R7("R7_CT", 1) && !ctx.leading && ctx.previous && !partner && !toBeatPartner && !isPass(move) && !emptiesHand(move, ctx.hand) && hand.length <= 12 && enemyShort >= 3 && (((_J = move.combo) == null ? void 0 : _J.type) === TYPES.SINGLE || ((_K = move.combo) == null ? void 0 : _K.type) === TYPES.PAIR) && ctx.previous.type === move.combo.type && (move.combo.rank === levelRank || isJokerRank(move.combo.rank)) && !usesWild(move, levelRank) && enemyShort <= R7("R7_CTE", 13) && // 只奖励“最便宜够用”的控制牌：有更小的级牌/王同型能压就不加（例 dev-r6 R146、dev-real d001）
    !(R7("R7_CTC", 1) && (allMoves || []).some((m) => {
      var _a2;
      return !isPass(m) && ((_a2 = m.combo) == null ? void 0 : _a2.type) === move.combo.type && !isBombLike(m.combo) && (m.combo.rank === levelRank || isJokerRank(m.combo.rank)) && !usesWild(m, levelRank) && singleStrength(m.combo.rank, levelRank) < singleStrength(move.combo.rank, levelRank);
    }))) {
      const plan = handPlanFor(ctx);
      const comp = plan && plan.comps.find((c) => c.key === comboKey(move));
      if (comp && comp.role === "control") {
        const p = winProb(move, ctx);
        if (p >= R7("R7_CTP", 0.85)) {
          score += R7("R7_CTB", 40);
          tags.push("controlTempo");
        }
      }
    }
    if (!ctx.leading && enemyShort >= 4 && ((_L = move.combo) == null ? void 0 : _L.type) === TYPES.PAIR && (move.combo.rank === levelRank || isJokerRank(move.combo.rank)) && !emptiesHand(move, ctx.hand) && !winThenGood) {
      score -= 80;
      tags.push("keepControlPair");
    }
    if (earlyMidFollow) {
      const smallPrev = singleStrength(ctx.previous.rank, levelRank) <= singleStrength("10", levelRank) && ctx.previous.rank !== levelRank;
      if (!isPass(move)) {
        const cost = followCost(move);
        if (cost != null) {
          score += [30, 12, -5][cost] + (smallPrev ? 10 : 0);
          tags.push(`activeFollow:${cost}`);
        }
      } else if ((allMoves || []).some((m) => {
        var _a2;
        return !isPass(m) && ((_a2 = followCost(m)) != null ? _a2 : 9) <= 1;
      })) {
        score -= smallPrev ? 25 : 12;
        tags.push("passiveEarly");
      }
      const spare = (m) => {
        var _a2;
        return !isPass(m) && ((_a2 = m.combo) == null ? void 0 : _a2.type) === TYPES.SINGLE && ctx.previous.type === TYPES.SINGLE && !smallPrev && (m.combo.rank === levelRank || m.combo.rank === "BJ" || m.combo.rank === "RJ") && !usesWild(m, levelRank) && hand.filter((c) => c.rank === m.combo.rank && !isWildCard(c, levelRank)).length === 1 && hand.filter((c) => isJokerRank(c.rank) || c.rank === levelRank && !isWildCard(c, levelRank)).length >= (m.combo.rank === "RJ" ? 4 : 3);
      };
      if (spare(move)) {
        score += 90;
        tags.push("spareControl");
      } else if (isPass(move) && (allMoves || []).some(spare)) {
        score -= 12;
        tags.push("passiveEarly");
      }
    }
    if (!ctx.leading && !isPass(move) && ((_M = move.combo) == null ? void 0 : _M.type) === TYPES.SINGLE && ((_N = ctx.previous) == null ? void 0 : _N.type) === TYPES.SINGLE && !emptiesHand(move, ctx.hand)) {
      const restN = minPlays(restAfter(hand, move), levelRank);
      if (restN <= 1) {
        score += 40 * winProb(move, ctx);
        tags.push("strongBeforeLast");
      } else if (enemyShort >= 2) {
        const r = move.combo.rank;
        score -= r === "RJ" ? 20 : r === "BJ" ? 10 : 0;
      }
    }
    if (!ctx.leading && !isPass(move) && !emptiesHand(move, ctx.hand) && !isBombLike(move.combo)) {
      if (enemyShort >= 3 && !winThenGood) {
        const before = minPlays(hand, levelRank);
        if (before <= 2 && minPlays(restAfter(hand, move), levelRank) >= before) {
          score -= 150;
          tags.push("keepFinish");
        }
      }
      if ((enemyShort >= 4 || enemyShort >= 3 && (((_O = move.cards) == null ? void 0 : _O.length) || 0) >= 3) && usesWild(move, levelRank) && !winThenGood) {
        score -= 100;
        tags.push("keepWild");
      } else if (enemyShort >= 2 && wildFillers(move, levelRank) > 0) {
        const natAlt = (allMoves || []).some((m) => {
          var _a2, _b2;
          return !isPass(m) && !isBombLike(m.combo) && ((_a2 = m.combo) == null ? void 0 : _a2.type) === ((_b2 = move.combo) == null ? void 0 : _b2.type) && !wildFillers(m, levelRank);
        });
        const nf = wildFillers(move, levelRank);
        if (natAlt || nf >= 2) {
          score -= nf >= 2 ? 80 : 40;
          tags.push("wildWaste");
        }
      }
    }
    if (ctx.leading && !isPass(move) && !isBombLike(move.combo) && enemyShort >= 3 && !emptiesHand(move, ctx.hand)) {
      if (usesWild(move, levelRank)) {
        score -= 60;
        tags.push("leadNoWild");
      } else if (((_P = move.combo) == null ? void 0 : _P.type) === TYPES.FULLHOUSE && move.combo.rank === levelRank) {
        score -= 30;
        tags.push("leadNoLevelTriple");
      }
    }
    if (ctx.leading && !isPass(move)) {
      const poolNonSingle = (allMoves || []).some(
        (m) => {
          var _a2;
          return !isPass(m) && !isBombLike(m.combo) && ((_a2 = m.combo) == null ? void 0 : _a2.type) !== TYPES.SINGLE;
        }
      );
      const hasOrphan = [...byRank.values()].some((n) => n === 1);
      const nextEnemyN = (_R = seatCounts[(((_Q = ctx.seat) != null ? _Q : 0) + 1) % 4]) != null ? _R : 27;
      const feedOk1 = partnerCount === 1 && !enemyCutsBeforePartner(ctx, 1);
      const feedPairAvail = partnerCount === 2 && enemyShort >= 3 && (allMoves || []).some((m) => {
        var _a2;
        return ((_a2 = m.combo) == null ? void 0 : _a2.type) === TYPES.PAIR && [2, 3].includes(byRank.get(m.combo.rank) || 0) && !usesWild(m, levelRank) && singleStrength(m.combo.rank, levelRank) <= 10;
      });
      if (feedOk1 && ((_S = move.combo) == null ? void 0 : _S.type) === TYPES.SINGLE) {
        const lowOrphans = [...byRank.entries()].filter(([r, n]) => n === 1 && singleStrength(r, levelRank) <= 8);
        const isOrphan = isOrphanSingleMove(move, byRank);
        score += 260 - cappedStrength(move.combo.rank) * 6;
        if (lowOrphans.length && !isOrphan) score -= 120;
        tags.push("feedPartner");
      }
      if (feedPairAvail && ((_T = move.combo) == null ? void 0 : _T.type) === TYPES.PAIR && [2, 3].includes(byRank.get(move.combo.rank) || 0) && !usesWild(move, levelRank)) {
        score += 150 - cappedStrength(move.combo.rank) * 5 - ((byRank.get(move.combo.rank) || 0) === 3 ? 35 : 0) + 40;
        tags.push("feedPartnerPair");
      }
      if (hand.length === 2 && partnerCount !== 1 && ((_U = move.combo) == null ? void 0 : _U.type) === TYPES.SINGLE && !(allMoves || []).some((m) => emptiesHand(m, ctx.hand))) {
        const other = hand.find((c) => !move.cards.some((x) => x.id === c.id));
        if (other && singleStrength(move.combo.rank, levelRank) > singleStrength(other.rank, levelRank)) {
          score += 200;
          tags.push("bigFirstTwo");
        }
      }
      if (enemyShort === 2 && partnerCount > 2 && !(allMoves || []).some((m) => emptiesHand(m, ctx.hand))) {
        if (((_V = move.combo) == null ? void 0 : _V.type) === TYPES.PAIR) score -= 70;
        if (((_W = move.combo) == null ? void 0 : _W.type) === TYPES.SINGLE && isOrphanSingleMove(move, byRank) && !(allMoves || []).some((m) => {
          var _a2;
          return !isBombLike(m.combo) && (((_a2 = m.cards) == null ? void 0 : _a2.length) || 0) >= 3;
        })) score += 30;
        tags.push("vsTwoNoPair");
      }
      if (enemyShort === 2 && partnerCount !== 1 && !isBombLike(move.combo) && (((_X = move.cards) == null ? void 0 : _X.length) || 0) >= 3 && !(allMoves || []).some((m) => emptiesHand(m, ctx.hand))) {
        score += 90;
        tags.push("unfollowableVsTwo");
      }
      if (enemyShort >= 4 && partnerCount !== 1 && !feedPairAvail && !bigPlanLead && isOrphanSingleMove(move, byRank) && singleStrength(move.combo.rank, levelRank) <= 8) {
        score += 60 + (14 - singleStrength(move.combo.rank, levelRank)) * 3;
        tags.push("smallFirst");
      }
      if (enemyShort <= 1 && !feedOk1 && !poolNonSingle && ((_Y = move.combo) == null ? void 0 : _Y.type) === TYPES.SINGLE) {
        score += cappedStrength(move.combo.rank) * 12 + 55;
        if (isControlRank(move.combo.rank, levelRank)) score += 55;
        tags.push("bigFirstVsLast");
      }
      if (enemyShort === 2 && !hasOrphan && partnerCount !== 1) {
        if (((_Z = move.combo) == null ? void 0 : _Z.type) === TYPES.SINGLE) score += 120;
        if (((__ = move.combo) == null ? void 0 : __.type) === TYPES.PAIR) score -= 60;
        tags.push("vsTwoSingle");
      }
    }
    if (ctx.leading && !isPass(move)) tags.push("control");
    if (ctx.leading && isBombLike(move.combo) && enemyShort >= 4 && !emptiesHand(move, ctx.hand) && (allMoves || []).some((m) => !isPass(m) && !isBombLike(m.combo))) {
      if (bombClearOk(hand, move, levelRank)) {
        if (!tags.includes("bombClear")) tags.push("bombClear");
      } else {
        score -= 40 + 20 * wildFillers(move, levelRank);
        tags.push("leadBombLate");
      }
    }
    if (ctx.leading && !isPass(move) && !emptiesHand(move, ctx.hand)) {
      const pr = planLeadScore(move, ctx, allMoves, { enemyShort, partnerCount, byRank, levelRank });
      score += pr.score;
      tags.push(...pr.tags);
    }
    if (!isPass(move) && !emptiesHand(move, ctx.hand)) {
      let fin = moveFinish(move, ctx, laCache(ctx));
      if (fin && ctx.leading && isBombLike(move.combo) && enemyShort >= 6) fin = null;
      const pc1 = (ctx.remainingSeatCounts || [])[(((_$ = ctx.seat) != null ? _$ : 0) + 2) % 4];
      if (fin === "likely" && ctx.leading && pc1 === 1) fin = null;
      if (fin) {
        score += fin === "sure" ? 160 : fin === "bombBack" ? 115 : 100;
        tags.push(`forceFinish:${fin}`);
      } else if (!ctx.leading && ctx.previous && !resolvePartnerCombo(ctx)) {
        const feed = feedAfter(move, ctx);
        const bombOk = !isBombLike(move.combo) || enemyShort <= 3;
        if (feed && bombOk) {
          const p = winProb(move, ctx);
          if (p >= 0.3) {
            score += Math.round(70 * p) - (isBombLike(move.combo) ? 20 : 0);
            tags.push(`controlFeed:${feed}`);
          }
        }
      }
    }
    if (!ctx.leading && ctx.previous && isPass(move) && partner) {
      const seatP = (_aa = ctx.seat) != null ? _aa : 0;
      const cP = ctx.remainingSeatCounts || [];
      const sizeP = ((_ca = (_ba = ctx.previous) == null ? void 0 : _ba.cards) == null ? void 0 : _ca.length) || ((_da = ctx.previous) == null ? void 0 : _da.size) || 1;
      const nextE = cP[(seatP + 1) % 4];
      const hasBlock = (allMoves || []).some((m) => !isPass(m) && !isBombLike(m.combo));
      if (nextE > 0 && nextE === sizeP && hasBlock) {
        const pw = winProb({ combo: ctx.previous, cards: new Array(sizeP).fill(null) }, ctx);
        if (pw < 0.7) {
          score -= Math.round(50 * (1 - pw));
          tags.push("partnerExposed");
        }
      }
    }
    if (!ctx.leading && ctx.previous && !isPass(move) && !emptiesHand(move, ctx.hand)) {
      const cb = criticalBlock(ctx, partner);
      if (cb) {
        const others = (allMoves || []).filter((m) => !isPass(m) && m !== move);
        const sf = safety(move, ctx);
        if (!isBombLike(move.combo)) {
          const wildM = usesWild(move, levelRank);
          let k = 1;
          if (partner) {
            const sizeP = ((_fa = (_ea = ctx.previous) == null ? void 0 : _ea.cards) == null ? void 0 : _fa.length) || ((_ga = ctx.previous) == null ? void 0 : _ga.size) || 1;
            const pw = winProb({ combo: ctx.previous, cards: new Array(sizeP).fill(null) }, ctx);
            k = Math.max(0, Math.min(1, (1 - pw) / 0.5));
          }
          if (sf === "sure") {
            score += 60 * k;
            tags.push("blockSure");
          } else if (sf === "likely") {
            score += 48 * k;
            tags.push("blockLikely");
          } else if (!wildM) {
            const p = winProb(move, ctx);
            if (p >= 0.4) {
              score += Math.round(45 * Math.min(p, 0.85) * k);
              tags.push("blockProb");
            }
          }
        } else {
          const natSure = others.some((m) => !isBombLike(m.combo) && safety(m, ctx) === "sure" && !usesWild(m, levelRank));
          if (natSure) {
            score -= 90;
            tags.push("blockNoBomb");
          } else if (usesWild(move, levelRank) && others.some((m) => isBombLike(m.combo) && !usesWild(m, levelRank))) {
            score -= 15;
            tags.push("blockNatBomb");
          }
          if (wildFillers(move, levelRank) > 0) {
            const nat = others.filter((m) => !isBombLike(m.combo) && !usesWild(m, levelRank));
            const bp = Math.max(0, ...nat.map((m) => winProb(m, ctx)));
            if (bp >= 0.45) {
              score -= Math.round(140 * bp);
              tags.push("blockNatural");
            }
          }
        }
      }
    }
    if (isBombLike(move.combo) && !emptiesHand(move, hand)) {
      const alts = (allMoves || []).filter((m) => m !== move && isBombLike(m.combo) && !emptiesHand(m, hand));
      if (alts.length) {
        let best = null, bc = Infinity;
        for (const m of alts) {
          const c = bombCost(m, levelRank);
          if (c < bc) {
            bc = c;
            best = m;
          }
        }
        const d = bombCost(move, levelRank) - bc;
        if (d > 0) {
          const FIN = { sure: 3, bombBack: 2, likely: 1 };
          const fm = FIN[moveFinish(move, ctx, laCache(ctx))] || 0;
          const fb = FIN[moveFinish(best, ctx, laCache(ctx))] || 0;
          if (fm <= fb) {
            score -= Math.min(60, d);
            tags.push(wildFillers(move, levelRank) > wildFillers(best, levelRank) ? "bombWildPad" : "bombOversize");
          }
        }
      }
    }
    return { score, tags };
  }
  function bombCost(m, levelRank) {
    const c = m.combo;
    const tier = c.type === TYPES.BOMB && (c.rocket || c.rank === "RJ") ? 12 : c.type === TYPES.STRAIGHT_FLUSH ? 1.5 : (c.bombSize || c.size || m.cards.length) - 4;
    return 20 * wildFillers(m, levelRank) + 6 * tier + 0.5 * Math.min(singleStrength(c.rank, levelRank) || 0, 16);
  }
  function bombClearOk(hand, move, levelRank) {
    const rest = restAfter(hand, move);
    const mp = minPlays(rest, levelRank);
    if (mp <= 1) return true;
    if (mp > 2) return false;
    const nat = /* @__PURE__ */ new Map();
    for (const c of rest) {
      if (isJokerRank(c.rank) || isWildCard(c, levelRank)) continue;
      nat.set(c.rank, (nat.get(c.rank) || 0) + 1);
    }
    return [...nat.values()].some((n) => n >= 4);
  }
  function enemyCutsBeforePartner(ctx, size = 1) {
    var _a, _b;
    const seat = (_a = ctx.seat) != null ? _a : 0;
    const partner = (seat + 2) % 4;
    const c = ctx.remainingSeatCounts || [];
    for (let i = 1; i < 4; i++) {
      const s = (seat + i) % 4;
      if (s === partner) break;
      const n = (_b = c[s]) != null ? _b : 27;
      if (n > 0 && n <= size) return true;
    }
    return false;
  }
  function liveEnemyMin(ctx) {
    var _a;
    const counts = ctx.remainingSeatCounts || ctx.opponentCounts || [27, 27, 27, 27];
    const seat = (_a = ctx.seat) != null ? _a : 0;
    const live = [(seat + 1) % 4, (seat + 3) % 4].map((s) => {
      var _a2;
      return (_a2 = counts[s]) != null ? _a2 : 27;
    }).filter((x) => x > 0);
    return live.length ? Math.min(...live) : 27;
  }
  function earlyFollowCost(m, prev, hand, levelRank) {
    if (!m || isPass(m) || !prev || !m.combo || m.combo.type !== prev.type || isBombLike(m.combo)) return null;
    if (usesWild(m, levelRank)) return null;
    const r = m.combo.rank;
    if (r === levelRank || isJokerRank(r)) return null;
    const n = (hand || []).filter((c) => c.rank === r && !isWildCard(c, levelRank)).length;
    const need = m.combo.type === TYPES.SINGLE ? 1 : 2;
    if (n >= 4 || n < need) return null;
    return n - need;
  }
  function criticalBlock(ctx, partner) {
    var _a, _b, _c, _d;
    const seat = (_a = ctx.seat) != null ? _a : 0;
    const c = ctx.remainingSeatCounts || [];
    const e1 = c[(seat + 1) % 4], e3 = c[(seat + 3) % 4];
    const size = ((_c = (_b = ctx.previous) == null ? void 0 : _b.cards) == null ? void 0 : _c.length) || ((_d = ctx.previous) == null ? void 0 : _d.size) || 1;
    if (e1 > 0 && e1 <= 1 || e3 > 0 && e3 <= 1) return true;
    if (partner && e1 > 0 && e1 === size) return true;
    return false;
  }
  var PLAN_CACHE = /* @__PURE__ */ new WeakMap();
  function planCache(ctx) {
    let c = PLAN_CACHE.get(ctx);
    if (!c) {
      c = /* @__PURE__ */ new Map();
      PLAN_CACHE.set(ctx, c);
    }
    return c;
  }
  function handPlanFor(ctx) {
    const pc = planCache(ctx);
    if (!pc.has("__plan")) pc.set("__plan", decompose(ctx.hand || [], ctx.levelRank || "2", pc));
    return pc.get("__plan");
  }
  var R7 = (k, d) => {
    var _a;
    const v = typeof process !== "undefined" ? (_a = process.env) == null ? void 0 : _a[k] : void 0;
    return v == null ? d : Number(v);
  };
  var BIG_PLAN_CACHE = /* @__PURE__ */ new WeakMap();
  function bigPlanCache(ctx) {
    let c = BIG_PLAN_CACHE.get(ctx);
    if (!c) {
      c = /* @__PURE__ */ new Map();
      BIG_PLAN_CACHE.set(ctx, c);
    }
    return c;
  }
  function bigPlanFor(ctx) {
    const hand = ctx.hand || [];
    if (hand.length <= 14 || !R7("R7_PLAN", 1)) return null;
    const pc = bigPlanCache(ctx);
    if (!pc.has("__plan")) pc.set("__plan", decomposeCounts(hand, ctx.levelRank || "2", pc));
    return pc.get("__plan");
  }
  function planLeadScore(move, ctx, allMoves, { enemyShort, partnerCount, byRank, levelRank }) {
    var _a, _b, _c, _d, _e, _f;
    const tags = [];
    let score = 0;
    const hand = ctx.hand || [];
    const big = bigPlanFor(ctx);
    const plan = big || handPlanFor(ctx);
    if (!plan || plan.plays < 2) return { score, tags };
    const cache = big ? bigPlanCache(ctx) : planCache(ctx);
    const rest = restAfter(hand, move);
    const rp = big ? decomposeCounts(rest, levelRank, cache, big.counts) : decompose(rest, levelRank, cache);
    if (rp) {
      const one = decompose(move.cards, levelRank, cache);
      const moveCost = isBombLike(move.combo) ? 0.3 : one && one.plays === 1 ? one.cost : 1;
      const delta = Math.max(0, rp.cost + moveCost - plan.cost);
      const feedMove = partnerCount === 1 && ((_a = move.combo) == null ? void 0 : _a.type) === TYPES.SINGLE || partnerCount === 2 && ((_b = move.combo) == null ? void 0 : _b.type) === TYPES.PAIR;
      if (delta > 0.04 && !feedMove) {
        score -= Math.min(90, 45 * delta);
        tags.push("offPlan");
      }
    }
    const comps = plan.comps;
    const isComp = comps.some((c) => c.key === comboKey(move));
    const partnerFeeding = partnerCount === 1 || partnerCount === 2;
    const weak = comps.filter((c) => c.role !== "bomb" && c.role !== "control");
    const enemyMax = Math.max(...(ctx.remainingSeatCounts || []).filter((_, i) => {
      var _a2;
      return i % 2 !== ((_a2 = ctx.seat) != null ? _a2 : 0) % 2;
    }).filter((c) => c > 0), 0);
    if (enemyShort >= 3 && enemyShort <= 4 && !partnerFeeding && isComp) {
      const big2 = weak.filter((c) => c.move.cards.length > enemyMax);
      if (big2.length && comboKey(big2.sort((x, y) => y.move.cards.length - x.move.cards.length)[0].move) === comboKey(move)) {
        score += 60;
        tags.push("planUnfollowable");
      }
    }
    if (enemyShort >= 3 && !partnerFeeding && weak.length && isComp) {
      const LONG = /* @__PURE__ */ new Set([TYPES.STRAIGHT, TYPES.PAIR_SEQ, TYPES.TRIPLE_SEQ]);
      const longU = weak.filter((c) => {
        var _a2;
        return LONG.has((_a2 = c.move.combo) == null ? void 0 : _a2.type) && c.move.cards.length >= 5;
      });
      const first = longU.length ? longU[0] : weak[0];
      if (first.key === comboKey(move)) {
        score += longU.length ? big ? R7("R7_UNIT", 100) : 100 : big ? R7("R7_WEAK", 45) : 45;
        tags.push(longU.length ? "planUnitFirst" : "planWeakFirst");
      } else if (((_c = comps.find((c) => c.key === comboKey(move))) == null ? void 0 : _c.role) === "control" && weak.length >= 1) {
        score -= 20;
        tags.push("planKeepControl");
      }
    }
    if (plan.plays === 2 && comps.every((c) => c.role !== "bomb") && isComp && enemyShort >= 2 && !partnerFeeding) {
      const [a, b] = comps.map((c) => c.move);
      const pa = winProb(a, ctx), pb = winProb(b, ctx);
      const strong = pa >= pb ? a : b;
      const weakU = strong === a ? b : a;
      if (enemyShort >= 3 && ((_d = strong.combo) == null ? void 0 : _d.type) === TYPES.SINGLE && (((_e = weakU.cards) == null ? void 0 : _e.length) || 0) >= 2) {
        if (comboKey(weakU) === comboKey(move) && Math.abs(pa - pb) > 0.02) {
          score += 70;
          tags.push("planWeakFirstTwo");
        }
      } else if (comboKey(strong) === comboKey(move) && Math.abs(pa - pb) > 0.02) {
        score += 70;
        tags.push("planStrongFirst");
      }
    }
    if (enemyShort === 2 && !partnerFeeding && ((_f = move.combo) == null ? void 0 : _f.type) === TYPES.SINGLE) {
      const shaped = (allMoves || []).some((m) => {
        var _a2;
        return !isPass(m) && !isBombLike(m.combo) && (((_a2 = m.cards) == null ? void 0 : _a2.length) || 0) >= 2 && !(m.cards || []).some((c) => (byRank.get(c.rank) || 0) >= 4);
      });
      if (!shaped) {
        const ctrl = (r) => r === levelRank || r === "BJ" || r === "RJ";
        const orph = (allMoves || []).filter((m) => {
          var _a2;
          return ((_a2 = m.combo) == null ? void 0 : _a2.type) === TYPES.SINGLE && (byRank.get(m.combo.rank) || 0) === 1 && !ctrl(m.combo.rank);
        });
        if (orph.length && (byRank.get(move.combo.rank) || 0) === 1 && !ctrl(move.combo.rank)) {
          const top = Math.max(...orph.map((m) => singleStrength(m.combo.rank, levelRank)));
          if (singleStrength(move.combo.rank, levelRank) === top) {
            score += 60;
            tags.push("vsTwoBigSingle");
          }
        }
      }
    }
    return { score, tags };
  }
  function decide(ctx = {}) {
    var _a, _b;
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const belief = ctx.belief || buildBelief(ctx);
    const full = { ...ctx, belief };
    full.partnerCombo = resolvePartnerCombo(full);
    full._struct = detectStructures(full.hand || [], full.levelRank || "2");
    let cands = generateCandidates(full);
    if (!cands.length) {
      const move = { cards: [], combo: { type: TYPES.PASS, rank: null, size: 0 } };
      return { move, reason: "无合法着法，过牌。", alternatives: [], ms: 0 };
    }
    const outs = cands.filter((m) => emptiesHand(m, full.hand));
    if (outs.length) {
      const move = outs[0];
      return {
        move,
        reason: reasonFor(move, full, ["goOut"]),
        alternatives: cands.filter((m) => m !== move).slice(0, 3),
        ms: (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0
      };
    }
    const beam = beamSearch(full, { beam: 10, timeMs: 20 });
    let pool = uniqueByCards(cands);
    const allowed = pool.filter((m) => !isForbidden(m, full, pool));
    if (allowed.length) pool = allowed;
    let best = pool[0];
    let bestS = -1e15;
    let bestTags = [];
    const ranked = [];
    for (const m of pool) {
      const { score, tags } = scoreMove(m, full, pool);
      const extra = beam.find((b) => sameMove(b.move, m));
      const s = score + (extra ? extra.value * 0.05 : 0);
      ranked.push({ move: m, score: s, tags });
      if (s > bestS) {
        bestS = s;
        best = m;
        bestTags = tags;
      }
    }
    ranked.sort((a, b) => b.score - a.score);
    if (typeof process !== "undefined" && ((_a = process.env) == null ? void 0 : _a.DECIDE_DEBUG)) for (const r of ranked.slice(0, Number(process.env.DECIDE_DEBUG) > 1 ? Number(process.env.DECIDE_DEBUG) : 6)) console.error("[decide]", (_b = r.move.combo) == null ? void 0 : _b.type, r.move.cards.map((c) => c.rank).join(""), r.score.toFixed(1), r.tags.join(","));
    const ms = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
    return {
      move: best,
      reason: reasonFor(best, full, bestTags),
      alternatives: ranked.slice(1, 4).map((r) => r.move),
      tags: bestTags,
      scored: ranked.slice(0, 40).map((r) => ({ move: r.move, tags: r.tags, score: r.score })),
      ms
    };
  }
  function sameMove(a, b) {
    var _a, _b;
    if (!a || !b) return false;
    const ka = a.cards.map((c) => c.id).sort().join(",");
    const kb = b.cards.map((c) => c.id).sort().join(",");
    return ka === kb && ((_a = a.combo) == null ? void 0 : _a.type) === ((_b = b.combo) == null ? void 0 : _b.type);
  }
  function uniqueByCards(moves) {
    const seen = /* @__PURE__ */ new Set();
    return moves.filter((m) => {
      const k = m.cards.map((c) => c.id).sort().join(",") + m.combo.type;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // engine/tributeStd.js
  var teamOf2 = (s) => s % 2;
  var NAT_LE10 = ["2", "3", "4", "5", "6", "7", "8", "9", "10"];
  var SUIT_ORD = { S: 0, H: 1, C: 2, D: 3, J: 4 };
  function tributeCard(hand, lv) {
    var _a, _b;
    let best = null;
    for (const c of hand || []) {
      if (isWildCard(c, lv)) continue;
      if (!best) {
        best = c;
        continue;
      }
      const d = singleStrength(c.rank, lv) - singleStrength(best.rank, lv);
      if (d > 0 || d === 0 && (((_a = SUIT_ORD[c.suit]) != null ? _a : 9) < ((_b = SUIT_ORD[best.suit]) != null ? _b : 9) || c.suit === best.suit && c.id < best.id)) best = c;
    }
    return best;
  }
  function isReturnEligible(c, lv) {
    return !!c && !isJokerRank(c.rank) && !isWildCard(c, lv) && NAT_LE10.includes(c.rank);
  }
  function returnOptions(hand, lv) {
    const el = (hand || []).filter((c) => isReturnEligible(c, lv));
    if (el.length) return { cards: el, fallback: false };
    const pool = (hand || []).filter((c) => !isWildCard(c, lv));
    const src = pool.length ? pool : hand || [];
    if (!src.length) return { cards: [], fallback: true };
    const min = Math.min(...src.map((c) => singleStrength(c.rank, lv)));
    return { cards: src.filter((c) => singleStrength(c.rank, lv) === min), fallback: true };
  }
  function isLegalReturn(c, hand, lv) {
    return returnOptions(hand, lv).cards.some((x) => x.id === (c == null ? void 0 : c.id));
  }
  function countRJ(hand) {
    return (hand || []).filter((c) => c.rank === JOKER_RED).length;
  }
  function planTribute(prevOrder, hands, lv) {
    if (!prevOrder || prevOrder.length !== 4) return { kind: "none", resisted: false, gives: [], leader: null, head: null, reason: "首副不进贡" };
    const [head, second, third, tail] = prevOrder;
    const dd = teamOf2(head) === teamOf2(second);
    if (!dd) {
      if (countRJ(hands[tail]) >= 2) return { kind: "single", resisted: true, gives: [], leader: head, head, resistBy: [tail], reason: "末游有两张大王，抗贡；头游先出" };
      const card2 = tributeCard(hands[tail], lv);
      return { kind: "single", resisted: false, gives: [{ from: tail, to: head, card: card2 }], leader: tail, head, reason: "末游向头游进贡，末游先出" };
    }
    const rj3 = countRJ(hands[third]), rj4 = countRJ(hands[tail]);
    if (rj3 + rj4 >= 2) return { kind: "double", resisted: true, gives: [], leader: head, head, resistBy: [third, tail].filter((s) => countRJ(hands[s]) > 0), reason: "双下方合计两张大王，抗贡；头游先出" };
    const a = { from: third, card: tributeCard(hands[third], lv) };
    const b = { from: tail, card: tributeCard(hands[tail], lv) };
    const sa = singleStrength(a.card.rank, lv), sb = singleStrength(b.card.rank, lv);
    let big, small, tie = false;
    if (sa !== sb) [big, small] = sa > sb ? [a, b] : [b, a];
    else {
      tie = true;
      const hn = (head + 1) % 4;
      [big, small] = a.from === hn ? [a, b] : [b, a];
    }
    return {
      kind: "double",
      resisted: false,
      tie,
      gives: [{ from: big.from, to: head, card: big.card }, { from: small.from, to: second, card: small.card }],
      leader: big.from,
      head,
      reason: tie ? "双下双贡：贡牌一样大，头游下家进贡头游并先出" : "双下双贡：大贡归头游、小贡归二游，进贡大牌者先出"
    };
  }
  function applyGives(hands, plan) {
    const next = hands.map((h) => h.slice());
    for (const g of plan.gives) {
      next[g.from] = next[g.from].filter((c) => c.id !== g.card.id);
      next[g.to] = next[g.to].concat(g.card);
    }
    return next;
  }
  function minReturn(hand, lv) {
    const o = returnOptions(hand, lv).cards;
    return o.reduce((b, c) => !b || singleStrength(c.rank, lv) < singleStrength(b.rank, lv) ? c : b, null);
  }
  function newStdMatch(startLevel = "2") {
    return { teamLevel: [startLevel, startLevel], level: startLevel, levelTeam: null, matchOver: false, winnerTeam: null, prevOrder: null };
  }
  function bump(lv, n) {
    return RANKS[Math.min(RANKS.length - 1, RANKS.indexOf(lv) + n)];
  }
  function stepsFor(order) {
    const t = teamOf2(order[0]);
    return teamOf2(order[1]) === t ? 3 : teamOf2(order[2]) === t ? 2 : 1;
  }
  function applyStdResult(m, order) {
    const winTeam = teamOf2(order[0]);
    const steps = stepsFor(order);
    const before = m.teamLevel.slice();
    const playingOwnA = m.level === "A" && m.teamLevel[winTeam] === "A" && (m.levelTeam === winTeam || m.levelTeam == null);
    let passA = false;
    let message;
    if (playingOwnA && steps >= 2) {
      passA = true;
      m.matchOver = true;
      m.winnerTeam = winTeam;
      message = `${steps === 3 ? "双上" : "头游+三游"}，过 A，整场胜利`;
    } else if (playingOwnA) {
      message = "打 A 头游但对家末游，未过 A，继续打 A";
    } else {
      m.teamLevel[winTeam] = bump(m.teamLevel[winTeam], steps);
      message = `${steps === 3 ? "双上" : steps === 2 ? "头游+三游" : "头游+末游"}，升 ${steps} 级`;
    }
    m.level = m.teamLevel[winTeam];
    m.levelTeam = winTeam;
    m.prevOrder = order.slice();
    return { winTeam, steps, passA, before, after: m.teamLevel.slice(), level: m.level, message };
  }

  // policy/tribute.js
  var DEFAULT_RETURN = "plan";
  function chooseReturn(hand, info = {}, variant = DEFAULT_RETURN) {
    const lv = info.lv || "2";
    const { cards } = returnOptions(hand, lv);
    if (!cards.length) return null;
    const minOf = (arr) => arr.reduce((b, c) => !b || singleStrength(c.rank, lv) < singleStrength(b.rank, lv) ? c : b, null);
    if (variant === "min" || cards.length === 1) return minOf(cards);
    const byRank = /* @__PURE__ */ new Map();
    const nonLevel = cards.filter((c) => c.rank !== lv);
    const pool = nonLevel.length ? nonLevel : cards;
    for (const c of pool) if (!byRank.has(c.rank)) byRank.set(c.rank, c);
    const cache = /* @__PURE__ */ new Map();
    let best = null;
    for (const c of byRank.values()) {
      const rest = hand.filter((x) => x.id !== c.id);
      const s = decomposeCounts(rest, lv, cache).cost;
      const str = singleStrength(c.rank, lv);
      if (!best || s < best.s - 1e-9 || Math.abs(s - best.s) <= 1e-9 && str < best.str) best = { c, s, str };
    }
    return best.c;
  }

  // play/core.js
  var SEAT_NAMES = ["南（你）", "东（下家）", "北（对家）", "西（上家）"];
  var PLACE_NAMES = ["头游", "二游", "三游", "末游"];
  var TYPE_LIST = [
    TYPES.BOMB,
    TYPES.STRAIGHT_FLUSH,
    TYPES.SINGLE,
    TYPES.PAIR,
    TYPES.TRIPLE,
    TYPES.FULLHOUSE,
    TYPES.STRAIGHT,
    TYPES.PAIR_SEQ,
    TYPES.TRIPLE_SEQ
  ];
  function makeRng(seed) {
    let a = seed >>> 0;
    return () => {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function isPassMove(m) {
    var _a;
    return !m || !m.cards || m.cards.length === 0 || ((_a = m.combo) == null ? void 0 : _a.type) === TYPES.PASS;
  }
  function moveText(m) {
    if (isPassMove(m)) return "过牌";
    return `${labelCombo(m.combo)}（${m.cards.map(formatCard).join(" ")}）`;
  }
  function moveKey(m) {
    if (isPassMove(m)) return "pass";
    return `${m.combo.type}:${m.combo.rank}:${m.cards.map(formatCard).sort().join(",")}`;
  }
  function sortHand(hand, lv) {
    const suitOrd = { S: 0, H: 1, C: 2, D: 3, J: 4 };
    return hand.slice().sort((a, b) => {
      var _a, _b;
      const wa = isWildCard(a, lv) ? 1 : 0;
      const wb = isWildCard(b, lv) ? 1 : 0;
      const sa = singleStrength(a.rank, lv) + wa * 0.5;
      const sb = singleStrength(b.rank, lv) + wb * 0.5;
      if (sa !== sb) return sb - sa;
      return ((_a = suitOrd[a.suit]) != null ? _a : 9) - ((_b = suitOrd[b.suit]) != null ? _b : 9);
    });
  }
  function newGame({ seed = Date.now() % 1e9, levelRank = "2", progression = true, botEngine = "decide", tribute = null, pre = null } = {}) {
    const std = newStdMatch(levelRank);
    if (pre) Object.assign(std, structuredClone(pre), { matchOver: false, winnerTeam: null });
    const g = {
      seed,
      rng: makeRng(seed),
      match: createMatch({ levelRank }),
      std,
      progression,
      tribute: tribute == null ? progression : tribute,
      botEngine,
      dealNo: 0,
      round: null,
      log: [],
      played: [],
      trickPlays: [],
      lastResult: null,
      flags: [],
      history: [],
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      nextLeader: Math.floor(makeRng(seed + 7)() * 4),
      tributeState: null
    };
    startDeal(g);
    return g;
  }
  function archiveDeal(g) {
    if (!g.round || !g.dealNo) return;
    g.history = g.history || [];
    if (g.history.some((d) => d.deal === g.dealNo)) return;
    g.history.push(dealRecord(g));
  }
  function dealRecord(g) {
    var _a;
    const ts = g.tributeState || {};
    const lv = g.match.levelRank;
    return {
      deal: g.dealNo,
      levelRank: lv,
      teamLevel: g.match.teamLevel ? g.match.teamLevel.slice() : null,
      dealt: (ts.dealt || []).map((h) => sortHand(h, lv).map(formatCard)),
      tribute: ts.plan ? {
        kind: ts.plan.kind,
        resisted: !!ts.plan.resisted,
        resistBy: ts.plan.resistBy || null,
        leader: (_a = ts.plan.leader) != null ? _a : null,
        gives: (ts.plan.gives || []).map((x) => ({ from: x.from, to: x.to, card: formatCard(x.card) })),
        returns: (ts.returns || []).map((x) => ({ from: x.from, to: x.to, card: formatCard(x.card) }))
      } : null,
      log: g.log.slice(),
      result: g.lastResult ? structuredClone(g.lastResult) : null,
      finished: g.round.finished.length >= 4
    };
  }
  function gameLogRows(g, { flags: flags2 = [], app = {} } = {}) {
    const deals = [...g.history || []];
    if (g.round && g.dealNo && !deals.some((d) => d.deal === g.dealNo)) deals.push(dealRecord(g));
    const rows = [];
    const moves = deals.reduce((n, d) => n + d.log.length, 0);
    rows.push({
      type: "game",
      app: "guandan-play",
      ...app,
      seed: g.seed,
      startedAt: g.startedAt || null,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      progression: !!g.progression,
      tribute: !!g.tribute,
      seats: SEAT_NAMES,
      humanSeat: 0,
      deals: deals.length,
      moves,
      flags: flags2.length
    });
    for (const d of deals) {
      const { log, ...rest } = d;
      rows.push({ type: "deal", ...rest, moves: log.length });
      for (const e of log) {
        const s = e.snapshot || {};
        const counts = s.hands ? [0, 1, 2, 3].map((k) => (s.hands[String(k)] || []).length) : null;
        rows.push({
          type: "move",
          deal: e.deal,
          n: e.n,
          seat: e.seat,
          seatName: SEAT_NAMES[e.seat],
          by: e.by,
          handBefore: s.hands ? s.hands[String(e.seat)] : null,
          table: { levelRank: s.levelRank, leading: s.leading, previous: s.previous, trickMeta: s.trickMeta, firstLeadOfDeal: s.firstLeadOfDeal, counts, playedCards: s.playedCards },
          handsAll: s.hands || null,
          coach: e.coach,
          move: e.move,
          same: e.coach ? !!e.coach.same : null,
          reason: e.reason || "",
          trickEnd: !!e.trickEnd,
          wentOut: e.wentOut || null,
          flagged: !!e.flagged
        });
      }
    }
    for (const f of flags2) rows.push({ type: "flag", ...f });
    return rows;
  }
  function gameLogJsonl(g, opts) {
    return gameLogRows(g, opts).map((r) => JSON.stringify(r)).join("\n") + "\n";
  }
  function startDeal(g) {
    var _a;
    archiveDeal(g);
    g.dealNo += 1;
    if (g.progression) {
      if (g.std.matchOver) g.std = newStdMatch("2");
      g.match.levelRank = g.std.level;
      g.match.teamLevel = g.std.teamLevel.slice();
      g.match.matchOver = false;
      g.match.winnerTeam = null;
    }
    const hands = dealFourHands(shuffle(makeDeck(), g.rng));
    const lv = g.match.levelRank;
    const plan = g.tribute && g.progression ? planTribute(g.std.prevOrder, hands, lv) : { kind: "none", gives: [], resisted: false, leader: null };
    const leader = (_a = plan.leader) != null ? _a : g.nextLeader;
    g.round = createRound(g.match, { dealerSeat: leader, hands });
    g.tributeState = {
      plan,
      phase: plan.kind === "none" || plan.resisted ? "done" : "give",
      returns: [],
      pending: [],
      dealt: hands.map((h) => h.slice())
    };
    g.log = [];
    g.played = [];
    g.trickPlays = [];
    g.lastResult = null;
    g.leadsSoFar = 0;
    g.lastTablePlay = [null, null, null, null];
    return g;
  }
  function tributePending(g) {
    return !!g.tributeState && g.tributeState.phase !== "done";
  }
  function tributeGive(g) {
    const ts = g.tributeState;
    if (!ts || ts.phase !== "give") return { ok: false, reason: "不在进贡阶段" };
    g.round.hands = applyGives(g.round.hands, ts.plan);
    ts.pending = ts.plan.gives.map((x) => ({ seat: x.to, to: x.from, received: x.card }));
    ts.phase = ts.pending.length ? "return" : "done";
    return { ok: true, gives: ts.plan.gives };
  }
  function returnChoices(g, seat) {
    return returnOptions(g.round.hands[seat], g.match.levelRank).cards;
  }
  function tributeReturn(g, seat, card2) {
    const ts = g.tributeState;
    if (!ts || ts.phase !== "return") return { ok: false, reason: "不在还贡阶段" };
    const i = ts.pending.findIndex((p2) => p2.seat === seat);
    if (i < 0) return { ok: false, reason: "该座位不需要还贡" };
    const lv = g.match.levelRank;
    const c = card2 && g.round.hands[seat].find((x) => x.id === card2.id);
    if (!c || !isLegalReturn(c, g.round.hands[seat], lv)) return { ok: false, reason: "还贡须是 10 或以下的牌（王、逢人配不可）" };
    const p = ts.pending[i];
    g.round.hands[seat] = g.round.hands[seat].filter((x) => x.id !== c.id);
    g.round.hands[p.to] = g.round.hands[p.to].concat(c);
    ts.returns.push({ from: seat, to: p.to, card: c });
    ts.pending.splice(i, 1);
    if (!ts.pending.length) ts.phase = "done";
    return { ok: true, card: c, to: p.to };
  }
  function botReturnCard(g, seat, variant) {
    const ts = g.tributeState;
    const p = ts == null ? void 0 : ts.pending.find((x) => x.seat === seat);
    return chooseReturn(g.round.hands[seat], { lv: g.match.levelRank, seat, to: p == null ? void 0 : p.to, received: p == null ? void 0 : p.received }, variant);
  }
  function autoTribute(g, chooser = null, skipSeats = []) {
    const ts = g.tributeState;
    if (!ts) return g;
    if (ts.phase === "give") tributeGive(g);
    for (const p of ts.pending.slice()) {
      if (skipSeats.includes(p.seat)) continue;
      let c = chooser ? chooser(p.seat, g) : botReturnCard(g, p.seat);
      if (!c || !isLegalReturn(c, g.round.hands[p.seat], g.match.levelRank)) c = minReturn(g.round.hands[p.seat], g.match.levelRank);
      tributeReturn(g, p.seat, c);
    }
    return g;
  }
  function isLeading(g) {
    const r = g.round;
    return !r.lastCombo || r.lastCombo.type === TYPES.PASS;
  }
  function isOver(g) {
    return g.round.finished.length >= 4;
  }
  function ctxFor(g, seat) {
    const r = g.round;
    const leading = isLeading(g);
    const partner = (seat + 2) % 4;
    const partnerCombo = !leading && r.lastPlayer === partner ? r.lastCombo : null;
    return {
      hand: r.hands[seat],
      previous: leading ? null : r.lastCombo,
      levelRank: g.match.levelRank,
      leading,
      firstLeadOfDeal: leading && g.leadsSoFar === 0,
      seat,
      remainingSeatCounts: r.hands.map((h) => h.length),
      partnerCombo: leading ? null : partnerCombo,
      playedCards: g.played.slice(),
      persona: null,
      lastPlaySeat: leading ? null : r.lastPlayer
    };
  }
  function coachMove(g, seat) {
    const rec = decide(ctxFor(g, seat));
    return { move: rec.move, reason: rec.reason || "", text: moveText(rec.move) };
  }
  function snapshot(g, seat) {
    var _a, _b;
    const r = g.round;
    const leading = isLeading(g);
    const hands = {};
    for (let s = 0; s < 4; s++) hands[String(s)] = sortHand(r.hands[s], g.match.levelRank).map(formatCard);
    const ctx = ctxFor(g, seat);
    let previous = null;
    if (!leading) {
      const lastT = [...g.trickPlays].reverse().find((t) => !isPassMove(t));
      previous = { type: r.lastCombo.type, rank: (_a = r.lastCombo.rank) != null ? _a : null, cards: lastT ? lastT.cards.map(formatCard) : [] };
    }
    return {
      levelRank: g.match.levelRank,
      seat,
      leading,
      hands,
      previous,
      firstLeadOfDeal: ctx.firstLeadOfDeal,
      playedCards: g.played.map(formatCard),
      trickMeta: {
        lastPlayer: leading ? null : r.lastPlayer,
        controlSeat: leading ? seat : r.lastPlayer,
        partnerLastPlay: ctx.partnerCombo ? { type: ctx.partnerCombo.type, rank: (_b = ctx.partnerCombo.rank) != null ? _b : null } : null
      }
    };
  }
  function interpretPlay(g, seat, cards, preferCombo = null) {
    const r = g.round;
    const lv = g.match.levelRank;
    const leading = isLeading(g);
    if (!cards.length) return leading ? { ok: false, reason: "领出不能过牌" } : { ok: true, combo: { type: TYPES.PASS, rank: null, size: 0 } };
    if (!cards.every((c) => r.hands[seat].some((h) => h.id === c.id))) return { ok: false, reason: "手牌中没有这些牌" };
    const tries = [];
    if (preferCombo && preferCombo.type) {
      const c = interpretAs(cards, preferCombo.type, lv);
      if (c) tries.push(c);
    }
    const c0 = classify(cards, lv);
    if (c0) tries.push(c0);
    for (const t of TYPE_LIST) {
      const c = interpretAs(cards, t, lv);
      if (c) tries.push(c);
    }
    if (!tries.length) return { ok: false, reason: "不能组成合法牌型" };
    if (leading) return { ok: true, combo: tries[0] };
    const ok = tries.find((c) => beats(c, r.lastCombo, lv));
    if (!ok) return { ok: false, reason: `压不过上一手（${labelCombo(r.lastCombo)}）` };
    return { ok: true, combo: ok };
  }
  function play(g, seat, cards, { by = "human", coach = null, reason = "", preferCombo = null } = {}) {
    var _a, _b, _c, _d;
    const r = g.round;
    if (isOver(g)) return { ok: false, reason: "本副已结束" };
    if (tributePending(g)) return { ok: false, reason: "进贡/还贡还没完成" };
    if (seat !== r.currentSeat) return { ok: false, reason: "还没轮到该座位" };
    const it = interpretPlay(g, seat, cards, preferCombo);
    if (!it.ok) return it;
    const snap = snapshot(g, seat);
    const leading = isLeading(g);
    const move = { cards: cards.slice(), combo: it.combo };
    const entry = {
      n: g.log.length + 1,
      deal: g.dealNo,
      seat,
      by,
      move: { text: moveText(move), cards: cards.map(formatCard), type: it.combo.type, rank: (_a = it.combo.rank) != null ? _a : null, size: cards.length },
      coach: coach ? { text: moveText(coach.move), cards: (coach.move.cards || []).map(formatCard), type: ((_b = coach.move.combo) == null ? void 0 : _b.type) || "pass", rank: (_d = (_c = coach.move.combo) == null ? void 0 : _c.rank) != null ? _d : null, size: (coach.move.cards || []).length, reason: coach.reason, same: moveKey(coach.move) === moveKey(move) } : null,
      reason,
      snapshot: snap
    };
    g.log.push(entry);
    if (isPassMove(move)) {
      r.passCount += 1;
      g.trickPlays.push({ seat, cards: [], combo: move.combo });
      g.lastTablePlay[seat] = { pass: true };
      const active = 4 - r.finished.length;
      const need = r.finished.includes(r.lastPlayer) ? active : active - 1;
      if (r.passCount >= need) {
        r.lastCombo = null;
        r.passCount = 0;
        let leader = r.lastPlayer;
        if (r.finished.includes(leader)) {
          const p = (leader + 2) % 4;
          leader = r.finished.includes(p) ? nextActive(r, leader) : p;
        }
        r.currentSeat = leader;
        r.leadSeat = leader;
        g.trickPlays = [];
        entry.trickEnd = true;
      } else {
        r.currentSeat = nextActive(r, seat);
      }
      return { ok: true, entry };
    }
    if (leading) {
      g.leadsSoFar += 1;
      g.lastTablePlay = [null, null, null, null];
    }
    r.hands[seat] = r.hands[seat].filter((h) => !cards.some((c) => c.id === h.id));
    r.lastCombo = it.combo;
    r.lastPlayer = seat;
    r.passCount = 0;
    r.tricks.push({ seat, cards, combo: it.combo });
    g.trickPlays.push({ seat, cards: cards.slice(), combo: it.combo });
    g.played.push(...cards);
    g.lastTablePlay[seat] = { cards: cards.slice(), combo: it.combo };
    if (r.hands[seat].length === 0) {
      r.finished.push(seat);
      entry.wentOut = r.finished.length;
    }
    const t0 = r.finished.includes(0) && r.finished.includes(2);
    const t1 = r.finished.includes(1) && r.finished.includes(3);
    if (r.finished.length >= 3 || t0 || t1) {
      const rest = [0, 1, 2, 3].filter((s) => !r.finished.includes(s));
      rest.sort((a, b) => r.hands[a].length - r.hands[b].length);
      r.finished.push(...rest);
      finishDeal(g);
      return { ok: true, entry, finished: true };
    }
    r.currentSeat = nextActive(r, seat);
    return { ok: true, entry };
  }
  function nextActive(r, seat) {
    for (let i = 1; i <= 4; i++) {
      const s = (seat + i) % 4;
      if (!r.finished.includes(s)) return s;
    }
    return seat;
  }
  function finishDeal(g) {
    var _a, _b;
    const order = g.round.finished.slice();
    const before = g.match.levelRank;
    const teamLevelBefore = g.match.teamLevel.slice();
    let res = { message: "" };
    if (g.progression) {
      res = applyStdResult(g.std, order);
      g.match.teamLevel = g.std.teamLevel.slice();
      g.match.matchOver = g.std.matchOver;
      g.match.winnerTeam = g.std.winnerTeam;
    }
    g.lastResult = {
      order,
      places: order.map((s, i) => `${PLACE_NAMES[i]}：${SEAT_NAMES[s]}`),
      winTeam: order[0] % 2,
      steps: (_a = res.steps) != null ? _a : null,
      levelBefore: before,
      levelAfter: g.progression ? g.std.level : before,
      teamLevelBefore,
      teamLevel: g.match.teamLevel.slice(),
      message: res.message,
      matchOver: !!g.match.matchOver,
      winnerTeam: (_b = g.match.winnerTeam) != null ? _b : null
    };
    g.nextLeader = order[0];
  }
  function botStepDecide(g) {
    const seat = g.round.currentSeat;
    const c = coachMove(g, seat);
    const res = play(g, seat, c.move.cards || [], { by: "decide", coach: c, reason: c.reason, preferCombo: c.move.combo });
    if (!res.ok) {
      const fb = isLeading(g) ? [sortHand(g.round.hands[seat], g.match.levelRank).slice(-1)[0]] : [];
      return play(g, seat, fb, { by: "decide", coach: c, reason: `兜底（${res.reason}）` });
    }
    return res;
  }
  function cardsFromStrings(hand, strs) {
    const pool = hand.slice();
    const out = [];
    for (const s of strs || []) {
      const i = pool.findIndex((c) => formatCard(c) === s);
      if (i < 0) return null;
      out.push(pool[i]);
      pool.splice(i, 1);
    }
    return out;
  }
  function flagToCase(entry, { note = "", goldFrom = "unsure", idx = 1 } = {}) {
    const pick = goldFrom === "played" ? entry.move : goldFrom === "coach" ? entry.coach : null;
    const goldAlt = (m) => m.type === "pass" || !m.cards.length ? { comboType: "pass" } : { comboType: m.type, ranks: m.rank != null ? [m.rank] : [], size: m.size };
    const ts = /* @__PURE__ */ new Date();
    const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, "0")}${String(ts.getDate()).padStart(2, "0")}-${String(ts.getHours()).padStart(2, "0")}${String(ts.getMinutes()).padStart(2, "0")}${String(ts.getSeconds()).padStart(2, "0")}`;
    const s = entry.snapshot;
    const out = {
      id: `flag-${stamp}-${idx}`,
      tags: ["user-flag", entry.by === "human" ? "human-move" : `bot-${entry.by}`],
      source: { app: "guandan-play", deal: entry.deal, play: entry.n, by: entry.by, flaggedAt: ts.toISOString() },
      levelRank: s.levelRank,
      seat: s.seat,
      leading: s.leading,
      hands: s.hands,
      previous: s.previous,
      firstLeadOfDeal: s.firstLeadOfDeal,
      playedCards: s.playedCards,
      confidence: pick ? "user" : "unlabelled",
      chosen: entry.move,
      coach: entry.coach,
      note,
      trickMeta: s.trickMeta
    };
    if (pick) {
      const a = goldAlt(pick);
      out.gold = { action: a.comboType === "pass" ? "pass" : "play", comboType: a.comboType, ranks: a.ranks || [], alts: [a], rationale: note || (goldFrom === "played" ? "用户认为实际出牌正确" : "用户认为教练建议正确") };
    } else {
      out.gold = null;
    }
    return out;
  }

  // play/ui.js
  var $ = (id) => document.getElementById(id);
  var HUMAN = 0;
  var G = null;
  var token = 0;
  var selected = /* @__PURE__ */ new Set();
  var hintIds = /* @__PURE__ */ new Set();
  var coachCache = null;
  var flagTarget = null;
  var flagBtn = null;
  var jevAvailable = false;
  var botBusy = false;
  var flags = loadFlags();
  var tribMode = null;
  function loadFlags() {
    try {
      return JSON.parse(localStorage.getItem("gd_flags") || "[]");
    } catch {
      return [];
    }
  }
  function saveFlags() {
    try {
      localStorage.setItem("gd_flags", JSON.stringify(flags));
    } catch {
    }
    $("flagCount").textContent = flags.length;
  }
  var SEAT_COMPACT = ["南（你）", "东·下家", "北·对家", "西·上家"];
  function compact() {
    return window.innerWidth < 900 || window.innerHeight <= 500;
  }
  function placeCoach() {
    if (placeCoach.done) return;
    placeCoach.done = true;
    if (window.innerWidth >= 1280 && window.innerHeight >= 640) setDrawer(true);
  }
  function setDrawer(open) {
    document.body.classList.toggle("drawerOpen", open);
    if (open) $("coachTip").classList.add("hidden");
  }
  function coachTip(html) {
    const el = $("coachTip");
    if (!html || document.body.classList.contains("drawerOpen")) {
      el.classList.add("hidden");
      return;
    }
    el.innerHTML = html;
    el.classList.remove("hidden");
  }
  var AV_COLORS = [["#ffb347", "#e0731b"], ["#6fc3ff", "#2a7fd0"], ["#9be37a", "#3f9c34"], ["#ff8fb1", "#c9406b"]];
  function avatarSvg(s) {
    const [a, b] = AV_COLORS[s];
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="avg${s}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient></defs><circle cx="32" cy="32" r="32" fill="url(#avg${s})"/><circle cx="32" cy="25" r="11" fill="#fff" fill-opacity=".92"/><path d="M12 56c2-12 11-18 20-18s18 6 20 18" fill="#fff" fill-opacity=".92"/></svg>`;
  }
  var SUIT_SYM = { S: "♠", H: "♥", D: "♦", C: "♣" };
  function cardEl(c, cls = "") {
    const el = document.createElement("div");
    const lv = G.match.levelRank;
    el.className = `card ${cls}`;
    if (c.rank === "RJ" || c.rank === "BJ") {
      el.classList.add("joker");
      if (c.rank === "RJ") el.classList.add("red");
      el.innerHTML = `<span class="cr">J<br>O<br>K<br>E<br>R</span><span class="strip">${c.rank === "RJ" ? "大王" : "小王"}</span><span class="jk">${c.rank === "RJ" ? "大王" : "小王"}</span>`;
    } else {
      if (c.suit === "H" || c.suit === "D") el.classList.add("red");
      const sym = SUIT_SYM[c.suit] || "";
      const rk = c.rank === "T" ? "10" : c.rank;
      el.innerHTML = `<span class="cr">${rk}<br><span class="s">${sym}</span></span><span class="strip">${rk}<span class="s">${sym}</span></span><span class="pip">${sym}</span>`;
      if (c.rank === lv) el.classList.add("level");
      if (isWildCard(c, lv)) {
        el.classList.add("wild");
        el.insertAdjacentHTML("beforeend", '<span class="wildTag">配</span>');
      }
    }
    return el;
  }
  function engineMode() {
    return $("engine").value === "jev" && jevAvailable ? "jev" : "decide";
  }
  function render() {
    const r = G.round;
    const m = G.match;
    $("level").textContent = m.levelRank;
    $("lvUs").textContent = m.teamLevel[0];
    $("lvThem").textContent = m.teamLevel[1];
    $("dealNo").textContent = G.dealNo;
    $("turn").textContent = isOver(G) ? "本副结束" : tribMode ? "进贡" : SEAT_NAMES[r.currentSeat];
    const showAll = $("showAll").checked;
    for (let s = 0; s < 4; s++) {
      const box = $(`seat${s}`);
      const isTurn = !isOver(G) && !tribMode && r.currentSeat === s;
      box.classList.toggle("turn", isTurn);
      const n = r.hands[s].length;
      const placeIdx = r.finished.indexOf(s);
      const tp = G.lastTablePlay[s];
      const team = s % 2;
      box.innerHTML = "";
      box.classList.toggle("teamUs", team === 0);
      box.classList.toggle("teamThem", team === 1);
      const head = document.createElement("div");
      head.className = "head";
      const place = placeIdx >= 0 && (n === 0 || isOver(G)) ? `<span class="place">${PLACE_NAMES[placeIdx]}</span>` : "";
      head.innerHTML = `<div class="avatar">${avatarSvg(s)}<span class="ring"></span>${place}</div><div class="meta"><span class="name">${compact() ? SEAT_COMPACT[s] : SEAT_NAMES[s]}</span><span class="tag">${s === HUMAN ? "我" : s === 2 ? "队友" : "对手"} · 打${m.teamLevel[team]}</span></div><span class="cnt ${n === 0 ? "out" : n <= 5 ? "warn" : ""}">${n === 0 ? "出完" : n + " 张"}</span>`;
      box.appendChild(head);
      const pl = $(`pz${s}`);
      pl.className = "pz played";
      pl.innerHTML = "";
      if (tp == null ? void 0 : tp.pass) pl.innerHTML = '<span class="passed">不出</span>';
      else if (tp == null ? void 0 : tp.cards) {
        const row = document.createElement("div");
        row.className = "fan";
        for (const c of tp.cards) row.appendChild(cardEl(c, "small"));
        pl.appendChild(row);
        const t = document.createElement("span");
        t.className = "tag";
        t.textContent = labelCombo(tp.combo);
        pl.appendChild(t);
        pl.classList.toggle("last", r.lastPlayer === s && !isLeading(G));
      }
      if (showAll && s !== HUMAN && n) {
        const op = document.createElement("div");
        op.className = "open";
        for (const c of sortHand(r.hands[s], m.levelRank)) op.appendChild(cardEl(c, "tiny"));
        box.appendChild(op);
      }
    }
    layoutHand();
    const myTurn = !isOver(G) && !tribMode && !tributePending(G) && r.currentSeat === HUMAN && !botBusy;
    document.body.classList.toggle("tribOn", !!tribMode);
    const tEl = $("toast");
    if (!tEl.classList.contains("hidden")) {
      placeToast(tEl);
      requestAnimationFrame(() => placeToast(tEl));
    }
    $("btnPlay").disabled = !myTurn;
    $("btnPass").disabled = !myTurn || isLeading(G);
    $("btnHint").disabled = !myTurn;
    $("btnFlagPos").disabled = !myTurn;
    let st = "";
    if (isOver(G)) st = "本副结束";
    else if (tribMode) st = tribMode === "resist" ? "抗贡" : tribMode === "return" ? "请你还贡" : "进贡 / 还贡";
    else if (r.currentSeat === HUMAN) st = isLeading(G) ? "轮到你领出" : `轮到你：要压 ${labelCombo(r.lastCombo)}（${SEAT_NAMES[r.lastPlayer]}出）`;
    else st = `${SEAT_NAMES[r.currentSeat]} 思考中…${engineMode() === "jev" ? "（Jev）" : ""}`;
    $("status").textContent = st;
    renderLog();
  }
  function layoutHand() {
    const hand = $("hand");
    const cards = sortHand(G.round.hands[HUMAN], G.match.levelRank);
    const lv = G.match.levelRank;
    hand.innerHTML = "";
    const W = hand.clientWidth || window.innerWidth - 24;
    const shortLand = window.innerHeight <= 500 && window.innerWidth > window.innerHeight;
    const phone = window.innerWidth < 900;
    const cw = shortLand ? 44 : phone ? 46 : 64;
    const ch = Math.round(cw * 1.4);
    const cols = [];
    for (const c of cards) {
      const key = c.rank + (isWildCard(c, lv) ? "*" : "");
      if (cols.length && cols[cols.length - 1].key === key) cols[cols.length - 1].cards.push(c);
      else cols.push({ key, cards: [c] });
    }
    const maxStack = Math.max(1, ...cols.map((c) => c.cards.length));
    const maxH = shortLand ? Math.max(ch + 36, window.innerHeight * 0.3) : phone ? Math.max(ch + 60, window.innerHeight * 0.3) : 230;
    const vStep = maxStack > 1 ? Math.max(shortLand ? 17 : 18, Math.min(Math.round(ch * 0.3), (maxH - ch) / (maxStack - 1))) : 0;
    const nc = cols.length;
    const step = nc > 1 ? Math.min(cw + 4, (W - cw) / (nc - 1)) : 0;
    const totalW = (nc - 1) * step + cw;
    const x0 = Math.max(0, (W - totalW) / 2);
    const raise = 14;
    const baseTop = raise + (maxStack - 1) * vStep;
    cols.forEach((col, ci) => {
      col.cards.forEach((c, k) => {
        let extra = "";
        if (tribMode === "return") extra = eligIds.has(c.id) ? " elig" : " dim";
        if (tribMode === "give" && giveIds.has(c.id)) extra = " tribGive";
        if (tribMode === "summary" && newIds.has(c.id)) extra = " newCard";
        const el = cardEl(c, (selected.has(c.id) ? "sel " : "") + (hintIds.has(c.id) ? "hint" : "") + extra);
        el.style.width = cw + "px";
        el.style.height = ch + "px";
        el.style.left = Math.round(x0 + ci * step) + "px";
        el.style.top = Math.round(baseTop - (col.cards.length - 1 - k) * vStep) + "px";
        el.style.zIndex = String(10 + ci * 10 + k);
        el.dataset.id = c.id;
        hand.appendChild(el);
      });
    });
    hand.style.height = (cards.length ? baseTop + ch + 4 : 20) + "px";
  }
  function setupHandPointer() {
    const hand = $("hand");
    let mode = null;
    let seen = /* @__PURE__ */ new Set();
    const apply = (el) => {
      if (!el) return;
      const id = Number(el.dataset.id);
      if (seen.has(id)) return;
      seen.add(id);
      if (mode === "add") selected.add(id);
      else selected.delete(id);
      el.classList.toggle("sel", mode === "add");
    };
    const cardAt = (x, y) => {
      const e = document.elementFromPoint(x, y);
      return e && e.closest ? e.closest("#hand .card") : null;
    };
    hand.addEventListener("pointerdown", (ev) => {
      const el = cardAt(ev.clientX, ev.clientY);
      if (!el) return;
      ev.preventDefault();
      if (tribMode) {
        const id = Number(el.dataset.id);
        if (tribMode === "return" && eligIds.has(id)) {
          selected = /* @__PURE__ */ new Set([id]);
          hintIds.clear();
          renderTribute();
          render();
        } else if (tribMode === "return") toast("只能还 10 或以下的牌（王、逢人配不可）");
        return;
      }
      mode = selected.has(Number(el.dataset.id)) ? "remove" : "add";
      seen = /* @__PURE__ */ new Set();
      apply(el);
      $("msg").textContent = "";
    });
    hand.addEventListener("pointermove", (ev) => {
      if (mode) apply(cardAt(ev.clientX, ev.clientY));
    });
    const end = () => {
      mode = null;
    };
    hand.addEventListener("pointerup", end);
    hand.addEventListener("pointercancel", end);
    window.addEventListener("pointerup", end);
  }
  function toast(t, ms = 1800) {
    const el = $("toast");
    el.textContent = t;
    el.classList.remove("hidden");
    placeToast(el);
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), ms);
  }
  function placeToast() {
  }
  function renderLog() {
    const ol = $("log");
    if (ol.dataset.deal !== String(G.dealNo) || ol.children.length > G.log.length || ol.dataset.game !== String(G.seed)) {
      ol.innerHTML = "";
      ol.dataset.deal = String(G.dealNo);
      ol.dataset.game = String(G.seed);
    }
    const prevLen = ol.children.length;
    for (let i = prevLen; i < G.log.length; i++) {
      const e = G.log[i];
      const li = document.createElement("li");
      const who = SEAT_NAMES[e.seat].replace(/（.*）/, "");
      const eng = e.by === "human" ? "" : e.by === "jev" ? " [Jev]" : "";
      const sp = document.createElement("span");
      sp.textContent = `${who}${eng}：${e.move.text}`;
      li.appendChild(sp);
      if (e.by === "human" && e.coach && !e.coach.same) {
        li.classList.add("diff");
        li.title = `教练会出：${e.coach.text}`;
      }
      if (e.trickEnd) li.classList.add("trickEnd");
      const f = document.createElement("button");
      f.type = "button";
      f.className = "flag";
      f.textContent = "🚩";
      f.setAttribute("aria-label", "标记这一手");
      f.onclick = () => openFlag(e, f);
      li.appendChild(f);
      ol.appendChild(li);
    }
    if (G.log.length > prevLen && ol.parentElement.open) ol.parentElement.scrollTop = ol.parentElement.scrollHeight;
  }
  function humanCoach() {
    if (!coachCache || coachCache.at !== G.log.length || coachCache.deal !== G.dealNo) {
      coachCache = { at: G.log.length, deal: G.dealNo, c: coachMove(G, HUMAN) };
    }
    return coachCache.c;
  }
  function selectedCards() {
    return G.round.hands[HUMAN].filter((c) => selected.has(c.id));
  }
  function doHuman(cards) {
    const c = humanCoach();
    const res = play(G, HUMAN, cards, { by: "human", coach: c });
    if (!res.ok) {
      toast(res.reason);
      return;
    }
    selected.clear();
    hintIds.clear();
    $("hintBox").textContent = "";
    const e = res.entry;
    coachTip(e.coach.same ? "" : `你出：${e.move.text} · 教练会出：<b>${e.coach.text}</b>`);
    $("feedback").innerHTML = e.coach.same ? `<div class="good">✔ 与教练一致：${e.move.text}</div>` : `<div class="bad">你出：${e.move.text}<br>教练会出：<b>${e.coach.text}</b><br><span class="muted">${e.coach.reason || ""}</span></div>`;
    afterMove(res);
  }
  function afterMove(res) {
    render();
    if (res.finished) {
      archiveDeal(G);
      persistGame();
      showEnd();
      return;
    }
    scheduleBots();
  }
  function scheduleBots() {
    const my = token;
    if (isOver(G) || G.round.currentSeat === HUMAN) {
      botBusy = false;
      render();
      return;
    }
    botBusy = true;
    render();
    setTimeout(async () => {
      if (my !== token) return;
      let res;
      if (engineMode() === "jev") res = await botStepJev(my);
      else res = botStepDecide(G);
      if (my !== token || !res) return;
      botBusy = false;
      afterMove(res);
    }, Number($("speed").value));
  }
  async function botStepJev(my) {
    const seat = G.round.currentSeat;
    try {
      const resp = await fetch("api/jev", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot(G, seat)) });
      const out = await resp.json();
      if (my !== token) return null;
      const cards = cardsFromStrings(G.round.hands[seat], out.cards);
      if (cards && out.engine === "jev") {
        const c = coachMove(G, seat);
        const res = play(G, seat, cards, { by: "jev", coach: c, reason: out.label || "", preferCombo: { type: out.type } });
        if (res.ok) return res;
      }
    } catch (e) {
    }
    if (my !== token) return null;
    return botStepDecide(G);
  }
  function showEnd() {
    const R = G.lastResult;
    const win = R.winTeam === 0;
    $("endTitle").textContent = win ? "本副我方获胜 🎉" : "本副对方获胜";
    let html = "<ol>" + R.order.map((s, i) => `<li>${PLACE_NAMES[i]}：${SEAT_NAMES[s]}</li>`).join("") + "</ol>";
    if (G.progression) {
      html += `<p>${R.message || ""}（${R.winTeam === 0 ? "我方" : "对方"}）</p><p>级数：我方 ${R.teamLevelBefore[0]} → <b>${R.teamLevel[0]}</b>，对方 ${R.teamLevelBefore[1]} → <b>${R.teamLevel[1]}</b>；下一副打 <b>${R.levelAfter}</b>。</p>`;
      if (R.matchOver) html += `<p><b>比赛结束：${R.winnerTeam === 0 ? "我方" : "对方"}过 A！</b>下一副新比赛从 2 打起（不进贡）。</p>`;
      else html += `<p class="tribNext">${nextTributeText(R.order)}</p>`;
    } else {
      html += '<p class="muted">（未开“升级”：不进贡，下一副由头游先出。）</p>';
    }
    $("endBody").innerHTML = html;
    $("btnNext").textContent = R.matchOver ? "新比赛" : "下一副";
    $("endModal").classList.remove("hidden");
  }
  var nm = (s) => s === HUMAN ? "你" : SEAT_NAMES[s].replace(/（.*）/, "");
  var nmFull = (s) => s === HUMAN ? "你（南）" : SEAT_NAMES[s];
  function nextTributeText(order) {
    const [h, s2, t3, t4] = order;
    if (h % 2 === s2 % 2) return `下一副进贡：双下，${nmFull(t3)} 和 ${nmFull(t4)} 各进贡一张最大的牌（大的给头游 ${nm(h)}、小的给二游 ${nm(s2)}），两家合计两张大王可抗贡。`;
    return `下一副进贡：末游 ${nmFull(t4)} 向头游 ${nmFull(h)} 进贡一张最大的牌（红桃级牌除外），有两张大王可抗贡。`;
  }
  var eligIds = /* @__PURE__ */ new Set();
  var giveIds = /* @__PURE__ */ new Set();
  var newIds = /* @__PURE__ */ new Set();
  function cardChip(c, cls = "") {
    const el = cardEl(c, `small ${cls}`);
    return el.outerHTML;
  }
  function renderTribute() {
    const box = $("tribPanel");
    if (!tribMode) {
      box.classList.add("hidden");
      return;
    }
    box.classList.remove("hidden");
    const ts = G.tributeState;
    const p = ts.plan;
    const lv = G.match.levelRank;
    const showAll = $("showAll").checked;
    let title = "", body = "", btn = "", btn2 = "";
    if (tribMode === "resist") {
      title = "抗贡";
      const who = (p.resistBy || []).map(nmFull).join("、");
      body = `<div class="tribRow anim">${p.kind === "double" ? `双下方 ${who} 合计有两张大王` : `末游 ${who} 有两张大王`}，<b>抗贡</b>：本副不进贡、不还贡。</div><div class="tribRow">由头游 <b>${nmFull(p.leader)}</b> 先出。</div>`;
      btn = "开始出牌";
    } else if (tribMode === "give") {
      title = p.kind === "double" ? "进贡（双下双贡）" : "进贡";
      body = p.gives.map((g, i) => `<div class="tribRow anim" style="animation-delay:${i * 0.25}s">${nmFull(g.from)} → ${nmFull(g.to)}：${cardChip(g.card, "fly")}</div>`).join("");
      if (p.tie) body += '<div class="tribRow small muted">两张贡牌一样大：头游的下家进贡给头游。</div>';
      const mine = p.gives.find((g) => g.from === HUMAN);
      body += mine ? `<div class="tribRow">你要进贡手里最大的牌（红桃级牌除外）：已自动选好。</div>` : '<div class="tribRow small muted">贡牌是强制的：手里最大的一张（红桃级牌除外）。</div>';
      btn = mine ? "确认进贡" : "继续";
    } else if (tribMode === "return") {
      const pend = ts.pending.find((x) => x.seat === HUMAN);
      title = "还贡";
      body = `<div class="tribRow">你收到 ${nmFull(pend.to)} 的贡牌 ${cardChip(pend.received)}，请选一张 <b>10 或以下</b> 的牌还给 ${nm(pend.to)}（亮着的牌可选）。</div>`;
      const sel = [...selected].map((id) => G.round.hands[HUMAN].find((c) => c.id === id)).filter(Boolean)[0];
      body += `<div class="tribRow">已选：${sel ? cardChip(sel) : '<span class="muted">（未选）</span>'}</div>`;
      btn = "确认还贡";
      btn2 = "建议";
    } else if (tribMode === "summary") {
      title = "进贡完成";
      body = p.gives.map((g) => `<div class="tribRow">进贡：${nmFull(g.from)} → ${nmFull(g.to)} ${cardChip(g.card)}</div>`).join("");
      body += ts.returns.map((r, i) => {
        const seen = r.from === HUMAN || r.to === HUMAN || showAll;
        return `<div class="tribRow anim" style="animation-delay:${i * 0.25}s">还贡：${nmFull(r.from)} → ${nmFull(r.to)} ${seen ? cardChip(r.card, "fly") : '<span class="muted">（暗还一张 ≤10 的牌）</span>'}</div>`;
      }).join("");
      body += `<div class="tribRow">由 <b>${nmFull(G.round.currentSeat)}</b> 先出${p.kind === "double" ? "（进贡给头游的人）" : "（进贡的人）"}。</div>`;
      btn = "开始出牌";
    }
    box.innerHTML = `<div class="tribHead"><b>${title}</b><span class="lvBadge">打 ${lv}</span><button id="tribRules" class="link" type="button" title="进贡规则">规则？</button></div><div class="tribBody">${body}</div><div class="tribBtns">${btn2 ? `<button id="tribHint" type="button">${btn2}</button>` : ""}<button id="tribOk" class="primary" type="button">${btn}</button></div>`;
    $("tribRules").onclick = () => $("rulesModal").classList.remove("hidden");
    $("tribOk").onclick = tributeNext;
    if (tribMode === "return") {
      $("tribOk").disabled = selected.size !== 1;
      $("tribHint").onclick = () => {
        const c = botReturnCard(G, HUMAN);
        if (c) {
          selected = /* @__PURE__ */ new Set([c.id]);
          hintIds = /* @__PURE__ */ new Set([c.id]);
          toast(`建议还 ${formatCard(c)}：尽量不拆对子/顺子/炸弹`);
          renderTribute();
          render();
        }
      };
    }
  }
  function beginTribute() {
    const ts = G.tributeState;
    tribMode = null;
    newIds = /* @__PURE__ */ new Set();
    if (!ts || ts.plan.kind === "none") return false;
    if (ts.plan.resisted) tribMode = "resist";
    else {
      tribMode = "give";
      const mine = ts.plan.gives.find((g) => g.from === HUMAN);
      giveIds = new Set(mine ? [mine.card.id] : []);
      selected = new Set(giveIds);
    }
    renderTribute();
    return true;
  }
  function tributeNext() {
    const ts = G.tributeState;
    if (tribMode === "give") {
      tributeGive(G);
      autoTribute(G, null, [HUMAN]);
      selected.clear();
      giveIds = /* @__PURE__ */ new Set();
      const mineRecv = ts.plan.gives.find((g) => g.to === HUMAN);
      if (mineRecv) newIds.add(mineRecv.card.id);
      if (ts.pending.some((x) => x.seat === HUMAN)) {
        tribMode = "return";
        eligIds = new Set(returnChoices(G, HUMAN).map((c) => c.id));
      } else {
        tribMode = "summary";
        for (const r of ts.returns) if (r.to === HUMAN) newIds.add(r.card.id);
      }
    } else if (tribMode === "return") {
      const id = [...selected][0];
      const c = G.round.hands[HUMAN].find((x) => x.id === id);
      const res = tributeReturn(G, HUMAN, c);
      if (!res.ok) {
        toast(res.reason);
        return;
      }
      selected.clear();
      hintIds.clear();
      eligIds = /* @__PURE__ */ new Set();
      tribMode = "summary";
    } else {
      const sum = ts.plan.resisted ? `抗贡，${nm(ts.plan.leader)}先出` : ts.plan.gives.map((g) => `${nm(g.from)}→${nm(g.to)} ${formatCard(g.card)}`).join("，") + "；" + ts.returns.map((r) => `${nm(r.from)}→${nm(r.to)} ${r.from === HUMAN || r.to === HUMAN ? formatCard(r.card) : "暗还"}`).join("，");
      $("feedback").innerHTML = `<div class="muted">本副${ts.plan.resisted ? "" : "进贡"}：${sum}</div>`;
      tribMode = null;
      newIds = /* @__PURE__ */ new Set();
      renderTribute();
      render();
      scheduleBots();
      return;
    }
    renderTribute();
    render();
  }
  function openFlag(entry, btn = null) {
    var _a;
    flagTarget = entry;
    flagBtn = btn;
    const who = SEAT_NAMES[entry.seat];
    $("flagDesc").innerHTML = `<p>${who}${entry.by === "human" ? "" : `（${entry.by}）`} 实际：<b>${entry.move ? entry.move.text : "（尚未出牌）"}</b><br>教练（decide）：<b>${entry.coach ? entry.coach.text : "-"}</b>${((_a = entry.coach) == null ? void 0 : _a.reason) ? `<br><span style="color:#666">${entry.coach.reason}</span>` : ""}</p>`;
    const played = document.querySelector("input[name=gold][value=played]");
    played.disabled = !entry.move;
    document.querySelector("input[name=gold][value=unsure]").checked = true;
    $("flagNote").value = "";
    $("flagModal").classList.remove("hidden");
  }
  function flagCurrentPosition() {
    var _a, _b, _c, _d;
    const c = humanCoach();
    const sel = selectedCards();
    let move = null;
    if (sel.length) {
      const it = interpretPlay(G, HUMAN, sel);
      if (it.ok) move = { text: moveText({ cards: sel, combo: it.combo }), cards: sel.map(formatCard), type: it.combo.type, rank: (_a = it.combo.rank) != null ? _a : null, size: sel.length };
    }
    const coach = { text: moveText(c.move), cards: (c.move.cards || []).map(formatCard), type: ((_b = c.move.combo) == null ? void 0 : _b.type) || "pass", rank: (_d = (_c = c.move.combo) == null ? void 0 : _c.rank) != null ? _d : null, size: (c.move.cards || []).length, reason: c.reason };
    openFlag({ n: G.log.length + 1, deal: G.dealNo, seat: HUMAN, by: "human", move, coach, snapshot: snapshot(G, HUMAN), pending: true });
  }
  function saveFlag() {
    const goldFrom = document.querySelector("input[name=gold]:checked").value;
    const e = flagTarget;
    const entry = e.move ? e : { ...e, move: { text: "（未出）", cards: [], type: "none", rank: null, size: 0 } };
    const row = flagToCase(entry, { note: $("flagNote").value.trim(), goldFrom: e.move || goldFrom !== "played" ? goldFrom : "unsure", idx: flags.length + 1 });
    flags.push(row);
    e.flagged = true;
    if (flagBtn) flagBtn.classList.add("on");
    saveFlags();
    persistGame();
    $("flagModal").classList.add("hidden");
    toast(`已保存标记（共 ${flags.length} 条）`);
  }
  var pad2 = (n) => String(n).padStart(2, "0");
  function exportFileName(ext = "jsonl") {
    const d = /* @__PURE__ */ new Date();
    return `guandan-game-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}.${ext}`;
  }
  var BUILD = typeof document !== "undefined" && document.documentElement.dataset.build || null;
  function gameText() {
    var _a;
    const moves = ((G == null ? void 0 : G.history) || []).reduce((n, d) => n + d.log.length, 0) + (((_a = G == null ? void 0 : G.log) == null ? void 0 : _a.length) || 0);
    if (G && moves > 0) return { text: gameLogJsonl(G, { flags, app: { build: BUILD, ua: navigator.userAgent } }), moves };
    try {
      const last = localStorage.getItem("gd_lastgame");
      if (last) {
        const lines = last.trim().split("\n");
        const seen = new Set(lines.map((l) => {
          try {
            const o = JSON.parse(l);
            return o.type === "flag" ? o.id : null;
          } catch {
            return null;
          }
        }).filter(Boolean));
        const extra = flags.filter((f) => !seen.has(f.id)).map((f) => JSON.stringify({ type: "flag", ...f }));
        return { text: [...lines, ...extra].join("\n") + "\n", moves: lines.filter((l) => l.startsWith('{"type":"move"')).length };
      }
    } catch {
    }
    if (flags.length) return { text: flags.map((f) => JSON.stringify({ type: "flag", ...f })).join("\n") + "\n", moves: 0 };
    return { text: "", moves: 0 };
  }
  function persistGame() {
    var _a;
    if (!G) return;
    const moves = (G.history || []).reduce((n, d) => n + d.log.length, 0) + (((_a = G.log) == null ? void 0 : _a.length) || 0);
    if (!moves) return;
    try {
      localStorage.setItem("gd_lastgame", gameLogJsonl(G, { flags, app: { build: BUILD } }));
    } catch {
    }
  }
  function triggerDownload(text, name) {
    const blob = new Blob([text], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 6e4);
  }
  function showCopy(text) {
    $("copyText").value = text;
    $("copyModal").classList.remove("hidden");
    $("copyText").focus();
    $("copyText").select();
  }
  async function shareGame() {
    const { text, moves } = gameText();
    if (!text) {
      toast("还没有对局记录");
      return;
    }
    const summary = `${moves} 手${flags.length ? `、${flags.length} 条标记` : ""}`;
    if (navigator.share && navigator.canShare && typeof File !== "undefined") {
      let file = null;
      for (const [ext, type] of [["jsonl", "text/plain"], ["jsonl", "application/json"], ["txt", "text/plain"]]) {
        try {
          const f = new File([text], exportFileName(ext), { type });
          if (navigator.canShare({ files: [f] })) {
            file = f;
            break;
          }
        } catch {
        }
      }
      if (file) {
        try {
          await navigator.share({ files: [file] });
          toast(`已分享对局记录（${summary}）`);
          return;
        } catch (e) {
          if (e && e.name === "AbortError") return;
        }
      }
    }
    try {
      triggerDownload(text, exportFileName("jsonl"));
    } catch {
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        toast(`已下载并复制对局记录（${summary}）`, 2600);
        return;
      }
    } catch {
    }
    showCopy(text);
  }
  function download() {
    const { text, moves } = gameText();
    if (!text) {
      toast("还没有对局记录");
      return;
    }
    triggerDownload(text, exportFileName("jsonl"));
    toast(`已下载对局记录（${moves} 手${flags.length ? `、${flags.length} 条标记` : ""}）`, 2600);
    if (flags.length && confirm(`已下载（含 ${flags.length} 条标记）。要清空浏览器里保存的标记吗？（对局记录不受影响）`)) {
      flags = [];
      saveFlags();
    }
  }
  function closeMenu() {
    $("menu").classList.remove("open");
    $("topbar").classList.remove("menuOpen");
  }
  function startNew() {
    persistGame();
    token += 1;
    botBusy = false;
    const qs = typeof location !== "undefined" ? new URLSearchParams(location.search) : null;
    const seedQ = qs && !startNew.used && qs.get("seed") ? Number(qs.get("seed")) : null;
    startNew.used = true;
    G = newGame(seedQ != null && Number.isFinite(seedQ) ? { progression: $("progression").checked, seed: seedQ } : { progression: $("progression").checked });
    tribMode = null;
    renderTribute();
    selected.clear();
    hintIds.clear();
    coachCache = null;
    coachTip("");
    $("feedback").innerHTML = "";
    $("hintBox").textContent = "轮到你时点“提示”查看 decide 的建议。";
    render();
    scheduleBots();
  }
  function nextDeal() {
    var _a;
    $("endModal").classList.add("hidden");
    if ((_a = G.lastResult) == null ? void 0 : _a.matchOver) {
      startNew();
      return;
    }
    token += 1;
    G.progression = $("progression").checked;
    G.tribute = G.progression;
    startDeal(G);
    selected.clear();
    hintIds.clear();
    coachCache = null;
    coachTip("");
    $("feedback").innerHTML = "";
    const wait = beginTribute();
    render();
    if (!wait) scheduleBots();
  }
  function init() {
    $("btnPlay").onclick = () => {
      const cs = selectedCards();
      if (!cs.length) {
        toast("请先选牌");
        return;
      }
      doHuman(cs);
    };
    $("btnPass").onclick = () => doHuman([]);
    $("btnClear").onclick = () => {
      selected.clear();
      hintIds.clear();
      render();
    };
    $("btnDrawer").onclick = () => {
      closeMenu();
      setDrawer(!document.body.classList.contains("drawerOpen"));
    };
    $("drawerClose").onclick = () => setDrawer(false);
    $("coachTip").onclick = () => setDrawer(true);
    document.addEventListener("pointerdown", (e) => {
      if ($("menu").classList.contains("open") && !e.target.closest("#menu, #btnMenu")) closeMenu();
    });
    $("btnHint").onclick = () => {
      const c = humanCoach();
      hintIds = new Set((c.move.cards || []).map((x) => x.id));
      selected = new Set(hintIds);
      $("hintBox").innerHTML = `建议：<b>${c.text}</b><br><span class="muted">${c.reason || ""}</span>`;
      coachTip(`💡 建议：<b>${c.text}</b>${c.reason ? `<span class="muted"> · ${c.reason}</span>` : ""}`);
      render();
    };
    $("btnFlagPos").onclick = flagCurrentPosition;
    $("flagOk").onclick = saveFlag;
    $("flagCancel").onclick = () => $("flagModal").classList.add("hidden");
    $("btnNext").onclick = nextDeal;
    $("endClose").onclick = () => $("endModal").classList.add("hidden");
    $("btnRules").onclick = () => {
      closeMenu();
      $("rulesModal").classList.remove("hidden");
    };
    $("rulesClose").onclick = () => $("rulesModal").classList.add("hidden");
    $("btnNew").onclick = () => {
      closeMenu();
      if (confirm("开始新比赛？")) startNew();
    };
    $("btnDownload").onclick = () => {
      closeMenu();
      download();
    };
    $("btnShare").onclick = () => {
      closeMenu();
      shareGame();
    };
    $("btnShareEnd") && ($("btnShareEnd").onclick = () => shareGame());
    $("copyClose").onclick = () => $("copyModal").classList.add("hidden");
    $("btnMenu").onclick = () => {
      $("menu").classList.toggle("open");
      $("topbar").classList.toggle("menuOpen", $("menu").classList.contains("open"));
    };
    setupHandPointer();
    let rt = null;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (G) render();
      }, 80);
    });
    placeCoach();
    $("logPanel").addEventListener("toggle", () => {
      if ($("logPanel").open) $("logPanel").scrollTop = $("logPanel").scrollHeight;
    });
    document.addEventListener("gesturestart", (e) => e.preventDefault());
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController || reloaded) return;
        reloaded = true;
        location.reload();
      });
      navigator.serviceWorker.register("sw.js").then((reg) => {
        if (navigator.onLine && reg.update) reg.update().catch(() => {
        });
      }).catch(() => {
      });
    }
    $("showAll").onchange = () => {
      render();
      renderTribute();
    };
    $("progression").onchange = () => {
      if (G) G.progression = $("progression").checked;
    };
    $("engine").onchange = () => {
      if ($("engine").value === "jev" && !jevAvailable) {
        alert("Jev 需在电脑上用 “node server.mjs” 启动本地服务并设置 TYPESAFE_API_KEY。机器人继续使用 decide（离线）。");
        $("engine").value = "decide";
      }
      render();
    };
    saveFlags();
    const persistSoon = () => persistGame();
    window.addEventListener("pagehide", persistSoon);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") persistGame();
    });
    if (location.protocol.startsWith("http") && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
      fetch("api/status", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((s) => {
        if (!s || !s.server) return;
        jevAvailable = !!s.jev;
        const opt = $("engine").querySelector("option[value=jev]");
        opt.disabled = !jevAvailable;
        opt.textContent = jevAvailable ? "Jev（已连接）" : "Jev（服务器未设密钥）";
      }).catch(() => {
      });
    }
    startNew();
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  }
})();
