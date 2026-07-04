import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CreditCard, Smartphone, Wallet, X } from 'lucide-react';

const toNum = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

function MethodButton({ active, icon: Icon, label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      className={active ? 'primary-button' : 'ghost-button'}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={16} /> {label}
    </button>
  );
}

function StrategyCard({ active, title, subtitle, onClick, disabled = false }) {
  return (
    <button
      type="button"
      className={active ? 'primary-button' : 'ghost-button'}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'grid',
        gap: 4,
        textAlign: 'left',
        justifyItems: 'start',
        padding: 14,
      }}
    >
      <span style={{ fontWeight: 800 }}>{title}</span>
      <span style={{ fontSize: 12, opacity: 0.9 }}>{subtitle}</span>
    </button>
  );
}

function ModeSwitch({ active, label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      className={active ? 'primary-button' : 'ghost-button'}
      onClick={onClick}
      disabled={disabled}
      style={{ minWidth: 140 }}
    >
      {label}
    </button>
  );
}

function PaymentInfoCard({ label, value, muted = false }) {
  return (
    <div style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
      <strong style={{ color: muted ? 'var(--muted)' : 'var(--text)' }}>{value}</strong>
    </div>
  );
}

function GrnPaymentModal({
  isOpen,
  onClose,
  grn,
  currency,
  submitting,
  stkSubmitting = false,
  onCharge,
  onInitiateStk,
}) {
  const [settlementType, setSettlementType] = useState('partial');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [mpesaMode, setMpesaMode] = useState('stk');
  const [amountReceived, setAmountReceived] = useState(0);
  const [amountTendered, setAmountTendered] = useState(0);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaCode, setMpesaCode] = useState('');
  const [cardReference, setCardReference] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [bankReference, setBankReference] = useState('');
  const [notes, setNotes] = useState('');

  const balanceDue = useMemo(() => toNum(grn?.balance_due), [grn]);
  const alreadyPaid = useMemo(() => toNum(grn?.paid_amount), [grn]);
  const invoiceTotal = useMemo(() => toNum(grn?.final_total), [grn]);
  const isBusy = submitting || stkSubmitting;

  useEffect(() => {
    if (!isOpen) return;

    const defaultSettlementType = balanceDue > 0 ? 'partial' : 'immediate';
    setSettlementType(defaultSettlementType);
    setPaymentMethod('cash');
    setMpesaMode('stk');
    setAmountReceived(balanceDue);
    setAmountTendered(balanceDue);
    setMpesaPhone('');
    setMpesaCode('');
    setCardReference('');
    setCardHolder('');
    setBankReference('');
    setNotes('');
  }, [isOpen, balanceDue]);

  useEffect(() => {
    if (!isOpen) return;

    if (settlementType === 'immediate') {
      setAmountReceived(balanceDue);
      if (paymentMethod === 'cash') {
        setAmountTendered(balanceDue);
      }
      return;
    }

    const safeAmount = Math.min(Math.max(toNum(amountReceived), 0), balanceDue);
    if (safeAmount !== toNum(amountReceived)) {
      setAmountReceived(safeAmount);
    }

    if (paymentMethod === 'cash') {
      setAmountTendered((current) => {
        const currentNum = toNum(current);
        return currentNum < safeAmount ? safeAmount : currentNum;
      });
    }
  }, [settlementType, paymentMethod, balanceDue, amountReceived, isOpen]);

  const amountToCharge = useMemo(() => {
    if (settlementType === 'immediate') {
      return balanceDue;
    }

    return Math.min(Math.max(toNum(amountReceived), 0), balanceDue);
  }, [settlementType, amountReceived, balanceDue]);

  const effectiveTendered = useMemo(() => (
    paymentMethod === 'cash'
      ? Math.max(toNum(amountTendered), amountToCharge)
      : amountToCharge
  ), [paymentMethod, amountTendered, amountToCharge]);

  const change = useMemo(() => (
    paymentMethod === 'cash'
      ? Math.max(effectiveTendered - amountToCharge, 0)
      : 0
  ), [paymentMethod, effectiveTendered, amountToCharge]);

  const remainingBalance = useMemo(
    () => Math.max(balanceDue - amountToCharge, 0),
    [balanceDue, amountToCharge],
  );

  const requiresReference = paymentMethod === 'mpesa' || paymentMethod === 'card' || paymentMethod === 'bank_transfer';
  const isStkFlow = paymentMethod === 'mpesa' && mpesaMode === 'stk';

  const canSubmitDirectCharge =
    amountToCharge > 0 &&
    balanceDue > 0 &&
    (
      paymentMethod !== 'mpesa' ||
      (mpesaMode === 'stk' && mpesaPhone.trim()) ||
      (mpesaMode === 'manual' && mpesaPhone.trim() && mpesaCode.trim())
    ) &&
    (paymentMethod !== 'card' || (cardReference.trim() && cardHolder.trim())) &&
    (paymentMethod !== 'bank_transfer' || bankReference.trim());

  const handleSettlementType = useCallback((type) => {
    setSettlementType(type);
    if (type === 'immediate') {
      setAmountReceived(balanceDue);
      if (paymentMethod === 'cash') {
        setAmountTendered(balanceDue);
      }
    }
  }, [balanceDue, paymentMethod]);

  const handlePaymentMethod = useCallback((method) => {
    setPaymentMethod(method);
    if (method === 'cash') {
      setAmountTendered(amountToCharge);
    }
  }, [amountToCharge]);

  const submit = useCallback(async () => {
    if (isStkFlow) {
      await onInitiateStk?.({
        phone: mpesaPhone.trim(),
        amount: amountToCharge,
      });
      return;
    }

    await onCharge({
      settlement_type: settlementType,
      payment_method: paymentMethod,
      amount_received: amountToCharge,
      amount_tendered: paymentMethod === 'cash' ? effectiveTendered : amountToCharge,
      mpesa_phone: paymentMethod === 'mpesa' ? mpesaPhone || null : null,
      mpesa_code: paymentMethod === 'mpesa' && mpesaMode === 'manual' ? mpesaCode || null : null,
      card_reference: paymentMethod === 'card' ? cardReference || null : null,
      card_holder: paymentMethod === 'card' ? cardHolder || null : null,
      bank_reference: paymentMethod === 'bank_transfer' ? bankReference || null : null,
      notes: notes || null,
    });
  }, [
    isStkFlow,
    onInitiateStk,
    mpesaPhone,
    amountToCharge,
    onCharge,
    settlementType,
    paymentMethod,
    effectiveTendered,
    mpesaMode,
    mpesaCode,
    cardReference,
    cardHolder,
    bankReference,
    notes,
  ]);

  if (!isOpen) return null;

  const submitLabel = isStkFlow
    ? 'Send M-Pesa Request'
    : settlementType === 'partial'
      ? 'Record Partial Payment'
      : 'Settle Full Balance';

  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ width: 'min(780px, 96vw)', borderRadius: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0 }}>GRN Settlement</h3>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              {grn?.grn_number || 'GRN'} · {grn?.supplier?.supplier_name || grn?.supplier_name || 'Supplier'}
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={isBusy}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            <PaymentInfoCard label="Invoice Total" value={currency(invoiceTotal)} />
            <PaymentInfoCard label="Already Paid" value={currency(alreadyPaid)} />
            <PaymentInfoCard label="This Payment" value={currency(amountToCharge)} />
            <PaymentInfoCard label="Balance After Payment" value={currency(remainingBalance)} muted={remainingBalance <= 0} />
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Settlement Type</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <StrategyCard
                active={settlementType === 'partial'}
                title="Partial Payment"
                subtitle="Record only the amount entered below and keep the remaining supplier balance outstanding."
                onClick={() => handleSettlementType('partial')}
                disabled={isBusy}
              />
              <StrategyCard
                active={settlementType === 'immediate'}
                title="Full Payment"
                subtitle="Clear the full remaining GRN balance now using cash, M-Pesa, card, or bank."
                onClick={() => handleSettlementType('immediate')}
                disabled={isBusy}
              />
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Payment Method</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
              <MethodButton active={paymentMethod === 'cash'} icon={Wallet} label="Cash" onClick={() => handlePaymentMethod('cash')} disabled={isBusy} />
              <MethodButton active={paymentMethod === 'mpesa'} icon={Smartphone} label="M-Pesa" onClick={() => handlePaymentMethod('mpesa')} disabled={isBusy} />
              <MethodButton active={paymentMethod === 'card'} icon={CreditCard} label="Card" onClick={() => handlePaymentMethod('card')} disabled={isBusy} />
              <MethodButton active={paymentMethod === 'bank_transfer'} icon={Building2} label="Bank" onClick={() => handlePaymentMethod('bank_transfer')} disabled={isBusy} />
            </div>
          </div>

          {paymentMethod === 'mpesa' ? (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>M-Pesa Flow</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <ModeSwitch active={mpesaMode === 'stk'} label="STK Push" onClick={() => setMpesaMode('stk')} disabled={isBusy} />
                <ModeSwitch active={mpesaMode === 'manual'} label="Enter Code Manually" onClick={() => setMpesaMode('manual')} disabled={isBusy} />
              </div>
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
                {settlementType === 'immediate' ? 'Amount to Settle' : 'Partial Amount Received'}
              </span>
              <input
                className="text-input"
                type="number"
                step="0.01"
                min="0"
                max={balanceDue}
                value={settlementType === 'immediate' ? balanceDue : amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                disabled={settlementType === 'immediate' || isBusy}
              />
              {settlementType === 'partial' ? (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Enter only the amount collected now. Remaining balance will stay on the GRN.
                </span>
              ) : null}
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
                {paymentMethod === 'cash' ? 'Amount Tendered' : 'Processed Amount'}
              </span>
              <input
                className="text-input"
                type="number"
                step="0.01"
                min="0"
                value={paymentMethod === 'cash' ? amountTendered : amountToCharge}
                onChange={(e) => setAmountTendered(e.target.value)}
                disabled={paymentMethod !== 'cash' || isBusy}
              />
            </label>
          </div>

          {paymentMethod === 'cash' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                Change: <strong style={{ color: 'var(--text)' }}>{currency(change)}</strong>
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'right' }}>
                Net payment posted: <strong style={{ color: 'var(--text)' }}>{currency(amountToCharge)}</strong>
              </div>
            </div>
          ) : null}

          {paymentMethod === 'mpesa' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>M-Pesa Phone</span>
                <input className="text-input" value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value)} disabled={isBusy} />
              </label>
              {mpesaMode === 'manual' ? (
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>M-Pesa Code</span>
                  <input className="text-input" value={mpesaCode} onChange={(e) => setMpesaCode(e.target.value)} disabled={isBusy} />
                </label>
              ) : (
                <div style={{ border: '1px dashed var(--line)', borderRadius: 14, padding: 14, fontSize: 13, color: 'var(--muted)' }}>
                  The system will send the exact amount shown in “This Payment” to Safaricom and wait for the callback before marking this payment as cleared.
                </div>
              )}
            </div>
          ) : null}

          {paymentMethod === 'card' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Card Reference</span>
                <input className="text-input" value={cardReference} onChange={(e) => setCardReference(e.target.value)} disabled={isBusy} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Card Holder</span>
                <input className="text-input" value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} disabled={isBusy} />
              </label>
            </div>
          ) : null}

          {paymentMethod === 'bank_transfer' ? (
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Bank Transfer Reference</span>
              <input className="text-input" value={bankReference} onChange={(e) => setBankReference(e.target.value)} disabled={isBusy} />
            </label>
          ) : null}

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
              {requiresReference ? 'Payment Notes / Reference Context' : 'Notes'}
            </span>
            <textarea className="text-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isBusy} />
          </label>

          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
            {settlementType === 'partial'
              ? 'Only the partial amount entered above will be posted. The remaining balance stays visible on the GRN and supplier statement.'
              : 'Full settlement clears the current GRN balance. For M-Pesa STK, the final payment status updates automatically after the provider callback arrives.'}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" className="ghost-button" onClick={onClose} disabled={isBusy}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={submit}
            disabled={isBusy || !canSubmitDirectCharge}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(GrnPaymentModal);
