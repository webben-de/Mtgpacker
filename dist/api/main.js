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

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1);
const cors_1 = tslib_1.__importDefault(__webpack_require__(2));
const express_1 = tslib_1.__importDefault(__webpack_require__(3));
const sqlite3_1 = tslib_1.__importDefault(__webpack_require__(4));
const app = (0, express_1.default)();
const DB_FILE = 'mtg_packer.db';
app.use((0, cors_1.default)());
app.use(express_1.default.json());
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
        id INTEGER PRIMARY KEY,
        name TEXT,
        url TEXT,
        commander_image TEXT
      )`);
            try {
                yield runSql(db, 'ALTER TABLE decks ADD COLUMN commander_image TEXT');
            }
            catch (_a) {
                // ignore existing column
            }
            yield runSql(db, `CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY,
        title TEXT,
        date DATE
      )`);
            yield runSql(db, `CREATE TABLE IF NOT EXISTS votes (
        event_id INTEGER,
        deck_id INTEGER,
        user_name TEXT
      )`);
            try {
                yield runSql(db, 'ALTER TABLE votes ADD COLUMN user_name TEXT');
            }
            catch (_b) {
                // ignore existing column
            }
        }
        finally {
            db.close();
        }
    });
}
function isValidMoxfieldUrl(url) {
    try {
        const parsed = new URL(url);
        return (!!parsed.hostname &&
            (parsed.hostname === 'moxfield.com' ||
                parsed.hostname.endsWith('.moxfield.com')));
    }
    catch (_a) {
        return false;
    }
}
function fetchScryfallAutocomplete(query) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!query || query.length < 2) {
            return [];
        }
        try {
            const response = yield fetch('https://api.scryfall.com/cards/autocomplete?' +
                new URLSearchParams({ q: query }), {
                headers: { 'User-Agent': 'MtgPacker/1.0' },
            });
            if (!response.ok) {
                return [];
            }
            const data = yield response.json();
            return (_a = data.data) !== null && _a !== void 0 ? _a : [];
        }
        catch (_b) {
            return [];
        }
    });
}
function extractImageUrl(cardData) {
    var _a, _b, _c, _d;
    const imageUris = (_a = cardData === null || cardData === void 0 ? void 0 : cardData.image_uris) !== null && _a !== void 0 ? _a : (_c = (_b = cardData === null || cardData === void 0 ? void 0 : cardData.card_faces) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.image_uris;
    return (_d = imageUris === null || imageUris === void 0 ? void 0 : imageUris.normal) !== null && _d !== void 0 ? _d : null;
}
function fetchScryfallCardImage(cardName) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!cardName) {
            return null;
        }
        try {
            const deQuery = `!\"${cardName}\" lang:de`;
            const deResponse = yield fetch('https://api.scryfall.com/cards/search?' +
                new URLSearchParams({ q: deQuery, unique: 'prints' }), {
                headers: { 'User-Agent': 'MtgPacker/1.0' },
            });
            if (deResponse.ok) {
                const deData = yield deResponse.json();
                const cards = (_a = deData.data) !== null && _a !== void 0 ? _a : [];
                if (cards.length > 0) {
                    const image = extractImageUrl(cards[0]);
                    if (image) {
                        return image;
                    }
                }
            }
        }
        catch (_b) {
            // fallback handled below
        }
        try {
            const response = yield fetch('https://api.scryfall.com/cards/named?' +
                new URLSearchParams({ fuzzy: cardName }), {
                headers: { 'User-Agent': 'MtgPacker/1.0' },
            });
            if (!response.ok) {
                return null;
            }
            const data = yield response.json();
            return extractImageUrl(data);
        }
        catch (_c) {
            return null;
        }
    });
}
function fetchMoxfieldDeck(url) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const match = url.match(/decks\/([^/]+)/);
        if (!match) {
            return { deckName: 'Unbekanntes Deck', commanderImage: null };
        }
        const deckId = match[1];
        try {
            const response = yield fetch(`https://api2.moxfield.com/v2/decks/all/${deckId}`, {
                headers: { 'User-Agent': 'MtgPacker/1.0' },
            });
            if (response.ok) {
                const data = yield response.json();
                const deckName = (_a = data.name) !== null && _a !== void 0 ? _a : deckId
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                const commanders = (_b = data.commanders) !== null && _b !== void 0 ? _b : {};
                const firstCommander = Object.values(commanders)[0];
                const scryfallId = (_c = firstCommander === null || firstCommander === void 0 ? void 0 : firstCommander.card) === null || _c === void 0 ? void 0 : _c.scryfall_id;
                if (scryfallId) {
                    const scryfallResponse = yield fetch(`https://api.scryfall.com/cards/${scryfallId}`, {
                        headers: { 'User-Agent': 'MtgPacker/1.0' },
                    });
                    if (scryfallResponse.ok) {
                        const scryfallData = yield scryfallResponse.json();
                        return { deckName, commanderImage: extractImageUrl(scryfallData) };
                    }
                }
                return { deckName, commanderImage: null };
            }
        }
        catch (_d) {
            // fallback below
        }
        return {
            deckName: deckId
                .replace(/-/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase()),
            commanderImage: null,
        };
    });
}
app.get('/api/health', (_req, res) => {
    res.send({ ok: true });
});
app.get('/api/decks', (_req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    const db = getDbConnection();
    try {
        const decks = yield allSql(db, 'SELECT * FROM decks ORDER BY id DESC');
        res.send(decks);
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
app.post('/api/decks/manual', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { name, commanderName } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
    if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).send({ error: 'Deck name is required' });
        return;
    }
    const trimmedName = name.trim();
    const commanderImage = commanderName
        ? yield fetchScryfallCardImage(String(commanderName))
        : null;
    const db = getDbConnection();
    try {
        const result = yield runSql(db, 'INSERT INTO decks (name, url, commander_image) VALUES (?, ?, ?)', [trimmedName, '', commanderImage]);
        res.status(201).send({
            id: result.lastID,
            name: trimmedName,
            url: '',
            commander_image: commanderImage,
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
app.post('/api/decks/import-moxfield', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { url } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
    if (!url || typeof url !== 'string' || !isValidMoxfieldUrl(url)) {
        res.status(400).send({ error: 'Please provide a valid Moxfield URL' });
        return;
    }
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
    catch (err) {
        res
            .status(500)
            .send({ error: 'Could not import deck', details: String(err) });
    }
    finally {
        db.close();
    }
}));
app.delete('/api/decks/:id', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    const deckId = Number(req.params.id);
    if (!Number.isFinite(deckId)) {
        res.status(400).send({ error: 'Invalid deck id' });
        return;
    }
    const db = getDbConnection();
    try {
        yield runSql(db, 'DELETE FROM votes WHERE deck_id = ?', [deckId]);
        const result = yield runSql(db, 'DELETE FROM decks WHERE id = ?', [deckId]);
        res.send({ deleted: result.changes > 0 });
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
app.get('/api/events', (_req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    const db = getDbConnection();
    try {
        const events = yield allSql(db, 'SELECT * FROM events ORDER BY date DESC');
        res.send(events);
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
app.post('/api/events', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { title, date } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
    if (!title || typeof title !== 'string' || !date) {
        res.status(400).send({ error: 'Title and date are required' });
        return;
    }
    const db = getDbConnection();
    try {
        const result = yield runSql(db, 'INSERT INTO events (title, date) VALUES (?, ?)', [title.trim(), String(date)]);
        res
            .status(201)
            .send({ id: result.lastID, title: title.trim(), date: String(date) });
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
    const userName = String((_a = req.query.userName) !== null && _a !== void 0 ? _a : '').trim();
    if (!Number.isFinite(eventId)) {
        res.status(400).send({ error: 'Invalid event id' });
        return;
    }
    const db = getDbConnection();
    try {
        const decks = yield allSql(db, 'SELECT * FROM decks');
        const claimedRows = yield allSql(db, 'SELECT DISTINCT deck_id FROM votes WHERE event_id = ? AND user_name != ?', [eventId, userName]);
        const claimedDeckIds = new Set(claimedRows.map((r) => r.deck_id));
        const available = decks.filter((d) => !claimedDeckIds.has(d.id));
        res.send(available);
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
app.post('/api/votes', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { eventId, userName, deckIds } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
    const parsedEventId = Number(eventId);
    const normalizedUser = typeof userName === 'string' ? userName.trim() : '';
    if (!Number.isFinite(parsedEventId) || !normalizedUser) {
        res.status(400).send({ error: 'eventId and userName are required' });
        return;
    }
    if (!Array.isArray(deckIds) || deckIds.length < 1 || deckIds.length > 2) {
        res.status(400).send({ error: 'Please select 1 or 2 decks' });
        return;
    }
    const ids = deckIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));
    if (ids.length !== deckIds.length) {
        res.status(400).send({ error: 'Invalid deck ids' });
        return;
    }
    const db = getDbConnection();
    try {
        yield runSql(db, 'DELETE FROM votes WHERE event_id = ? AND user_name = ?', [
            parsedEventId,
            normalizedUser,
        ]);
        const unavailableRows = yield allSql(db, 'SELECT DISTINCT deck_id FROM votes WHERE event_id = ? AND user_name != ?', [parsedEventId, normalizedUser]);
        const unavailableDeckIds = new Set(unavailableRows.map((row) => row.deck_id));
        if (ids.some((id) => unavailableDeckIds.has(id))) {
            res
                .status(409)
                .send({ error: 'One or more selected decks are no longer available' });
            return;
        }
        for (const deckId of ids) {
            yield runSql(db, 'INSERT INTO votes (event_id, deck_id, user_name) VALUES (?, ?, ?)', [parsedEventId, deckId, normalizedUser]);
        }
        res.status(201).send({ success: true });
    }
    catch (err) {
        res
            .status(500)
            .send({ error: 'Could not submit votes', details: String(err) });
    }
    finally {
        db.close();
    }
}));
app.get('/api/results/summary', (_req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    const db = getDbConnection();
    try {
        const query = `
      SELECT e.title, d.name, COUNT(v.deck_id) as stimmen
      FROM votes v
      JOIN decks d ON v.deck_id = d.id
      JOIN events e ON v.event_id = e.id
      GROUP BY v.event_id, v.deck_id
      ORDER BY stimmen DESC
    `;
        const rows = yield allSql(db, query);
        res.send(rows);
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
        const query = `
      SELECT e.title as event, d.name as deck, v.user_name as teilnehmer
      FROM votes v
      JOIN decks d ON v.deck_id = d.id
      JOIN events e ON v.event_id = e.id
      ORDER BY e.title, v.user_name
    `;
        const rows = yield allSql(db, query);
        res.send(rows);
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
app.get('/api/scryfall/autocomplete', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const query = String((_a = req.query.q) !== null && _a !== void 0 ? _a : '');
    const suggestions = yield fetchScryfallAutocomplete(query);
    res.send(suggestions);
}));
app.get('/api/scryfall/card-image', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const name = String((_a = req.query.name) !== null && _a !== void 0 ? _a : '');
    const imageUrl = yield fetchScryfallCardImage(name);
    res.send({ imageUrl });
}));
const port = process.env.PORT || 3333;
initDb()
    .then(() => {
    const server = app.listen(port, () => {
        console.log(`Listening at http://localhost:${port}/api`);
    });
    server.on('error', console.error);
})
    .catch((error) => {
    console.error('Failed to initialize database', error);
    process.exit(1);
});

})();

/******/ })()
;
//# sourceMappingURL=main.js.map