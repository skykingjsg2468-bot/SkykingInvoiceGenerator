/* =====================================================
   app.js — wires up the UI: navigation, the new-invoice
   builder, customer & rate editor, settings, history,
   and backup import/export.
   ===================================================== */

let state = {
  invoiceType: "nontax", // "tax" | "nontax"
  editingCustomerId: null,
  rowSeq: 0,
  workingQuotes: [],   // quotes being edited for the currently open customer
  editingQuoteId: null,
  quoteModalType: "both",
};

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initInvoiceTypeControls();
  initItemsTable();
  initInvoiceActions();
  initCustomersView();
  initSettingsView();
  initHistoryView();
  initBackupControls();

  refreshCustomerDropdown();
  populateSettingsForm();
  resetInvoiceForm();
  renderCustomersTable();
  renderHistoryTable();

  // Ask tax / non-tax right away for the first invoice of the session.
  openTypeModal();
});

/* ---------------------------------------------------
   NAVIGATION
--------------------------------------------------- */
function initNav() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.view).classList.add("active");

      if (btn.dataset.view === "view-history") renderHistoryTable();
      if (btn.dataset.view === "view-customers") renderCustomersTable();
    });
  });
}

/* ---------------------------------------------------
   TAX / NON-TAX MODAL + PILL TOGGLE
--------------------------------------------------- */
function initInvoiceTypeControls() {
  document.getElementById("modal-btn-tax").addEventListener("click", () => {
    setInvoiceType("tax");
    closeTypeModal();
  });
  document.getElementById("modal-btn-nontax").addEventListener("click", () => {
    setInvoiceType("nontax");
    closeTypeModal();
  });
  document.getElementById("btn-type-tax").addEventListener("click", () => setInvoiceType("tax"));
  document.getElementById("btn-type-nontax").addEventListener("click", () => setInvoiceType("nontax"));
}

function openTypeModal() {
  document.getElementById("modal-invoice-type").style.display = "flex";
}
function closeTypeModal() {
  document.getElementById("modal-invoice-type").style.display = "none";
}

function setInvoiceType(type) {
  state.invoiceType = type;
  document.getElementById("btn-type-tax").classList.toggle("selected", type === "tax");
  document.getElementById("btn-type-nontax").classList.toggle("selected", type === "nontax");
}

/* ---------------------------------------------------
   NEW INVOICE FORM
--------------------------------------------------- */
function resetInvoiceForm() {
  state.rowSeq = 0;
  document.getElementById("items-tbody").innerHTML = "";
  addItemRow();

  document.getElementById("inv-number").value = Store.peekNextInvoiceNumber();
  document.getElementById("inv-date").value = todayISO();
  document.getElementById("inv-branch").value = Store.getCompany().branchLabel || "";
  document.getElementById("inv-state").value = "";
  document.getElementById("inv-roundoff").value = "0";

  refreshCustomerDropdown();
  recalcTotals();
}

function refreshCustomerDropdown() {
  const sel = document.getElementById("inv-customer");
  const current = sel.value;
  const customers = Store.getCustomers();
  sel.innerHTML =
    `<option value="">— select customer —</option>` +
    customers.map((c) => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("");
  if (customers.some((c) => c.id === current)) sel.value = current;

  sel.onchange = () => {
    const cust = Store.getCustomer(sel.value);
    if (cust) {
      if (!document.getElementById("inv-branch").value) {
        document.getElementById("inv-branch").value = cust.branch || "";
      }
      if (!document.getElementById("inv-state").value) {
        document.getElementById("inv-state").value = cust.state || "";
      }
    }
    updateDestinationDatalist();
    recalcAllRowAmounts();
  };
}

function updateDestinationDatalist() {
  let dl = document.getElementById("destination-list");
  if (!dl) {
    dl = document.createElement("datalist");
    dl.id = "destination-list";
    document.body.appendChild(dl);
  }
  const custId = document.getElementById("inv-customer").value;
  const cust = Store.getCustomer(custId);
  const custDestinations = cust ? (cust.quotes || []).map((q) => q.destination) : [];
  const all = new Set([...custDestinations, ...allDestinationNames()]);
  dl.innerHTML = [...all].map((d) => `<option value="${escapeHTML(d)}">`).join("");
}

function initItemsTable() {
  document.getElementById("btn-add-row").addEventListener("click", () => addItemRow());

  document.getElementById("items-tbody").addEventListener("input", (e) => {
    const row = e.target.closest("tr");
    if (!row) return;
    if (e.target.classList.contains("cell-weight") || e.target.classList.contains("cell-destination")) {
      autofillAmount(row);
    }
    recalcTotals();
  });

  document.getElementById("items-tbody").addEventListener("change", (e) => {
    const row = e.target.closest("tr");
    if (!row) return;
    if (e.target.classList.contains("cell-type")) {
      const remarkInput = row.querySelector(".cell-remark");
      const wasDefault = remarkInput.value.trim().toUpperCase() === "DOCUMENT" || remarkInput.value.trim().toUpperCase() === "PARCEL";
      if (wasDefault) remarkInput.value = e.target.value === "parcel" ? "PARCEL" : "DOCUMENT";
      autofillAmount(row);
      recalcTotals();
    }
  });

  document.getElementById("items-tbody").addEventListener("click", (e) => {
    if (e.target.classList.contains("row-delete")) {
      e.target.closest("tr").remove();
      renumberRows();
      recalcTotals();
    }
  });

  document.getElementById("inv-roundoff").addEventListener("input", recalcTotals);
}

function addItemRow(prefill = {}) {
  state.rowSeq += 1;
  const tbody = document.getElementById("items-tbody");
  const tr = document.createElement("tr");
  const type = prefill.type || "document";
  tr.innerHTML = `
    <td class="row-slno">${state.rowSeq}</td>
    <td><input type="date" class="cell-date" value="${prefill.date || todayISO()}"></td>
    <td><input type="text" class="cell-cn" placeholder="e.g. 443556575" value="${escapeHTML(prefill.cnNumber || "")}"></td>
    <td><input type="text" class="cell-destination" list="destination-list" placeholder="e.g. BHUBANESHWAR" value="${escapeHTML(prefill.destination || "")}"></td>
    <td>
      <select class="cell-type">
        <option value="document" ${type === "document" ? "selected" : ""}>Document</option>
        <option value="parcel" ${type === "parcel" ? "selected" : ""}>Parcel</option>
      </select>
    </td>
    <td><input type="text" class="cell-remark" placeholder="DOCUMENT" value="${escapeHTML(prefill.remark || (type === "parcel" ? "PARCEL" : "DOCUMENT"))}"></td>
    <td><input type="number" step="0.01" min="0" class="cell-weight" placeholder="0.00" value="${prefill.weight || ""}"></td>
    <td><input type="number" step="0.01" min="0" class="cell-amount" placeholder="0.00" value="${prefill.amount || ""}"></td>
    <td><button type="button" class="row-delete icon-btn" title="Remove row">✕</button></td>
  `;
  tbody.appendChild(tr);
  updateDestinationDatalist();
}

function renumberRows() {
  document.querySelectorAll("#items-tbody tr").forEach((tr, idx) => {
    tr.querySelector(".row-slno").textContent = idx + 1;
  });
}

function autofillAmount(row) {
  const custId = document.getElementById("inv-customer").value;
  const cust = Store.getCustomer(custId);
  const destination = row.querySelector(".cell-destination").value;
  const weight = row.querySelector(".cell-weight").value;
  const type = row.querySelector(".cell-type").value;
  if (!cust || !destination || !weight) return;
  const amount = Calc.computeAmount(cust, destination, weight, type);
  if (amount != null) {
    row.querySelector(".cell-amount").value = amount;
  }
}

function recalcAllRowAmounts() {
  document.querySelectorAll("#items-tbody tr").forEach((row) => autofillAmount(row));
  recalcTotals();
}

function recalcTotals() {
  let total = 0;
  document.querySelectorAll("#items-tbody tr").forEach((row) => {
    total += Number(row.querySelector(".cell-amount").value) || 0;
  });
  const roundOff = Number(document.getElementById("inv-roundoff").value) || 0;
  const net = total + roundOff;
  document.getElementById("calc-total").textContent = `₹ ${fmtMoney(total)}`;
  document.getElementById("calc-net").textContent = `₹ ${fmtMoney(net)}`;
}

function collectItemsFromForm() {
  const items = [];
  document.querySelectorAll("#items-tbody tr").forEach((row, idx) => {
    const cnNumber = row.querySelector(".cell-cn").value.trim();
    const destination = row.querySelector(".cell-destination").value.trim();
    const weight = row.querySelector(".cell-weight").value;
    const amount = row.querySelector(".cell-amount").value;
    if (!cnNumber && !destination && !weight && !amount) return; // skip fully-empty row
    items.push({
      slNo: idx + 1,
      date: row.querySelector(".cell-date").value,
      cnNumber,
      destination,
      type: row.querySelector(".cell-type").value,
      remark: row.querySelector(".cell-remark").value.trim(),
      weight: weight || "0",
      amount: Number(amount) || 0,
    });
  });
  return items;
}

function buildInvoiceDraft() {
  const custId = document.getElementById("inv-customer").value;
  const customer = Store.getCustomer(custId);
  if (!customer) {
    alert("Please select a customer first.");
    return null;
  }
  const items = collectItemsFromForm();
  if (items.length === 0) {
    alert("Add at least one consignment row.");
    return null;
  }

  const invoice = {
    id: null,
    invoiceNo: document.getElementById("inv-number").value.trim(),
    invoiceDate: document.getElementById("inv-date").value,
    branch: document.getElementById("inv-branch").value.trim(),
    state: document.getElementById("inv-state").value.trim(),
    type: state.invoiceType,
    roundOff: Number(document.getElementById("inv-roundoff").value) || 0,
    items,
    customerId: customer.id,
  };

  return { invoice, customer, company: Store.getCompany() };
}

function initInvoiceActions() {
  document.getElementById("btn-preview").addEventListener("click", () => {
    const draft = buildInvoiceDraft();
    if (!draft) return;
    showPreview(draft.company, draft.customer, draft.invoice);
  });

  document.getElementById("btn-save-invoice").addEventListener("click", () => {
    const draft = buildInvoiceDraft();
    if (!draft) return;

    const { invoice, customer, company } = draft;

    // If the invoice number matches the auto-suggested next number, consume the counter.
    const suggested = Store.peekNextInvoiceNumber();
    if (invoice.invoiceNo === suggested) {
      Store.consumeNextInvoiceNumber();
    }

    invoice.id = uid("inv");
    invoice.createdAt = new Date().toISOString();
    invoice.customerSnapshot = customer;
    invoice.companySnapshot = company;
    invoice.netAmount = round2(
      invoice.items.reduce((s, it) => s + (Number(it.amount) || 0), 0) + invoice.roundOff
    );

    Store.addInvoice(invoice);
    renderHistoryTable();
    showPreview(company, customer, invoice);
    resetInvoiceForm();
  });

  document.getElementById("btn-close-preview").addEventListener("click", () => {
    document.getElementById("modal-preview").style.display = "none";
  });
  document.getElementById("btn-print").addEventListener("click", () => window.print());
}

function showPreview(company, customer, invoice) {
  const target = document.getElementById("invoice-render-target");
  target.innerHTML = renderInvoiceHTML({ company, customer, invoice });
  document.getElementById("modal-preview").style.display = "flex";
}

/* ---------------------------------------------------
   HISTORY VIEW
--------------------------------------------------- */
function initHistoryView() {
  document.getElementById("history-tbody").addEventListener("click", (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    const inv = Store.getInvoice(id);
    if (!inv) return;
    showPreview(inv.companySnapshot, inv.customerSnapshot, inv);
  });
}

function renderHistoryTable() {
  const invoices = Store.getInvoices();
  const tbody = document.getElementById("history-tbody");
  const empty = document.getElementById("history-empty");
  if (invoices.length === 0) {
    tbody.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  tbody.innerHTML = invoices
    .map(
      (inv) => `
      <tr>
        <td>${escapeHTML(inv.invoiceNo)}</td>
        <td>${escapeHTML(fmtDate(inv.invoiceDate))}</td>
        <td>${escapeHTML(inv.customerSnapshot?.name || "")}</td>
        <td>${inv.type === "tax" ? "Tax" : "Non-Tax"}</td>
        <td>₹ ${fmtMoney(inv.netAmount)}</td>
        <td><button class="row-link" data-id="${inv.id}">View / Print</button></td>
      </tr>`
    )
    .join("");
}

/* ---------------------------------------------------
   CUSTOMERS & RATES VIEW
--------------------------------------------------- */
function initCustomersView() {
  document.getElementById("btn-new-customer").addEventListener("click", () => {
    state.editingCustomerId = null;
    openCustomerEditor(blankCustomer());
  });

  document.getElementById("customers-tbody").addEventListener("click", (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    const cust = Store.getCustomer(id);
    if (!cust) return;
    state.editingCustomerId = id;
    openCustomerEditor(cust);
  });

  document.getElementById("btn-save-customer").addEventListener("click", saveCustomerFromForm);
  document.getElementById("btn-delete-customer").addEventListener("click", () => {
    if (!state.editingCustomerId) {
      document.getElementById("customer-editor").hidden = true;
      return;
    }
    if (confirm("Delete this customer and their saved rates?")) {
      Store.deleteCustomer(state.editingCustomerId);
      document.getElementById("customer-editor").hidden = true;
      renderCustomersTable();
      refreshCustomerDropdown();
    }
  });

  initQuoteModal();

  document.getElementById("quotes-list").addEventListener("click", (e) => {
    const editId = e.target.dataset.editQuote;
    const removeId = e.target.dataset.removeQuote;
    if (editId) {
      const q = state.workingQuotes.find((q) => q.id === editId);
      if (q) openQuoteModal(q);
    }
    if (removeId) {
      if (confirm("Remove this destination's rates?")) {
        state.workingQuotes = state.workingQuotes.filter((q) => q.id !== removeId);
        renderQuotesSummary();
      }
    }
  });
}

function blankCustomer() {
  return { id: uid("cust"), name: "", code: "", gstn: "", branch: "", address: "", city: "", state: "", quotes: [] };
}

function openCustomerEditor(customer) {
  document.getElementById("customer-editor").hidden = false;
  document.getElementById("customer-editor-title").textContent = customer.name || "New Customer";
  document.getElementById("cust-name").value = customer.name || "";
  document.getElementById("cust-code").value = customer.code || "";
  document.getElementById("cust-gstn").value = customer.gstn || "";
  document.getElementById("cust-branch").value = customer.branch || "";
  document.getElementById("cust-address").value = customer.address || "";
  document.getElementById("cust-city").value = customer.city || "";
  document.getElementById("cust-state").value = customer.state || "";

  // Work on a copy of this customer's quotes until "Save Customer" is clicked.
  state.workingQuotes = (customer.quotes || []).map((q) => ({ ...q, id: q.id || uid("quote") }));
  renderQuotesSummary();
}

function renderQuotesSummary() {
  const wrap = document.getElementById("quotes-list");
  const quotes = state.workingQuotes || [];
  if (quotes.length === 0) {
    wrap.innerHTML = `<p class="hint">No destinations quoted yet — click "+ Add Quote" to add one.</p>`;
    return;
  }
  wrap.innerHTML = `
    <table class="quotes-summary-table">
      <thead><tr><th>Destination</th><th>Rate type</th><th>Parcel</th><th>Document</th><th></th></tr></thead>
      <tbody>
        ${quotes
          .map((q) => {
            const tags = [];
            if (q.type === "parcel" || q.type === "both") tags.push('<span class="qty-tag">Parcel</span>');
            if (q.type === "document" || q.type === "both") tags.push('<span class="qty-tag">Document</span>');
            const parcelText = q.parcel ? `₹${q.parcel.ratePerKg} / kg` : "—";
            const docText = q.document ? q.document.slabs.map((r) => `₹${r}`).join(" / ") : "—";
            return `
            <tr>
              <td><strong>${escapeHTML(q.destination)}</strong></td>
              <td>${tags.join(" ")}</td>
              <td>${escapeHTML(parcelText)}</td>
              <td style="font-size:11px;">${escapeHTML(docText)}</td>
              <td style="white-space:nowrap;">
                <button type="button" class="row-link" data-edit-quote="${q.id}">Edit</button>
                &nbsp;
                <button type="button" class="row-link" style="color:var(--danger);" data-remove-quote="${q.id}">Remove</button>
              </td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>`;
}

/* ---- Add / Edit Quote popup modal ---- */
function initQuoteModal() {
  document.getElementById("btn-add-quote").addEventListener("click", () => openQuoteModal());
  document.getElementById("btn-cancel-quote").addEventListener("click", closeQuoteModal);

  document.querySelectorAll('#modal-quote .pill[data-qtype]').forEach((btn) => {
    btn.addEventListener("click", () => setQuoteModalType(btn.dataset.qtype));
  });

  document.getElementById("btn-save-quote").addEventListener("click", saveQuoteFromModal);
}

function buildDocumentSlabInputs(existingSlabs) {
  const wrap = document.getElementById("q-document-slabs");
  wrap.innerHTML = DOCUMENT_SLAB_LABELS.map(
    (label, i) => `
    <div class="slab-input-row">
      <span class="slab-label">${label}</span>
      <input type="number" step="0.01" min="0" class="q-slab-rate" data-slab-index="${i}" placeholder="₹" value="${existingSlabs && existingSlabs[i] != null ? existingSlabs[i] : ""}">
    </div>`
  ).join("");
}

function openQuoteModal(existingQuote = null) {
  state.editingQuoteId = existingQuote ? existingQuote.id : null;
  document.getElementById("quote-modal-title").textContent = existingQuote ? "Edit Rate Quote" : "Add Rate Quote";
  document.getElementById("q-destination").value = existingQuote ? existingQuote.destination : "";
  document.getElementById("q-parcel-rate").value = existingQuote?.parcel ? existingQuote.parcel.ratePerKg : "";
  buildDocumentSlabInputs(existingQuote?.document ? existingQuote.document.slabs : null);
  setQuoteModalType(existingQuote ? existingQuote.type : "both");
  document.getElementById("modal-quote").hidden = false;
}

function closeQuoteModal() {
  document.getElementById("modal-quote").hidden = true;
}

function setQuoteModalType(type) {
  document.querySelectorAll('#modal-quote .pill[data-qtype]').forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.qtype === type);
  });
  document.getElementById("q-parcel-section").style.display = type === "parcel" || type === "both" ? "block" : "none";
  document.getElementById("q-document-section").style.display = type === "document" || type === "both" ? "block" : "none";
  state.quoteModalType = type;
}

function saveQuoteFromModal() {
  const destination = document.getElementById("q-destination").value.trim();
  if (!destination) {
    alert("Enter a destination (city or state).");
    return;
  }
  const type = state.quoteModalType || "both";

  let parcel = null;
  if (type === "parcel" || type === "both") {
    const rate = document.getElementById("q-parcel-rate").value;
    if (rate !== "") parcel = { ratePerKg: Number(rate) };
  }

  let document_ = null;
  if (type === "document" || type === "both") {
    const slabs = [];
    document.querySelectorAll(".q-slab-rate").forEach((input) => {
      const v = input.value;
      slabs[Number(input.dataset.slabIndex)] = v === "" ? null : Number(v);
    });
    if (slabs.some((v) => v != null)) document_ = { slabs };
  }

  if (!parcel && !document_) {
    alert("Enter at least one rate.");
    return;
  }

  const quote = {
    id: state.editingQuoteId || uid("quote"),
    destination,
    type,
    parcel,
    document: document_,
  };

  state.workingQuotes = state.workingQuotes || [];
  const idx = state.workingQuotes.findIndex((q) => q.id === quote.id);
  if (idx >= 0) state.workingQuotes[idx] = quote;
  else state.workingQuotes.push(quote);

  renderQuotesSummary();
  closeQuoteModal();
}

function saveCustomerFromForm() {
  const name = document.getElementById("cust-name").value.trim();
  if (!name) {
    alert("Customer name is required.");
    return;
  }

  const customer = {
    id: state.editingCustomerId || uid("cust"),
    name,
    code: document.getElementById("cust-code").value.trim(),
    gstn: document.getElementById("cust-gstn").value.trim(),
    branch: document.getElementById("cust-branch").value.trim(),
    address: document.getElementById("cust-address").value.trim(),
    city: document.getElementById("cust-city").value.trim(),
    state: document.getElementById("cust-state").value.trim(),
    quotes: state.workingQuotes || [],
  };
  state.editingCustomerId = customer.id;
  Store.upsertCustomer(customer);
  renderCustomersTable();
  refreshCustomerDropdown();
  document.getElementById("customer-editor-title").textContent = customer.name;
  alert("Customer saved.");
}

function renderCustomersTable() {
  const customers = Store.getCustomers();
  const tbody = document.getElementById("customers-tbody");
  tbody.innerHTML = customers
    .map(
      (c) => `
      <tr>
        <td>${escapeHTML(c.name)}</td>
        <td>${escapeHTML(c.code || "")}</td>
        <td>${escapeHTML(c.city || "")}</td>
        <td><button class="row-link" data-id="${c.id}">Edit</button></td>
      </tr>`
    )
    .join("");
}

/* ---------------------------------------------------
   SETTINGS VIEW
--------------------------------------------------- */
function initSettingsView() {
  document.getElementById("btn-save-settings").addEventListener("click", saveSettingsFromForm);
  ["set-inv-prefix", "set-inv-seq", "set-inv-padding"].forEach((id) =>
    document.getElementById(id).addEventListener("input", updateNumberingPreview)
  );

  document.getElementById("set-logo").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const company = Store.getCompany();
      company.logoDataUrl = reader.result;
      Store.saveCompany(company);
      renderLogoPreview();
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("btn-remove-logo").addEventListener("click", () => {
    const company = Store.getCompany();
    delete company.logoDataUrl;
    Store.saveCompany(company);
    document.getElementById("set-logo").value = "";
    renderLogoPreview();
  });
}

function renderLogoPreview() {
  const wrap = document.getElementById("logo-preview-wrap");
  const company = Store.getCompany();
  wrap.innerHTML = company.logoDataUrl
    ? `<img src="${company.logoDataUrl}" alt="logo preview" style="max-height:70px;max-width:160px;object-fit:contain;border:1px solid var(--line);border-radius:6px;padding:4px;">`
    : `<span class="hint">No logo uploaded yet — a plain placeholder mark is used until you add one.</span>`;
}

function populateSettingsForm() {
  const c = Store.getCompany();
  document.getElementById("set-company-name").value = c.name || "";
  document.getElementById("set-branch-label").value = c.branchLabel || "";
  document.getElementById("set-address").value = c.address || "";
  document.getElementById("set-phone").value = c.phone || "";
  document.getElementById("set-pan").value = c.pan || "";
  document.getElementById("set-udyam").value = c.udyam || "";
  document.getElementById("set-gstin").value = c.gstin || "";
  document.getElementById("set-tagline").value = c.tagline || "";
  document.getElementById("set-bank-name").value = c.bankName || "";
  document.getElementById("set-account-no").value = c.accountNo || "";
  document.getElementById("set-ifsc").value = c.ifsc || "";
  document.getElementById("set-sac").value = c.sac || "";
  document.getElementById("set-favour").value = c.favourOf || "";
  document.getElementById("set-notes").value = (c.notes || []).join("\n");
  renderLogoPreview();

  const n = Store.getNumbering();
  document.getElementById("set-inv-prefix").value = n.prefix || "";
  document.getElementById("set-inv-seq").value = n.nextSeq || 1;
  document.getElementById("set-inv-padding").value = n.padding || 4;
  updateNumberingPreview();
}

function updateNumberingPreview() {
  const prefix = document.getElementById("set-inv-prefix").value || "";
  const seq = Number(document.getElementById("set-inv-seq").value) || 1;
  const padding = Number(document.getElementById("set-inv-padding").value) || 4;
  document.getElementById("inv-number-preview").textContent = `${prefix}${String(seq).padStart(padding, "0")}`;
}

function saveSettingsFromForm() {
  const existing = Store.getCompany();
  const company = {
    logoDataUrl: existing.logoDataUrl,
    name: document.getElementById("set-company-name").value.trim(),
    branchLabel: document.getElementById("set-branch-label").value.trim(),
    address: document.getElementById("set-address").value.trim(),
    phone: document.getElementById("set-phone").value.trim(),
    pan: document.getElementById("set-pan").value.trim(),
    udyam: document.getElementById("set-udyam").value.trim(),
    gstin: document.getElementById("set-gstin").value.trim(),
    tagline: document.getElementById("set-tagline").value.trim(),
    bankName: document.getElementById("set-bank-name").value.trim(),
    accountNo: document.getElementById("set-account-no").value.trim(),
    ifsc: document.getElementById("set-ifsc").value.trim(),
    sac: document.getElementById("set-sac").value.trim(),
    favourOf: document.getElementById("set-favour").value.trim(),
    notes: document.getElementById("set-notes").value.split("\n").map((s) => s.trim()).filter(Boolean),
  };
  Store.saveCompany(company);

  const numbering = {
    prefix: document.getElementById("set-inv-prefix").value.trim(),
    nextSeq: Number(document.getElementById("set-inv-seq").value) || 1,
    padding: Number(document.getElementById("set-inv-padding").value) || 4,
  };
  Store.saveNumbering(numbering);

  const msg = document.getElementById("settings-saved-msg");
  msg.hidden = false;
  setTimeout(() => (msg.hidden = true), 2000);

  // Reflect new defaults into an untouched invoice form.
  if (!document.getElementById("inv-branch").value) {
    document.getElementById("inv-branch").value = company.branchLabel;
  }
}

/* ---------------------------------------------------
   BACKUP: EXPORT / IMPORT
--------------------------------------------------- */
function initBackupControls() {
  document.getElementById("btn-export-data").addEventListener("click", () => {
    const data = Store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skyking-billing-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("input-import-data").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        Store.importAll(data);
        alert("Backup restored.");
        populateSettingsForm();
        renderCustomersTable();
        renderHistoryTable();
        refreshCustomerDropdown();
      } catch (err) {
        alert("Could not read that file: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("btn-seed-demo").addEventListener("click", () => {
    if (Store.getCustomers().length > 0 && !confirm("This adds a sample customer alongside your existing data. Continue?")) return;
    const demoCustomer = {
      id: uid("cust"),
      name: "BANK OF MAHARASHTRA",
      code: "SK18651",
      gstn: "NA",
      branch: "JHARSUGUDA",
      address: "M B ROAD",
      city: "JHARSUGUDA- 768201, OD",
      state: "ODISHA (21)",
      quotes: [
        {
          id: uid("quote"),
          destination: "BHUBANESWAR",
          type: "both",
          parcel: { ratePerKg: 50 },
          document: { slabs: [85, 85, 100, 120, 140] },
        },
        {
          id: uid("quote"),
          destination: "ODISHA",
          type: "document",
          parcel: null,
          document: { slabs: [90, 90, 110, 130, 150] },
        },
      ],
    };
    Store.upsertCustomer(demoCustomer);
    renderCustomersTable();
    refreshCustomerDropdown();
    alert('Sample customer "BANK OF MAHARASHTRA" added with Bhubaneswar (Parcel+Document) and a state-wide Odisha (Document) rate card. Try billing a different Odisha city — it\'ll fall back to the Odisha rate automatically.');
  });
}

/* ---------------------------------------------------
   SMALL HELPERS
--------------------------------------------------- */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// fmtMoney, fmtDate, round2, escapeHTML are already defined in render.js (loaded first).
