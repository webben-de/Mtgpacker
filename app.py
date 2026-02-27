import streamlit as st
import sqlite3
import pandas as pd
import requests
import re

# --- DATENBANK SETUP ---
def init_db():
    conn = sqlite3.connect('mtg_packer.db')
    c = conn.cursor()
    # Tabelle für Decks
    c.execute('''CREATE TABLE IF NOT EXISTS decks 
                 (id INTEGER PRIMARY KEY, name TEXT, url TEXT, commander_image TEXT)''')
    # Migration: add commander_image column to existing databases
    try:
        c.execute("ALTER TABLE decks ADD COLUMN commander_image TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists
    # Tabelle für Events
    c.execute('''CREATE TABLE IF NOT EXISTS events 
                 (id INTEGER PRIMARY KEY, title TEXT, date DATE)''')
    # Tabelle für Stimmen/Wünsche
    c.execute('''CREATE TABLE IF NOT EXISTS votes 
                 (event_id INTEGER, deck_id INTEGER, user_name TEXT)''')
    # Migration: add user_name column to existing databases
    try:
        c.execute("ALTER TABLE votes ADD COLUMN user_name TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists
    conn.commit()
    conn.close()

def get_db_connection():
    return sqlite3.connect('mtg_packer.db')

# --- HELPER: SCRYFALL ---
@st.cache_data(ttl=300)
def fetch_scryfall_autocomplete(query):
    """Return a list of card name suggestions from Scryfall autocomplete."""
    if not query or len(query) < 2:
        return []
    try:
        resp = requests.get(
            "https://api.scryfall.com/cards/autocomplete",
            params={"q": query},
            headers={"User-Agent": "MtgPacker/1.0"},
            timeout=5,
        )
        if resp.status_code == 200:
            return resp.json().get("data", [])
    except (requests.RequestException, ValueError):
        pass
    return []


@st.cache_data(ttl=3600)
def fetch_scryfall_card_image(card_name):
    """Return the normal card image URL for a card by (fuzzy) name from Scryfall.
    Prefers the German printing; falls back to English if unavailable."""
    if not card_name:
        return None
    # Try German version first
    try:
        resp_de = requests.get(
            "https://api.scryfall.com/cards/search",
            params={"q": f'!"{card_name}" lang:de', "unique": "prints"},
            headers={"User-Agent": "MtgPacker/1.0"},
            timeout=10,
        )
        if resp_de.status_code == 200:
            cards = resp_de.json().get("data", [])
            if cards:
                image_uris = cards[0].get("image_uris") or (
                    cards[0].get("card_faces", [{}])[0].get("image_uris", {})
                )
                img = image_uris.get("normal")
                if img:
                    return img
    except (requests.RequestException, ValueError):
        pass
    # Fallback: English version
    try:
        resp = requests.get(
            "https://api.scryfall.com/cards/named",
            params={"fuzzy": card_name},
            headers={"User-Agent": "MtgPacker/1.0"},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            image_uris = data.get("image_uris") or (
                data.get("card_faces", [{}])[0].get("image_uris", {})
            )
            return image_uris.get("normal")
    except (requests.RequestException, ValueError):
        pass
    return None


# --- HELPER: MOXFIELD IMPORT ---
def fetch_moxfield_deck(url):
    """Fetch deck name and commander card art URL from Moxfield API."""
    match = re.search(r'decks/([^/]+)', url)
    if not match:
        return "Unbekanntes Deck", None
    deck_id = match.group(1)
    try:
        resp = requests.get(
            f"https://api2.moxfield.com/v2/decks/all/{deck_id}",
            headers={"User-Agent": "MtgPacker/1.0"},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            deck_name = data.get("name", deck_id.replace("-", " ").title())
            commander_image = None
            commanders = data.get("commanders", {})
            if commanders:
                first = next(iter(commanders.values()))
                card = first.get("card", {})
                scryfall_id = card.get("scryfall_id")
                if scryfall_id:
                    sf = requests.get(
                        f"https://api.scryfall.com/cards/{scryfall_id}",
                        headers={"User-Agent": "MtgPacker/1.0"},
                        timeout=10,
                    )
                    if sf.status_code == 200:
                        sf_data = sf.json()
                        image_uris = sf_data.get("image_uris") or (
                            sf_data.get("card_faces", [{}])[0].get("image_uris", {})
                        )
                        commander_image = image_uris.get("normal")
            return deck_name, commander_image
    except (requests.RequestException, ValueError):
        pass
    # Fallback: derive name from URL
    return deck_id.replace("-", " ").title(), None

# --- APP LAYOUT ---
st.set_page_config(page_title="MtG Suitcase Optimizer", layout="wide")
init_db()

st.title("🧙‍♂️ MtG Koffer-Packer")
st.caption("Plane deine Magic-Abende und nimm nur mit, was wirklich gespielt wird.")

# Sidebar zur Navigation
menu = st.sidebar.radio("Navigation", ["Teilnehmer-Ansicht", "Verwalter-Bereich"])

# --- VERWALTER BEREICH ---
if menu == "Verwalter-Bereich":
    st.header("Admin Dashboard")
    
    tab1, tab2, tab3 = st.tabs(["Deck-Verwaltung", "Event erstellen", "Auswertung"])
    
    with tab1:
        st.subheader("Neues Deck hinzufügen")

        add_mode = st.radio("Importmethode", ["Moxfield-Import", "Manuell (Scryfall-Suche)"], horizontal=True)

        if add_mode == "Moxfield-Import":
            mox_url = st.text_input("Moxfield Link", placeholder="https://www.moxfield.com/decks/...")
            if st.button("Deck importieren"):
                from urllib.parse import urlparse
                parsed = urlparse(mox_url)
                if parsed.hostname and (parsed.hostname == "moxfield.com" or parsed.hostname.endswith(".moxfield.com")):
                    deck_name, commander_image = fetch_moxfield_deck(mox_url)
                    conn = get_db_connection()
                    c = conn.cursor()
                    c.execute(
                        "INSERT INTO decks (name, url, commander_image) VALUES (?, ?, ?)",
                        (deck_name, mox_url, commander_image),
                    )
                    conn.commit()
                    conn.close()
                    st.success(f"Deck '{deck_name}' wurde hinzugefügt!")
                    if commander_image:
                        st.image(commander_image, caption=f"Commander – {deck_name}", use_container_width=True)
                else:
                    st.error("Bitte einen gültigen Moxfield-Link eingeben.")
        else:
            manual_deck_name = st.text_input("Deck-Name", placeholder="z. B. Zur's Weirding Control")
            commander_query = st.text_input(
                "Commander suchen (Scryfall-Syntax)",
                placeholder="z. B. Atraxa, Praetors' Voice",
                key="commander_query",
            )
            suggestions = []
            if commander_query:
                suggestions = fetch_scryfall_autocomplete(commander_query)

            selected_commander = None
            if suggestions:
                selected_commander = st.selectbox("Vorschläge", suggestions, key="commander_select")
            elif commander_query:
                st.caption("Keine Vorschläge gefunden – Name wird direkt verwendet.")
                selected_commander = commander_query

            if selected_commander:
                preview_image = fetch_scryfall_card_image(selected_commander)
                if preview_image:
                    st.image(preview_image, caption=f"Commander-Vorschau: {selected_commander}", width=200)

            if st.button("Deck manuell hinzufügen"):
                if not manual_deck_name.strip():
                    st.error("Bitte einen Deck-Namen eingeben.")
                else:
                    commander_image = fetch_scryfall_card_image(selected_commander) if selected_commander else None
                    conn = get_db_connection()
                    c = conn.cursor()
                    c.execute(
                        "INSERT INTO decks (name, url, commander_image) VALUES (?, ?, ?)",
                        (manual_deck_name.strip(), "", commander_image),
                    )
                    conn.commit()
                    conn.close()
                    st.success(f"Deck '{manual_deck_name.strip()}' wurde hinzugefügt!")
                    if commander_image:
                        st.image(commander_image, caption=f"Commander – {selected_commander}", use_container_width=True)
        
        st.subheader("Deine Deckliste")
        conn = get_db_connection()
        all_decks = pd.read_sql_query("SELECT * FROM decks", conn)
        conn.close()

        if all_decks.empty:
            st.info("Noch keine Decks vorhanden.")
        else:
            for _, deck_row in all_decks.iterrows():
                with st.container(border=True):
                    col_img, col_info, col_del = st.columns([1, 5, 1])
                    with col_img:
                        if pd.notna(deck_row.get("commander_image")) and deck_row["commander_image"]:
                            st.image(deck_row["commander_image"], width=80)
                        else:
                            st.write("🃏")
                    with col_info:
                        st.markdown(f"**{deck_row['name']}**")
                        if deck_row.get("url"):
                            st.markdown(f"[Moxfield]({deck_row['url']})", unsafe_allow_html=False)
                    with col_del:
                        if st.button("🗑️ Löschen", key=f"del_deck_{deck_row['id']}", help="Deck löschen", type="secondary"):
                            conn2 = get_db_connection()
                            c2 = conn2.cursor()
                            c2.execute("DELETE FROM decks WHERE id = ?", (deck_row['id'],))
                            c2.execute("DELETE FROM votes WHERE deck_id = ?", (deck_row['id'],))
                            conn2.commit()
                            conn2.close()
                            st.toast(f"Deck '{deck_row['name']}' wurde gelöscht.", icon="🗑️")
                            st.rerun()

    with tab2:
        st.subheader("Neuen Spieleabend planen")
        e_title = st.text_input("Event Name", placeholder="Friday Night Magic")
        e_date = st.date_input("Datum")
        if st.button("Event anlegen"):
            conn = get_db_connection()
            c = conn.cursor()
            c.execute("INSERT INTO events (title, date) VALUES (?, ?)", (e_title, e_date))
            conn.commit()
            conn.close()
            st.success(f"Event '{e_title}' am {e_date} erstellt.")

    with tab3:
        st.subheader("Packliste (Top Votes)")
        conn = get_db_connection()
        query = '''
            SELECT e.title, d.name, COUNT(v.deck_id) as Stimmen
            FROM votes v
            JOIN decks d ON v.deck_id = d.id
            JOIN events e ON v.event_id = e.id
            GROUP BY v.event_id, v.deck_id
            ORDER BY Stimmen DESC
        '''
        results = pd.read_sql_query(query, conn)
        st.table(results)
        st.subheader("Teilnehmer Details")
        detail_query = '''
            SELECT e.title as Event, d.name as Deck, v.user_name as Teilnehmer
            FROM votes v
            JOIN decks d ON v.deck_id = d.id
            JOIN events e ON v.event_id = e.id
            ORDER BY e.title, v.user_name
        '''
        details = pd.read_sql_query(detail_query, conn)
        conn.close()
        st.table(details)

# --- TEILNEHMER ANSICHT ---
else:
    st.header("🗳️ Abstimmung für den nächsten Abend")

    user_name = st.text_input("👤 Dein Name", placeholder="Vor- oder Spitzname")

    conn = get_db_connection()
    events = pd.read_sql_query("SELECT * FROM events ORDER BY date DESC", conn)

    if events.empty:
        st.info("Aktuell sind keine Events geplant.")
    else:
        event_options = {f"{row['title']} ({row['date']})": row['id'] for index, row in events.iterrows()}
        selected_event_label = st.selectbox("📅 Event auswählen:", list(event_options.keys()))
        selected_event_id = event_options[selected_event_label]

        st.divider()
        st.markdown("### 🃏 Welche Decks soll ich mitbringen? *(max. 2)*")

        decks = pd.read_sql_query("SELECT * FROM decks", conn)

        # Only show decks not yet claimed by another user for this event
        claimed_query = '''
            SELECT DISTINCT deck_id FROM votes
            WHERE event_id = ? AND user_name != ?
        '''
        claimed_rows = conn.execute(claimed_query, (selected_event_id, user_name.strip())).fetchall()
        claimed_deck_ids = {row[0] for row in claimed_rows}
        available_decks = decks[~decks['id'].isin(claimed_deck_ids)]

        # Card grid with checkboxes
        selected_decks = []
        cols_per_row = 3
        deck_list = list(available_decks.iterrows())
        for i in range(0, len(deck_list), cols_per_row):
            row_cols = st.columns(cols_per_row)
            for j, (_, row) in enumerate(deck_list[i:i + cols_per_row]):
                with row_cols[j]:
                    with st.container(border=True):
                        if pd.notna(row.get("commander_image")) and row["commander_image"]:
                            st.image(row["commander_image"], use_container_width=True)
                        else:
                            st.markdown("🃏")
                        checked = st.checkbox(f"**{row['name']}**", key=f"deck_{row['id']}")
                        if checked:
                            selected_decks.append(row['id'])

        st.divider()
        submit_col, info_col = st.columns([2, 3])
        with submit_col:
            if st.button("✅ Wünsche abschicken", type="primary", use_container_width=True):
                if not user_name.strip():
                    st.warning("Bitte gib deinen Namen ein, damit wir Rückfragen stellen können.")
                elif 0 < len(selected_decks) <= 2:
                    c = conn.cursor()
                    for d_id in selected_decks:
                        c.execute("INSERT INTO votes (event_id, deck_id, user_name) VALUES (?, ?, ?)", (selected_event_id, d_id, user_name.strip()))
                    conn.commit()
                    st.success("🎉 Deine Wünsche wurden gespeichert! Ich packe entsprechend.")
                else:
                    st.warning("Bitte wähle 1 oder 2 Decks aus.")
        with info_col:
            if selected_decks:
                st.info(f"Du hast {len(selected_decks)} Deck(s) ausgewählt.")
    conn.close()

# --- FOOTER ---
st.sidebar.markdown("---")
st.sidebar.info("💡 **Tipp:** Teile den Link zu dieser App in deiner WhatsApp/Discord Gruppe.")
st.sidebar.caption("🔗 Powered by [Scryfall](https://scryfall.com) & [Moxfield](https://moxfield.com)")
