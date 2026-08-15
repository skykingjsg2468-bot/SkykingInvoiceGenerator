/* =====================================================
   calc.js — figures out the billing amount for a
   consignment from the customer's stored rate card.

   Quote shape (per customer, per destination):
   {
     id, destination: "ODISHA" | "BHUBANESWAR" | ...,
     type: "parcel" | "document" | "both",
     parcel: { ratePerKg: number } | null,
     document: { slabs: [r0_100, r101_250, r251_500, r501_750, r751_1000] } | null
   }

   Fixed document slabs (grams), in order:
     0–100, 101–250, 251–500, 501–750, 751–1000
   ===================================================== */

const DOCUMENT_SLAB_LABELS = [
  "0 – 100 gm",
  "101 – 250 gm",
  "251 – 500 gm",
  "501 – 750 gm",
  "751 gm – 1 kg",
];
const DOCUMENT_SLAB_MAX_GRAMS = [100, 250, 500, 750, 1000];

const Calc = {
  /**
   * Find the quote for a destination on a customer. Tries an exact
   * (case-insensitive) match first. If the destination is a known city
   * with no quote of its own, falls back to a quote entered for that
   * city's state.
   */
  findQuote(customer, destination) {
    if (!customer || !destination) return null;
    const target = destination.trim().toUpperCase();
    const quotes = customer.quotes || [];

    const exact = quotes.find((q) => (q.destination || "").trim().toUpperCase() === target);
    if (exact) return exact;

    const state = stateForCity(target);
    if (state) {
      const stateQuote = quotes.find((q) => (q.destination || "").trim().toUpperCase() === state);
      if (stateQuote) return stateQuote;
    }
    return null;
  },

  /** Which document slab index (0-4) a gram weight falls into, or -1 if over 1kg. */
  documentSlabIndex(grams) {
    for (let i = 0; i < DOCUMENT_SLAB_MAX_GRAMS.length; i++) {
      if (grams <= DOCUMENT_SLAB_MAX_GRAMS[i] + 1e-9) return i;
    }
    return -1; // heavier than 1kg — treat as the top slab by convention
  },

  /**
   * Compute the amount for a consignment.
   * @param customer
   * @param destination
   * @param weightKg
   * @param type "parcel" | "document"
   */
  computeAmount(customer, destination, weightKg, type) {
    const quote = this.findQuote(customer, destination);
    if (!quote) return null;
    const weight = Number(weightKg);
    if (!isFinite(weight) || weight <= 0) return null;

    if (type === "parcel") {
      if (!quote.parcel || (quote.type !== "parcel" && quote.type !== "both")) return null;
      return round2(weight * Number(quote.parcel.ratePerKg || 0));
    }

    if (type === "document") {
      if (!quote.document || (quote.type !== "document" && quote.type !== "both")) return null;
      const grams = weight * 1000;
      let idx = this.documentSlabIndex(grams);
      if (idx === -1) idx = DOCUMENT_SLAB_MAX_GRAMS.length - 1; // heavier than 1kg -> top slab rate
      const rate = quote.document.slabs[idx];
      return rate != null ? round2(Number(rate)) : null;
    }

    return null;
  },
};

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
