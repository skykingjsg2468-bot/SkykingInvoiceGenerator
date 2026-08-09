/* =====================================================
   storage.js — all localStorage read/write lives here.
   Everything is plain JSON, so backup/restore is trivial.
   ===================================================== */

const DB_KEYS = {
  company: "skyking_company",
  customers: "skyking_customers",
  invoices: "skyking_invoices",
  numbering: "skyking_numbering",
};

const DEFAULT_COMPANY = {
  name: "SKYKING COURIER SERVICE",
  branchLabel: "JHARSUGUDA",
  address: "MANGAL BAZAR ROAD, NEAR DR P K JAIN CLINIC,, JHARSUGUDA - 768201, OD",
  phone: "9776072953 9437053234 9337053717",
  pan: "AJVPP8853E",
  udyam: "UDYAM-OD-14-0003850",
  gstin: "",
  tagline: "Your Delivery Partner",
  bankName: "BANK OF MAHARASHTRA",
  accountNo: "60281527573",
  ifsc: "MAHB0001700",
  sac: "996812- COURIER SERVICE",
  favourOf: "SKYKING COURIER SERVICE",
  notes: [
    "All complaints in respect of this bill must be forward within 8 days of the receipt.",
    "18% Interest will be charged on bill not paid within a month.",
    "Cheque return charges Rs 200 besides legal liability.",
    "PLEASE MAKE PAYMENT VIA CHEQUE/NEFT/RTGS/UPI.",
    "RCM is not applicable.",
    "We are registered under MSME and our UDYAM number is UDYAM-OD-14-0003850",
  ],
};

const DEFAULT_NUMBERING = {
  prefix: "JHARAUG26",
  nextSeq: 1,
  padding: 4,
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error("storage read failed for", key, e);
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("storage write failed for", key, e);
    return false;
  }
}

const Store = {
  getCompany() {
    return loadJSON(DB_KEYS.company, DEFAULT_COMPANY);
  },
  saveCompany(company) {
    saveJSON(DB_KEYS.company, company);
  },

  getCustomers() {
    return loadJSON(DB_KEYS.customers, []);
  },
  saveCustomers(list) {
    saveJSON(DB_KEYS.customers, list);
  },
  getCustomer(id) {
    return this.getCustomers().find((c) => c.id === id) || null;
  },
  upsertCustomer(customer) {
    const list = this.getCustomers();
    const idx = list.findIndex((c) => c.id === customer.id);
    if (idx >= 0) list[idx] = customer;
    else list.push(customer);
    this.saveCustomers(list);
  },
  deleteCustomer(id) {
    const list = this.getCustomers().filter((c) => c.id !== id);
    this.saveCustomers(list);
  },

  getInvoices() {
    return loadJSON(DB_KEYS.invoices, []);
  },
  saveInvoices(list) {
    saveJSON(DB_KEYS.invoices, list);
  },
  addInvoice(invoice) {
    const list = this.getInvoices();
    list.unshift(invoice);
    this.saveInvoices(list);
  },
  getInvoice(id) {
    return this.getInvoices().find((i) => i.id === id) || null;
  },

  getNumbering() {
    return loadJSON(DB_KEYS.numbering, DEFAULT_NUMBERING);
  },
  saveNumbering(n) {
    saveJSON(DB_KEYS.numbering, n);
  },
  peekNextInvoiceNumber() {
    const n = this.getNumbering();
    const seqStr = String(n.nextSeq).padStart(n.padding || 4, "0");
    return `${n.prefix}${seqStr}`;
  },
  consumeNextInvoiceNumber() {
    const n = this.getNumbering();
    const num = this.peekNextInvoiceNumber();
    n.nextSeq = (n.nextSeq || 1) + 1;
    this.saveNumbering(n);
    return num;
  },

  exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      company: this.getCompany(),
      customers: this.getCustomers(),
      invoices: this.getInvoices(),
      numbering: this.getNumbering(),
    };
  },
  importAll(data) {
    if (!data || typeof data !== "object") throw new Error("Invalid backup file");
    if (data.company) this.saveCompany(data.company);
    if (Array.isArray(data.customers)) this.saveCustomers(data.customers);
    if (Array.isArray(data.invoices)) this.saveInvoices(data.invoices);
    if (data.numbering) this.saveNumbering(data.numbering);
  },
};

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
