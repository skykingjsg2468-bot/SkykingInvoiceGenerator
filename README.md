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
  everything else (bank details, letterhead, footer notes) stays identical.
- **Customers & Rates** — store each customer's billing name, code, GSTN,
  address, branch and state, plus a **quote per destination** made up of
  weight slabs (e.g. "up to 0.5 kg → ₹85", "up to 1 kg → ₹120") and an
  optional extra-per-kg rate for anything heavier. Amounts on new invoices
  fill in automatically from this once you pick a customer, type a
  destination and a weight — you can still edit any amount by hand.
  destination input has autocomplete suggestions from that customer's saved
  rate card.
- **Invoice numbering** — set a prefix (e.g. `JHARAUG26`) and a running
  sequence in *Company Settings*; every saved bill consumes the next number
  automatically (unless you've typed a custom number over it).
- **Print-ready output** — the generated bill uses a dedicated print
  stylesheet that mirrors the original PDF layout (bordered items table,
  totals block, amount-in-words, notes, bank details, signatory) so File →
  Print → Save as PDF gives you a clean, undistorted single page.
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

- A customer's **quote** is a list of destinations. Each destination has one
  or more **weight slabs** (`up to X kg → ₹rate`), evaluated in ascending
  order — the first slab that covers the entered weight is used. If the
  weight is heavier than every slab you've defined, the last slab's rate is
  used plus `extra ₹ per kg` (if you set one) for the overage.
- Editing a customer's rates or company settings does **not** change bills
  you've already saved — each saved invoice keeps its own snapshot.
