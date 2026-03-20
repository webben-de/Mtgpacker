import cors from 'cors';
import express, { Request, Response } from 'express';
import sqlite3 from 'sqlite3';

const app = express();
const DB_FILE = 'mtg_packer.db';

app.use(cors());
app.use(express.json());

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
        id INTEGER PRIMARY KEY,
        name TEXT,
        url TEXT,
        commander_image TEXT
      )`,
    );

    try {
      await runSql(db, 'ALTER TABLE decks ADD COLUMN commander_image TEXT');
    } catch {
      // ignore existing column
    }

    await runSql(
      db,
      `CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY,
        title TEXT,
        date DATE
      )`,
    );

    await runSql(
      db,
      `CREATE TABLE IF NOT EXISTS votes (
        event_id INTEGER,
        deck_id INTEGER,
        user_name TEXT
      )`,
    );

    try {
      await runSql(db, 'ALTER TABLE votes ADD COLUMN user_name TEXT');
    } catch {
      // ignore existing column
    }
  } finally {
    db.close();
  }
}

function isValidMoxfieldUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      !!parsed.hostname &&
      (parsed.hostname === 'moxfield.com' ||
        parsed.hostname.endsWith('.moxfield.com'))
    );
  } catch {
    return false;
  }
}

async function fetchScryfallAutocomplete(query: string): Promise<string[]> {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    const response = await fetch(
      'https://api.scryfall.com/cards/autocomplete?' +
        new URLSearchParams({ q: query }),
      {
        headers: { 'User-Agent': 'MtgPacker/1.0' },
      },
    );
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

function extractImageUrl(cardData: any): string | null {
  const imageUris =
    cardData?.image_uris ?? cardData?.card_faces?.[0]?.image_uris;
  return imageUris?.normal ?? null;
}

async function fetchScryfallCardImage(
  cardName: string,
): Promise<string | null> {
  if (!cardName) {
    return null;
  }

  try {
    const deQuery = `!\"${cardName}\" lang:de`;
    const deResponse = await fetch(
      'https://api.scryfall.com/cards/search?' +
        new URLSearchParams({ q: deQuery, unique: 'prints' }),
      {
        headers: { 'User-Agent': 'MtgPacker/1.0' },
      },
    );
    if (deResponse.ok) {
      const deData = await deResponse.json();
      const cards = deData.data ?? [];
      if (cards.length > 0) {
        const image = extractImageUrl(cards[0]);
        if (image) {
          return image;
        }
      }
    }
  } catch {
    // fallback handled below
  }

  try {
    const response = await fetch(
      'https://api.scryfall.com/cards/named?' +
        new URLSearchParams({ fuzzy: cardName }),
      {
        headers: { 'User-Agent': 'MtgPacker/1.0' },
      },
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return extractImageUrl(data);
  } catch {
    return null;
  }
}

async function fetchMoxfieldDeck(
  url: string,
): Promise<{ deckName: string; commanderImage: string | null }> {
  const match = url.match(/decks\/([^/]+)/);
  if (!match) {
    return { deckName: 'Unbekanntes Deck', commanderImage: null };
  }

  const deckId = match[1];
  try {
    const response = await fetch(
      `https://api2.moxfield.com/v2/decks/all/${deckId}`,
      {
        headers: { 'User-Agent': 'MtgPacker/1.0' },
      },
    );

    if (response.ok) {
      const data = await response.json();
      const deckName =
        data.name ??
        deckId
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase());

      const commanders = data.commanders ?? {};
      const firstCommander = Object.values(commanders)[0] as any;
      const scryfallId = firstCommander?.card?.scryfall_id;

      if (scryfallId) {
        const scryfallResponse = await fetch(
          `https://api.scryfall.com/cards/${scryfallId}`,
          {
            headers: { 'User-Agent': 'MtgPacker/1.0' },
          },
        );
        if (scryfallResponse.ok) {
          const scryfallData = await scryfallResponse.json();
          return { deckName, commanderImage: extractImageUrl(scryfallData) };
        }
      }

      return { deckName, commanderImage: null };
    }
  } catch {
    // fallback below
  }

  return {
    deckName: deckId
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    commanderImage: null,
  };
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.send({ ok: true });
});

app.get('/api/decks', async (_req: Request, res: Response) => {
  const db = getDbConnection();
  try {
    const decks = await allSql(db, 'SELECT * FROM decks ORDER BY id DESC');
    res.send(decks);
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not fetch decks', details: String(err) });
  } finally {
    db.close();
  }
});

app.post('/api/decks/manual', async (req: Request, res: Response) => {
  const { name, commanderName } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).send({ error: 'Deck name is required' });
    return;
  }

  const trimmedName = name.trim();
  const commanderImage = commanderName
    ? await fetchScryfallCardImage(String(commanderName))
    : null;

  const db = getDbConnection();
  try {
    const result = await runSql(
      db,
      'INSERT INTO decks (name, url, commander_image) VALUES (?, ?, ?)',
      [trimmedName, '', commanderImage],
    );
    res.status(201).send({
      id: result.lastID,
      name: trimmedName,
      url: '',
      commander_image: commanderImage,
    });
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not create deck', details: String(err) });
  } finally {
    db.close();
  }
});

app.post('/api/decks/import-moxfield', async (req: Request, res: Response) => {
  const { url } = req.body ?? {};
  if (!url || typeof url !== 'string' || !isValidMoxfieldUrl(url)) {
    res.status(400).send({ error: 'Please provide a valid Moxfield URL' });
    return;
  }

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
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not import deck', details: String(err) });
  } finally {
    db.close();
  }
});

app.delete('/api/decks/:id', async (req: Request, res: Response) => {
  const deckId = Number(req.params.id);
  if (!Number.isFinite(deckId)) {
    res.status(400).send({ error: 'Invalid deck id' });
    return;
  }

  const db = getDbConnection();
  try {
    await runSql(db, 'DELETE FROM votes WHERE deck_id = ?', [deckId]);
    const result = await runSql(db, 'DELETE FROM decks WHERE id = ?', [deckId]);
    res.send({ deleted: result.changes > 0 });
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not delete deck', details: String(err) });
  } finally {
    db.close();
  }
});

app.get('/api/events', async (_req: Request, res: Response) => {
  const db = getDbConnection();
  try {
    const events = await allSql(db, 'SELECT * FROM events ORDER BY date DESC');
    res.send(events);
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not fetch events', details: String(err) });
  } finally {
    db.close();
  }
});

app.post('/api/events', async (req: Request, res: Response) => {
  const { title, date } = req.body ?? {};
  if (!title || typeof title !== 'string' || !date) {
    res.status(400).send({ error: 'Title and date are required' });
    return;
  }

  const db = getDbConnection();
  try {
    const result = await runSql(
      db,
      'INSERT INTO events (title, date) VALUES (?, ?)',
      [title.trim(), String(date)],
    );
    res
      .status(201)
      .send({ id: result.lastID, title: title.trim(), date: String(date) });
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
    const userName = String(req.query.userName ?? '').trim();
    if (!Number.isFinite(eventId)) {
      res.status(400).send({ error: 'Invalid event id' });
      return;
    }

    const db = getDbConnection();
    try {
      const decks = await allSql<any>(db, 'SELECT * FROM decks');
      const claimedRows = await allSql<{ deck_id: number }>(
        db,
        'SELECT DISTINCT deck_id FROM votes WHERE event_id = ? AND user_name != ?',
        [eventId, userName],
      );
      const claimedDeckIds = new Set(claimedRows.map((r) => r.deck_id));
      const available = decks.filter((d) => !claimedDeckIds.has(d.id));
      res.send(available);
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

app.post('/api/votes', async (req: Request, res: Response) => {
  const { eventId, userName, deckIds } = req.body ?? {};
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
    await runSql(db, 'DELETE FROM votes WHERE event_id = ? AND user_name = ?', [
      parsedEventId,
      normalizedUser,
    ]);

    const unavailableRows = await allSql<{ deck_id: number }>(
      db,
      'SELECT DISTINCT deck_id FROM votes WHERE event_id = ? AND user_name != ?',
      [parsedEventId, normalizedUser],
    );
    const unavailableDeckIds = new Set(
      unavailableRows.map((row) => row.deck_id),
    );
    if (ids.some((id) => unavailableDeckIds.has(id))) {
      res
        .status(409)
        .send({ error: 'One or more selected decks are no longer available' });
      return;
    }

    for (const deckId of ids) {
      await runSql(
        db,
        'INSERT INTO votes (event_id, deck_id, user_name) VALUES (?, ?, ?)',
        [parsedEventId, deckId, normalizedUser],
      );
    }
    res.status(201).send({ success: true });
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not submit votes', details: String(err) });
  } finally {
    db.close();
  }
});

app.get('/api/results/summary', async (_req: Request, res: Response) => {
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
    const rows = await allSql(db, query);
    res.send(rows);
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
    const query = `
      SELECT e.title as event, d.name as deck, v.user_name as teilnehmer
      FROM votes v
      JOIN decks d ON v.deck_id = d.id
      JOIN events e ON v.event_id = e.id
      ORDER BY e.title, v.user_name
    `;
    const rows = await allSql(db, query);
    res.send(rows);
  } catch (err) {
    res
      .status(500)
      .send({ error: 'Could not fetch details', details: String(err) });
  } finally {
    db.close();
  }
});

app.get('/api/scryfall/autocomplete', async (req: Request, res: Response) => {
  const query = String(req.query.q ?? '');
  const suggestions = await fetchScryfallAutocomplete(query);
  res.send(suggestions);
});

app.get('/api/scryfall/card-image', async (req: Request, res: Response) => {
  const name = String(req.query.name ?? '');
  const imageUrl = await fetchScryfallCardImage(name);
  res.send({ imageUrl });
});

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
