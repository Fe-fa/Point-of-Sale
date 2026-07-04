import { memo, useCallback, useEffect, useState } from 'react';
import {
  X,
  Receipt,
  DollarSign,
  CreditCard,
  Wallet,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';
import { currency, formatDateTime } from '../../utils/helpers';

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* ── Status pill ────────────────────────────────────────────────────── */
function StatusPill({ status }) {
  const safe = String(status || '').toLowerCase();
  const styles = {
    open: { bg: '#eef8fe', color: '#1d4ed8', border: '#cfe7fb', label: 'Open' },
    closed: { bg: '#e4f6ea', color: '#20834f', border: '#ccead7', label: 'Closed' },
  };
  const s = styles[safe] || { bg: '#f4f7f9', color: '#64748b', border: '#e3eaee', label: 'Not opened' };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '5px 12px',
      borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontSize: '0.78rem', fontWeight: 700, textTransform: 'capitalize',
    }}>
      {s.label}
    </span>
  );
}

/* ── Variance badge ─────────────────────────────────────────────────── */
function VarianceBadge({ variance, currency: cur }) {
  if (variance == null) return <span style={{ color: '#92a0ae' }}>—</span>;

  const isShort = variance < 0;
  const isOver = variance > 0;
  const isBalanced = variance === 0;

  const color = isShort ? '#cf3a3a' : isOver ? '#d58c1f' : '#218353';
  const bg = isShort ? '#fde8e8' : isOver ? '#fff8eb' : '#e2f5ec';
  const border = isShort ? '#f2c7c7' : isOver ? '#f2ddb2' : '#c3edd7';
  const label = isShort
    ? `SHORT (${cur} ${Math.abs(variance).toFixed(2)})`
    : isOver
      ? `OVER (+${cur} ${variance.toFixed(2)})`
      : `BALANCED`;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '5px 12px',
      borderRadius: 999, background: bg, color, border: `1px solid ${border}`,
      fontSize: '0.78rem', fontWeight: 700,
    }}>
      {label}
    </span>
  );
}

/* ── Summary tile ───────────────────────────────────────────────────── */
function SummaryTile({ icon: Icon, label, value, sub, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: '#f7fafc', color: '#475569', border: '#e2e8f0' },
    green: { bg: '#eef8f2', color: '#20834f', border: '#dae9df' },
    blue: { bg: '#eef8fe', color: '#1d4ed8', border: '#cfe7fb' },
    amber: { bg: '#fff8eb', color: '#b78855', border: '#f2ddb2' },
    danger: { bg: '#fde8e8', color: '#cf3a3a', border: '#f2c7c7' },
  };
  const t = tones[tone] || tones.neutral;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
      borderRadius: 14, background: t.bg, border: `1px solid ${t.border}`,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center',
        background: '#fff', border: `1px solid ${t.border}`, color: t.color, flexShrink: 0,
      }}>
        <Icon size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#92a0ae' }}>
          {label}
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1b2530', lineHeight: 1.1 }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: '0.76rem', color: '#667788', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* =====================================================================
   CASHIER DAILY SALES MODAL
   Shows a single cashier's full daily sales report.
   Used on the cashier POS page — accessed by clicking "Daily Sales" button.
   ===================================================================== */
function CashierDailySalesModal({
  isOpen,
  onClose,
  loading = false,
  report = null,
  currentCurrency = 'KES',
}) {
  if (!isOpen) return null;

  const cur = report?.currency || currentCurrency;

  return (
    <div className="modal-backdrop" onClick={loading ? undefined : onClose}>
      <div
        className="modal-box"
        style={{ maxWidth: 680, maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              <Receipt size={18} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              Daily Sales Report
            </h2>
            <p className="modal-sub">
              {report?.cashier_name || 'Cashier'} · {report?.business_date || 'Today'} · {report?.store_name || 'Store'}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={loading} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#92a0ae' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              Loading report…
            </div>
          ) : !report ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#92a0ae', fontStyle: 'italic' }}>
              No report data available.
            </div>
          ) : (
            <>
              {/* Status row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StatusPill status={report.status} />
                  {report.status === 'closed' && report.closed_by_name && (
                    <span style={{ fontSize: '0.82rem', color: '#667788' }}>
                      Closed by: <strong>{report.closed_by_name}</strong>
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#667788' }}>
                  {report.opened_at && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} /> Opened: {formatDateTime(report.opened_at)}
                    </span>
                  )}
                  {report.closed_at && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={13} /> Closed: {formatDateTime(report.closed_at)}
                    </span>
                  )}
                </div>
              </div>

              {/* Summary tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                <SummaryTile icon={Wallet} label="Opening Balance" value={currency(toNumber(report.opening_balance), cur)} tone="blue" />
                <SummaryTile icon={Receipt} label="Transactions" value={toNumber(report.transactions)} tone="neutral" />
                <SummaryTile icon={DollarSign} label="Total Sales" value={currency(toNumber(report.total_sales), cur)} tone="green" />
                <SummaryTile icon={Wallet} label="Cash Sales" value={currency(toNumber(report.cash_sales), cur)} tone="green" />
                <SummaryTile icon={CreditCard} label="Non-Cash Sales" value={currency(toNumber(report.non_cash_sales), cur)} tone="blue" />
                <SummaryTile icon={TrendingUp} label="Refunds" value={currency(toNumber(report.refunds), cur)} tone="danger" />
              </div>

              {/* Carry-forward variance notice */}
              {toNumber(report.carry_forward_variance) !== 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                  borderRadius: 10, background: '#fff8eb', border: '1px solid #f2ddb2',
                  fontSize: '0.84rem', color: '#8b6a3f',
                }}>
                  <AlertTriangle size={16} />
                  <span>
                    Opening balance includes <strong>{cur} {toNumber(report.carry_forward_variance).toFixed(2)}</strong> carried forward
                    from the previous day's drawer variance.
                  </span>
                </div>
              )}

              {/* Drawer reconciliation (only if shift is closed or has expected cash) */}
              {report.status === 'closed' && (
                <div style={{
                  border: '1px solid #e6edf1', borderRadius: 14, padding: 16, background: '#f8fbfc',
                }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '0.92rem', fontWeight: 800, color: '#1b2530' }}>
                    Drawer Reconciliation
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                      <span style={{ color: '#667788' }}>Expected cash</span>
                      <strong>{currency(toNumber(report.expected_cash), cur)}</strong>
                    </div>
                    {report.counted_cash != null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                        <span style={{ color: '#667788' }}>Counted cash</span>
                        <strong>{currency(toNumber(report.counted_cash), cur)}</strong>
                      </div>
                    )}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderTop: '1px solid #e6edf1', paddingTop: 10, marginTop: 4,
                    }}>
                      <span style={{ fontWeight: 700, color: '#1b2530' }}>Variance</span>
                      <VarianceBadge variance={report.variance} currency={cur} />
                    </div>
                    {report.close_note && (
                      <div style={{
                        marginTop: 8, padding: '10px 12px', borderRadius: 8,
                        background: '#fff', border: '1px solid #e6edf1',
                        fontSize: '0.82rem', color: '#475569',
                      }}>
                        <FileText size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                        {report.close_note}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Payment breakdown */}
              {report.payment_breakdown?.length > 0 && (
                <div style={{ border: '1px solid #e6edf1', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #e6edf1', background: '#f5fafc' }}>
                    <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#667788' }}>
                      Payment Method Breakdown
                    </h3>
                  </div>
                  {report.payment_breakdown.map((pm, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 16px', borderBottom: i < report.payment_breakdown.length - 1 ? '1px solid #edf2f5' : 'none',
                    }}>
                      <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#1b2530' }}>
                        {pm.method} <span style={{ color: '#92a0ae', fontWeight: 400 }}>({pm.count} txn)</span>
                      </span>
                      <strong style={{ fontSize: '0.88rem' }}>{currency(toNumber(pm.amount), cur)}</strong>
                    </div>
                  ))}
                </div>
              )}
              {/* Products sold */}
{report.products_sold?.length > 0 && (
  <div style={{ border: '1px solid #e6edf1', borderRadius: 14, overflow: 'hidden' }}>
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #e6edf1', background: '#f5fafc' }}>
      <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#667788' }}>
        Products Sold
      </h3>
    </div>

    <div style={{ padding: 12, display: 'grid', gap: 8 }}>
      {report.products_sold.map((item, i) => (
        <div
          key={`${item.product_id}-${i}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: 12,
            alignItems: 'center',
            padding: '10px 12px',
            border: '1px solid #edf2f5',
            borderRadius: 10,
            background: '#fff',
          }}
        >
          <strong style={{ color: '#1b2530', fontSize: '0.86rem' }}>{item.product_name}</strong>
          <span style={{ color: '#667788', fontSize: '0.82rem' }}>{item.qty} pcs</span>
          <strong style={{ fontSize: '0.84rem' }}>{currency(toNumber(item.amount), cur)}</strong>
        </div>
      ))}

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: 8,
        borderTop: '1px solid #e6edf1',
        fontSize: '0.84rem',
      }}>
        <strong>Total items sold</strong>
        <strong>{toNumber(report.total_items_sold)} units</strong>
      </div>
    </div>
  </div>
)}


              {/* Additional info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#667788' }}>Outstanding</span>
                  <strong>{currency(toNumber(report.outstanding), cur)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#667788' }}>Voids</span>
                  <strong>{toNumber(report.total_voids)}</strong>
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" className="ghost-button" onClick={onClose} disabled={loading}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(CashierDailySalesModal);
