import { useEffect, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
  padding: 16,
};

const modalStyle = {
  width: '100%',
  maxWidth: 520,
  background: '#fff',
  borderRadius: 18,
  padding: 24,
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)',
};

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid #d0d7e2',
  fontSize: 15,
};

export default function CashOpeningModal({
  isOpen,
  loading = false,
  currentCurrency = 'KES',
  carryForwardVariance = 0,
  onClose,
  onSubmit,
}) {
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingNote, setOpeningNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setOpeningBalance('');
      setOpeningNote('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const carry = Number(carryForwardVariance || 0);
  const hasCarryForward = carry !== 0;
  const parsedBalance = Number(openingBalance);
  const adjustedOpening = hasCarryForward && Number.isFinite(parsedBalance)
    ? Math.max(parsedBalance + carry, 0)
    : parsedBalance;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!Number.isFinite(parsedBalance) || parsedBalance < 0) {
      setError('Enter a valid opening balance.');
      return;
    }

    try {
      await onSubmit?.({
        openingBalance: parsedBalance,
        openingNote: openingNote.trim() || null,
      });
    } catch (err) {
      setError(err?.message || 'Unable to open cashier shift.');
    }
  };

  return (
    <div style={overlayStyle} onClick={() => !loading && onClose?.()}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
            Cashier accountability
          </div>
          <h3 style={{ margin: '8px 0 6px', fontSize: 24 }}>Open today&apos;s cash shift</h3>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.5 }}>
            Enter the opening drawer balance for this cashier before you start processing daily sales.
          </p>
        </div>

        {/* Carry-forward variance notice */}
        {hasCarryForward && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 12,
            background: carry < 0 ? '#fde8e8' : '#fff8eb',
            border: `1px solid ${carry < 0 ? '#f2c7c7' : '#f2ddb2'}`,
            fontSize: '0.86rem',
            color: carry < 0 ? '#a23b3b' : '#8b6a3f',
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Drawer variance carried forward</strong>
              <p style={{ margin: '4px 0 0', lineHeight: 1.5 }}>
                Your previous shift ended with a{' '}
                <strong>{carry < 0 ? 'SHORT' : 'OVER'} of {currentCurrency} {Math.abs(carry).toFixed(2)}</strong>.
                This will be {carry < 0 ? 'subtracted from' : 'added to'} your opening balance automatically.
                <br />
                Adjusted opening: <strong>{currentCurrency} {adjustedOpening.toFixed(2)}</strong>
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>
              Opening balance ({currentCurrency})
              {hasCarryForward && (
                <span style={{ fontWeight: 400, fontSize: '0.82rem', color: '#64748b', marginLeft: 6 }}>
                  (before carry-forward adjustment)
                </span>
              )}
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={openingBalance}
              onChange={(event) => setOpeningBalance(event.target.value)}
              placeholder="0.00"
              style={inputStyle}
              autoFocus
            />
            {hasCarryForward && Number.isFinite(parsedBalance) && (
              <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                <Info size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                Final opening balance after carry-forward: <strong>{currentCurrency} {adjustedOpening.toFixed(2)}</strong>
              </span>
            )}
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>Opening note</span>
            <textarea
              value={openingNote}
              onChange={(event) => setOpeningNote(event.target.value)}
              placeholder="Optional drawer or handover note"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </label>

          {error ? (
            <div style={{ color: '#b91c1c', background: '#fee2e2', borderRadius: 12, padding: '10px 12px' }}>
              {error}
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              type="button"
              onClick={() => !loading && onClose?.()}
              disabled={loading}
              style={{
                padding: '10px 16px',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 16px',
                borderRadius: 12,
                border: 'none',
                background: '#0f766e',
                color: '#fff',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Opening…' : 'Open cash shift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
