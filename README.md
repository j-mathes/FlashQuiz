# ⚡ FlashQuiz

A browser-based flashcard and quiz app. No server, no build step, no frameworks — just open `index.html` or host on GitHub Pages.

**Live demo:** [j-mathes.github.io/FlashQuiz](https://j-mathes.github.io/FlashQuiz)

---

## Quick Start

**Local:** Clone the repo and open `index.html` in any modern browser.

**GitHub Pages:** In repo Settings → Pages, set source to the `main` branch root. Your app will be live at `https://<username>.github.io/FlashQuiz`.

---

## Data Format

Import a **CSV** or **Excel** (`.xlsx` / `.xls`) file. Use **⬇ Sample CSV** or **⬇ Sample Excel** on the Data page to download a working example.

| Column | Contents |
|---|---|
| A | Question (text or image) |
| B | Correct answer |
| C, D, E… | Wrong answers (at least one required for Quiz mode) |

### Images

| Format | Example |
|---|---|
| Bare URL | `https://example.com/image.jpg` |
| Explicit tag | `[IMG:https://example.com/image.jpg]` |
| Base64 data URI | `data:image/png;base64,…` |
| Local Library reference | `[LOCAL:filename.jpg]` |
| Mixed (text + image) | `[IMG:url]` on first line + text below (image before), or text first + `[IMG:url]` last (image after) |

---

## Features

### Flashcard Mode
- Click card or press **Space** to flip; navigate with **Arrow keys** or Prev/Next buttons
- Shuffled each session; restart anytime with **↺ Restart**

### Quiz Mode
- Multiple-choice with shuffled answers; keyboard shortcuts **1–4**, **Enter / →**
- Score grid shows ⬜ unanswered / 🟩 correct / 🟥 incorrect per question
- **↺ Retry Incorrect** re-runs only missed questions in a new round; continues until all correct

### Quiz Builder

Build or edit decks in the app. Each question/answer field supports text, an image, or both.

#### Adding an image — three ways

**1. Upload a file (🖼)**
Click the **🖼** button next to any field → choose a file (max 2 MB). The image is embedded as base64 directly in the deck.

**2. Pick from the Image Library (📚)**
Upload images once on the **Data** page (up to 5 MB each). Then, in the builder, click **📚** → choose a name from the picker. Stored as a lightweight `[LOCAL:name]` reference, not embedded.

**3. Mixed — text + image**
Type text in the field *and* then click **🖼** or **📚** to also add an image. A position toggle appears:

| Toggle | Result |
|---|---|
| **Above** | Image on top, text below |
| **Inline** | Image and text side by side |
| **Below** | Text on top, image below |

In CSV/Excel, put the text and image tag on separate lines in the same cell. Image tag on first line = image above; text on first line = image below:

```
What is this animal?
[LOCAL:dog.jpg]
```

Use `[LOCAL:filename]` for an Image Library file, or `[IMG:https://…]` for an external URL.

#### Removing an image
When an image is set a **✕ Remove** button appears below the preview. Click it to clear the image while keeping any text. Click **🖼** or **📚** at any time to replace the current image instead.

---

- **💾 Save Deck** overwrites in place; **📋 Save as Copy** saves a new deck named `"Copy of …"`
- **⬇ Export CSV** serialises library picks as `[LOCAL:name]` tags for round-trip import

#### 🖼 Missing Images filter
Click **🖼 Missing Images** in the builder toolbar to show only questions where any field (question, correct answer, or a wrong answer) contains a broken image reference — either a `[LOCAL:name]` not found in the Image Library, or an external URL that fails to load. The button shows **🔍 Checking…** while verifying images in parallel, then highlights active. Click again to clear the filter.

---

- **💾 Save Deck** overwrites in place; **📋 Save as Copy** saves a new deck named `"Copy of …"`
- **⬇ Export CSV** serialises library picks as `[LOCAL:name]` tags for round-trip import

### Image Library
- Upload images once (up to 5 MB each) from the **Data** page; stored locally in IndexedDB
- **Upload multiple images at once** to a specific group using the **📤 Upload** button on each group header
- Reference in the builder via 📚 or in CSV/Excel with `[LOCAL:filename]`
- Images retain their original filename for easy identification
- Delete individual images at any time

### Users & Reports
- Add named profiles to track sessions separately; switch users from the nav
- Reports show every session with per-round breakdown; filter by user, deck, or mode

---

## Storage

All data is browser-local — nothing leaves your device.

| Data | Where |
|---|---|
| Decks + embedded images | IndexedDB |
| Image Library | IndexedDB |
| Users, sessions, metadata | localStorage |

---

## License

[Creative Commons Attribution-NonCommercial-ShareAlike 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/) — © 2026 Jared Mathes. See [LICENSE](LICENSE).
