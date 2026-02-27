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
                 (event_id INTEGER, deck_id INTEGER)''')
    conn.commit()
    conn.close()

def get_db_connection():
    return sqlite3.connect('mtg_packer.db')

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
                        commander_image = image_uris.get("art_crop")
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
        mox_url = st.text_input("Moxfield Link", placeholder="https://www.moxfield.com/decks/...")
        if st.button("Deck importieren"):
            if "moxfield.com" in mox_url:
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
        
        st.subheader("Deine Deckliste")
        conn = get_db_connection()
        all_decks = pd.read_sql_query("SELECT * FROM decks", conn)
        conn.close()
        st.dataframe(all_decks, use_container_width=True)

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
        conn.close()
        st.table(results)

# --- TEILNEHMER ANSICHT ---
else:
    st.header("Abstimmung für den nächsten Abend")
    
    conn = get_db_connection()
    events = pd.read_sql_query("SELECT * FROM events ORDER BY date DESC", conn)
    
    if events.empty:
        st.info("Aktuell sind keine Events geplant.")
    else:
        event_options = {f"{row['title']} ({row['date']})": row['id'] for index, row in events.iterrows()}
        selected_event_label = st.selectbox("Wähle das Event aus:", list(event_options.keys()))
        selected_event_id = event_options[selected_event_label]
        
        st.divider()
        st.write("Welche Decks soll ich mitbringen? (Wähle maximal 2)")
        
        decks = pd.read_sql_query("SELECT * FROM decks", conn)
        
        # Checkboxen für Decks
        selected_decks = []
        backdrop_url = None
        for index, row in decks.iterrows():
            cols = st.columns([1, 4])
            with cols[0]:
                if pd.notna(row.get("commander_image")) and row["commander_image"]:
                    st.image(row["commander_image"], width=80)
            with cols[1]:
                if st.checkbox(f"{row['name']}", key=f"deck_{row['id']}"):
                    selected_decks.append(row['id'])
                    # Use the first selected deck's commander art as backdrop
                    if backdrop_url is None and pd.notna(row.get("commander_image")) and row["commander_image"]:
                        backdrop_url = row["commander_image"]
        
        if backdrop_url:
            st.markdown(
                f"""
                <style>
                .stApp {{
                    background-image: linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.65)),
                                      url("{backdrop_url}");
                    background-size: cover;
                    background-attachment: fixed;
                }}
                </style>
                """,
                unsafe_allow_html=True,
            )
        
        if st.button("Wünsche abschicken"):
            if 0 < len(selected_decks) <= 2:
                c = conn.cursor()
                for d_id in selected_decks:
                    c.execute("INSERT INTO votes (event_id, deck_id) VALUES (?, ?)", (selected_event_id, d_id))
                conn.commit()
                st.success("Deine Wünsche wurden gespeichert! Ich packe entsprechend.")
            else:
                st.warning("Bitte wähle 1 oder 2 Decks aus.")
    conn.close()

# --- FOOTER ---
st.sidebar.markdown("---")
st.sidebar.info("💡 **Tipp:** Teile den Link zu dieser App in deiner WhatsApp/Discord Gruppe.")
