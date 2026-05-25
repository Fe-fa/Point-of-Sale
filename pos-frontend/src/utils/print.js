import JsBarcode from 'jsbarcode';
import { currency, formatDateTime } from './helpers';

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function groupVatSummary(items = []) {
  const summary = {};

  items.forEach((item) => {
    const rate = Number(item.vat_rate || 0);
    const total = Number(item.total_amount || 0);
    const net = rate > 0 ? total / (1 + rate / 100) : total;
    const vat = total - net;
    const key = `${rate}`;

    if (!summary[key]) {
      summary[key] = {
        rate,
        net: 0,
        vat: 0,
        amount: 0,
      };
    }

    summary[key].net += net;
    summary[key].vat += vat;
    summary[key].amount += total;
  });

  return Object.values(summary);
}
export function openBillingPrint(
  billing,
  currentStore,
  mode = 'receipt',
  storeSettings = {}
) {
  if (!billing) return;

  const payment = billing.payments?.[billing.payments.length - 1];
  const receiptNumber =
    mode === 'invoice'
      ? billing.invnumber || payment?.receiptnumber || `INV-${billing.billing_id}`
      : payment?.receiptnumber || billing.invnumber || `RCT-${billing.billing_id}`;

  const barcodeValue =
    payment?.barcode_value || billing?.barcode_value || receiptNumber;

  const footerText =
    mode === 'invoice'
      ? storeSettings?.invoice_footer || 'Goods once sold are not returnable.'
      : storeSettings?.receipt_footer || 'Thank you for your purchase.';

  const vatRows = groupVatSummary(billing.items || []);
  const netAmount = Number(billing.subtotal || 0);
  const vatAmount = Number(billing.vat_amount || 0);
  const totalAmount = Number(billing.total || 0);
  const paidAmount = Number(billing.paid_amount || 0);
  const balanceDue = Number(billing.balance_due || 0);

  const itemsHtml = (billing.items || [])
    .map((item) => {
      const name = item.product?.product_name || 'Product';
      const qty = Number(item.quantity || 0);
      const unitPrice = Number(item.unit_price || 0);
      const total = Number(item.total_amount || 0);
      const vatRate = Number(item.vat_rate || 0);

      return `
        <tr>
          <td class="item-desc">
            <div class="item-name">${escapeHtml(name)}</div>
            <div class="item-meta">${qty} x ${currency(unitPrice, currentStore?.currency || 'KES')} &nbsp; VAT ${vatRate}%</div>
          </td>
          <td class="amount-cell">${currency(total, currentStore?.currency || 'KES')}</td>
        </tr>
      `;
    })
    .join('');

  const vatHtml = vatRows
    .map(
      (row) => `
      <tr>
        <td>${row.rate}%</td>
        <td>${currency(row.net, currentStore?.currency || 'KES')}</td>
        <td>${currency(row.vat, currentStore?.currency || 'KES')}</td>
        <td>${currency(row.amount, currentStore?.currency || 'KES')}</td>
      </tr>
    `
    )
    .join('');

  const html = `<!doctype html>
  <html>
    <head>
      <title>${mode === 'invoice' ? 'Invoice Print' : 'Receipt Print'}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 4mm;
        }

        * {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
          background: #fff;
          color: #000;
          font-family: "Courier New", Courier, monospace;
          font-size: 12px;
          line-height: 1.35;
        }

        body {
          width: 72mm;
          margin: 0 auto;
          padding: 2mm 0;
        }

        .center {
          text-align: center;
        }

        .brand {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 3px;
          text-transform: uppercase;
        }

        .small {
          font-size: 11px;
        }

        .muted {
          color: #222;
        }

        .divider {
          border-top: 1px dashed #000;
          margin: 8px 0;
        }

        .meta-row,
        .line-row,
        .total-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin: 2px 0;
          align-items: flex-start;
        }

        .line-row strong,
        .total-row strong {
          font-weight: 700;
        }

        .label {
          flex: 1;
        }

        .value {
          text-align: right;
          white-space: nowrap;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        .items-table th,
        .items-table td {
          padding: 4px 0;
          vertical-align: top;
        }

        .items-table thead th {
          border-bottom: 1px solid #000;
          border-top: 1px solid #000;
          font-size: 12px;
        }

        .items-table th:first-child {
          text-align: left;
        }

        .items-table th:last-child,
        .items-table td:last-child {
          text-align: right;
        }

        .item-name {
          font-weight: 700;
        }

        .item-meta {
          font-size: 11px;
        }

        .amount-cell {
          white-space: nowrap;
          padding-left: 8px;
        }

        .totals {
          margin-top: 6px;
        }

        .grand-total {
          border-top: 1px solid #000;
          border-bottom: 1px solid #000;
          padding: 4px 0;
          margin: 4px 0;
          font-weight: 700;
        }

        .vat-table {
          margin-top: 6px;
        }

        .vat-table th,
        .vat-table td {
          padding: 3px 2px;
          font-size: 11px;
          text-align: right;
        }

        .vat-table th:first-child,
        .vat-table td:first-child {
          text-align: left;
        }

        .vat-table thead th {
          border-bottom: 1px solid #000;
          border-top: 1px solid #000;
        }

        .footer-note {
          margin-top: 8px;
          text-align: center;
          font-size: 11px;
          white-space: pre-line;
        }

        .barcode-wrap {
          margin-top: 10px;
          text-align: center;
        }

        .barcode-text {
          font-size: 11px;
          margin-top: 3px;
          letter-spacing: 0.5px;
        }
        .section-title {
          text-align: center;
          font-weight: 700;
          margin: 4px 0;
          text-transform: uppercase;
        }
      </style>
    </head>
    <body>
      <div class="center">
        <div class="brand">${escapeHtml(currentStore?.store_name || 'Store')}</div>
        ${currentStore?.location ? `<div class="small">Location: ${escapeHtml(currentStore.location)}</div>` : ''}
        ${currentStore?.telephone ? `<div class="small">Tel: ${escapeHtml(currentStore.telephone)}</div>` : ''}
        ${currentStore?.email_address ? `<div class="small">Email: ${escapeHtml(currentStore.email_address)}</div>` : ''}
        ${currentStore?.pin ? `<div class="small">KRA PIN: ${escapeHtml(currentStore.pin)}</div>` : ''}
      </div>

      <div class="divider"></div>

      <div class="meta-row">
        <div class="label">No</div>
        <div class="value">${escapeHtml(receiptNumber)}</div>
      </div>
      <div class="meta-row">
        <div class="label">Date</div>
        <div class="value">${escapeHtml(formatDateTime(payment?.payment_date || billing.billing_date))}</div>
      </div>
      <div class="meta-row">
        <div class="label">Customer</div>
        <div class="value">${escapeHtml(billing.customer?.full_name || 'Walk-in Customer')}</div>
      </div>
      <div class="meta-row">
        <div class="label">Served By</div>
        <div class="value">${escapeHtml(billing.user?.full_name || 'Cashier')}</div>
      </div>
      ${
        payment?.payment_method
          ? `
          <div class="meta-row">
            <div class="label">Payment</div>
            <div class="value">${escapeHtml(String(payment.payment_method).toUpperCase())}</div>
          </div>
        `
          : ''
      }
      <div class="divider"></div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="divider"></div>

      <div class="totals">
        <div class="line-row">
          <div class="label">Net Amount</div>
          <div class="value">${currency(netAmount, currentStore?.currency || 'KES')}</div>
        </div>
        <div class="line-row">
          <div class="label">VAT Amount</div>
          <div class="value">${currency(vatAmount, currentStore?.currency || 'KES')}</div>
        </div>

        <div class="grand-total">
          <div class="total-row">
            <div class="label"><strong>Total</strong></div>
            <div class="value"><strong>${currency(totalAmount, currentStore?.currency || 'KES')}</strong></div>
          </div>
        </div>
        
        <div class="line-row">
          <div class="label">Paid</div>
          <div class="value">${currency(paidAmount, currentStore?.currency || 'KES')}</div>
        </div>
        <div class="line-row">
          <div class="label">Balance Due</div>
          <div class="value">${currency(balanceDue, currentStore?.currency || 'KES')}</div>
        </div>
        ${
          payment?.change_returned
            ? `
            <div class="line-row">
              <div class="label">Change</div>
              <div class="value">${currency(payment.change_returned, currentStore?.currency || 'KES')}</div>
            </div>
          `
            : ''
        }
      </div>

      ${
        vatRows.length
          ? `
          <div class="section-title">VAT Summary</div>
          <table class="vat-table">
            <thead>
              <tr>
                <th>VAT%</th>
                <th>Net</th>
                <th>VAT</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${vatHtml}
            </tbody>
          </table>
        `
          : ''
      }

      <div class="divider"></div>

      <div class="footer-note">
        ${escapeHtml(footerText)}
      </div>

      ${
        billing.notes
          ? `<div class="footer-note">${escapeHtml(billing.notes)}</div>`
          : ''
      }

      <div class="barcode-wrap">
        <svg id="receipt-barcode"></svg>
        <div class="barcode-text">${escapeHtml(barcodeValue)}</div>
      </div>
    </body>
  </html>`;

  const printWindow = window.open('', '_blank', 'width=420,height=900');
  if (!printWindow) return;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    const svg = printWindow.document.getElementById('receipt-barcode');

    if (svg) {
      JsBarcode(svg, barcodeValue, {
        format: 'CODE128',
        displayValue: false,
        width: 1.4,
        height: 42,
        margin: 0,
      });
    }

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };
}
