# SkyKing Courier — Billing Console

A self-contained web app that replicates your SkyKing courier bill (like
`JHARAUG26020001_BOM.pdf`) so you can generate invoices without Excel.

No backend, no database, no build step — plain HTML/CSS/JS. All data
(company details, customers, rate cards, saved invoices) is stored in your
browser's `localStorage`. Use the **Export backup** button regularly to keep
a `.json` copy safe, and **Import backup** to restore it (or move it to
another browser/computer).

## Features

- **Tax / Non-Tax toggle** — asked up front for every new bill. Choosing
  Non-Tax hides SkyKing's own GSTIN from the letterhead automatically;
  everything else (bank block, footer notes, layout) stays identical.
- **Real logo support** — upload your actual letterhead logo image in
  Company Settings; it's used as-is on every bill (no restyling). Until you
  upload one, a plain black placeholder mark is shown.
- **Customers & Rates, with Parcel + Document rate types** — for each
  customer, add a quote per destination and choose whether you're quoting
  **Parcel** rates, **Document** rates, or **both**:
  - *Parcel* — a single ₹-per-KG rate; billed amount = weight × rate.
  - *Document* — five **fixed** weight slabs (0–100 gm, 101–250 gm,
    251–500 gm, 501–750 gm, 751 gm–1 kg) — you only type the ₹ rate for
    each slab, the ranges themselves are fixed.
  - Adding/editing a quote opens a popup ("+ Add Quote") rather than a long
    inline form.
- **State-level fallback** — quote a whole state (e.g. "ODISHA") instead of
  (or alongside) individual cities. When billing, if you type a city that
  has no quote of its own but belongs to a quoted state, that state's rate
  is used automatically. Try it with the sample data: quote Bhubaneswar
  directly and Odisha at the state level, then bill "Cuttack" — it picks up
  the Odisha rate.
- **Searchable destination dropdowns** — every destination field (in quotes
  and in invoice rows) offers an autocomplete list of Indian states and
  major cities as you type, plus any destinations you've already quoted for
  that customer. You can still type a destination that isn't listed.
- **Per-row Type (Parcel/Document)** on the invoice builder — pick which
  rate applies to each consignment; the amount auto-fills from the matching
  quote and the Remarks field defaults to match.
- **Invoice numbering** — set a prefix (e.g. `JHARAUG26`) and a running
  sequence in *Company Settings*; every saved bill consumes the next number
  automatically (unless you've typed a custom number over it).
- **Print-ready output** — a dedicated print stylesheet mirrors the original
  bill layout (bordered items table with the total folded in as the last
  row, a plain right-aligned totals block, amount-in-words, notes, bank
  details, signatory) so File → Print → Save as PDF gives a clean,
  undistorted single page in plain black-and-white, matching the original.
- **Invoice History** — every saved bill keeps a snapshot of the company and
  customer details used at the time, so later edits to your rates/settings
  never change a bill you already issued. Reopen any past invoice to reprint
  it.
- **Backup / Restore** — export everything to a `.json` file, import it back
  on any device/browser.

## Running it locally

No install needed — it's static files:

```bash
# any static server works, e.g.
npx serve .
# or
python3 -m http.server 8080
```

Then open the printed local URL in your browser. Or just double-click
`index.html` (some browsers restrict `<datalist>`/localStorage under
`file://`, so a local server is the safer option).

## Deploying

Because this is a fully static site (`index.html`, `css/`, `js/` — no
server code), you can deploy it anywhere that serves static files:

### GitHub Pages
1. Push this folder to a GitHub repo.
2. Repo → Settings → Pages → Deploy from branch → pick `main` and `/root`.
3. Your app will be live at `https://<username>.github.io/<repo>/`.

### Vercel
1. Push the folder to GitHub (or run `vercel` from inside this folder with
   the Vercel CLI).
2. Import the repo in the Vercel dashboard. Framework preset: **Other** /
   **Static**. No build command, output directory is the project root.
3. Deploy.

### Render
1. Push to GitHub.
2. Render dashboard → New → **Static Site**.
3. Build command: leave blank (or `echo "no build"`).
4. Publish directory: `.` (project root).
5. Deploy.

## First-time setup

1. Open **Company Settings** and confirm/update SkyKing's letterhead, PAN,
   UDYAM, GSTIN, bank details and footer notes, plus your invoice-number
   prefix/sequence.
2. Open **Customers & Rates** → **New Customer** and add each of your
   billing customers along with their destination rate cards. (Click
   **Load sample data** in the sidebar to drop in a "Bank of Maharashtra"
   example pre-filled from the sample PDF, so you can see how it works.)
3. Go to **New Invoice**, answer Tax/Non-Tax, pick the customer, add
   consignment rows, and hit **Save & Generate Bill** — it opens a print
   preview you can print or save as a PDF.

## Data model notes

- A customer's **quotes** are a list of destinations (city or state name).
  Each quote has a `type` of `parcel`, `document`, or `both`, plus:
  - `parcel: { ratePerKg }` — amount = weight (kg) × ratePerKg.
  - `document: { slabs: [r1, r2, r3, r4, r5] }` — fixed slabs in order
    0–100gm, 101–250gm, 251–500gm, 501–750gm, 751gm–1kg. Anything heavier
    than 1kg uses the last slab's rate.
- **Destination resolution**: billing first looks for an exact match on the
  typed destination. If none exists and the destination is a recognised
  Indian city (see `js/india-places.js`), it falls back to a quote entered
  for that city's *state*. Unrecognised destinations still work for typing
  and billing — they just won't get automatic state fallback unless you add
  them to `INDIA_CITY_STATE` in `js/india-places.js`.
- Editing a customer's rates or company settings does **not** change bills
  you've already saved — each saved invoice keeps its own snapshot.
