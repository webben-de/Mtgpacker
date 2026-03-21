/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("tslib");

/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = require("cors");

/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("express");

/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("express-session");

/***/ }),
/* 5 */
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),
/* 6 */
/***/ ((module) => {

module.exports = require("passport");

/***/ }),
/* 7 */
/***/ ((module) => {

module.exports = require("passport-github2");

/***/ }),
/* 8 */
/***/ ((module) => {

module.exports = require("sqlite3");

/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

var _a, _b, _c, _d, _e, _f;
Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1);
const cors_1 = tslib_1.__importDefault(__webpack_require__(2));
const express_1 = tslib_1.__importDefault(__webpack_require__(3));
const express_session_1 = tslib_1.__importDefault(__webpack_require__(4));
const child_process_1 = __webpack_require__(5);
const passport_1 = tslib_1.__importDefault(__webpack_require__(6));
const passport_github2_1 = __webpack_require__(7);
const sqlite3_1 = tslib_1.__importDefault(__webpack_require__(8));
// ── DB setup ──────────────────────────────────────────────────────────────────
const DB_FILE = (_a = process.env['DB_PATH']) !== null && _a !== void 0 ? _a : 'mtg_packer.db';
const PRICE_PER_CARD = 0.07; // €
function getDbConnection() {
    return new sqlite3_1.default.Database(DB_FILE);
}
function runSql(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onResult(err) {
            if (err) {
                reject(err);
                return;
            }
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}
function allSql(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
        });
    });
}
function getSql(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row);
        });
    });
}
function initDb() {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const db = getDbConnection();
        try {
            yield runSql(db, `CREATE TABLE IF NOT EXISTS decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT DEFAULT '',
      commander_image TEXT
    )`);
            yield runSql(db, `CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date DATE NOT NULL
    )`);
            yield runSql(db, `CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      deck_id INTEGER NOT NULL,
      user_name TEXT NOT NULL
    )`);
            yield runSql(db, `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL,
      github_login TEXT,
      github_avatar TEXT,
      moxfield_url TEXT NOT NULL,
      deck_name TEXT NOT NULL,
      card_count INTEGER NOT NULL,
      total_price REAL NOT NULL,
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'offen',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
            // Migrations: add columns if missing
            for (const [table, col, def] of [
                ['decks', 'commander_image', 'TEXT'],
                ['votes', 'user_name', 'TEXT'],
                ['orders', 'github_avatar', "TEXT DEFAULT ''"],
            ]) {
                try {
                    yield runSql(db, `ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
                }
                catch ( /* exists */_a) { /* exists */ }
            }
        }
        finally {
            db.close();
        }
    });
}
// ── Auth config ───────────────────────────────────────────────────────────────
const GITHUB_CLIENT_ID = (_b = process.env['GITHUB_CLIENT_ID']) !== null && _b !== void 0 ? _b : '';
const GITHUB_CLIENT_SECRET = (_c = process.env['GITHUB_CLIENT_SECRET']) !== null && _c !== void 0 ? _c : '';
const SESSION_SECRET = (_d = process.env['SESSION_SECRET']) !== null && _d !== void 0 ? _d : 'mtgpacker-dev-secret';
const BASE_URL = (_e = process.env['BASE_URL']) !== null && _e !== void 0 ? _e : 'http://localhost:3333';
const ADMIN_USERS = ((_f = process.env['ADMIN_USERS']) !== null && _f !== void 0 ? _f : '')
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);
const oauthEnabled = Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);
if (oauthEnabled) {
    passport_1.default.use(new passport_github2_1.Strategy({
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: `${BASE_URL}/api/auth/github/callback`,
        scope: ['read:user'],
    }, (_accessToken, _refreshToken, profile, done) => {
        var _a, _b, _c, _d, _e, _f, _g;
        const user = {
            id: profile.id,
            login: (_a = profile.username) !== null && _a !== void 0 ? _a : '',
            displayName: (_c = (_b = profile.displayName) !== null && _b !== void 0 ? _b : profile.username) !== null && _c !== void 0 ? _c : '',
            avatar: (_f = (_e = (_d = profile.photos) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.value) !== null && _f !== void 0 ? _f : '',
            isAdmin: ADMIN_USERS.includes(((_g = profile.username) !== null && _g !== void 0 ? _g : '').toLowerCase()),
        };
        done(null, user);
    }));
    passport_1.default.serializeUser((user, done) => done(null, user));
    passport_1.default.deserializeUser((obj, done) => done(null, obj));
}
// ── Express setup ─────────────────────────────────────────────────────────────
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use(express_1.default.json());
app.use((0, express_session_1.default)({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
if (oauthEnabled) {
    app.use(passport_1.default.initialize());
    app.use(passport_1.default.session());
}
function isAdmin(req, res, next) {
    var _a;
    const user = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
    if (!oauthEnabled || (user && user.isAdmin)) {
        next();
        return;
    }
    res.status(403).send({ error: 'Admin access required' });
}
// ── Helpers ───────────────────────────────────────────────────────────────────
function isValidMoxfieldUrl(url) {
    try {
        const p = new URL(url);
        return p.hostname === 'moxfield.com' || p.hostname.endsWith('.moxfield.com');
    }
    catch (_a) {
        return false;
    }
}
function extractImageUrl(cardData) {
    var _a, _b, _c, _d;
    const uris = (_a = cardData === null || cardData === void 0 ? void 0 : cardData.image_uris) !== null && _a !== void 0 ? _a : (_c = (_b = cardData === null || cardData === void 0 ? void 0 : cardData.card_faces) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.image_uris;
    return (_d = uris === null || uris === void 0 ? void 0 : uris.normal) !== null && _d !== void 0 ? _d : null;
}
function fetchScryfallAutocomplete(query) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!query || query.length < 2)
            return [];
        try {
            const r = yield fetch('https://api.scryfall.com/cards/autocomplete?' + new URLSearchParams({ q: query }), { headers: { 'User-Agent': 'MtgPacker/1.0' } });
            if (!r.ok)
                return [];
            return (_a = (yield r.json()).data) !== null && _a !== void 0 ? _a : [];
        }
        catch (_b) {
            return [];
        }
    });
}
function fetchScryfallCardImage(cardName) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        if (!cardName)
            return null;
        try {
            const r = yield fetch('https://api.scryfall.com/cards/named?' + new URLSearchParams({ fuzzy: cardName }), { headers: { 'User-Agent': 'MtgPacker/1.0' } });
            if (!r.ok)
                return null;
            return extractImageUrl(yield r.json());
        }
        catch (_a) {
            return null;
        }
    });
}
/** Fetch a URL via curl to bypass Cloudflare TLS fingerprinting on Moxfield */
function fetchViaCurl(url) {
    return new Promise((resolve, reject) => {
        (0, child_process_1.execFile)('curl', [
            '-s', '--compressed',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            '-H', 'Accept: application/json, text/plain, */*',
            '-H', 'Accept-Language: en-US,en;q=0.9',
            '-H', 'Referer: https://www.moxfield.com/',
            '-H', 'Origin: https://www.moxfield.com',
            url,
        ], { maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err)
                return reject(err);
            try {
                resolve(JSON.parse(stdout));
            }
            catch (e) {
                reject(new Error(`JSON parse failed: ${stderr || stdout.slice(0, 200)}`));
            }
        });
    });
}
function fetchMoxfieldDeck(url) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const match = url.match(/decks\/([^/?#]+)/);
        const fallback = (slug) => ({
            deckName: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            commanderImage: null,
            cardCount: 0,
            cardList: [],
        });
        if (!match)
            return fallback('unbekannt');
        const deckId = match[1];
        try {
            const data = yield fetchViaCurl(`https://api2.moxfield.com/v2/decks/all/${deckId}`);
            // Deck name — try multiple fields
            const deckName = data.name ||
                data.deckTitleDisplay ||
                ((_b = (_a = data.publicUrl) === null || _a === void 0 ? void 0 : _a.split('/').pop()) === null || _b === void 0 ? void 0 : _b.replace(/-/g, ' ')) ||
                deckId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            // Card list (mainboard + commanders + sideboard)
            const sections = [
                (_c = data.commanders) !== null && _c !== void 0 ? _c : {},
                (_d = data.mainboard) !== null && _d !== void 0 ? _d : {},
                (_e = data.sideboard) !== null && _e !== void 0 ? _e : {},
            ];
            const cardList = [];
            let cardCount = 0;
            for (const section of sections) {
                for (const entry of Object.values(section)) {
                    const qty = (_f = entry.quantity) !== null && _f !== void 0 ? _f : 1;
                    const name = (_h = (_g = entry.card) === null || _g === void 0 ? void 0 : _g.name) !== null && _h !== void 0 ? _h : 'Unknown';
                    const set = (_k = (_j = entry.card) === null || _j === void 0 ? void 0 : _j.set) !== null && _k !== void 0 ? _k : '';
                    cardList.push({ name, quantity: qty, set });
                    cardCount += qty;
                }
            }
            // Commander image — cascade through multiple strategies
            let commanderImage = null;
            const commanders = (_l = data.commanders) !== null && _l !== void 0 ? _l : {};
            const firstCommander = Object.values(commanders)[0];
            const commanderCard = firstCommander === null || firstCommander === void 0 ? void 0 : firstCommander.card;
            // 1. Try Scryfall ID from Moxfield
            if (commanderCard === null || commanderCard === void 0 ? void 0 : commanderCard.scryfall_id) {
                try {
                    const sr = yield fetch(`https://api.scryfall.com/cards/${commanderCard.scryfall_id}`, {
                        headers: { 'User-Agent': 'MtgPacker/1.0' },
                    });
                    if (sr.ok)
                        commanderImage = extractImageUrl(yield sr.json());
                }
                catch ( /* fall through */_m) { /* fall through */ }
            }
            // 2. Try commander name search
            if (!commanderImage && (commanderCard === null || commanderCard === void 0 ? void 0 : commanderCard.name)) {
                commanderImage = yield fetchScryfallCardImage(commanderCard.name);
            }
            // 3. Try deck name as card name (for mono-commander decks titled by commander)
            if (!commanderImage) {
                commanderImage = yield fetchScryfallCardImage(deckName);
            }
            return { deckName, commanderImage, cardCount, cardList };
        }
        catch (_o) {
            return fallback(deckId);
        }
    });
}
// ── Routes: Auth ──────────────────────────────────────────────────────────────
app.get('/api/auth/me', (req, res) => {
    var _a;
    if ((_a = req.session) === null || _a === void 0 ? void 0 : _a.user) {
        res.send(req.session.user);
    }
    else {
        res.send(null);
    }
});
if (oauthEnabled) {
    app.get('/api/auth/github', passport_1.default.authenticate('github'));
    app.get('/api/auth/github/callback', passport_1.default.authenticate('github', { failureRedirect: '/?auth=failed' }), (req, res) => {
        req.session.user = req.user;
        res.redirect('/');
    });
}
else {
    // Dev mode: auto-login as admin
    app.get('/api/auth/github', (req, res) => {
        req.session.user = {
            id: 'dev',
            login: 'dev',
            displayName: 'Dev User',
            avatar: '',
            isAdmin: true,
        };
        res.redirect('/');
    });
}
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => res.send({ ok: true }));
});
// ── Routes: Health ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.send({ ok: true, oauthEnabled });
});
// ── Routes: Decks ─────────────────────────────────────────────────────────────
app.get('/api/decks', (_req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    const db = getDbConnection();
    try {
        res.send(yield allSql(db, 'SELECT * FROM decks ORDER BY id DESC'));
    }
    catch (err) {
        res.status(500).send({ error: 'Could not fetch decks', details: String(err) });
    }
    finally {
        db.close();
    }
}));
app.post('/api/decks', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { name, commander_name, commander_image } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
    if (!(name === null || name === void 0 ? void 0 : name.trim())) {
        res.status(400).send({ error: 'Deck name is required' });
        return;
    }
    const image = commander_image || (commander_name ? yield fetchScryfallCardImage(commander_name) : null);
    const db = getDbConnection();
    try {
        const result = yield runSql(db, 'INSERT INTO decks (name, url, commander_image) VALUES (?, ?, ?)', [name.trim(), '', image]);
        res.status(201).send({ id: result.lastID, name: name.trim(), url: '', commander_image: image });
    }
    catch (err) {
        res.status(500).send({ error: 'Could not create deck', details: String(err) });
    }
    finally {
        db.close();
    }
}));
// Preview a Moxfield deck without saving (used by order form too)
app.post('/api/decks/preview-moxfield', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { url } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
    if (!url || !isValidMoxfieldUrl(url)) {
        res.status(400).send({ error: 'Invalid Moxfield URL' });
        return;
    }
    try {
        const result = yield fetchMoxfieldDeck(url);
        res.send(result);
    }
    catch (err) {
        res.status(500).send({ error: 'Could not fetch deck', details: String(err) });
    }
}));
app.post('/api/decks/import-moxfield', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { url } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
    if (!url || !isValidMoxfieldUrl(url)) {
        res.status(400).send({ error: 'Invalid Moxfield URL' });
        return;
    }
    try {
        const { deckName, commanderImage } = yield fetchMoxfieldDeck(url);
        const db = getDbConnection();
        try {
            const result = yield runSql(db, 'INSERT INTO decks (name, url, commander_image) VALUES (?, ?, ?)', [deckName, url, commanderImage]);
            res.status(201).send({ id: result.lastID, name: deckName, url, commander_image: commanderImage });
        }
        finally {
            db.close();
        }
    }
    catch (err) {
        res.status(500).send({ error: 'Could not import deck', details: String(err) });
    }
}));
app.delete('/api/decks/:id', isAdmin, (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        res.status(400).send({ error: 'Invalid deck id' });
        return;
    }
    const db = getDbConnection();
    try {
        yield runSql(db, 'DELETE FROM decks WHERE id = ?', [id]);
        res.send({ ok: true });
    }
    catch (err) {
        res.status(500).send({ error: 'Could not delete deck', details: String(err) });
    }
    finally {
        db.close();
    }
}));
// ── Routes: Events ────────────────────────────────────────────────────────────
app.get('/api/events', (_req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    const db = getDbConnection();
    try {
        res.send(yield allSql(db, 'SELECT * FROM events ORDER BY date DESC'));
    }
    catch (err) {
        res.status(500).send({ error: 'Could not fetch events', details: String(err) });
    }
    finally {
        db.close();
    }
}));
app.post('/api/events', isAdmin, (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { title, date } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
    if (!(title === null || title === void 0 ? void 0 : title.trim()) || !date) {
        res.status(400).send({ error: 'title and date required' });
        return;
    }
    const db = getDbConnection();
    try {
        const result = yield runSql(db, 'INSERT INTO events (title, date) VALUES (?, ?)', [title.trim(), date]);
        res.status(201).send({ id: result.lastID, title: title.trim(), date });
    }
    catch (err) {
        res.status(500).send({ error: 'Could not create event', details: String(err) });
    }
    finally {
        db.close();
    }
}));
app.get('/api/events/:eventId/available-decks', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const eventId = Number(req.params.eventId);
    const userName = String((_a = req.query['userName']) !== null && _a !== void 0 ? _a : '').trim();
    if (!Number.isFinite(eventId) || !userName) {
        res.status(400).send({ error: 'eventId and userName required' });
        return;
    }
    const db = getDbConnection();
    try {
        const voted = yield allSql(db, 'SELECT deck_id FROM votes WHERE event_id = ? AND user_name != ?', [eventId, userName]);
        const takenIds = voted.map((v) => v.deck_id);
        const decks = yield allSql(db, 'SELECT * FROM decks ORDER BY id DESC');
        res.send(decks.filter((d) => !takenIds.includes(d.id)));
    }
    catch (err) {
        res.status(500).send({ error: 'Could not fetch available decks', details: String(err) });
    }
    finally {
        db.close();
    }
}));
// ── Routes: Votes ─────────────────────────────────────────────────────────────
app.post('/api/votes', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { eventId, userName, deckIds } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
    if (!eventId || !userName || !Array.isArray(deckIds) || deckIds.length === 0) {
        res.status(400).send({ error: 'eventId, userName, deckIds required' });
        return;
    }
    if (deckIds.length > 2) {
        res.status(400).send({ error: 'Max 2 decks per vote' });
        return;
    }
    const db = getDbConnection();
    try {
        yield runSql(db, 'DELETE FROM votes WHERE event_id = ? AND user_name = ?', [eventId, userName]);
        for (const deckId of deckIds) {
            yield runSql(db, 'INSERT INTO votes (event_id, deck_id, user_name) VALUES (?, ?, ?)', [eventId, deckId, userName]);
        }
        res.status(201).send({ ok: true });
    }
    catch (err) {
        res.status(500).send({ error: 'Could not save votes', details: String(err) });
    }
    finally {
        db.close();
    }
}));
// ── Routes: Results ───────────────────────────────────────────────────────────
app.get('/api/results/summary', (_req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    const db = getDbConnection();
    try {
        res.send(yield allSql(db, `SELECT e.title, d.name, COUNT(*) as stimmen
       FROM votes v
       JOIN decks d ON v.deck_id = d.id
       JOIN events e ON v.event_id = e.id
       GROUP BY v.event_id, v.deck_id
       ORDER BY stimmen DESC`));
    }
    catch (err) {
        res.status(500).send({ error: 'Could not fetch summary', details: String(err) });
    }
    finally {
        db.close();
    }
}));
app.get('/api/results/details', (_req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    const db = getDbConnection();
    try {
        res.send(yield allSql(db, `SELECT e.title as event, d.name as deck, v.user_name as teilnehmer
       FROM votes v
       JOIN decks d ON v.deck_id = d.id
       JOIN events e ON v.event_id = e.id
       ORDER BY e.date DESC, d.name`));
    }
    catch (err) {
        res.status(500).send({ error: 'Could not fetch details', details: String(err) });
    }
    finally {
        db.close();
    }
}));
// ── Routes: Orders ────────────────────────────────────────────────────────────
app.post('/api/orders', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const { moxfieldUrl, notes } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
    const sessionUser = (_b = req.session) === null || _b === void 0 ? void 0 : _b.user;
    const userName = (sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.displayName) || (sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.login) || ((_c = req.body.userName) !== null && _c !== void 0 ? _c : '').trim();
    if (!moxfieldUrl || !isValidMoxfieldUrl(moxfieldUrl)) {
        res.status(400).send({ error: 'Valid Moxfield URL required' });
        return;
    }
    if (!userName) {
        res.status(400).send({ error: 'User name required (log in or provide userName)' });
        return;
    }
    try {
        const { deckName, cardCount } = yield fetchMoxfieldDeck(moxfieldUrl);
        const totalPrice = Math.round(cardCount * PRICE_PER_CARD * 100) / 100;
        const db = getDbConnection();
        try {
            const result = yield runSql(db, `INSERT INTO orders (user_name, github_login, github_avatar, moxfield_url, deck_name, card_count, total_price, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                userName,
                (_d = sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.login) !== null && _d !== void 0 ? _d : '',
                (_e = sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.avatar) !== null && _e !== void 0 ? _e : '',
                moxfieldUrl,
                deckName,
                cardCount,
                totalPrice,
                notes !== null && notes !== void 0 ? notes : '',
            ]);
            res.status(201).send({
                id: result.lastID, userName, deckName, cardCount, totalPrice,
                pricePerCard: PRICE_PER_CARD, status: 'offen',
            });
        }
        finally {
            db.close();
        }
    }
    catch (err) {
        res.status(500).send({ error: 'Could not create order', details: String(err) });
    }
}));
app.get('/api/orders', (_req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    const db = getDbConnection();
    try {
        res.send(yield allSql(db, 'SELECT * FROM orders ORDER BY created_at DESC'));
    }
    catch (err) {
        res.status(500).send({ error: 'Could not fetch orders', details: String(err) });
    }
    finally {
        db.close();
    }
}));
app.patch('/api/orders/:id', isAdmin, (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const id = Number(req.params.id);
    const { status } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
    const allowed = ['offen', 'in Bearbeitung', 'abgeschlossen', 'storniert'];
    if (!Number.isFinite(id) || !allowed.includes(status)) {
        res.status(400).send({ error: 'Invalid id or status' });
        return;
    }
    const db = getDbConnection();
    try {
        yield runSql(db, 'UPDATE orders SET status = ? WHERE id = ?', [status, id]);
        res.send({ ok: true });
    }
    catch (err) {
        res.status(500).send({ error: 'Could not update order', details: String(err) });
    }
    finally {
        db.close();
    }
}));
// ── Routes: Scryfall ──────────────────────────────────────────────────────────
app.get('/api/scryfall/autocomplete', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const q = String((_a = req.query['q']) !== null && _a !== void 0 ? _a : '');
    res.send({ data: yield fetchScryfallAutocomplete(q) });
}));
app.get('/api/scryfall/card-image', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const name = String((_a = req.query['name']) !== null && _a !== void 0 ? _a : '');
    if (!name) {
        res.status(400).send({ error: 'name required' });
        return;
    }
    const imageUrl = yield fetchScryfallCardImage(name);
    if (!imageUrl) {
        res.status(404).send({ error: 'Card not found' });
        return;
    }
    res.send({ imageUrl });
}));
// ── Start ─────────────────────────────────────────────────────────────────────
const port = process.env['PORT'] ? Number(process.env['PORT']) : 3333;
initDb()
    .then(() => {
    app.listen(port, () => {
        console.log(`[MtgPacker API] http://localhost:${port}`);
        console.log(`[MtgPacker API] OAuth: ${oauthEnabled ? 'enabled (GitHub)' : 'disabled (dev auto-login)'}`);
        console.log(`[MtgPacker API] Admin users: ${ADMIN_USERS.length ? ADMIN_USERS.join(', ') : '(all, dev mode)'}`);
    });
})
    .catch((err) => {
    console.error('DB init failed', err);
    process.exit(1);
});

})();

/******/ })()
;
//# sourceMappingURL=main.js.map