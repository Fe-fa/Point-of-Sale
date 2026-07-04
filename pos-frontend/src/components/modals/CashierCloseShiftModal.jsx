import { memo, useState } from 'react';
import {
  X,
  AlertTriangle,
  Wallet,
  CheckCircle2,
  Lock,
  ShieldCheck,
} from 'lucide-react';

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* =====================================================================
   CASHIER CLOSE SHIFT MODAL (Drawer Reconciliation)

   Shows the cashier:
     - Input for physical counted cash
     - Close note

   Cashiers are "blind" to the expected cash figure (blind drop):
     - Opening balance and Expected cash are NEVER shown to a cashier
       closing their own shift.
     - Variance is likewise never computed or shown client-side for a
       cashier, since counted - expected would leak the expected figure.
       The variance is calculated server-side after save.

   Shows a Manager/Admin (closing someone else's shift):
     - Opening balance
     - Expected cash (revealed at close time, for audit purposes)
     - Live variance as they type, so they can audit the discrepancy
       on the spot.

   Permission indicator:
     - If the actor is a manager/admin closing someone else's shift,
       a "Manager override" badge is shown.
     - If the cashier is closing their own shift, it shows "Self-close".

   On confirm, calls onConfirm({ countedCash, variance, closeNote })
   For cashiers, variance is always passed as null — the backend
   computes and stores it after save.
   ===================================================================== */
function CashierCloseShiftModal({
  isOpen,
  onClose,
  loading = false,
  error = '',
  shiftData = null,
  currentCurrency = 'KES',
  isManagerOverride = false,
  onConfirm,
}) {
  const [countedCash, setCountedCash] = useState('');
  const [closeNote, setCloseNote] = useState('');

  if (!isOpen) return null;

  // Only managers/admins auditing another cashier's register get to see
  // the expected-cash figures. A cashier closing their own shift is
  // "blind" to this — they only ever see what they physically counted.
  const canSeeExpected = isManagerOverride;

  const cur = shiftData?.currency || currentCurrency;
  const openingBalance = toNumber(shiftData?.opening_balance);
  const expectedCash = toNumber(shiftData?.expected_cash);
  const carryForward = toNumber(shiftData?.carry_forward_variance);

  const counted = countedCash === '' ? null : toNumber(countedCash);
  const variance = canSeeExpected && counted !== null ? round(counted - expectedCash) : null;

  const isShort = variance !== null && variance < 0;
  const isOver = variance !== null && variance > 0;
  const isBalanced = variance !== null && variance === 0;

  const varianceLabel =
    variance === null
      ? '—'
      : isShort
        ? `SHORT (-${cur} ${Math.abs(variance).toFixed(2)})`
        : isOver
          ? `OVER (+${cur} ${variance.toFixed(2)})`
          : `BALANCED (${cur} 0.00)`;

  const varianceColor = isShort ? '#cf3a3a' : isOver ? '#d58c1f' : '#218353';
  const varianceBg = isShort ? '#fde8e8' : isOver ? '#fff8eb' : '#e2f5ec';
  const varianceBorder = isShort ? '#f2c7c7' : isOver ? '#f2ddb2' : '#c3edd7';

  const cashierName = shiftData?.cashier_name || 'This cashier';
  const businessDate = shiftData?.business_date || 'today';

  const handleConfirm = () => {
    onConfirm({
      countedCash: counted,
      // Cashiers never compute variance client-side — the backend
      // calculates and stores it once the count is saved.
      variance: canSeeExpected ? variance : null,
      closeNote: closeNote.trim() || null,
    });
  };

  return (
    <div className="modal-backdrop" onClick={loading ? undefined : onClose}>
      <div
        className="modal-box"
        style={{ maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              <Lock size={18} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              Close Cashier Shift
            </h2>
            <p className="modal-sub">
              {cashierName} · {businessDate}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={loading} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {canSeeExpected && (
            <div style={{
              border: '1px solid #e6edf1', borderRadius: 14, padding: 16,
              background: '#f8fbfc',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Opening balance */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#667788', fontSize: '0.86rem' }}>
                    <Wallet size={15} /> Opening balance
                  </span>
                  <strong style={{ fontSize: '0.95rem' }}>{cur} {openingBalance.toFixed(2)}</strong>
                </div>

                {/* Carry-forward notice */}
                {carryForward !== 0 && (
                  <div style={{
                    fontSize: '0.78rem', color: '#8b6a3f', background: '#fff8eb',
                    border: '1px solid #f2ddb2', borderRadius: 8, padding: '8px 10px',
                  }}>
                    Includes {cur} {carryForward.toFixed(2)} carried forward from previous day's variance.
                  </div>
                )}

                {/* Expected cash — revealed only to managers/admins at close time */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderTop: '1px solid #e6edf1', paddingTop: 10,
                }}>
                  <span style={{ fontWeight: 700, color: '#1b2530', fontSize: '0.88rem' }}>
                    Expected cash in drawer
                  </span>
                  <strong style={{ fontSize: '1.1rem', color: '#1b2530' }}>
                    {cur} {expectedCash.toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>
          )}
          <label className="modal-label">
            Enter counted cash in drawer
            <input
              type="number"
              className="modal-input"
              placeholder="Enter counted total"
              min={0}
              step="0.01"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              autoFocus
            />
          </label>
          <label className="modal-label">
            Close note <span className="modal-optional">(optional)</span>
            <input
              type="text"
              className="modal-input"
              placeholder="e.g. Drawer counted, all notes verified"
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              maxLength={500}
            />
          </label>
          {canSeeExpected && variance !== null && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 16px', borderRadius: 12,
              background: varianceBg, border: `1px solid ${varianceBorder}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isBalanced ? <CheckCircle2 size={18} color={varianceColor} /> : <AlertTriangle size={18} color={varianceColor} />}
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#92a0ae' }}>
                    Drawer Reconciliation
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#667788' }}>
                    Counted: <strong>{cur} {counted.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
              <strong style={{ fontSize: '0.92rem', color: varianceColor, fontWeight: 800 }}>
                {varianceLabel}
              </strong>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="modal-error">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" className="ghost-button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={handleConfirm}
              disabled={loading || counted === null}
            >
              {loading ? 'Closing shift…' : 'Close Shift & Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function round(n) {
  return Math.round(n * 100) / 100;
}

export default memo(CashierCloseShiftModal);