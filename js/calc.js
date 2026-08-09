/* =====================================================
   calc.js — figures out the billing amount for a
   consignment from the customer's stored quote.
   ===================================================== */

const Calc = {
  /**
   * Find the quote block for a destination on a customer (case-insensitive,
   * trims whitespace so "Bhubaneshwar" / "BHUBANESHWAR " both match).
   */
  findQuote(customer, destination) {
    if (!customer || !destination) return null;
    const target = destination.trim().toLowerCase();
    return (
      (customer.quotes || []).find(
        (q) => (q.destination || "").trim().toLowerCase() === target
      ) || null
    );
  },

  /**
   * Given a quote block and a weight in KG, return the computed amount.
   * Slabs are of the form { uptoKg: number, rate: number } and are
   * evaluated in ascending order of uptoKg. If the weight exceeds every
   * slab, the last slab's rate applies plus extraPerKg * overage (if set).
   */
  amountForWeight(quote, weightKg) {
    if (!quote || !Array.isArray(quote.slabs) || quote.slabs.length === 0) return null;
    const weight = Number(weightKg);
    if (!isFinite(weight) || weight <= 0) return null;

    const slabs = [...quote.slabs]
      .filter((s) => s.uptoKg != null && s.rate != null)
      .sort((a, b) => a.uptoKg - b.uptoKg);
    if (slabs.length === 0) return null;

    for (const slab of slabs) {
      if (weight <= Number(slab.uptoKg) + 1e-9) {
        return round2(Number(slab.rate));
      }
    }

    // Weight exceeds every defined slab
    const last = slabs[slabs.length - 1];
    const extra = Number(quote.extraPerKg) || 0;
    const overage = weight - Number(last.uptoKg);
    return round2(Number(last.rate) + overage * extra);
  },

  /**
   * Convenience: straight from customer + destination + weight -> amount or null.
   */
  computeAmount(customer, destination, weightKg) {
    const quote = this.findQuote(customer, destination);
    if (!quote) return null;
    return this.amountForWeight(quote, weightKg);
  },
};

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
