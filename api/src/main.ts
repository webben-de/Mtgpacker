import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import session from 'express-session';
import { execFile } from 'child_process';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import sqlite3 from 'sqlite3';

// ── DB setup ──────────────────────────────────────────────────────────────────

const DB_FILE = process.env['DB_PATH'] ?? 'mtg_packer.db';
const PRICE_PER_CARD = 0.07; // €

function getDbConnection(): sqlite3.Database {
  return new sqlite3.Database(DB_FILE);
}

function runSql(
  db: sqlite3.Database,
  sql: string,
  params: unknown[] = [],
): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onResult(err) {
      if (err) { reject(err); return; }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function allSql<T>(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows: T[]) => {
      if (err) { reject(err); return; }
      resolve(rows);
    });
  });
}

function getSql<T>(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row: T) => {
      if (err) { reject(err); return; }
      resolve(row);
    });
  });
}

async function initDb(): Promise<void> {
  const db = getDbConnection();
  try {
    await runSql(db, `CREATE TABLE IF NOT EXISTS decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT DEFAULT '',
      commander_image TEXT
    )`);

    await runSql(db, `CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date DATE NOT NULL
    )`);

    await runSql(db, `CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      deck_id INTEGER NOT NULL,
      user_name TEXT NOT NULL
    )`);

    await runSql(db, `CREATE TABLE IF NOT EXISTS orders (
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
    ] as [string, string, string][]) {
      try { await runSql(db, `ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch { /* exists */ }
    }
  } finally {
    db.close();
  }
}

// ── Auth config ───────────────────────────────────────────────────────────────

const GITHUB_CLIENT_ID = process.env['GITHUB_CLIENT_ID'] ?? '';
const GITHUB_CLIENT_SECRET = process.env['GITHUB_CLIENT_SECRET'] ?? '';
const SESSION_SECRET = process.env['SESSION_SECRET'] ?? 'mtgpacker-dev-secret';
const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:3333';
const ADMIN_USERS = (process.env['ADMIN_USERS'] ?? '')
  .split(',')
  .map((u) => u.trim().toLowerCase())
  .filter(Boolean);

const oauthEnabled = Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);

interface GitHubUser {
  id: string;
  login: string;
  displayName: string;
  avatar: string;
  isAdmin: boolean;
}

declare module 'express-session' {
  interface SessionData {
    user?: GitHubUser;
  }
}

if (oauthEnabled) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: `${BASE_URL}/api/auth/github/callback`,
        scope: ['read:user'],
      },
      (_accessToken: string, _refreshToken: string, profile: any, done: Function) => {
        const user: GitHubUser = {
          id: profile.id,
          login: profile.username ?? '',
          displayName: profile.displayName ?? profile.username ?? '',
          avatar: profile.photos?.[0]?.value ?? '',
          isAdmin: ADMIN_USERS.includes((profile.username ?? '').toLowerCase()),
        };
        done(null, user);
      },
    ),
  );
  passport.serializeUser((user: any, done) => done(null, user));
  passport.deserializeUser((obj: any, done) => done(null, obj));
}

// ── Express setup ─────────────────────────────────────────────────────────────

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 },
  }),
);

if (oauthEnabled) {
  app.use(passport.initialize());
  app.use(passport.session());
}

function isAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.session?.user;
  if (!oauthEnabled || (user && user.isAdmin)) { next(); return; }
  res.status(403).send({ error: 'Admin access required' });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidMoxfieldUrl(url: string): boolean {
  try {
    const p = new URL(url);
    return p.hostname === 'moxfield.com' || p.hostname.endsWith('.moxfield.com');
  } catch { return false; }
}

function extractImageUrl(cardData: any): string | null {
  const uris = cardData?.image_uris ?? cardData?.card_faces?.[0]?.image_uris;
  return uris?.normal ?? null;
}

async function fetchScryfallAutocomplete(query: string): Promise<string[]> {
  if (!query || query.length < 2) return [];
  try {
    const r = await fetch(
      'https://api.scryfall.com/cards/autocomplete?' + new URLSearchParams({ q: query }),
      { headers: { 'User-Agent': 'MtgPacker/1.0' } },
    );
    if (!r.ok) return [];
    return (await r.json()).data ?? [];
  } catch { return []; }
}

async function fetchScryfallCardImage(cardName: string): Promise<string | null> {
  if (!cardName) return null;
  try {
    const r = await fetch(
      'https://api.scryfall.com/cards/named?' + new URLSearchParams({ fuzzy: cardName }),
      { headers: { 'User-Agent': 'MtgPacker/1.0' } },
    );
    if (!r.ok) return null;
    return extractImageUrl(await r.json());
  } catch { return null; }
}

/** Fetch a URL via curl to bypass Cloudflare TLS fingerprinting on Moxfield */
function fetchViaCurl(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    execFile('curl', [
      '-s', '--compressed',
      '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      '-H', 'Accept: application/json, text/plain, */*',
      '-H', 'Accept-Language: en-US,en;q=0.9',
      '-H', 'Referer: https://www.moxfield.com/',
      '-H', 'Origin: https://www.moxfield.com',
      url,
    ], { maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      try { resolve(JSON.parse(stdout)); }
      catch (e) { reject(new Error(`JSON parse failed: ${stderr || stdout.slice(0, 200)}`)); }
    });
  });
}


interface MoxfieldResult {
  deckName: string;
  commanderImage: string | null;
  cardCount: number;
  cardList: Array<{ name: string; quantity: number; set?: string }>;
}

async function fetchMoxfieldDeck(url: string): Promise<MoxfieldResult> {
  const match = url.match(/decks\/([^/?#]+)/);
  const fallback = (slug: string): MoxfieldResult => ({
    deckName: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    commanderImage: null,
    cardCount: 0,
    cardList: [],
  });

  if (!match) return fallback('unbekannt');
  const deckId = match[1];

  try {
    const data: any = await fetchViaCurl(`https://api2.moxfield.com/v2/decks/all/${deckId}`);

    // Deck name — try multiple fields
    const deckName: string =
      data.name ||
      data.deckTitleDisplay ||
      data.publicUrl?.split('/').pop()?.replace(/-/g, ' ') ||
      deckId.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

    // Card list (mainboard + commanders + sideboard)
    const sections: Array<{ [cardId: string]: { card: any; quantity: number } }> = [
      data.commanders ?? {},
      data.mainboard ?? {},
      data.sideboard ?? {},
    ];
    const cardList: MoxfieldResult['cardList'] = [];
    let cardCount = 0;
    for (const section of sections) {
      for (const entry of Object.values(section)) {
        const qty: number = (entry as any).quantity ?? 1;
        const name: string = (entry as any).card?.name ?? 'Unknown';
        const set: string = (entry as any).card?.set ?? '';
        cardList.push({ name, quantity: qty, set });
        cardCount += qty;
      }
    }

    // Commander image — cascade through multiple strategies
    let commanderImage: string | null = null;

    const commanders = data.commanders ?? {};
    const firstCommander = Object.values(commanders)[0] as any;
    const commanderCard = firstCommander?.card;

    // 1. Try Scryfall ID from Moxfield
    if (commanderCard?.scryfall_id) {
      try {
        const sr = await fetch(`https://api.scryfall.com/cards/${commanderCard.scryfall_id}`, {
          headers: { 'User-Agent': 'MtgPacker/1.0' },
        });
        if (sr.ok) commanderImage = extractImageUrl(await sr.json());
      } catch { /* fall through */ }
    }

    // 2. Try commander name search
    if (!commanderImage && commanderCard?.name) {
      commanderImage = await fetchScryfallCardImage(commanderCard.name);
    }

    // 3. Try deck name as card name (for mono-commander decks titled by commander)
    if (!commanderImage) {
      commanderImage = await fetchScryfallCardImage(deckName);
    }

    return { deckName, commanderImage, cardCount, cardList };
  } catch {
    return fallback(deckId);
  }
}

// ── Routes: Auth ──────────────────────────────────────────────────────────────

app.get('/api/auth/me', (req: Request, res: Response) => {
  if (req.session?.user) {
    res.send(req.session.user);
  } else {
    res.send(null);
  }
});

if (oauthEnabled) {
  app.get('/api/auth/github', passport.authenticate('github'));

  app.get(
    '/api/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/?auth=failed' }),
    (req: Request, res: Response) => {
      req.session.user = req.user as GitHubUser;
      res.redirect('/');
    },
  );
} else {
  // Dev mode: auto-login as admin
  app.get('/api/auth/github', (req: Request, res: Response) => {
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

app.post('/api/auth/logout', (req: Request, res: Response) => {
  req.session.destroy(() => res.send({ ok: true }));
});

// ── Routes: Health ────────────────────────────────────────────────────────────

app.get('/api/health', (_req: Request, res: Response) => {
  res.send({ ok: true, oauthEnabled });
});

// ── Routes: Decks ─────────────────────────────────────────────────────────────

app.get('/api/decks', async (_req: Request, res: Response) => {
  const db = getDbConnection();
  try {
    res.send(await allSql(db, 'SELECT * FROM decks ORDER BY id DESC'));
  } catch (err) {
    res.status(500).send({ error: 'Could not fetch decks', details: String(err) });
  } finally { db.close(); }
});

app.post('/api/decks', async (req: Request, res: Response) => {
  const { name, commander_name, commander_image } = req.body ?? {};
  if (!name?.trim()) { res.status(400).send({ error: 'Deck name is required' }); return; }
  const image = commander_image || (commander_name ? await fetchScryfallCardImage(commander_name) : null);
  const db = getDbConnection();
  try {
    const result = await runSql(db, 'INSERT INTO decks (name, url, commander_image) VALUES (?, ?, ?)', [name.trim(), '', image]);
    res.status(201).send({ id: result.lastID, name: name.trim(), url: '', commander_image: image });
  } catch (err) {
    res.status(500).send({ error: 'Could not create deck', details: String(err) });
  } finally { db.close(); }
});

// Preview a Moxfield deck without saving (used by order form too)
app.post('/api/decks/preview-moxfield', async (req: Request, res: Response) => {
  const { url } = req.body ?? {};
  if (!url || !isValidMoxfieldUrl(url)) { res.status(400).send({ error: 'Invalid Moxfield URL' }); return; }
  try {
    const result = await fetchMoxfieldDeck(url);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: 'Could not fetch deck', details: String(err) });
  }
});

app.post('/api/decks/import-moxfield', async (req: Request, res: Response) => {
  const { url } = req.body ?? {};
  if (!url || !isValidMoxfieldUrl(url)) { res.status(400).send({ error: 'Invalid Moxfield URL' }); return; }
  try {
    const { deckName, commanderImage } = await fetchMoxfieldDeck(url);
    const db = getDbConnection();
    try {
      const result = await runSql(db, 'INSERT INTO decks (name, url, commander_image) VALUES (?, ?, ?)', [deckName, url, commanderImage]);
      res.status(201).send({ id: result.lastID, name: deckName, url, commander_image: commanderImage });
    } finally { db.close(); }
  } catch (err) {
    res.status(500).send({ error: 'Could not import deck', details: String(err) });
  }
});

app.delete('/api/decks/:id', isAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).send({ error: 'Invalid deck id' }); return; }
  const db = getDbConnection();
  try {
    await runSql(db, 'DELETE FROM decks WHERE id = ?', [id]);
    res.send({ ok: true });
  } catch (err) {
    res.status(500).send({ error: 'Could not delete deck', details: String(err) });
  } finally { db.close(); }
});

// ── Routes: Events ────────────────────────────────────────────────────────────

app.get('/api/events', async (_req: Request, res: Response) => {
  const db = getDbConnection();
  try {
    res.send(await allSql(db, 'SELECT * FROM events ORDER BY date DESC'));
  } catch (err) {
    res.status(500).send({ error: 'Could not fetch events', details: String(err) });
  } finally { db.close(); }
});

app.post('/api/events', isAdmin, async (req: Request, res: Response) => {
  const { title, date } = req.body ?? {};
  if (!title?.trim() || !date) { res.status(400).send({ error: 'title and date required' }); return; }
  const db = getDbConnection();
  try {
    const result = await runSql(db, 'INSERT INTO events (title, date) VALUES (?, ?)', [title.trim(), date]);
    res.status(201).send({ id: result.lastID, title: title.trim(), date });
  } catch (err) {
    res.status(500).send({ error: 'Could not create event', details: String(err) });
  } finally { db.close(); }
});

app.get('/api/events/:eventId/available-decks', async (req: Request, res: Response) => {
  const eventId = Number(req.params.eventId);
  const userName = String(req.query['userName'] ?? '').trim();
  if (!Number.isFinite(eventId) || !userName) {
    res.status(400).send({ error: 'eventId and userName required' });
    return;
  }
  const db = getDbConnection();
  try {
    const voted = await allSql<{ deck_id: number }>(
      db, 'SELECT deck_id FROM votes WHERE event_id = ? AND user_name != ?', [eventId, userName],
    );
    const takenIds = voted.map((v) => v.deck_id);
    const decks = await allSql<{ id: number }>(db, 'SELECT * FROM decks ORDER BY id DESC');
    res.send(decks.filter((d) => !takenIds.includes(d.id)));
  } catch (err) {
    res.status(500).send({ error: 'Could not fetch available decks', details: String(err) });
  } finally { db.close(); }
});

// ── Routes: Votes ─────────────────────────────────────────────────────────────

app.post('/api/votes', async (req: Request, res: Response) => {
  const { eventId, userName, deckIds } = req.body ?? {};
  if (!eventId || !userName || !Array.isArray(deckIds) || deckIds.length === 0) {
    res.status(400).send({ error: 'eventId, userName, deckIds required' }); return;
  }
  if (deckIds.length > 2) { res.status(400).send({ error: 'Max 2 decks per vote' }); return; }
  const db = getDbConnection();
  try {
    await runSql(db, 'DELETE FROM votes WHERE event_id = ? AND user_name = ?', [eventId, userName]);
    for (const deckId of deckIds) {
      await runSql(db, 'INSERT INTO votes (event_id, deck_id, user_name) VALUES (?, ?, ?)', [eventId, deckId, userName]);
    }
    res.status(201).send({ ok: true });
  } catch (err) {
    res.status(500).send({ error: 'Could not save votes', details: String(err) });
  } finally { db.close(); }
});

// ── Routes: Results ───────────────────────────────────────────────────────────

app.get('/api/results/summary', async (_req: Request, res: Response) => {
  const db = getDbConnection();
  try {
    res.send(await allSql(db,
      `SELECT e.title, d.name, COUNT(*) as stimmen
       FROM votes v
       JOIN decks d ON v.deck_id = d.id
       JOIN events e ON v.event_id = e.id
       GROUP BY v.event_id, v.deck_id
       ORDER BY stimmen DESC`,
    ));
  } catch (err) {
    res.status(500).send({ error: 'Could not fetch summary', details: String(err) });
  } finally { db.close(); }
});

app.get('/api/results/details', async (_req: Request, res: Response) => {
  const db = getDbConnection();
  try {
    res.send(await allSql(db,
      `SELECT e.title as event, d.name as deck, v.user_name as teilnehmer
       FROM votes v
       JOIN decks d ON v.deck_id = d.id
       JOIN events e ON v.event_id = e.id
       ORDER BY e.date DESC, d.name`,
    ));
  } catch (err) {
    res.status(500).send({ error: 'Could not fetch details', details: String(err) });
  } finally { db.close(); }
});

// ── Routes: Orders ────────────────────────────────────────────────────────────

app.post('/api/orders', async (req: Request, res: Response) => {
  const { moxfieldUrl, notes } = req.body ?? {};
  const sessionUser = req.session?.user;
  const userName: string = sessionUser?.displayName || sessionUser?.login || (req.body.userName ?? '').trim();

  if (!moxfieldUrl || !isValidMoxfieldUrl(moxfieldUrl)) {
    res.status(400).send({ error: 'Valid Moxfield URL required' }); return;
  }
  if (!userName) {
    res.status(400).send({ error: 'User name required (log in or provide userName)' }); return;
  }

  try {
    const { deckName, cardCount } = await fetchMoxfieldDeck(moxfieldUrl);
    const totalPrice = Math.round(cardCount * PRICE_PER_CARD * 100) / 100;

    const db = getDbConnection();
    try {
      const result = await runSql(db,
        `INSERT INTO orders (user_name, github_login, github_avatar, moxfield_url, deck_name, card_count, total_price, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userName,
          sessionUser?.login ?? '',
          sessionUser?.avatar ?? '',
          moxfieldUrl,
          deckName,
          cardCount,
          totalPrice,
          notes ?? '',
        ],
      );
      res.status(201).send({
        id: result.lastID, userName, deckName, cardCount, totalPrice,
        pricePerCard: PRICE_PER_CARD, status: 'offen',
      });
    } finally { db.close(); }
  } catch (err) {
    res.status(500).send({ error: 'Could not create order', details: String(err) });
  }
});

app.get('/api/orders', async (_req: Request, res: Response) => {
  const db = getDbConnection();
  try {
    res.send(await allSql(db, 'SELECT * FROM orders ORDER BY created_at DESC'));
  } catch (err) {
    res.status(500).send({ error: 'Could not fetch orders', details: String(err) });
  } finally { db.close(); }
});

app.patch('/api/orders/:id', isAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { status } = req.body ?? {};
  const allowed = ['offen', 'in Bearbeitung', 'abgeschlossen', 'storniert'];
  if (!Number.isFinite(id) || !allowed.includes(status)) {
    res.status(400).send({ error: 'Invalid id or status' }); return;
  }
  const db = getDbConnection();
  try {
    await runSql(db, 'UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    res.send({ ok: true });
  } catch (err) {
    res.status(500).send({ error: 'Could not update order', details: String(err) });
  } finally { db.close(); }
});

// ── Routes: Scryfall ──────────────────────────────────────────────────────────

app.get('/api/scryfall/autocomplete', async (req: Request, res: Response) => {
  const q = String(req.query['q'] ?? '');
  res.send({ data: await fetchScryfallAutocomplete(q) });
});

app.get('/api/scryfall/card-image', async (req: Request, res: Response) => {
  const name = String(req.query['name'] ?? '');
  if (!name) { res.status(400).send({ error: 'name required' }); return; }
  const imageUrl = await fetchScryfallCardImage(name);
  if (!imageUrl) { res.status(404).send({ error: 'Card not found' }); return; }
  res.send({ imageUrl });
});

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
