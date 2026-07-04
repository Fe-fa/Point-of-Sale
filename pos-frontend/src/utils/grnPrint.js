import { formatDateTime } from './helpers';
import { mergeStoreSettings } from './storeSettings';

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

const money = (value, currencyCode = 'KES') =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export function openGrnPrint(grn, currentStore, mode = 'invoice', storeSettings = {}) {
  if (!grn) return;

  const settings =
    storeSettings && Object.keys(storeSettings).length > 0
      ? storeSettings
      : mergeStoreSettings(grn.store ?? currentStore);

  const store = { ...currentStore, ...(grn.store || {}) };
  const payment = Array.isArray(grn.payments) && grn.payments.length
    ? grn.payments[0]
    : null;

  const cur = store?.currency || 'KES';

  const showLogo = settings.show_logo_on_print !== false;
  const showStoreContacts = settings.show_store_contacts_on_print !== false;
  const showStorePin = settings.show_store_pin_on_print !== false;

  const footerText = mode === 'receipt'
    ? settings.receipt_footer || 'Thank you for your business.'
    : settings.invoice_footer || 'Goods once received are not returnable without prior authorization.';

  const isReceipt = mode === 'receipt';
  const title = isReceipt ? 'GRN PAYMENT RECEIPT' : 'GOOD RECEIVE NOTE';
  const docNo = isReceipt
    ? (payment?.payment_number || `GRN-REC-${grn.grn_id}`)
    : (grn.grn_number || `GRN-${grn.grn_id}`);

  const today = new Date().toLocaleDateString('en-KE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const itemRows = (grn.items || []).map((item, index) => {
    const qty = Number(item.qty_received || 0);
    const note = item.notes || '';

    return `
      <tr>
        <td class="item-no">${index + 1}</td>
        <td class="item-desc">
          <div class="item-name">${escapeHtml(item.product_name_snapshot || 'Product')}</div>
        </td>
        <td class="cell-center">${qty}</td>
        <td class="comment-cell">${escapeHtml(note || '')}</td>
      </tr>
    `;
  }).join('');

  const minRows = 10;
  const padCount = Math.max(0, minRows - (grn.items || []).length);
  const padRows = Array.from({ length: padCount }).map(() => `
    <tr class="pad-row">
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --print-primary: #0E84C3;
      --print-primary-strong: #0A6CA0;
      --print-secondary: #427E97;
      --print-accent: #FA7316;
      --print-text: #1a1d20;
      --print-muted: #6b7280;
      --print-line: #dbe3ea;
      --print-soft: #f4f8fc;
      --print-white: #ffffff;
    }

    @page {
      size: A4;
      margin: 14mm 14mm 18mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: var(--print-text);
      background: var(--print-white);
    }

    .print-wrap {
      width: 100%;
    }

    /* Header */
    .page-header {
      text-align: center;
      padding: 0 0 14px;
      margin-bottom: 18px;
      border-bottom: 3px solid var(--print-primary);
      position: relative;
    }

    .page-header::after {
      content: '';
      position: absolute;
      right: 0;
      top: 0;
      width: 120px;
      height: 70px;
      background:
        radial-gradient(ellipse at 100% 0%, rgba(14,132,195,0.12) 0%, transparent 70%);
      pointer-events: none;
    }

    .logo-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 8px;
    }

    .logo-img {
      max-height: 58px;
      max-width: 140px;
      object-fit: contain;
    }

    .store-name {
      font-size: 22px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--print-text);
      margin-bottom: 6px;
    }

    .store-meta {
      font-size: 11px;
      color: var(--print-muted);
      line-height: 1.7;
      max-width: 520px;
      margin: 0 auto;
    }

    /* Title + document info */
    .doc-title-block {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 18px;
      margin-bottom: 18px;
    }

    .doc-left {
      flex: 1;
    }

    .doc-title {
      font-size: 28px;
      font-weight: 800;
      color: var(--print-primary);
      letter-spacing: -0.01em;
      line-height: 1;
      margin-bottom: 10px;
    }

    .doc-meta {
      display: grid;
      gap: 4px;
      font-size: 11.5px;
      color: #333;
      line-height: 1.6;
    }

    .doc-meta strong {
      display: inline-block;
      min-width: 88px;
      color: var(--print-text);
    }

    .delivery-box {
      min-width: 240px;
      border: 1px solid var(--print-line);
      border-radius: 8px;
      padding: 12px 14px;
      background: var(--print-soft);
    }

    .delivery-box .box-label {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--print-primary);
      margin-bottom: 8px;
    }

    .delivery-box .box-row {
      display: flex;
      gap: 8px;
      font-size: 11.5px;
      line-height: 1.6;
      margin-bottom: 4px;
    }

    .delivery-box .box-row:last-child {
      margin-bottom: 0;
    }

    .delivery-box .key {
      min-width: 58px;
      font-weight: 700;
      color: var(--print-muted);
    }

    /* Items table */
    table.items {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
      border: 1px solid var(--print-line);
      border-radius: 8px;
      overflow: hidden;
    }

    table.items thead tr {
      background: var(--print-secondary);
      color: var(--print-white);
    }

    table.items thead th {
      padding: 10px 10px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-align: left;
      border-right: 1px solid rgba(255,255,255,0.12);
    }

    table.items thead th:last-child {
      border-right: 0;
    }

    table.items tbody tr {
      border-bottom: 1px solid var(--print-line);
    }

    table.items tbody tr:nth-child(even) {
      background: #fbfdff;
    }

    table.items tbody tr.pad-row td {
      height: 34px;
    }

    table.items td {
      padding: 10px 10px;
      font-size: 11.5px;
      vertical-align: top;
    }

    .item-no {
      width: 48px;
      text-align: center;
      color: var(--print-muted);
    }

    .item-desc {
      width: 52%;
    }

    .item-name {
      font-weight: 700;
      color: var(--print-text);
      line-height: 1.45;
    }

    .cell-center {
      width: 90px;
      text-align: center;
      white-space: nowrap;
    }

    .comment-cell {
      min-width: 180px;
      color: var(--print-text);
    }

    /* Totals / payment area */
    .totals-wrap {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 20px;
    }

    .totals-box {
      width: 280px;
      border: 1px solid var(--print-line);
      border-radius: 8px;
      overflow: hidden;
      background: var(--print-white);
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 14px;
      font-size: 12px;
      border-bottom: 1px solid var(--print-line);
    }

    .totals-row:last-child {
      border-bottom: none;
    }

    .totals-row.grand {
      background: var(--print-primary);
      color: var(--print-white);
      font-weight: 800;
      font-size: 13px;
    }

    .t-label {
      color: inherit;
    }

    .t-value {
      font-weight: 700;
      white-space: nowrap;
    }

    .payment-note {
      background: #eef6fd;
      border-left: 3px solid var(--print-primary);
      padding: 8px 12px;
      font-size: 11.5px;
      border-radius: 0 4px 4px 0;
      margin-bottom: 16px;
    }

    /* Footer */
    .terms-section {
      border-top: 2px solid var(--print-primary);
      padding-top: 12px;
      margin-top: 8px;
    }

    .terms-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--print-primary);
      margin-bottom: 5px;
    }

    .terms-text {
      font-size: 11px;
      color: var(--print-muted);
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="print-wrap">

    <div class="page-header">
      ${showLogo && store?.logo_url ? `
        <div class="logo-wrap">
          <img class="logo-img" src="${escapeHtml(store.logo_url)}" alt="Logo" />
        </div>
      ` : ''}

      <div class="store-name">${escapeHtml(store?.store_name || 'Company Name')}</div>

      <div class="store-meta">
        ${showStoreContacts && store?.location ? `${escapeHtml(store.location)}<br/>` : ''}
        ${showStoreContacts && store?.physical_address ? `${escapeHtml(store.physical_address)}<br/>` : ''}
        ${showStoreContacts && store?.telephone ? `Phone: ${escapeHtml(store.telephone)}<br/>` : ''}
        ${showStoreContacts && store?.email_address ? `Email: ${escapeHtml(store.email_address)}<br/>` : ''}
        ${showStorePin && store?.pin ? `KRA PIN: ${escapeHtml(store.pin)}` : ''}
      </div>
    </div>

    <div class="doc-title-block">
      <div class="doc-left">
        <div class="doc-title">${escapeHtml(title)}</div>

        <div class="doc-meta">
          <div><strong>Date:</strong> ${escapeHtml(today)}</div>
          <div><strong>Doc No:</strong> ${escapeHtml(docNo)}</div>
          <div><strong>Supplier:</strong> ${escapeHtml(grn.supplier?.supplier_name || grn.supplier_name || '—')}</div>
          ${grn.purchase_order?.po_number ? `
            <div><strong>PO No:</strong> ${escapeHtml(grn.purchase_order.po_number)}</div>
          ` : ''}
          ${isReceipt && payment ? `
            <div><strong>Payment:</strong> ${escapeHtml(String(payment.payment_method || '').toUpperCase())}</div>
          ` : ''}
        </div>
      </div>

      <div class="delivery-box">
        <div class="box-label">Delivery To</div>
        <div class="box-row">
          <span class="key">Store</span>
          <span>${escapeHtml(grn.received_by || store?.store_name || 'Store')}</span>
        </div>
        <div class="box-row">
          <span class="key">Address</span>
          <span>${escapeHtml(store?.physical_address || store?.location || '—')}</span>
        </div>
        ${store?.telephone ? `
          <div class="box-row">
            <span class="key">Phone</span>
            <span>${escapeHtml(store.telephone)}</span>
          </div>
        ` : ''}
      </div>
    </div>

    ${isReceipt && payment ? `
      <div class="payment-note">
        Payment recorded successfully under <strong>${escapeHtml(String(payment.payment_method || '').toUpperCase())}</strong>.
      </div>
    ` : ''}

    <table class="items">
      <thead>
        <tr>
          <th class="item-no">Item No</th>
          <th>Description</th>
          <th class="cell-center">Quantity</th>
          <th>Comment (Notes)</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        ${padRows}
      </tbody>
    </table>

    <div class="totals-wrap">
      <div class="totals-box">
        ${isReceipt ? `
          <div class="totals-row">
            <span class="t-label">Paid</span>
            <span class="t-value">${money(grn.paid_amount || 0, cur)}</span>
          </div>
          <div class="totals-row grand">
            <span class="t-label">Balance Due</span>
            <span class="t-value">${money(grn.balance_due || 0, cur)}</span>
          </div>
        ` : `
          <div class="totals-row grand">
            <span class="t-label">Items Count</span>
            <span class="t-value">${(grn.items || []).length}</span>
          </div>
        `}
      </div>
    </div>

    <div class="terms-section">
      <div class="terms-title">Terms & Conditions</div>
      <div class="terms-text">${escapeHtml(footerText)}</div>
    </div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=820');
  if (!win) return;

  win.document.open();
  win.document.write(html);
  win.document.close();

  setTimeout(() => {
    win.focus();
    win.print();
  }, 300);
}
