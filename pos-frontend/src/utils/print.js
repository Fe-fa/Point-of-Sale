import { currency, formatDateTime } from './helpers';

export function openBillingPrint(billing, currentStore, mode = 'receipt') {
  if (!billing) return;

  const title = mode === 'invoice' ? 'Invoice Print' : 'Receipt Print';
  const payment = billing.payments?.[billing.payments.length - 1];
  const html = `<!doctype html>
  <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
        .header, .summary { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
        .brand { font-size: 22px; font-weight: 700; }
        .muted { color: #6b7280; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; }
        th:last-child, td:last-child { text-align: right; }
        .totals { margin-left: auto; width: 320px; }
        .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
        .grand { font-weight: 700; font-size: 18px; border-top: 2px solid #111827; margin-top: 8px; padding-top: 12px; }
        .pill { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #111827; color: #fff; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">${currentStore?.store_name || 'Store'}</div>
          <div class="muted">${currentStore?.location || ''}</div>
          <div class="muted">${currentStore?.telephone || ''}</div>
          <div class="muted">${currentStore?.email_address || ''}</div>
        </div>
        <div>
          <div class="pill">${mode === 'invoice' ? 'INVOICE' : 'RECEIPT'}</div>
          <div style="margin-top:12px; font-weight:700;">${billing.invnumber || payment?.receiptnumber || `BILL-${billing.billing_id}`}</div>
          <div class="muted">Date: ${formatDateTime(payment?.payment_date || billing.billing_date)}</div>
          <div class="muted">Status: ${billing.status || 'draft'}</div>
        </div>
      </div>

      <div class="summary">
        <div>
          <div style="font-weight:700; margin-bottom:8px;">Bill To</div>
          <div>${billing.customer?.full_name || 'Customer'}</div>
          <div class="muted">${billing.customer?.phone || ''}</div>
          <div class="muted">${billing.customer?.email || ''}</div>
        </div>
        <div>
          <div style="font-weight:700; margin-bottom:8px;">Cashier</div>
          <div>${billing.user?.full_name || 'Cashier'}</div>
          <div class="muted">${billing.notes || ''}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${(billing.items || []).map((item) => `
            <tr>
              <td>${item.product?.product_name || 'Product'}</td>
              <td>${item.quantity}</td>
              <td>${currency(item.unit_price, currentStore?.currency || 'KES')}</td>
              <td>${currency(item.total_amount, currentStore?.currency || 'KES')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div><span>Subtotal</span><strong>${currency(billing.subtotal, currentStore?.currency || 'KES')}</strong></div>
        <div><span>VAT</span><strong>${currency(billing.vat_amount, currentStore?.currency || 'KES')}</strong></div>
        <div><span>Paid</span><strong>${currency(billing.paid_amount, currentStore?.currency || 'KES')}</strong></div>
         <div class="grand"><span>Total</span><strong>${currency(billing.total, currentStore?.currency || 'KES')}</strong></div>
        <div class="grand"><span>Balance</span><strong>${currency(billing.balance_due, currentStore?.currency || 'KES')}</strong></div>
      </div>

      ${payment ? `<p style="margin-top: 24px;"><strong>Payment:</strong> ${payment.payment_method.toUpperCase()} | Received ${currency(payment.amount_received, currentStore?.currency || 'KES')} | Change ${currency(payment.change_returned, currentStore?.currency || 'KES')}</p>` : ''}

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
  </html>`;

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
