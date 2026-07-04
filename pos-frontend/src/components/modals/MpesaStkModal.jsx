// src/components/payments/MpesaStkModal.jsx
//
// Live-status modal shown after "Charge Payment" is clicked with M-Pesa selected.
// - Polls /api/mpesa/status/{checkoutRequestId} every 3 s.
// - Blocks the parent modal so the cashier can't fire a second STK push.
// - Auto-closes with success once the callback confirms the receipt.
// - Provides a "Cancel" escape hatch (marks txn as cancelled server-side).

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Smartphone, X, XCircle } from 'lucide-react';
import { mpesaService } from '../../services/mpesaService';

const STATUS_COPY = {
  pending:   { label: 'Sending request…',           tone: 'muted'   },
  sent:      { label: 'Waiting for customer PIN…',  tone: 'muted'   },
  success:   { label: 'Payment received',            tone: 'success' },
  failed:    { label: 'Payment failed',              tone: 'danger'  },
  cancelled: { label: 'Cancelled by customer',       tone: 'danger'  },
  timeout:   { label: 'Timed out — please retry',    tone: 'danger'  },
  unknown:   { label: 'Unknown status',              tone: 'muted'   },
};

export default function MpesaStkModal({
  isOpen,
  checkoutRequestId,
  phone,
  amount,
  currency,
  storeCurrency,
  pollingIntervalMs = 3000,
  pollingTimeoutMs = 120000,
  onSuccess,   // (mpesaTxn) => void
  onFailure,   // (message) => void
  onClose,
}) {
  const [status, setStatus] = useState('pending');
  const [resultDesc, setResultDesc] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const timerRef = useRef(null);
  const startedAtRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !checkoutRequestId) return undefined;

    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setStatus('sent');
    setResultDesc('');
    setReceipt(null);
    setElapsedMs(0);

    const poll = async () => {
      if (finishedRef.current) return;

      try {
        const res = await mpesaService.status(checkoutRequestId);
        const payload = res?.data || res || {};
        setStatus(payload.status || 'unknown');
        setResultDesc(payload.result_desc || '');
        setReceipt(payload.mpesa_receipt || null);

        if (payload.status === 'success') {
          finishedRef.current = true;
          clearInterval(timerRef.current);
          onSuccess?.(payload);
          return;
        }

        if (['failed', 'cancelled', 'timeout'].includes(payload.status)) {
          finishedRef.current = true;
          clearInterval(timerRef.current);
          onFailure?.(payload.result_desc || STATUS_COPY[payload.status]?.label);
          return;
        }

        const elapsed = Date.now() - startedAtRef.current;
        setElapsedMs(elapsed);

        if (elapsed >= pollingTimeoutMs) {
          finishedRef.current = true;
          clearInterval(timerRef.current);
          setStatus('timeout');
          onFailure?.('Payment timed out. Ask the customer to try again.');
        }
      } catch (err) {
        // Network hiccup — keep polling silently.
        console.warn('[Mpesa] status poll failed', err?.message);
      }
    };

    // Kick off immediately, then on interval.
    poll();
    timerRef.current = setInterval(poll, pollingIntervalMs);

    return () => {
      finishedRef.current = true;
      clearInterval(timerRef.current);
    };
  }, [isOpen, checkoutRequestId, pollingIntervalMs, pollingTimeoutMs, onSuccess, onFailure]);

  const handleCancel = async () => {
    finishedRef.current = true;
    clearInterval(timerRef.current);
    try {
      if (['pending', 'sent'].includes(status)) {
        await mpesaService.cancel(checkoutRequestId);
      }
    } catch (_) {}
    onClose?.();
  };

  if (!isOpen) return null;

  const copy = STATUS_COPY[status] || STATUS_COPY.unknown;
  const remainingSec = Math.max(0, Math.ceil((pollingTimeoutMs - elapsedMs) / 1000));
  const canClose = ['success', 'failed', 'cancelled', 'timeout'].includes(status);

  return (
    <div className="modal-backdrop" style={{ zIndex: 1200 }}>
      <div
        className="modal-card"
        style={{ width: 'min(460px, 94vw)', borderRadius: 20, textAlign: 'center' }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="icon-button"
            onClick={handleCancel}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '4px 8px 24px' }}>
          <div
            style={{
              width: 74, height: 74, borderRadius: '50%',
              margin: '0 auto 18px', display: 'grid', placeItems: 'center',
              background:
                status === 'success' ? 'rgba(33,197,94,0.12)'
                : ['failed', 'cancelled', 'timeout'].includes(status) ? 'rgba(220,38,38,0.10)'
                : 'rgba(56,132,255,0.10)',
              color:
                status === 'success' ? '#21c55e'
                : ['failed', 'cancelled', 'timeout'].includes(status) ? '#dc2626'
                : 'var(--primary)',
            }}
          >
            {status === 'success' ? (
              <CheckCircle2 size={38} />
            ) : ['failed', 'cancelled', 'timeout'].includes(status) ? (
              <XCircle size={38} />
            ) : (
              <Loader2 size={38} className="spin" />
            )}
          </div>

          <h3 style={{ margin: '0 0 6px' }}>
            <Smartphone size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
            M-Pesa Payment
          </h3>

          <div className={`muted`} style={{ marginBottom: 14 }}>
            {copy.label}
          </div>

          <div
            style={{
              padding: 14, borderRadius: 12, background: 'var(--panel-2)',
              display: 'grid', gap: 6, textAlign: 'left', marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">Phone</span>
              <strong>{phone}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">Amount</span>
              <strong>{currency(amount, storeCurrency)}</strong>
            </div>
            {receipt ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">Receipt</span>
                <strong style={{ letterSpacing: 1 }}>{receipt}</strong>
              </div>
            ) : null}
            {!canClose ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">Auto-cancel in</span>
                <strong>{remainingSec}s</strong>
              </div>
            ) : null}
          </div>

          {resultDesc && ['failed', 'cancelled', 'timeout'].includes(status) ? (
            <div className="form-error" style={{ marginBottom: 12 }}>{resultDesc}</div>
          ) : null}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {canClose ? (
              <button type="button" className="primary-button" onClick={onClose}>
                {status === 'success' ? 'Continue' : 'Close'}
              </button>
            ) : (
              <button type="button" className="ghost-button danger" onClick={handleCancel}>
                Cancel payment
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`.spin { animation: mpesa-spin 1s linear infinite; }
      @keyframes mpesa-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
