import { memo, useState } from 'react';
import {
  X,
  Users,
  Download,
  Printer,
  ChevronDown,
} from 'lucide-react';
import { currency } from '../../utils/helpers';

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function StatusPill({ status }) {
  const safe = String(status || '').toLowerCase();
  const styles = {
    open:   { bg: '#eef8fe', color: '#1d4ed8', border: '#cfe7fb', label: 'Open' },
    closed: { bg: '#e4f6ea', color: '#20834f', border: '#ccead7', label: 'Closed' },
  };
  const s = styles[safe] || { bg: '#f4f7f9', color: '#64748b', border: '#e3eaee', label: 'Not opened' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '4px 10px',
      borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontSize: '0.74rem', fontWeight: 700, textTransform: 'capitalize',
    }}>
      {s.label}
    </span>
  );
}

function VarianceCell({ variance, currency: cur }) {
  if (variance == null) return <span style={{ color: '#92a0ae' }}>—</span>;
  const isShort = variance < 0;
  const isOver  = variance > 0;
  const color = isShort ? '#cf3a3a' : isOver ? '#d58c1f' : '#218353';
  return (
    <strong style={{ color, fontSize: '0.82rem' }}>
      {isShort ? 'SHORT ' : isOver ? 'OVER ' : 'BALANCED'}
      {variance !== 0 ? `(${cur} ${Math.abs(variance).toFixed(2)})` : ''}
    </strong>
  );
}

/* ── Individual cashier print ─────────────────────────────────────── */
function printCashierRow(row, cur, businessDate, storeName) {
  const variance = row.variance;
  const isShort  = variance != null && variance < 0;
  const isOver   = variance != null && variance > 0;
  const varLabel = variance == null ? '—'
    : isShort ? `SHORT (${cur} ${Math.abs(variance).toFixed(2)})`
    : isOver  ? `OVER (${cur} ${variance.toFixed(2)})`
    : 'BALANCED';

  const win = window.open('', '_blank', 'width=600,height=700');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cashier Shift Report — ${row.cashier_name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #1b2530; font-size: 13px; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        .sub { color: #667788; margin: 0 0 24px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { text-align: left; padding: 8px 10px; background: #f5fafc; font-size: 11px;
             text-transform: uppercase; letter-spacing: 0.04em; color: #667788;
             border-bottom: 1px solid #e6edf1; }
        td { padding: 10px; border-bottom: 1px solid #edf2f5; }
        .total-row td { font-weight: 800; background: #f0f5f8; border-top: 2px solid #d8e3e9; }
        .balanced { color: #218353; } .short { color: #cf3a3a; } .over { color: #d58c1f; }
        .footer { margin-top: 32px; font-size: 11px; color: #92a0ae; border-top: 1px solid #e6edf1; padding-top: 12px; }
        @media print { body { padding: 16px; } }
      </style>
    </head>
    <body>
      <h1>Cashier Shift Report</h1>
      <p class="sub">${row.cashier_name} · ${storeName || row.store_name || 'Store'} · ${businessDate || 'Today'}</p>
      <table>
        <tr><th>Field</th><th>Amount</th></tr>
        <tr><td>Opening Balance</td><td>${cur} ${toNumber(row.opening_balance).toFixed(2)}</td></tr>
        <tr><td>Cash Sales</td><td>${cur} ${toNumber(row.cash_sales).toFixed(2)}</td></tr>
        <tr><td>Non-Cash Sales</td><td>${cur} ${toNumber(row.non_cash_sales).toFixed(2)}</td></tr>
        <tr><td>Total Sales</td><td><strong>${cur} ${toNumber(row.total_sales).toFixed(2)}</strong></td></tr>
        <tr><td>Transactions</td><td>${toNumber(row.transactions)}</td></tr>
        <tr><td>Expected Cash</td><td>${cur} ${toNumber(row.expected_cash).toFixed(2)}</td></tr>
        <tr><td>Counted Cash</td><td>${row.counted_cash != null ? `${cur} ${toNumber(row.counted_cash).toFixed(2)}` : '—'}</td></tr>
        <tr class="total-row">
          <td>Variance</td>
          <td class="${isShort ? 'short' : isOver ? 'over' : 'balanced'}">${varLabel}</td>
        </tr>
      </table>
      <div class="footer">
        Status: ${row.status || 'Unknown'} · Printed ${new Date().toLocaleString()}
      </div>
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

/* ── Full store report print ──────────────────────────────────────── */
function printFullReport(data, cur) {
  const rows    = data?.rows || [];
  const totals  = {
    opening:     rows.reduce((s, r) => s + toNumber(r.opening_balance), 0),
    cashSales:   rows.reduce((s, r) => s + toNumber(r.cash_sales), 0),
    nonCash:     rows.reduce((s, r) => s + toNumber(r.non_cash_sales), 0),
    total:       rows.reduce((s, r) => s + toNumber(r.total_sales), 0),
    transactions:rows.reduce((s, r) => s + toNumber(r.transactions), 0),
    expected:    rows.reduce((s, r) => s + toNumber(r.expected_cash), 0),
    counted:     rows.reduce((s, r) => s + toNumber(r.counted_cash ?? 0), 0),
    variance:    data?.total_variance ?? null,
  };

  const varLabel = totals.variance == null ? '—'
    : totals.variance < 0 ? `SHORT (${cur} ${Math.abs(totals.variance).toFixed(2)})`
    : totals.variance > 0 ? `OVER (${cur} ${totals.variance.toFixed(2)})`
    : 'BALANCED';

  const rowsHtml = rows.map(r => {
    const v = r.variance;
    const vLabel = v == null ? '—'
      : v < 0 ? `SHORT (${cur} ${Math.abs(v).toFixed(2)})`
      : v > 0 ? `OVER (${cur} ${v.toFixed(2)})` : 'BALANCED';
    const cls = v == null ? '' : v < 0 ? 'short' : v > 0 ? 'over' : 'balanced';
    return `
      <tr>
        <td><strong>${r.cashier_name || 'Cashier'}</strong></td>
        <td>${r.store_name || '—'}</td>
        <td>${r.status || '—'}</td>
        <td>${cur} ${toNumber(r.opening_balance).toFixed(2)}</td>
        <td>${cur} ${toNumber(r.cash_sales).toFixed(2)}</td>
        <td>${cur} ${toNumber(r.non_cash_sales).toFixed(2)}</td>
        <td><strong>${cur} ${toNumber(r.total_sales).toFixed(2)}</strong></td>
        <td style="text-align:center">${toNumber(r.transactions)}</td>
        <td>${cur} ${toNumber(r.expected_cash).toFixed(2)}</td>
        <td>${r.counted_cash != null ? `${cur} ${toNumber(r.counted_cash).toFixed(2)}` : '—'}</td>
        <td class="${cls}">${vLabel}</td>
      </tr>`;
  }).join('');

  const productsHtml = (data?.products_sold || []).map(p => `
    <tr>
      <td>${p.product_name}</td>
      <td style="text-align:center">${toNumber(p.qty)}</td>
      <td>${cur} ${toNumber(p.amount).toFixed(2)}</td>
    </tr>`).join('');

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>All Cashiers Daily Sales — ${data?.store_name || 'Store'}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #1b2530; font-size: 12px; }
        h1 { font-size: 17px; margin: 0 0 4px; }
        .sub { color: #667788; margin: 0 0 20px; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
        th { text-align: left; padding: 7px 8px; background: #f5fafc;
             text-transform: uppercase; letter-spacing: 0.04em; color: #667788;
             border-bottom: 1px solid #e6edf1; font-size: 10px; }
        td { padding: 8px; border-bottom: 1px solid #edf2f5; }
        .total-row td { font-weight: 800; background: #f0f5f8; border-top: 2px solid #d8e3e9; }
        .balanced { color: #218353; } .short { color: #cf3a3a; } .over { color: #d58c1f; }
        h2 { font-size: 13px; margin: 20px 0 8px; color: #667788; text-transform: uppercase; letter-spacing: 0.04em; }
        .footer { margin-top: 24px; font-size: 10px; color: #92a0ae; border-top: 1px solid #e6edf1; padding-top: 10px; }
        @media print { body { padding: 12px; } }
      </style>
    </head>
    <body>
      <h1>All Cashiers Daily Sales</h1>
      <p class="sub">${data?.store_name || 'Store'} · ${data?.business_date || 'Today'} · ${rows.length} cashier(s)</p>

      <table>
        <thead>
          <tr>
            <th>Cashier</th><th>Store</th><th>Status</th><th>Opening</th>
            <th>Cash</th><th>Non-Cash</th><th>Total</th><th>Txn</th>
            <th>Expected</th><th>Counted</th><th>Variance</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="3">TOTAL (${rows.length} cashiers)</td>
            <td>${cur} ${totals.opening.toFixed(2)}</td>
            <td>${cur} ${totals.cashSales.toFixed(2)}</td>
            <td>${cur} ${totals.nonCash.toFixed(2)}</td>
            <td>${cur} ${totals.total.toFixed(2)}</td>
            <td style="text-align:center">${totals.transactions}</td>
            <td>${cur} ${totals.expected.toFixed(2)}</td>
            <td>${totals.counted > 0 ? `${cur} ${totals.counted.toFixed(2)}` : '—'}</td>
            <td class="${totals.variance == null ? '' : totals.variance < 0 ? 'short' : totals.variance > 0 ? 'over' : 'balanced'}">${varLabel}</td>
          </tr>
        </tfoot>
      </table>

      ${data?.products_sold?.length ? `
        <h2>Products Sold Today</h2>
        <table>
          <thead><tr><th>Product</th><th style="text-align:center">Qty</th><th>Amount</th></tr></thead>
          <tbody>${productsHtml}</tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="2">Total items sold</td>
              <td>${toNumber(data?.total_items_sold)} units</td>
            </tr>
          </tfoot>
        </table>` : ''}

      <div class="footer">Printed ${new Date().toLocaleString()}</div>
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

/* =====================================================================
   MAIN MODAL
   ===================================================================== */
function AllCashiersDailySalesModal({
  isOpen,
  onClose,
  loading = false,
  data = null,
  currentCurrency = 'KES',
  // NEW: for store selector
  storePerformance = [],
  onStoreChange,
  selectedStoreId,
}) {
  if (!isOpen) return null;

  const cur  = data?.currency || currentCurrency;
  const rows = data?.rows || [];

  const totals = {
    opening:      toNumber(data?.total_opening_balance),
    cashSales:    toNumber(data?.total_cash_sales),
    nonCashSales: toNumber(data?.total_non_cash_sales),
    totalSales:   toNumber(data?.total_sales),
    expectedCash: toNumber(data?.total_expected_cash),
    countedCash:  toNumber(data?.total_counted_cash),
    variance:     data?.total_variance != null ? toNumber(data?.total_variance) : null,
    transactions: toNumber(data?.total_transactions),
    openCount:    toNumber(data?.open_shift_count),
    closedCount:  toNumber(data?.closed_shift_count),
  };

  const handleExport = () => {
    if (!rows.length) return;
    const headers = ['Cashier','Store','Status','Opening','Cash Sales','Non-Cash','Total Sales','Transactions','Expected Cash','Counted Cash','Variance'];
    const csvRows = [headers.join(',')];
    rows.forEach((r) => {
      csvRows.push([
        `"${r.cashier_name || 'Cashier'}"`,
        `"${r.store_name || 'Store'}"`,
        r.status || '—',
        toNumber(r.opening_balance).toFixed(2),
        toNumber(r.cash_sales).toFixed(2),
        toNumber(r.non_cash_sales).toFixed(2),
        toNumber(r.total_sales).toFixed(2),
        toNumber(r.transactions),
        toNumber(r.expected_cash).toFixed(2),
        r.counted_cash != null ? toNumber(r.counted_cash).toFixed(2) : '—',
        r.variance != null ? toNumber(r.variance).toFixed(2) : '—',
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `all-cashiers-daily-sales-${data?.business_date || 'today'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" onClick={loading ? undefined : onClose}>
      <div
        className="modal-box"
        style={{ maxWidth: 1040, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 className="modal-title">
                <Users size={18} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                All Cashiers Daily Sales
              </h2>
              <p className="modal-sub">
                {data?.store_name || data?.rows?.[0]?.store_name || 'Store'} · {data?.business_date || 'Today'}
                {' · '}
                <span style={{ color: '#1d4ed8' }}>{totals.openCount} open</span>
                {' / '}
                <span style={{ color: '#20834f' }}>{totals.closedCount} closed</span>
              </p>
            </div>

            {/* Store selector — only shown if multiple stores available */}
            {storePerformance.length > 1 && onStoreChange && (
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedStoreId || ''}
                  onChange={(e) => onStoreChange(Number(e.target.value))}
                  style={{
                    appearance: 'none', padding: '6px 28px 6px 10px', borderRadius: 8,
                    border: '1px solid var(--sa-border, #e6edf1)', background: '#f7fafc',
                    fontSize: '0.82rem', fontWeight: 600, color: '#1b2530', cursor: 'pointer',
                    minWidth: 160,
                  }}
                >
                  {storePerformance.map((s) => (
                    <option key={s.store_id} value={s.store_id}>
                      {s.store_name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#667788' }} />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="ghost-button"
              onClick={handleExport}
              disabled={loading || !rows.length}
              title="Export CSV"
              style={{ minHeight: 36, padding: '0 12px' }}
            >
              <Download size={15} /> CSV
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => printFullReport(data, cur)}
              disabled={loading || !rows.length}
              title="Print full report"
              style={{ minHeight: 36, padding: '0 12px' }}
            >
              <Printer size={15} /> Print All
            </button>
            <button type="button" className="icon-btn" onClick={onClose} disabled={loading} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ overflow: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#92a0ae' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              Loading all cashiers report…
            </div>
          ) : !rows.length ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#92a0ae', fontStyle: 'italic' }}>
              No cashier shifts have been opened for this store today.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#f5fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                  {['Cashier','Store','Status','Opening','Cash','Non-Cash','Total','Txn','Expected','Counted','Variance',''].map((h, hi) => (
                    <th key={`${h}-${hi}`} style={{
                      textAlign: h === 'Txn' || h === '' ? 'center' : 'left',
                      padding: '10px 12px', fontSize: '0.72rem', fontWeight: 800,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      color: '#667788', borderBottom: '1px solid #e6edf1', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.cashier_user_id}-${r.store_id}-${i}`} style={{ borderBottom: '1px solid #edf2f5' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <strong style={{ color: '#1b2530' }}>{r.cashier_name || 'Cashier'}</strong>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#667788' }}>{r.store_name || 'Store'}</td>
                    <td style={{ padding: '10px 12px' }}><StatusPill status={r.status} /></td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{currency(toNumber(r.opening_balance), cur)}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{currency(toNumber(r.cash_sales), cur)}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{currency(toNumber(r.non_cash_sales), cur)}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontWeight: 700 }}>{currency(toNumber(r.total_sales), cur)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{toNumber(r.transactions)}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{currency(toNumber(r.expected_cash), cur)}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {r.counted_cash != null ? currency(toNumber(r.counted_cash), cur) : <span style={{ color: '#92a0ae' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <VarianceCell variance={r.variance} currency={cur} />
                    </td>
                    {/* ← Per-row print button */}
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <button
                        type="button"
                        title={`Print ${r.cashier_name}'s shift`}
                        onClick={() => printCashierRow(r, cur, data?.business_date, data?.store_name)}
                        style={{
                          background: 'none', border: '1px solid #e6edf1', borderRadius: 6,
                          padding: '4px 7px', cursor: 'pointer', color: '#667788',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: '0.72rem',
                        }}
                      >
                        <Printer size={12} /> Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f0f5f8', borderTop: '2px solid #d8e3e9', fontWeight: 800 }}>
                  <td style={{ padding: '12px' }} colSpan={3}>TOTAL ({rows.length} cashiers)</td>
                  <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{currency(totals.opening, cur)}</td>
                  <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{currency(totals.cashSales, cur)}</td>
                  <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{currency(totals.nonCashSales, cur)}</td>
                  <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{currency(totals.totalSales, cur)}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>{totals.transactions}</td>
                  <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{currency(totals.expectedCash, cur)}</td>
                  <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                    {totals.countedCash > 0 ? currency(totals.countedCash, cur) : '—'}
                  </td>
                  <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                    <VarianceCell variance={totals.variance} currency={cur} />
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}

          {data?.products_sold?.length > 0 && (
            <div style={{ padding: 16, borderTop: '1px solid #e6edf1', background: '#fbfdff' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '0.82rem', fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.04em', color: '#667788' }}>
                Products Sold Today
              </h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {data.products_sold.map((item, i) => (
                  <div key={`${item.product_id}-${i}`} style={{
                    display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12,
                    alignItems: 'center', padding: '10px 12px',
                    border: '1px solid #e6edf1', borderRadius: 10, background: '#fff',
                  }}>
                    <strong style={{ fontSize: '0.86rem', color: '#1b2530' }}>{item.product_name}</strong>
                    <span style={{ fontSize: '0.82rem', color: '#667788' }}>{toNumber(item.qty)} pcs</span>
                    <strong style={{ fontSize: '0.84rem' }}>{currency(toNumber(item.amount), cur)}</strong>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #e6edf1' }}>
                  <strong>Total items sold</strong>
                  <strong>{toNumber(data.total_items_sold)} units</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="modal-footer" style={{ marginTop: 0, paddingTop: 14 }}>
          <button type="button" className="ghost-button" onClick={onClose} disabled={loading}>
            Close
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => printFullReport(data, cur)}
            disabled={loading || !rows.length}
          >
            <Printer size={14} /> Print Full Report
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(AllCashiersDailySalesModal);