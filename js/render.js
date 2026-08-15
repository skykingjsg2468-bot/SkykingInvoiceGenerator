/* =====================================================
   render.js — turns { company, customer, invoice } data
   into the invoice-sheet HTML markup, closely matching
   the original SkyKing PDF layout.
   ===================================================== */

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function fmtMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function logoSVG() {
  return `
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="28" cy="28" r="26" stroke="#000" stroke-width="2"/>
    <path d="M14 33 L30 16 L30 23 L42 23 L42 29 L30 29 L30 36 Z" fill="#000"/>
  </svg>`;
}

function logoMarkup(company) {
  if (company.logoDataUrl) {
    return `<img src="${company.logoDataUrl}" alt="logo" style="max-height:64px;max-width:130px;object-fit:contain;">`;
  }
  return logoSVG();
}

function renderInvoiceHTML({ company, customer, invoice }) {
  const isTax = invoice.type === "tax";
  const docTypeLabel = isTax ? "TAX INVOICE" : "NON-TAX INVOICE";

  const companyNameLine = `${escapeHTML(company.name)}${company.branchLabel ? ` (${escapeHTML(company.branchLabel)})` : ""}`;

  const itemsRows = invoice.items
    .map(
      (it, idx) => `
      <tr>
        <td class="num">${idx + 1}</td>
        <td class="num">${escapeHTML(fmtDate(it.date))}</td>
        <td class="num">${escapeHTML(it.cnNumber)}</td>
        <td class="dest">${escapeHTML(it.destination)}</td>
        <td class="remark">${escapeHTML(it.remark)}</td>
        <td class="num">${escapeHTML(it.weight)}</td>
        <td class="amt">₹ ${fmtMoney(it.amount)}</td>
      </tr>`
    )
    .join("");

  const totalAmount = invoice.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const roundOff = Number(invoice.roundOff) || 0;
  const netAmount = round2(totalAmount + roundOff);

  const notesHTML = (company.notes || [])
    .map((n, i) => `<div>${i + 1}. ${escapeHTML(n)}</div>`)
    .join("");

  const gstinLine = isTax && company.gstin
    ? `<div class="inv-company-line">GSTIN No: ${escapeHTML(company.gstin)}</div>`
    : "";

  return `
  <div class="invoice-sheet">
    <div class="inv-head">
      <div class="inv-logo">${logoMarkup(company)}</div>
      <div class="inv-head-text">
        <div class="inv-company-name">${companyNameLine}</div>
        <div class="inv-company-line">${escapeHTML(company.address)}</div>
        <div class="inv-company-line">Tel: ${escapeHTML(company.phone)}</div>
        <div class="inv-company-line">PAN No: ${escapeHTML(company.pan)}</div>
        <div class="inv-company-line">UDYAM No: ${escapeHTML(company.udyam)}</div>
        ${gstinLine}
        <div class="inv-tagline">${escapeHTML(company.tagline || "")}</div>
      </div>
    </div>

    <div class="inv-doc-type">${docTypeLabel}</div>

    <div class="inv-parties">
      <div class="inv-party-left">
        <div class="to-label">To,</div>
        <div class="cust-name">${escapeHTML(customer.name)}</div>
        <div>Customer Code: ${escapeHTML(customer.code || "")}</div>
        <div>Customer GSTN No: ${escapeHTML(customer.gstn || "NA")}</div>
        <div>${escapeHTML(customer.address || "")}</div>
        <div>${escapeHTML(customer.city || "")}</div>
      </div>
      <div class="inv-party-right">
        <div><span class="lbl">Invoice No:</span> ${escapeHTML(invoice.invoiceNo)}</div>
        <div><span class="lbl">Invoice Date:</span> ${escapeHTML(fmtDate(invoice.invoiceDate))}</div>
        <div><span class="lbl">Branch:</span> ${escapeHTML(invoice.branch)}</div>
        <div><span class="lbl">State:</span> ${escapeHTML(invoice.state)}</div>
      </div>
    </div>

    <table class="inv-items">
      <thead>
        <tr>
          <th>S No</th><th>Date</th><th>Consignment Number</th><th>Destination</th>
          <th>Remarks</th><th>Weight<br>(KG)</th><th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
        <tr class="inv-total-row">
          <td colspan="6" class="amt strong">Total Amount:</td>
          <td class="amt strong">₹ ${fmtMoney(totalAmount)}</td>
        </tr>
      </tbody>
    </table>

    <div class="inv-totals-wrap">
      <div class="inv-totals-row"><span class="lbl">Total Service Charge:</span><span class="val">₹ ${fmtMoney(totalAmount)}</span></div>
      <div class="inv-totals-row"><span class="lbl">Round Off:</span><span class="val">₹ ${roundOff === 0 ? "-" : fmtMoney(roundOff)}</span></div>
      <div class="inv-totals-row strong"><span class="lbl">Net Billing Amount:</span><span class="val">₹ ${fmtMoney(netAmount)}</span></div>
      <div class="inv-words-row">Amount in Words: ${amountToWords(netAmount)}</div>
    </div>

    <div class="inv-eoe">E &amp; OE</div>
    <div class="inv-for-company">For ${escapeHTML(companyNameLine)}</div>

    <div class="inv-signatory">(Authorised Signatory)</div>

    <div class="inv-notes">
      ${notesHTML}
    </div>

    <div class="inv-bank-block">
      <div><span class="bk-label">Bank Name:</span> ${escapeHTML(company.bankName)}</div>
      <div><span class="bk-label">In Favour Of:</span> ${escapeHTML(company.favourOf)}</div>
      <div><span class="bk-label">Account No:</span> ${escapeHTML(company.accountNo)}</div>
      <div><span class="bk-label">PAN:</span> ${escapeHTML(company.pan)}</div>
      <div></div>
      <div><span class="bk-label">SAC Code:</span> ${escapeHTML(company.sac)}</div>
      <div><span class="bk-label">IFSC Code:</span> ${escapeHTML(company.ifsc)}</div>
    </div>

    <div class="inv-footer-page">Page 1 of 1</div>
  </div>`;
}
