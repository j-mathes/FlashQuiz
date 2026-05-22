# ⚡ FlashQuiz

A browser-based flashcard and quiz app that runs as a fully static web page — no server, no build step, no frameworks. Just open `index.html` in any modern browser, or host it on GitHub Pages.

## Quick Start

1. Download or clone this repo
2. Open `index.html` in your browser
3. Go to **Data** and import a CSV or Excel file (or export the built-in sample first to see the format)
4. Choose **Flashcards** or **Quiz** and pick your deck

> **GitHub Pages:** Push to a repo, enable Pages from the `main` branch root, and your app is live.

---

## Files

| File | Description |
|---|---|
| `index.html` | App shell — all views, nav, modal, and toast markup |
| `styles.css` | All styles — responsive, CSS custom properties, card-flip animation |
| `app.js` | All application logic (~1,650 lines, ES6+, `"use strict"`) |

No build step. No package.json. No dependencies to install.

---

## Data Format

Import a **CSV** or **Excel** (`.xlsx` / `.xls`) file. SheetJS is loaded from CDN for Excel support; CSV always works offline.

| Column | Contents |
|---|---|
| A | Question or statement (text or image — see below) |
| B | **Correct** answer |
| C, D, E… | Wrong answers (at least one required for Quiz mode) |

### Images

Any cell can contain an image instead of text. Supported formats:

| Format | Example |
|---|---|
| Bare URL | `https://example.com/image.jpg` |
| Explicit tag | `[IMG:https://example.com/image.jpg]` |
| Base64 data URI | `data:image/png;base64,…` |

> A bare `http://…` or `https://…` URL that occupies an entire cell is automatically treated as an image. This matches the sample volleyball quiz format (which used TinyPic URLs — those images are now dead, but the app handles broken images gracefully).

### Sample File

Click **⬇ Sample CSV** or **⬇ Sample Excel** on the Data page to download a working example with text questions and one image question.

---

## Features

### Flashcard Mode
- Questions appear one at a time; click the card (or press **Space**) to flip and reveal the answer
- Navigate with **← Prev** / **Next →** buttons or **Arrow keys**
- Questions are shuffled each session
- Restart the deck at any time with **↺ Restart**

### Quiz Mode
- Multiple-choice with shuffled answer order each time
- Keyboard shortcuts: **1–4** to select an answer, **Enter / →** to advance
- **Score grid** on the right (or bottom on mobile) shows a colored square per question:
  - ⬜ Gray — not yet answered
  - 🟩 Green — correct
  - 🟥 Red — incorrect
- After each round, choose **↺ Retry Incorrect** to attempt only wrong questions again
- Keeps retrying in new rounds until all are correct or you stop
- All rounds are tracked separately in Reports

### Quiz Builder
- Create and edit decks directly in the app
- Each question supports text **or** an uploaded image (≤ 2 MB → stored as base64)
- Add multiple wrong answers per question
- **⬇ Export CSV** saves the deck to a file you can re-import later

### Users
- Add named profiles to track sessions separately
- Switch users at any time from the **Users** page or the top-right nav button
- Continue anonymously if preferred

### Reports
- View every quiz and flashcard session
- Filter by user, dataset, or mode
- Expandable rows show per-round breakdown: ✅/❌ for each question with the correct answer for misses
- Multi-round retries appear as Round 1, Round 2, etc.

---

## Storage

| Data | Storage |
|---|---|
| Datasets (questions + any embedded images) | **IndexedDB** |
| Users, sessions, dataset metadata | **localStorage** |

Both are browser-local. No data leaves the device. IndexedDB is used for datasets because embedded base-64 images can be large; everything else fits comfortably in localStorage.

---

## Browser Compatibility

Works in all modern browsers (Chrome, Edge, Firefox, Safari). Requires ES6+ support and IndexedDB (available in all browsers since 2015).

---

## About the Sample Volleyball Quiz

The included `Sample Quiz/Volleyball Canada 2017-2018 Rules Multiple Choice Test.xlsx` file has 278 questions. Rows 39–71 have TinyPic image URLs in column A — those images are no longer available since TinyPic shut down. The app displays a "⚠ Image unavailable" notice for those rows. To restore them, open the deck in the **Builder**, replace the dead URLs with working image URLs, and save.
