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

module.exports = require("passport-google-oauth20");

/***/ }),
/* 9 */
/***/ ((module) => {

module.exports = require("passport-discord");

/***/ }),
/* 10 */
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

var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1);
// passport-discord types are declared in ./passport-discord.d.ts
const cors_1 = tslib_1.__importDefault(__webpack_require__(2));
const express_1 = tslib_1.__importDefault(__webpack_require__(3));
const express_session_1 = tslib_1.__importDefault(__webpack_require__(4));
const child_process_1 = __webpack_require__(5);
const passport_1 = tslib_1.__importDefault(__webpack_require__(6));
const passport_github2_1 = __webpack_require__(7);
const passport_google_oauth20_1 = __webpack_require__(8);
const passport_discord_1 = __webpack_require__(9);
const sqlite3_1 = tslib_1.__importDefault(__webpack_require__(10));
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
            yield runSql(db, `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL,
      email TEXT,
      avatar TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
            yield runSql(db, `CREATE TABLE IF NOT EXISTS user_identities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      provider_username TEXT,
      provider_avatar TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(provider, provider_id)
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
                catch (_a) {
                    /* exists */
                }
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
const GOOGLE_CLIENT_ID = (_d = process.env['GOOGLE_CLIENT_ID']) !== null && _d !== void 0 ? _d : '';
const GOOGLE_CLIENT_SECRET = (_e = process.env['GOOGLE_CLIENT_SECRET']) !== null && _e !== void 0 ? _e : '';
const DISCORD_CLIENT_ID = (_f = process.env['DISCORD_CLIENT_ID']) !== null && _f !== void 0 ? _f : '';
const DISCORD_CLIENT_SECRET = (_g = process.env['DISCORD_CLIENT_SECRET']) !== null && _g !== void 0 ? _g : '';
const SESSION_SECRET = (_h = process.env['SESSION_SECRET']) !== null && _h !== void 0 ? _h : 'mtgpacker-dev-secret';
const BASE_URL = (_j = process.env['BASE_URL']) !== null && _j !== void 0 ? _j : 'http://localhost:3333';
const ADMIN_USERS = ((_k = process.env['ADMIN_USERS']) !== null && _k !== void 0 ? _k : '')
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);
const googleEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
const discordEnabled = Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET);
const oauthEnabled = Boolean((GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) || googleEnabled || discordEnabled);
// ── findOrCreateUser ──────────────────────────────────────────────────────────
function findOrCreateUser(db, provider, providerId, profile) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const existingIdentity = yield getSql(db, 'SELECT * FROM user_identities WHERE provider = ? AND provider_id = ?', [provider, providerId]);
        let userId;
        if (existingIdentity) {
            userId = existingIdentity.user_id;
            yield runSql(db, 'UPDATE user_identities SET provider_username = ?, provider_avatar = ? WHERE provider = ? AND provider_id = ?', [(_a = profile.username) !== null && _a !== void 0 ? _a : profile.displayName, profile.avatar, provider, providerId]);
            yield runSql(db, "UPDATE users SET avatar = ?, updated_at = datetime('now') WHERE id = ? AND (avatar IS NULL OR avatar = '')", [profile.avatar, userId]);
        }
        else {
            const isAdminUser = provider === 'github' &&
                ADMIN_USERS.includes(((_b = profile.username) !== null && _b !== void 0 ? _b : '').toLowerCase());
            const userResult = yield runSql(db, 'INSERT INTO users (display_name, email, avatar, role) VALUES (?, ?, ?, ?)', [
                profile.displayName,
                (_c = profile.email) !== null && _c !== void 0 ? _c : null,
                profile.avatar,
                isAdminUser ? 'admin' : 'user',
            ]);
            userId = userResult.lastID;
            yield runSql(db, 'INSERT INTO user_identities (user_id, provider, provider_id, provider_username, provider_avatar) VALUES (?, ?, ?, ?, ?)', [userId, provider, providerId, (_d = profile.username) !== null && _d !== void 0 ? _d : profile.displayName, profile.avatar]);
        }
        const user = yield getSql(db, 'SELECT * FROM users WHERE id = ?', [userId]);
        const identities = yield allSql(db, 'SELECT provider FROM user_identities WHERE user_id = ?', [userId]);
        if (!user)
            throw new Error('User not found after create/update');
        return {
            id: user.id,
            displayName: user.display_name,
            avatar: (_e = user.avatar) !== null && _e !== void 0 ? _e : '',
            role: user.role,
            isAdmin: user.role === 'admin',
            providers: identities.map((i) => i.provider),
        };
    });
}
// ── Passport strategies ───────────────────────────────────────────────────────
if (oauthEnabled) {
    if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
        passport_1.default.use(new passport_github2_1.Strategy({
            clientID: GITHUB_CLIENT_ID,
            clientSecret: GITHUB_CLIENT_SECRET,
            callbackURL: `${BASE_URL}/api/auth/github/callback`,
            scope: ['read:user'],
        }, (_accessToken, _refreshToken, profile, done) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const db = getDbConnection();
            try {
                const user = yield findOrCreateUser(db, 'github', profile.id, {
                    displayName: (_b = (_a = profile.displayName) !== null && _a !== void 0 ? _a : profile.username) !== null && _b !== void 0 ? _b : '',
                    avatar: (_e = (_d = (_c = profile.photos) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.value) !== null && _e !== void 0 ? _e : '',
                    username: profile.username,
                });
                done(null, user);
            }
            catch (err) {
                done(err);
            }
            finally {
                db.close();
            }
        })));
    }
    if (googleEnabled) {
        passport_1.default.use(new passport_google_oauth20_1.Strategy({
            clientID: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            callbackURL: `${BASE_URL}/api/auth/google/callback`,
        }, (_accessToken, _refreshToken, profile, done) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const db = getDbConnection();
            try {
                const user = yield findOrCreateUser(db, 'google', profile.id, {
                    displayName: (_a = profile.displayName) !== null && _a !== void 0 ? _a : '',
                    avatar: (_d = (_c = (_b = profile.photos) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.value) !== null && _d !== void 0 ? _d : '',
                    email: (_f = (_e = profile.emails) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.value,
                });
                done(null, user);
            }
            catch (err) {
                done(err);
            }
            finally {
                db.close();
            }
        })));
    }
    if (discordEnabled) {
        passport_1.default.use(new passport_discord_1.Strategy({
            clientID: DISCORD_CLIENT_ID,
            clientSecret: DISCORD_CLIENT_SECRET,
            callbackURL: `${BASE_URL}/api/auth/discord/callback`,
            scope: ['identify', 'email'],
        }, (_accessToken, _refreshToken, profile, done) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
            const db = getDbConnection();
            try {
                const avatarUrl = profile.avatar
                    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                    : '';
                const user = yield findOrCreateUser(db, 'discord', profile.id, {
                    displayName: profile.username,
                    avatar: avatarUrl,
                    username: profile.username,
                    email: profile.email,
                });
                done(null, user);
            }
            catch (err) {
                done(err);
            }
            finally {
                db.close();
            }
        })));
    }
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
// ── Auth middleware ───────────────────────────────────────────────────────────
function isAdmin(req, res, next) {
    var _a;
    const user = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
    if (!oauthEnabled || (user && user.isAdmin)) {
        next();
        return;
    }
    res.status(403).send({ error: 'Admin access required' });
}
function isAuthenticated(req, res, next) {
    var _a;
    if (!oauthEnabled || ((_a = req.session) === null || _a === void 0 ? void 0 : _a.user)) {
        next();
        return;
    }
    res.status(401).send({ error: 'Authentication required' });
}
// ── Helpers ───────────────────────────────────────────────────────────────────
function isValidMoxfieldUrl(url) {
    try {
        const p = new URL(url);
        return (p.hostname === 'moxfield.com' || p.hostname.endsWith('.moxfield.com'));
    }
    catch (_a) {
        return false;
    }
}
function extractImageUrl(cardData) {
    var _a, _b, _c, _d;
    const data = cardData;
    const uris = (_a = data.image_uris) !== null && _a !== void 0 ? _a : (_c = (_b = data.card_faces) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.image_uris;
    return (_d = uris === null || uris === void 0 ? void 0 : uris.normal) !== null && _d !== void 0 ? _d : null;
}
function fetchScryfallAutocomplete(query) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!query || query.length < 2)
            return [];
        try {
            const r = yield fetch('https://api.scryfall.com/cards/autocomplete?' +
                new URLSearchParams({ q: query }), { headers: { 'User-Agent': 'MtgPacker/1.0' } });
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
            const r = yield fetch('https://api.scryfall.com/cards/named?' +
                new URLSearchParams({ fuzzy: cardName }), { headers: { 'User-Agent': 'MtgPacker/1.0' } });
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
            '-s',
            '--compressed',
            '-H',
            'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            '-H',
            'Accept: application/json, text/plain, */*',
            '-H',
            'Accept-Language: en-US,en;q=0.9',
            '-H',
            'Referer: https://www.moxfield.com/',
            '-H',
            'Origin: https://www.moxfield.com',
            url,
        ], { maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err)
                return reject(err);
            try {
                resolve(JSON.parse(stdout));
            }
            catch (_a) {
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
            const data = (yield fetchViaCurl(`https://api2.moxfield.com/v2/decks/all/${deckId}`));
            // Deck name — try multiple fields
            const deckName = data.name ||
                data.deckTitleDisplay ||
                ((_b = (_a = data.publicUrl) === null || _a === void 0 ? void 0 : _a.split('/').pop()) === null || _b === void 0 ? void 0 : _b.replace(/-/g, ' ')) ||
                deckId
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase());
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
                catch (_m) {
                    /* fall through */
                }
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
    var _a, _b;
    res.send((_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user) !== null && _b !== void 0 ? _b : null);
});
if (oauthEnabled) {
    if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
        app.get('/api/auth/github', passport_1.default.authenticate('github'));
        app.get('/api/auth/github/callback', passport_1.default.authenticate('github', { failureRedirect: '/?auth=failed' }), (req, res) => {
            req.session.user = req.user;
            res.redirect('/');
        });
    }
    if (googleEnabled) {
        app.get('/api/auth/google', passport_1.default.authenticate('google', { scope: ['profile', 'email'] }));
        app.get('/api/auth/google/callback', passport_1.default.authenticate('google', { failureRedirect: '/?auth=failed' }), (req, res) => {
            req.session.user = req.user;
            res.redirect('/');
        });
    }
    if (discordEnabled) {
        app.get('/api/auth/discord', passport_1.default.authenticate('discord'));
        app.get('/api/auth/discord/callback', passport_1.default.authenticate('discord', { failureRedirect: '/?auth=failed' }), (req, res) => {
            req.session.user = req.user;
            res.redirect('/');
        });
    }
}
else {
    // Dev mode: auto-login as admin for all providers
    for (const provider of ['github', 'google', 'discord']) {
        app.get(`/api/auth/${provider}`, (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
            const db = getDbConnection();
            try {
                const user = yield findOrCreateUser(db, 'dev', '1', {
                    displayName: 'Dev User',
                    avatar: '',
                    username: 'dev',
                });
                user.isAdmin = true;
                user.role = 'admin';
                req.session.user = user;
            }
            finally {
                db.close();
            }
            res.redirect('/');
        }));
    }
}
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => res.send({ ok: true }));
});
// ── Routes: Health ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.send({ ok: true, oauthEnabled, googleEnabled, discordEnabled });
});
app.get('/api/users', isAdmin, (_req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    const db = getDbConnection();
    try {
        const users = yield allSql(db, 'SELECT * FROM users ORDER BY created_at DESC');
        const result = yield Promise.all(users.map((u) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
            const identities = yield allSql(db, 'SELECT provider, provider_username, provider_avatar FROM user_identities WHERE user_id = ?', [u.id]);
            return {
                id: u.id,
                display_name: u.display_name,
                email: u.email,
                avatar: u.avatar,
                role: u.role,
                created_at: u.created_at,
                providers: identities,
            };
        })));
        res.send(result);
    }
    catch (err) {
        res.status(500).send({ error: 'Could not fetch users', details: String(err) });
    }
    finally {
        db.close();
    }
}));
app.get('/api/users/:id', isAuthenticated, (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const id = Number(req.params.id);
    const sessionUser = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
    if (!Number.isFinite(id)) {
        res.status(400).send({ error: 'Invalid user id' });
        return;
    }
    if (!(sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.isAdmin) && (sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.id) !== id) {
        res.status(403).send({ error: 'Forbidden' });
        return;
    }
    const db = getDbConnection();
    try {
        const user = yield getSql(db, 'SELECT * FROM users WHERE id = ?', [id]);
        if (!user) {
            res.status(404).send({ error: 'User not found' });
            return;
        }
        const identities = yield allSql(db, 'SELECT provider, provider_username, provider_avatar FROM user_identities WHERE user_id = ?', [id]);
        res.send({
            id: user.id,
            display_name: user.display_name,
            email: user.email,
            avatar: user.avatar,
            role: user.role,
            created_at: user.created_at,
            providers: identities,
        });
    }
    catch (err) {
        res.status(500).send({ error: 'Could not fetch user', details: String(err) });
    }
    finally {
        db.close();
    }
}));
app.patch('/api/users/:id', isAuthenticated, (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const id = Number(req.params.id);
    const sessionUser = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
    if (!Number.isFinite(id)) {
        res.status(400).send({ error: 'Invalid user id' });
        return;
    }
    if (!(sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.isAdmin) && (sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.id) !== id) {
        res.status(403).send({ error: 'Forbidden' });
        return;
    }
    const { display_name, avatar } = (_b = req.body) !== null && _b !== void 0 ? _b : {};
    if (!(display_name === null || display_name === void 0 ? void 0 : display_name.trim()) && avatar === undefined) {
        res.status(400).send({ error: 'display_name or avatar required' });
        return;
    }
    const db = getDbConnection();
    try {
        if (display_name === null || display_name === void 0 ? void 0 : display_name.trim()) {
            yield runSql(db, "UPDATE users SET display_name = ?, updated_at = datetime('now') WHERE id = ?", [display_name.trim(), id]);
        }
        if (avatar !== undefined) {
            yield runSql(db, "UPDATE users SET avatar = ?, updated_at = datetime('now') WHERE id = ?", [avatar, id]);
        }
        res.send({ ok: true });
    }
    catch (err) {
        res.status(500).send({ error: 'Could not update user', details: String(err) });
    }
    finally {
        db.close();
    }
}));
app.patch('/api/users/:id/role', isAdmin, (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const id = Number(req.params.id);
    const { role } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
    if (!Number.isFinite(id) || !['user', 'admin'].includes(role)) {
        res.status(400).send({ error: 'Invalid id or role' });
        return;
    }
    const db = getDbConnection();
    try {
        yield runSql(db, "UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?", [role, id]);
        res.send({ ok: true });
    }
    catch (err) {
        res.status(500).send({ error: 'Could not update role', details: String(err) });
    }
    finally {
        db.close();
    }
}));
app.delete('/api/users/:id', isAdmin, (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        res.status(400).send({ error: 'Invalid user id' });
        return;
    }
    const db = getDbConnection();
    try {
        yield runSql(db, 'DELETE FROM users WHERE id = ?', [id]);
        res.send({ ok: true });
    }
    catch (err) {
        res.status(500).send({ error: 'Could not delete user', details: String(err) });
    }
    finally {
        db.close();
    }
}));
app.get('/api/users/:id/identities', isAuthenticated, (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const id = Number(req.params.id);
    const sessionUser = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
    if (!Number.isFinite(id)) {
        res.status(400).send({ error: 'Invalid user id' });
        return;
    }
    if (!(sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.isAdmin) && (sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.id) !== id) {
        res.status(403).send({ error: 'Forbidden' });
        return;
    }
    const db = getDbConnection();
    try {
        const identities = yield allSql(db, 'SELECT * FROM user_identities WHERE user_id = ?', [id]);
        res.send(identities);
    }
    catch (err) {
        res.status(500).send({ error: 'Could not fetch identities', details: String(err) });
    }
    finally {
        db.close();
    }
}));
app.delete('/api/users/:id/identities/:provider', isAuthenticated, (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const id = Number(req.params.id);
    const { provider } = req.params;
    const sessionUser = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
    if (!Number.isFinite(id)) {
        res.status(400).send({ error: 'Invalid user id' });
        return;
    }
    if (!(sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.isAdmin) && (sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.id) !== id) {
        res.status(403).send({ error: 'Forbidden' });
        return;
    }
    const db = getDbConnection();
    try {
        // Prevent unlinking the last identity
        const count = yield getSql(db, 'SELECT COUNT(*) as cnt FROM user_identities WHERE user_id = ?', [id]);
        if (((_b = count === null || count === void 0 ? void 0 : count.cnt) !== null && _b !== void 0 ? _b : 0) <= 1) {
            res.status(400).send({ error: 'Cannot unlink the last identity' });
            return;
        }
        yield runSql(db, 'DELETE FROM user_identities WHERE user_id = ? AND provider = ?', [id, provider]);
        res.send({ ok: true });
    }
    catch (err) {
        res.status(500).send({ error: 'Could not unlink identity', details: String(err) });
    }
    finally {
        db.close();
    }
}));
// ── Routes: Decks ─────────────────────────────────────────────────────────────
app.get('/api/decks', (_req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    const db = getDbConnection();
    try {
        res.send(yield allSql(db, 'SELECT * FROM decks ORDER BY id DESC'));
    }
    catch (err) {
        res
            .status(500)
            .send({ error: 'Could not fetch decks', details: String(err) });
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
    const image = commander_image ||
        (commander_name ? yield fetchScryfallCardImage(commander_name) : null);
    const db = getDbConnection();
    try {
        const result = yield runSql(db, 'INSERT INTO decks (name, url, commander_image) VALUES (?, ?, ?)', [name.trim(), '', image]);
        res.status(201).send({
            id: result.lastID,
            name: name.trim(),
            url: '',
            commander_image: image,
        });
    }
    catch (err) {
        res
            .status(500)
            .send({ error: 'Could not create deck', details: String(err) });
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
        res
            .status(500)
            .send({ error: 'Could not fetch deck', details: String(err) });
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
            res.status(201).send({
                id: result.lastID,
                name: deckName,
                url,
                commander_image: commanderImage,
            });
        }
        finally {
            db.close();
        }
    }
    catch (err) {
        res
            .status(500)
            .send({ error: 'Could not import deck', details: String(err) });
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
        res
            .status(500)
            .send({ error: 'Could not delete deck', details: String(err) });
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
        res
            .status(500)
            .send({ error: 'Could not fetch events', details: String(err) });
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
        res
            .status(500)
            .send({ error: 'Could not create event', details: String(err) });
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
        res.status(500).send({
            error: 'Could not fetch available decks',
            details: String(err),
        });
    }
    finally {
        db.close();
    }
}));
// ── Routes: Votes ─────────────────────────────────────────────────────────────
app.post('/api/votes', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { eventId, userName, deckIds } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
    if (!eventId ||
        !userName ||
        !Array.isArray(deckIds) ||
        deckIds.length === 0) {
        res.status(400).send({ error: 'eventId, userName, deckIds required' });
        return;
    }
    if (deckIds.length > 2) {
        res.status(400).send({ error: 'Max 2 decks per vote' });
        return;
    }
    const db = getDbConnection();
    try {
        yield runSql(db, 'DELETE FROM votes WHERE event_id = ? AND user_name = ?', [
            eventId,
            userName,
        ]);
        for (const deckId of deckIds) {
            yield runSql(db, 'INSERT INTO votes (event_id, deck_id, user_name) VALUES (?, ?, ?)', [eventId, deckId, userName]);
        }
        res.status(201).send({ ok: true });
    }
    catch (err) {
        res
            .status(500)
            .send({ error: 'Could not save votes', details: String(err) });
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
        res
            .status(500)
            .send({ error: 'Could not fetch summary', details: String(err) });
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
        res
            .status(500)
            .send({ error: 'Could not fetch details', details: String(err) });
    }
    finally {
        db.close();
    }
}));
// ── Routes: Orders ────────────────────────────────────────────────────────────
app.post('/api/orders', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const { moxfieldUrl, notes } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
    const sessionUser = (_b = req.session) === null || _b === void 0 ? void 0 : _b.user;
    const userName = (sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.displayName) || ((_c = req.body.userName) !== null && _c !== void 0 ? _c : '').trim();
    if (!moxfieldUrl || !isValidMoxfieldUrl(moxfieldUrl)) {
        res.status(400).send({ error: 'Valid Moxfield URL required' });
        return;
    }
    if (!userName) {
        res
            .status(400)
            .send({ error: 'User name required (log in or provide userName)' });
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
                (_e = (_d = sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.providers) === null || _d === void 0 ? void 0 : _d[0]) !== null && _e !== void 0 ? _e : '',
                (_f = sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.avatar) !== null && _f !== void 0 ? _f : '',
                moxfieldUrl,
                deckName,
                cardCount,
                totalPrice,
                notes !== null && notes !== void 0 ? notes : '',
            ]);
            res.status(201).send({
                id: result.lastID,
                userName,
                deckName,
                cardCount,
                totalPrice,
                pricePerCard: PRICE_PER_CARD,
                status: 'offen',
            });
        }
        finally {
            db.close();
        }
    }
    catch (err) {
        res
            .status(500)
            .send({ error: 'Could not create order', details: String(err) });
    }
}));
app.get('/api/orders', (_req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    const db = getDbConnection();
    try {
        res.send(yield allSql(db, 'SELECT * FROM orders ORDER BY created_at DESC'));
    }
    catch (err) {
        res
            .status(500)
            .send({ error: 'Could not fetch orders', details: String(err) });
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
        res
            .status(500)
            .send({ error: 'Could not update order', details: String(err) });
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
        const githubStatus = GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET ? 'enabled' : 'disabled';
        const googleStatus = googleEnabled ? 'enabled' : 'disabled';
        const discordStatus = discordEnabled ? 'enabled' : 'disabled';
        console.log(`[MtgPacker API] http://localhost:${port}`);
        console.log(`[MtgPacker API] OAuth: GitHub(${githubStatus}) | Google(${googleStatus}) | Discord(${discordStatus})`);
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