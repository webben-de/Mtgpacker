// passport-discord types are declared in ./passport-discord.d.ts
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import session from 'express-session';
import { execFile } from 'child_process';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as DiscordStrategy } from 'passport-discord';
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
      if (err) {
        reject(err);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function allSql<T>(
  db: sqlite3.Database,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows: T[]) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

function getSql<T>(
  db: sqlite3.Database,
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row: T) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

async function initDb(): Promise<void> {
  const db = getDbConnection();
  try {
    await runSql(
      db,
      `CREATE TABLE IF NOT EXISTS decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT DEFAULT '',
      commander_image TEXT
    )`,
    );

    await runSql(
      db,
      `CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date DATE NOT NULL
    )`,
    );

    await runSql(
      db,
      `CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      deck_id INTEGER NOT NULL,
      user_name TEXT NOT NULL
    )`,
    );

    await runSql(
      db,
      `CREATE TABLE IF NOT EXISTS orders (
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
    )`,
    );

    await runSql(
      db,
      `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL,
      email TEXT,
      avatar TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    );

    await runSql(
      db,
      `CREATE TABLE IF NOT EXISTS user_identities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      provider_username TEXT,
      provider_avatar TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(provider, provider_id)
    )`,
    );

    // Migrations: add columns if missing
    for (const [table, col, def] of [
      ['decks', 'commander_image', 'TEXT'],
      ['votes', 'user_name', 'TEXT'],
      ['orders', 'github_avatar', "TEXT DEFAULT ''"],
    ] as [string, string, string][]) {
      try {
        await runSql(db, `ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
      } catch {
        /* exists */
      }
    }
  } finally {
    db.close();
  }
}

// ── Auth config ───────────────────────────────────────────────────────────────

const GITHUB_CLIENT_ID = process.env['GITHUB_CLIENT_ID'] ?? '';
const GITHUB_CLIENT_SECRET = process.env['GITHUB_CLIENT_SECRET'] ?? '';
const GOOGLE_CLIENT_ID = process.env['GOOGLE_CLIENT_ID'] ?? '';
const GOOGLE_CLIENT_SECRET = process.env['GOOGLE_CLIENT_SECRET'] ?? '';
const DISCORD_CLIENT_ID = process.env['DISCORD_CLIENT_ID'] ?? '';
const DISCORD_CLIENT_SECRET = process.env['DISCORD_CLIENT_SECRET'] ?? '';
const SESSION_SECRET = process.env['SESSION_SECRET'] ?? 'mtgpacker-dev-secret';
const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:3333';
const ADMIN_USERS = (process.env['ADMIN_USERS'] ?? '')
  .split(',')
  .map((u) => u.trim().toLowerCase())
  .filter(Boolean);

const googleEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
const discordEnabled = Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET);
const oauthEnabled = Boolean(
  (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) || googleEnabled || discordEnabled,
);

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionUser {
  id: number;
  displayName: string;
  avatar: string;
  role: 'user' | 'admin';
  isAdmin: boolean;
  providers?: string[];
}

interface DbUser {
  id: number;
  display_name: string;
  email: string | null;
  avatar: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

interface DbIdentity {
  id: number;
  user_id: number;
  provider: string;
  provider_id: string;
  provider_username: string | null;
  provider_avatar: string | null;
  created_at: string;
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}

// ── findOrCreateUser ──────────────────────────────────────────────────────────

async function findOrCreateUser(
  db: sqlite3.Database,
  provider: string,
  providerId: string,
  profile: {
    displayName: string;
    avatar: string;
    email?: string;
    username?: string;
  },
): Promise<SessionUser> {
  const existingIdentity = await getSql<DbIdentity>(
    db,
    'SELECT * FROM user_identities WHERE provider = ? AND provider_id = ?',
    [provider, providerId],
  );

  let userId: number;

  if (existingIdentity) {
    userId = existingIdentity.user_id;
    await runSql(
      db,
      'UPDATE user_identities SET provider_username = ?, provider_avatar = ? WHERE provider = ? AND provider_id = ?',
      [profile.username ?? profile.displayName, profile.avatar, provider, providerId],
    );
    await runSql(
      db,
      "UPDATE users SET avatar = ?, updated_at = datetime('now') WHERE id = ? AND (avatar IS NULL OR avatar = '')",
      [profile.avatar, userId],
    );
  } else {
    const isAdminUser =
      provider === 'github' &&
      ADMIN_USERS.includes((profile.username ?? '').toLowerCase());

    const userResult = await runSql(
      db,
      'INSERT INTO users (display_name, email, avatar, role) VALUES (?, ?, ?, ?)',
      [
        profile.displayName,
        profile.email ?? null,
        profile.avatar,
        isAdminUser ? 'admin' : 'user',
      ],
    );
    userId = userResult.lastID;

    await runSql(
      db,
      'INSERT INTO user_identities (user_id, provider, provider_id, provider_username, provider_avatar) VALUES (?, ?, ?, ?, ?)',
      [userId, provider, providerId, profile.username ?? profile.displayName, profile.avatar],
    );
  }

  const user = await getSql<DbUser>(db, 'SELECT * FROM users WHERE id = ?', [userId]);
  const identities = await allSql<DbIdentity>(
    db,
    'SELECT provider FROM user_identities WHERE user_id = ?',
    [userId],
  );

  if (!user) throw new Error('User not found after create/update');

  return {
    id: user.id,
    displayName: user.display_name,
    avatar: user.avatar ?? '',
    role: user.role as 'user' | 'admin',
    isAdmin: user.role === 'admin',
    providers: identities.map((i) => i.provider),
  };
}

// ── Passport strategies ───────────────────────────────────────────────────────

if (oauthEnabled) {
  if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: GITHUB_CLIENT_ID,
          clientSecret: GITHUB_CLIENT_SECRET,
          callbackURL: `${BASE_URL}/api/auth/github/callback`,
          scope: ['read:user'],
        },
        async (
          _accessToken: string,
          _refreshToken: string,
          profile: { id: string; username?: string; displayName?: string; photos?: Array<{ value?: string }> },
          done: (error: Error | null, user?: SessionUser) => void,
        ) => {
          const db = getDbConnection();
          try {
            const user = await findOrCreateUser(db, 'github', profile.id, {
              displayName: profile.displayName ?? profile.username ?? '',
              avatar: profile.photos?.[0]?.value ?? '',
              username: profile.username,
            });
            done(null, user);
          } catch (err) {
            done(err as Error);
          } finally {
            db.close();
          }
        },
      ),
    );
  }

  if (googleEnabled) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          callbackURL: `${BASE_URL}/api/auth/google/callback`,
        },
        async (
          _accessToken: string,
          _refreshToken: string,
          profile: {
            id: string;
            displayName?: string;
            photos?: Array<{ value?: string }>;
            emails?: Array<{ value?: string }>;
          },
          done: (error: Error | null, user?: SessionUser) => void,
        ) => {
          const db = getDbConnection();
          try {
            const user = await findOrCreateUser(db, 'google', profile.id, {
              displayName: profile.displayName ?? '',
              avatar: profile.photos?.[0]?.value ?? '',
              email: profile.emails?.[0]?.value,
            });
            done(null, user);
          } catch (err) {
            done(err as Error);
          } finally {
            db.close();
          }
        },
      ),
    );
  }

  if (discordEnabled) {
    passport.use(
      new DiscordStrategy(
        {
          clientID: DISCORD_CLIENT_ID,
          clientSecret: DISCORD_CLIENT_SECRET,
          callbackURL: `${BASE_URL}/api/auth/discord/callback`,
          scope: ['identify', 'email'],
        },
        async (
          _accessToken: string,
          _refreshToken: string,
          profile: { id: string; username: string; avatar?: string; email?: string },
          done: (err: Error | null, user?: unknown) => void,
        ) => {
          const db = getDbConnection();
          try {
            const avatarUrl = profile.avatar
              ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
              : '';
            const user = await findOrCreateUser(db, 'discord', profile.id, {
              displayName: profile.username,
              avatar: avatarUrl,
              username: profile.username,
              email: profile.email,
            });
            done(null, user);
          } catch (err) {
            done(err as Error);
          } finally {
            db.close();
          }
        },
      ),
    );
  }

  passport.serializeUser((user: SessionUser, done) => done(null, user));
  passport.deserializeUser((obj: SessionUser, done) => done(null, obj));
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

// ── Auth middleware ───────────────────────────────────────────────────────────

function isAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.session?.user;
  if (!oauthEnabled || (user && user.isAdmin)) {
    next();
    return;
  }
  res.status(403).send({ error: 'Admin access required' });
}

function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!oauthEnabled || req.session?.user) {
    next();
    return;
  }
  res.status(401).send({ error: 'Authentication required' });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidMoxfieldUrl(url: string): boolean {
  try {
    const p = new URL(url);
    return (
      p.hostname === 'moxfield.com' || p.hostname.endsWith('.moxfield.com')
    );
  } catch {
    return false;
  }
}

interface ScryfallImageUris {
  normal?: string;
}

interface ScryfallCardLike {
  image_uris?: ScryfallImageUris;
  card_faces?: Array<{ image_uris?: ScryfallImageUris }>;
}

function extractImageUrl(cardData: unknown): string | null {
  const data = cardData as ScryfallCardLike;
  const uris = data.image_uris ?? data.card_faces?.[0]?.image_uris;
  return uris?.normal ?? null;
}

async function fetchScryfallAutocomplete(query: string): Promise<string[]> {
  if (!query || query.length < 2) return [];
  try {
    const r = await fetch(
      'https://api.scryfall.com/cards/autocomplete?' +
        new URLSearchParams({ q: query }),
      { headers: { 'User-Agent': 'MtgPacker/1.0' } },
    );
    if (!r.ok) return [];
    return (await r.json()).data ?? [];
  } catch {
    return [];
  }
}

async function fetchScryfallCardImage(
  cardName: string,
): Promise<string | null> {
  if (!cardName) return null;
  try {
    const r = await fetch(
      'https://api.scryfall.com/cards/named?' +
        new URLSearchParams({ fuzzy: cardName }),
      { headers: { 'User-Agent': 'MtgPacker/1.0' } },
    );
    if (!r.ok) return null;
    return extractImageUrl(await r.json());
  } catch {
    return null;
  }
}

/** Fetch a URL via curl to bypass Cloudflare TLS fingerprinting on Moxfield */
function fetchViaCurl(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    execFile(
      'curl',
      [
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
      ],
      { maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(err);
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(
            new Error(`JSON parse failed: ${stderr || stdout.slice(0, 200)}`),
          );
        }
      },
    );
  });
}

interface MoxfieldCard {
  name?: string;
  set?: string;
  scryfall_id?: string;
}

interface MoxfieldCardEntry {
  card?: MoxfieldCard;
  quantity?: number;
}

interface MoxfieldDeckData {
  name?: string;
  deckTitleDisplay?: string;
  publicUrl?: string;
  commanders?: Record<string, MoxfieldCardEntry>;
  mainboard?: Record<string, MoxfieldCardEntry>;
  sideboard?: Record<string, MoxfieldCardEntry>;
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
    const data = (await fetchViaCurl(
      `https://api2.moxfield.com/v2/decks/all/${deckId}`,
    )) as MoxfieldDeckData;

    // Deck name — try multiple fields
    const deckName: string =
      data.name ||
      data.deckTitleDisplay ||
      data.publicUrl?.split('/').pop()?.replace(/-/g, ' ') ||
      deckId
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase());

    // Card list (mainboard + commanders + sideboard)
    const sections: Array<Record<string, MoxfieldCardEntry>> = [
      data.commanders ?? {},
      data.mainboard ?? {},
      data.sideboard ?? {},
    ];
    const cardList: MoxfieldResult['cardList'] = [];
    let cardCount = 0;
    for (const section of sections) {
      for (const entry of Object.values(section)) {
        const qty = entry.quantity ?? 1;
        const name = entry.card?.name ?? 'Unknown';
        const set = entry.card?.set ?? '';
        cardList.push({ name, quantity: qty, set });
        cardCount += qty;
      }
    }

    // Commander image — cascade through multiple strategies
    let commanderImage: string | null = null;

    const commanders = data.commanders ?? {};
    const firstCommander = Object.values(commanders)[0];
    const commanderCard = firstCommander?.card;

    // 1. Try Scryfall ID from Moxfield
    if (commanderCard?.scryfall_id) {
      try {
        const sr = await fetch(
          `https://api.scryfall.com/cards/${commanderCard.scryfall_id}`,
          {
            headers: { 'User-Agent': 'MtgPacker/1.0' },
          },
        );
        if (sr.ok) commanderImage = extractImageUrl(await sr.json());
      } catch {
        /* fall through */
      }
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
  res.send(req.session?.user ?? null);
});

if (oauthEnabled) {
  if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
    app.get('/api/auth/github', passport.authenticate('github'));
    app.get(
      '/api/auth/github/callback',
      passport.authenticate('github', { failureRedirect: '/?auth=failed' }),
      (req: Request, res: Response) => {
        req.session.user = req.user as SessionUser;
        res.redirect('/');
      },
    );
  }

  if (googleEnabled) {
    app.get(
      '/api/auth/google',
      passport.authenticate('google', { scope: ['profile', 'email'] }),
    );
    app.get(
      '/api/auth/google/callback',
      passport.authenticate('google', { failureRedirect: '/?auth=failed' }),
      (req: Request, res: Response) => {
        req.session.user = req.user as SessionUser;
        res.redirect('/');
      },
    );
  }

  if (discordEnabled) {
    app.get('/api/auth/discord', passport.authenticate('discord'));
    app.get(
      '/api/auth/discord/callback',
      passport.authenticate('discord', { failureRedirect: '/?auth=failed' }),
      (req: Request, res: Response) => {
        req.session.user = req.user as SessionUser;
        res.redirect('/');
      },
    );
  }
} else {
  // Dev mode: auto-login as admin for all providers
  for (const provider of ['github', 'google', 'discord']) {
    app.get(`/api/auth/${provider}`, async (req: Request, res: Response) => {
      const db = getDbConnection();
      try {
        const user = await findOrCreateUser(db, 'dev', '1', {
          displayName: 'Dev User',
          avatar: '',
          username: 'dev',
        });
        user.isAdmin = true;
        user.role = 'admin';
        req.session.user = user;
      } finally {
        db.close();
      }
      res.redirect('/');
    });
  }
}

app.post('/api/auth/logout', (req: Request, res: Response) => {
  req.session.destroy(() => res.send({ ok: true }));
});

// ── Routes: Health ────────────────────────────────────────────────────────────

app.get('/api/health', (_req: Request, res: Response) => {
  res.send({ ok: true, oauthEnabled, googleEnabled, discordEnabled });
});

// ── Routes: Users ─────────────────────────────────────────────────────────────

interface UserWithIdentities {
  id: number;
  display_name: string;
  email: string | null;
  avatar: string | null;
  role: string;
  created_at: string;
  providers: Array<{
    provider: string;
    provider_username: string | null;
    provider_avatar: string | null;
  }>;
}

app.get('/api/users', isAdmin, async (_req: Request, res: Response) => {
  const db = getDbConnection();
  try {
    const users = await allSql<DbUser>(db, 'SELECT * FROM users ORDER BY created_at DESC');
    const result: UserWithIdentities[] = await Promise.all(
      users.map(async (u) => {
        const identities = await allSql<{
          provider: string;
          provider_username: string | null;
          provider_avatar: string | null;
        }>(
          db,
          'SELECT provider, provider_username, provider_avatar FROM user_identities WHERE user_id = ?',
          [u.id],
        );
        return {
          id: u.id,
          display_name: u.display_name,
          email: u.email,
          avatar: u.avatar,
          role: u.role,
          created_at: u.created_at,
          providers: identities,
        };
      }),
    );
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: 'Could not fetch users', details: String(err) });
  } finally {
    db.close();
  }
});

app.get('/api/users/:id', isAuthenticated, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const sessionUser = req.session?.user;
  if (!Number.isFinite(id)) {
    res.status(400).send({ error: 'Invalid user id' });
    return;
  }
  if (!sessionUser?.isAdmin && sessionUser?.id !== id) {
    res.status(403).send({ error: 'Forbidden' });
    return;
  }
  const db = getDbConnection();
  try {
    const user = await getSql<DbUser>(db, 'SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      res.status(404).send({ error: 'User not found' });
      return;
    }
    const identities = await allSql<{
      provider: string;
      provider_username: string | null;
      provider_avatar: string | null;
    }>(
      db,
      'SELECT provider, provider_username, provider_avatar FROM user_identities WHERE user_id = ?',
      [id],
    );
    res.send({
      id: user.id,
      display_name: user.display_name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      created_at: user.created_at,
      providers: identities,
    });
  } catch (err) {
    res.status(500).send({ error: 'Could not fetch user', details: String(err) });
  } finally {
    db.close();
  }
});

app.patch('/api/users/:id', isAuthenticated, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const sessionUser = req.session?.user;
  if (!Number.isFinite(id)) {
    res.status(400).send({ error: 'Invalid user id' });
    return;
  }
  if (!sessionUser?.isAdmin && sessionUser?.id !== id) {
    res.status(403).send({ error: 'Forbidden' });
    return;
  }
  const { display_name, avatar } = req.body ?? {};
  if (!display_name?.trim() && avatar === undefined) {
    res.status(400).send({ error: 'display_name or avatar required' });
    return;
  }
  const db = getDbConnection();
  try {
    if (display_name?.trim()) {
      await runSql(
        db,
        "UPDATE users SET display_name = ?, updated_at = datetime('now') WHERE id = ?",
        [display_name.trim(), id],
      );
    }
    if (avatar !== undefined) {
      await runSql(
        db,
        "UPDATE users SET avatar = ?, updated_at = datetime('now') WHERE id = ?",
        [avatar, id],
      );
    }
    res.send({ ok: true });
  } catch (err) {
    res.status(500).send({ error: 'Could not update user', details: String(err) });
  } finally {
    db.close();
  }
});

app.patch('/api/users/:id/role', isAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { role } = req.body ?? {};
  if (!Number.isFinite(id) || !['user', 'admin'].includes(role)) {
    res.status(400).send({ error: 'Invalid id or role' });
    return;
  }
  const db = getDbConnection();
  try {
    await runSql(
      db,
      "UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?",
      [role, id],
    );
    res.send({ ok: true });
  } catch (err) {
    res.status(500).send({ error: 'Could not update role', details: String(err) });
  } finally {
    db.close();
  }
});

app.delete('/api/users/:id', isAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).send({ error: 'Invalid user id' });
    return;
  }
  const db = getDbConnection();
  try {
    await runSql(db, 'DELETE FROM users WHERE id = ?', [id]);
    res.send({ ok: true });
  } catch (err) {
    res.status(500).send({ error: 'Could not delete user', details: String(err) });
  } finally {
    db.close();
  }
});

app.get('/api/users/:id/identities', isAuthenticated, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const sessionUser = req.session?.user;
  if (!Number.isFinite(id)) {
    res.status(400).send({ error: 'Invalid user id' });
    return;
  }
  if (!sessionUser?.isAdmin && sessionUser?.id !== id) {
    res.status(403).send({ error: 'Forbidden' });
    return;
  }
  const db = getDbConnection();
  try {
    const identities = await allSql<DbIdentity>(
      db,
      'SELECT * FROM user_identities WHERE user_id = ?',
      [id],
    );
    res.send(identities);
  } catch (err) {
    res.status(500).send({ error: 'Could not fetch identities', details: String(err) });
  } finally {
    db.close();
  }
});

app.delete(
  '/api/users/:id/identities/:provider',
  isAuthenticated,
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { provider } = req.params;
    const sessionUser = req.session?.user;
    if (!Number.isFinite(id)) {
      res.status(400).send({ error: 'Invalid user id' });
      return;
    }
    if (!sessionUser?.isAdmin && sessionUser?.id !== id) {
      res.status(403).send({ error: 'Forbidden' });
      return;
    }
    const db = getDbConnection();
    try {
      // Prevent unlinking the last identity
      const count = await getSql<{ cnt: number }>(
        db,
        'SELECT COUNT(*) as cnt FROM user_identities WHERE user_id = ?',
        [id],
      );
      if ((count?.cnt ?? 0) <= 1) {
        res.status(400).send({ error: 'Cannot unlink the last identity' });
        return;
      }
      await runSql(
        db,
        'DELETE FROM user_identities WHERE user_id = ? AND provider = ?',
        [id, provider],
      );
      res.send({ ok: true });
    } catch (err) {
      res.status(500).send({ error: 'Could not unlink identity', details: String(err) });
    } finally {
      db.close();
    }
  },
);

// ── Routes: Decks ─────────────────────────────────────────────────────────────

app.get('/api/decks', async (_req: Request, res: Response) => {
  const db = getDbConnection();
  try {
    res.send(await allSql(db, 'SELECT * FROM decks ORDER BY id DESC'));
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not fetch decks', details: String(err) });
  } finally {
    db.close();
  }
});

app.post('/api/decks', async (req: Request, res: Response) => {
  const { name, commander_name, commander_image } = req.body ?? {};
  if (!name?.trim()) {
    res.status(400).send({ error: 'Deck name is required' });
    return;
  }
  const image =
    commander_image ||
    (commander_name ? await fetchScryfallCardImage(commander_name) : null);
  const db = getDbConnection();
  try {
    const result = await runSql(
      db,
      'INSERT INTO decks (name, url, commander_image) VALUES (?, ?, ?)',
      [name.trim(), '', image],
    );
    res.status(201).send({
      id: result.lastID,
      name: name.trim(),
      url: '',
      commander_image: image,
    });
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not create deck', details: String(err) });
  } finally {
    db.close();
  }
});

// Preview a Moxfield deck without saving (used by order form too)
app.post('/api/decks/preview-moxfield', async (req: Request, res: Response) => {
  const { url } = req.body ?? {};
  if (!url || !isValidMoxfieldUrl(url)) {
    res.status(400).send({ error: 'Invalid Moxfield URL' });
    return;
  }
  try {
    const result = await fetchMoxfieldDeck(url);
    res.send(result);
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not fetch deck', details: String(err) });
  }
});

app.post('/api/decks/import-moxfield', async (req: Request, res: Response) => {
  const { url } = req.body ?? {};
  if (!url || !isValidMoxfieldUrl(url)) {
    res.status(400).send({ error: 'Invalid Moxfield URL' });
    return;
  }
  try {
    const { deckName, commanderImage } = await fetchMoxfieldDeck(url);
    const db = getDbConnection();
    try {
      const result = await runSql(
        db,
        'INSERT INTO decks (name, url, commander_image) VALUES (?, ?, ?)',
        [deckName, url, commanderImage],
      );
      res.status(201).send({
        id: result.lastID,
        name: deckName,
        url,
        commander_image: commanderImage,
      });
    } finally {
      db.close();
    }
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not import deck', details: String(err) });
  }
});

app.delete('/api/decks/:id', isAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).send({ error: 'Invalid deck id' });
    return;
  }
  const db = getDbConnection();
  try {
    await runSql(db, 'DELETE FROM decks WHERE id = ?', [id]);
    res.send({ ok: true });
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not delete deck', details: String(err) });
  } finally {
    db.close();
  }
});

// ── Routes: Events ────────────────────────────────────────────────────────────

app.get('/api/events', async (_req: Request, res: Response) => {
  const db = getDbConnection();
  try {
    res.send(await allSql(db, 'SELECT * FROM events ORDER BY date DESC'));
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not fetch events', details: String(err) });
  } finally {
    db.close();
  }
});

app.post('/api/events', isAdmin, async (req: Request, res: Response) => {
  const { title, date } = req.body ?? {};
  if (!title?.trim() || !date) {
    res.status(400).send({ error: 'title and date required' });
    return;
  }
  const db = getDbConnection();
  try {
    const result = await runSql(
      db,
      'INSERT INTO events (title, date) VALUES (?, ?)',
      [title.trim(), date],
    );
    res.status(201).send({ id: result.lastID, title: title.trim(), date });
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not create event', details: String(err) });
  } finally {
    db.close();
  }
});

app.get(
  '/api/events/:eventId/available-decks',
  async (req: Request, res: Response) => {
    const eventId = Number(req.params.eventId);
    const userName = String(req.query['userName'] ?? '').trim();
    if (!Number.isFinite(eventId) || !userName) {
      res.status(400).send({ error: 'eventId and userName required' });
      return;
    }
    const db = getDbConnection();
    try {
      const voted = await allSql<{ deck_id: number }>(
        db,
        'SELECT deck_id FROM votes WHERE event_id = ? AND user_name != ?',
        [eventId, userName],
      );
      const takenIds = voted.map((v) => v.deck_id);
      const decks = await allSql<{ id: number }>(
        db,
        'SELECT * FROM decks ORDER BY id DESC',
      );
      res.send(decks.filter((d) => !takenIds.includes(d.id)));
    } catch (err) {
      res.status(500).send({
        error: 'Could not fetch available decks',
        details: String(err),
      });
    } finally {
      db.close();
    }
  },
);

// ── Routes: Votes ─────────────────────────────────────────────────────────────

app.post('/api/votes', async (req: Request, res: Response) => {
  const { eventId, userName, deckIds } = req.body ?? {};
  if (
    !eventId ||
    !userName ||
    !Array.isArray(deckIds) ||
    deckIds.length === 0
  ) {
    res.status(400).send({ error: 'eventId, userName, deckIds required' });
    return;
  }
  if (deckIds.length > 2) {
    res.status(400).send({ error: 'Max 2 decks per vote' });
    return;
  }
  const db = getDbConnection();
  try {
    await runSql(db, 'DELETE FROM votes WHERE event_id = ? AND user_name = ?', [
      eventId,
      userName,
    ]);
    for (const deckId of deckIds) {
      await runSql(
        db,
        'INSERT INTO votes (event_id, deck_id, user_name) VALUES (?, ?, ?)',
        [eventId, deckId, userName],
      );
    }
    res.status(201).send({ ok: true });
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not save votes', details: String(err) });
  } finally {
    db.close();
  }
});

// ── Routes: Results ───────────────────────────────────────────────────────────

app.get('/api/results/summary', async (_req: Request, res: Response) => {
  const db = getDbConnection();
  try {
    res.send(
      await allSql(
        db,
        `SELECT e.title, d.name, COUNT(*) as stimmen
       FROM votes v
       JOIN decks d ON v.deck_id = d.id
       JOIN events e ON v.event_id = e.id
       GROUP BY v.event_id, v.deck_id
       ORDER BY stimmen DESC`,
      ),
    );
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not fetch summary', details: String(err) });
  } finally {
    db.close();
  }
});

app.get('/api/results/details', async (_req: Request, res: Response) => {
  const db = getDbConnection();
  try {
    res.send(
      await allSql(
        db,
        `SELECT e.title as event, d.name as deck, v.user_name as teilnehmer
       FROM votes v
       JOIN decks d ON v.deck_id = d.id
       JOIN events e ON v.event_id = e.id
       ORDER BY e.date DESC, d.name`,
      ),
    );
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not fetch details', details: String(err) });
  } finally {
    db.close();
  }
});

// ── Routes: Orders ────────────────────────────────────────────────────────────

app.post('/api/orders', async (req: Request, res: Response) => {
  const { moxfieldUrl, notes } = req.body ?? {};
  const sessionUser = req.session?.user;
  const userName: string =
    sessionUser?.displayName || (req.body.userName ?? '').trim();

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
    const { deckName, cardCount } = await fetchMoxfieldDeck(moxfieldUrl);
    const totalPrice = Math.round(cardCount * PRICE_PER_CARD * 100) / 100;

    const db = getDbConnection();
    try {
      const result = await runSql(
        db,
        `INSERT INTO orders (user_name, github_login, github_avatar, moxfield_url, deck_name, card_count, total_price, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userName,
          sessionUser?.providers?.[0] ?? '',
          sessionUser?.avatar ?? '',
          moxfieldUrl,
          deckName,
          cardCount,
          totalPrice,
          notes ?? '',
        ],
      );
      res.status(201).send({
        id: result.lastID,
        userName,
        deckName,
        cardCount,
        totalPrice,
        pricePerCard: PRICE_PER_CARD,
        status: 'offen',
      });
    } finally {
      db.close();
    }
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not create order', details: String(err) });
  }
});

app.get('/api/orders', async (_req: Request, res: Response) => {
  const db = getDbConnection();
  try {
    res.send(await allSql(db, 'SELECT * FROM orders ORDER BY created_at DESC'));
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not fetch orders', details: String(err) });
  } finally {
    db.close();
  }
});

app.patch('/api/orders/:id', isAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { status } = req.body ?? {};
  const allowed = ['offen', 'in Bearbeitung', 'abgeschlossen', 'storniert'];
  if (!Number.isFinite(id) || !allowed.includes(status)) {
    res.status(400).send({ error: 'Invalid id or status' });
    return;
  }
  const db = getDbConnection();
  try {
    await runSql(db, 'UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    res.send({ ok: true });
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not update order', details: String(err) });
  } finally {
    db.close();
  }
});

// ── Routes: Scryfall ──────────────────────────────────────────────────────────

app.get('/api/scryfall/autocomplete', async (req: Request, res: Response) => {
  const q = String(req.query['q'] ?? '');
  res.send({ data: await fetchScryfallAutocomplete(q) });
});

app.get('/api/scryfall/card-image', async (req: Request, res: Response) => {
  const name = String(req.query['name'] ?? '');
  if (!name) {
    res.status(400).send({ error: 'name required' });
    return;
  }
  const imageUrl = await fetchScryfallCardImage(name);
  if (!imageUrl) {
    res.status(404).send({ error: 'Card not found' });
    return;
  }
  res.send({ imageUrl });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const port = process.env['PORT'] ? Number(process.env['PORT']) : 3333;

initDb()
  .then(() => {
    app.listen(port, () => {
      const githubStatus = GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET ? 'enabled' : 'disabled';
      const googleStatus = googleEnabled ? 'enabled' : 'disabled';
      const discordStatus = discordEnabled ? 'enabled' : 'disabled';
      console.log(`[MtgPacker API] http://localhost:${port}`);
      console.log(
        `[MtgPacker API] OAuth: GitHub(${githubStatus}) | Google(${googleStatus}) | Discord(${discordStatus})`,
      );
      console.log(
        `[MtgPacker API] Admin users: ${ADMIN_USERS.length ? ADMIN_USERS.join(', ') : '(all, dev mode)'}`,
      );
    });
  })
  .catch((err) => {
    console.error('DB init failed', err);
    process.exit(1);
  });
