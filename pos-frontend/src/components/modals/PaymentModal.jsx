// src/components/payments/PaymentModal.jsx
//
// Split-payment checkout modal.
// Key behaviours:
//   • Dynamic multi-row payment allocations.
//   • Live remaining-balance calculator.
//   • Final action stays disabled until remaining balance reaches exactly zero.
//   • If an M-Pesa STK row exists, we first ensure the billing exists, then send
//     the STK request while keeping all other allocations in memory.
//   • If the STK attempt fails/cancels/times out, the cashier's grid remains intact.
//   • If the STK succeeds, the backend finalises the whole split tender set and
//     the parent simply refreshes the billing / prints.

import { useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  Gift,
  Plus,
  Smartphone,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import MpesaStkModal from './MpesaStkModal';
import { mpesaService } from '../../services/mpesaService';

const EPSILON = 0.009;
const PAYMENT_METHODS = [
  { key: 'cash', title: 'Cash', icon: Wallet, tone: 'cash' },
  { key: 'mpesa', title: 'M-Pesa', icon: Smartphone, tone: 'mpesa' },
  { key: 'card', title: 'Card', icon: CreditCard, tone: 'card' },
];

const toNum = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const buildAllocationRow = (overrides = {}) => ({
  id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  paymentMethod: 'cash',
  amount: '',
  amountTendered: '',
  mpesaPhone: '',
  mpesaCode: '',
  mpesaMode: 'stk',
  cardReference: '',
  cardHolder: '',
  ...overrides,
});

export default function PaymentModal({
  isOpen,
  billing,
  currentStore,
  itemCount,
  selectedCustomer,
  customerCurrentBalance,
  submitting,
  currency,
  onClose,
  onCharge,
  onEnsureBilling,
  loyaltyPoints = 0,
  loyaltyPointValue = 1,
  pointsToRedeem = 0,
  setPointsToRedeem,
  chapa5Preview = null,
  onClaimChapa5Reward,
  loyaltyMinPoints = 0,
  isBalanceSettlement = false,
  isPreparingPayment = false,
}) {
  const [paymentRows, setPaymentRows] = useState([]);
  const [paymentError, setPaymentError] = useState('');
  const [loyaltyError, setLoyaltyError] = useState('');
  const [receiptPreview, setReceiptPreview] = useState(false);

  const [stkPushing, setStkPushing] = useState(false);
  const [stkModal, setStkModal] = useState(null);

  const invoiceSubtotal = Number(billing?.subtotal || 0);
  const invoiceTax = Number(billing?.vat_amount || 0);
  const invoiceAmount = Number(billing?.total || 0);

  const activeBalance = Number(
    billing?.customer?.current_balance ??
      selectedCustomer?.current_balance ??
      customerCurrentBalance ??
      0
  );

  const loyaltyDiscount = Math.max(
    0,
    Math.min(invoiceAmount, Number(pointsToRedeem || 0) * Number(loyaltyPointValue || 0))
  );

  const discountedInvoiceAmount = Math.max(invoiceAmount - loyaltyDiscount, 0);
  const isFullyCoveredByPoints = discountedInvoiceAmount <= 0 && pointsToRedeem > 0;

  const combinedPayable = isBalanceSettlement
    ? Number(billing?.balance_due || 0)
    : discountedInvoiceAmount + activeBalance;

  const effectiveAmountToBePaid = isFullyCoveredByPoints ? 0 : round2(combinedPayable);

  const loyaltyDiscountLabel = useMemo(
    () => currency(loyaltyDiscount, currentStore?.currency),
    [currency, currentStore?.currency, loyaltyDiscount]
  );

  const canClaimFreeReward =
    !!chapa5Preview?.qualifies && Number(chapa5Preview?.claimable_free_items || 0) > 0;

  useEffect(() => {
    if (!isOpen) return;

    const initialAmount = effectiveAmountToBePaid > 0 ? String(effectiveAmountToBePaid.toFixed(2)) : '';
    setPaymentRows([
      buildAllocationRow({
        paymentMethod: 'cash',
        amount: initialAmount,
        amountTendered: initialAmount,
      }),
    ]);
    setPaymentError('');
    setLoyaltyError('');
    setReceiptPreview(false);
    setStkPushing(false);
    setStkModal(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setPaymentError('');
  }, [isOpen, billing?.items?.length, billing?.total, pointsToRedeem]);

  if (!isOpen) return null;

  const totalAllocated = round2(
    paymentRows.reduce((sum, row) => sum + Math.max(toNum(row.amount), 0), 0)
  );
  const remainingBalance = round2(effectiveAmountToBePaid - totalAllocated);
  const remainingIsZero = Math.abs(remainingBalance) <= EPSILON;

  const hasAsyncStkRow = paymentRows.some(
    (row) => row.paymentMethod === 'mpesa' && row.mpesaMode === 'stk' && toNum(row.amount) > 0
  );

  const totalCashChange = round2(
    paymentRows.reduce((sum, row) => {
      if (row.paymentMethod !== 'cash') return sum;
      const amount = Math.max(toNum(row.amount), 0);
      const tendered = Math.max(toNum(row.amountTendered || row.amount), 0);
      return sum + Math.max(tendered - amount, 0);
    }, 0)
  );

  const withUpdatedRows = (updater) => {
    setPaymentRows((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return Array.isArray(next) ? next : prev;
    });
  };

  const updateRow = (rowId, patch) => {
    withUpdatedRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const next = { ...row, ...patch };
        if (patch.paymentMethod && patch.paymentMethod !== row.paymentMethod) {
          if (patch.paymentMethod === 'cash') {
            next.amountTendered = next.amount || '';
          }
          if (patch.paymentMethod !== 'mpesa') {
            next.mpesaPhone = '';
            next.mpesaCode = '';
            next.mpesaMode = 'stk';
          }
          if (patch.paymentMethod !== 'card') {
            next.cardReference = '';
            next.cardHolder = '';
          }
        }
        return next;
      })
    );
    setPaymentError('');
  };

  const addPaymentRow = () => {
    const nextRemaining = round2(Math.max(remainingBalance, 0));
    withUpdatedRows((prev) => [
      ...prev,
      buildAllocationRow({
        amount: nextRemaining > 0 ? String(nextRemaining.toFixed(2)) : '',
        amountTendered: nextRemaining > 0 ? String(nextRemaining.toFixed(2)) : '',
      }),
    ]);
  };

  const removePaymentRow = (rowId) => {
    withUpdatedRows((prev) => {
      if (prev.length <= 1) {
        return [buildAllocationRow({ amount: '', amountTendered: '' })];
      }
      return prev.filter((row) => row.id !== rowId);
    });
    setPaymentError('');
  };

  const fillRowWithRemaining = (rowId) => {
    const otherTotal = round2(
      paymentRows.reduce((sum, row) => {
        if (row.id === rowId) return sum;
        return sum + Math.max(toNum(row.amount), 0);
      }, 0)
    );
    const nextAmount = round2(Math.max(effectiveAmountToBePaid - otherTotal, 0));
    updateRow(rowId, {
      amount: nextAmount > 0 ? String(nextAmount.toFixed(2)) : '',
      amountTendered: nextAmount > 0 ? String(nextAmount.toFixed(2)) : '',
    });
  };

  const handleRedeem = () => {
    const minPoints = Number(loyaltyMinPoints ?? 0);
    if (loyaltyPoints < minPoints) {
      setLoyaltyError(`Minimum redemption is ${minPoints.toFixed(2)} points.`);
      return;
    }

    const maxPoints = Math.min(
      Number(loyaltyPoints || 0),
      Math.floor(invoiceAmount / Number(loyaltyPointValue || 1))
    );

    setLoyaltyError('');
    setPointsToRedeem(maxPoints);
  };

  const clearRedeem = () => {
    setPointsToRedeem(0);
    setLoyaltyError('');
  };

  const serialiseAllocations = () =>
    paymentRows
      .map((row) => {
        const amount = round2(Math.max(toNum(row.amount), 0));
        const tendered =
          row.paymentMethod === 'cash'
            ? round2(Math.max(toNum(row.amountTendered || row.amount), 0))
            : amount;

        return {
          payment_method: row.paymentMethod,
          amount_received: amount,
          amount_tendered: tendered,
          mpesa_phone: row.paymentMethod === 'mpesa' ? row.mpesaPhone.trim() || null : null,
          mpesa_code:
            row.paymentMethod === 'mpesa' && row.mpesaMode === 'manual'
              ? row.mpesaCode.trim().toUpperCase() || null
              : null,
          mpesa_mode: row.paymentMethod === 'mpesa' ? row.mpesaMode : null,
          card_reference: row.paymentMethod === 'card' ? row.cardReference.trim() || null : null,
          card_holder: row.paymentMethod === 'card' ? row.cardHolder.trim() || null : null,
        };
      })
      .filter((row) => row.amount_received > 0);

  const validateAllocations = () => {
    if (isFullyCoveredByPoints) return true;

    if (!paymentRows.length) {
      setPaymentError('Add at least one payment row.');
      return false;
    }

    const allocations = serialiseAllocations();
    if (!allocations.length) {
      setPaymentError('Enter at least one payment amount.');
      return false;
    }

    if (!remainingIsZero) {
      setPaymentError(
        remainingBalance > 0
          ? 'Allocate the full balance before processing the sale.'
          : 'Allocated payments exceed the balance due. Reduce one or more rows.'
      );
      return false;
    }

    const stkRows = allocations.filter(
      (row) => row.payment_method === 'mpesa' && row.mpesa_mode === 'stk'
    );
    if (stkRows.length > 1) {
      setPaymentError('Only one live M-Pesa STK row can be processed at a time.');
      return false;
    }

    for (const row of allocations) {
      if (row.amount_received <= 0) {
        setPaymentError('Every payment row must have an amount greater than zero.');
        return false;
      }

      if (row.payment_method === 'cash' && row.amount_tendered < row.amount_received) {
        setPaymentError('Cash tendered cannot be less than the allocated cash amount.');
        return false;
      }

      if (row.payment_method === 'mpesa') {
        if (!row.mpesa_phone) {
          setPaymentError('Every M-Pesa row requires a phone number.');
          return false;
        }
        if (row.mpesa_mode === 'manual' && !row.mpesa_code) {
          setPaymentError('Enter the M-Pesa transaction code for manual M-Pesa rows.');
          return false;
        }
      }

      if (row.payment_method === 'card' && !row.card_reference) {
        setPaymentError('Every card row requires a card reference.');
        return false;
      }
    }

    return true;
  };

  const triggerStkPush = async () => {
    if (stkPushing || stkModal) return;
    setPaymentError('');

    if (!validateAllocations()) return;

    const allocations = serialiseAllocations();
    const stkAllocation = allocations.find(
      (row) => row.payment_method === 'mpesa' && row.mpesa_mode === 'stk'
    );

    if (!stkAllocation) {
      setPaymentError('No STK row was found to process.');
      return;
    }

    try {
      setStkPushing(true);

      let targetBillingId = billing?.billing_id;
      if (!targetBillingId) {
        if (typeof onEnsureBilling !== 'function') {
          setPaymentError('Unable to create a pending bill for this sale.');
          return;
        }

        const ensured = await onEnsureBilling();
        targetBillingId = ensured?.billing_id;
        if (!targetBillingId) {
          setPaymentError('Could not create a pending bill. Please try again.');
          return;
        }
      }

      const res = await mpesaService.initiateStkPush({
        billing_id: targetBillingId,
        phone: stkAllocation.mpesa_phone,
        amount: stkAllocation.amount_received,
        split_allocations: allocations,
        points_redeemed: Number(pointsToRedeem || 0),
      });

      const data = res?.data || {};
      if (!data.checkout_request_id) {
        setPaymentError(res?.message || 'M-Pesa request could not be initiated.');
        return;
      }

      setStkModal({
        checkoutRequestId: data.checkout_request_id,
        phone: data.phone_number || stkAllocation.mpesa_phone,
        amount: data.amount || stkAllocation.amount_received,
        pollingIntervalMs: data.polling?.interval_ms || 3000,
        pollingTimeoutMs: data.polling?.timeout_ms || 60000,
      });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'M-Pesa request failed.';
      setPaymentError(message);
    } finally {
      setStkPushing(false);
    }
  };

  const handleMpesaStkSuccess = async (payload) => {
    setStkModal(null);
    try {
      await onCharge({
        alreadyRecorded: true,
        paymentId: payload.payment_id,
        paymentMethod: 'mpesa',
        amountReceived: Number(payload.amount || 0),
        amountTendered: Number(payload.amount || 0),
        mpesaPhone: payload.phone_number || '',
        mpesaCode: payload.mpesa_receipt || '',
        pointsToRedeem: Number(pointsToRedeem || 0),
        receiptPreview,
      });
    } catch (err) {
      setPaymentError(err?.message || 'Sale saved but receipt refresh failed.');
    }
  };

  const handleMpesaStkFailure = (message) => {
    setStkModal(null);
    setPaymentError(message || 'M-Pesa payment failed. Please try again.');
  };

  const handleProcessSale = async () => {
    if (submitting || stkPushing || stkModal) return;
    setPaymentError('');

    if (isFullyCoveredByPoints) {
      try {
        await onCharge({
          paymentMethod: 'cash',
          amountReceived: 0,
          amountTendered: 0,
          mpesaPhone: null,
          mpesaCode: null,
          cardReference: null,
          cardHolder: null,
          pointsToRedeem: Number(pointsToRedeem || 0),
          receiptPreview,
        });
      } catch (err) {
        setPaymentError(err?.message || 'Unable to process payment.');
      }
      return;
    }

    if (!validateAllocations()) return;

    if (hasAsyncStkRow) {
      await triggerStkPush();
      return;
    }

    try {
      await onCharge({
        paymentAllocations: serialiseAllocations(),
        pointsToRedeem: Number(pointsToRedeem || 0),
        receiptPreview,
      });
    } catch (err) {
      setPaymentError(err?.message || 'Unable to process payment.');
    }
  };

  const processButtonDisabled =
    submitting ||
    stkPushing ||
    !!stkModal ||
    isPreparingPayment ||
    billing?.status === 'paid' ||
    (!billing?.items?.length && !isBalanceSettlement && activeBalance <= 0) ||
    (!isFullyCoveredByPoints && !remainingIsZero);

  return (
    <>
      <div className="modal-backdrop" onClick={() => !submitting && !stkModal && onClose()}>
        <div
          className="modal-card payment-modal-card payment-modal-card--wide"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal-header payment-modal-header">
            <div>
              <h3>Split Payment</h3>
            </div>
            <button
              type="button"
              className="icon-button payment-modal-close"
              onClick={onClose}
              disabled={submitting || stkPushing || !!stkModal}
            >
              <X size={18} />
            </button>
          </div>

          <div className="modal-content payment-modal-content payment-modal-layout">
            <div className="payment-modal-pane payment-modal-pane--left">
              <div className="payment-panel-title-row">
                <h4>Transaction Context</h4>
              </div>

              <div className="payment-panel-card">
                <div className="payment-context-summary">
                  <div className="payment-context-box-title">Detailed Summary</div>

                  <div className="payment-kv-list">
                    <div className="payment-kv-row">
                      <span>SUBTOTAL</span>
                      <strong>{currency(invoiceSubtotal, currentStore?.currency)}</strong>
                    </div>
                    <div className="payment-kv-row">
                      <span>DISCOUNTS (Rewards)</span>
                      <strong className={loyaltyDiscount > 0 ? 'is-discount' : ''}>
                        {loyaltyDiscount > 0
                          ? `-${loyaltyDiscountLabel}`
                          : currency(0, currentStore?.currency)}
                      </strong>
                    </div>
                    <div className="payment-kv-row">
                      <span>TAX ({Number(billing?.vat_rate || 16)}%)</span>
                      <strong>{currency(invoiceTax, currentStore?.currency)}</strong>
                    </div>
                    {!isBalanceSettlement && activeBalance > 0 ? (
                      <div className="payment-kv-row">
                        <span>PREVIOUS BALANCE</span>
                        <strong>{currency(activeBalance, currentStore?.currency)}</strong>
                      </div>
                    ) : null}
                  </div>

                  <div className="payment-summary-divider" />
                  <div className="payment-kv-row payment-kv-row--net">
                    <span>NET TOTAL</span>
                    <strong>{currency(combinedPayable, currentStore?.currency)}</strong>
                  </div>
                  <div className="payment-summary-divider payment-summary-divider--soft" />
                  <div className="payment-kv-row">
                    <span>TOTAL ITEMS</span>
                    <strong>{itemCount}</strong>
                  </div>
                  <div className="payment-switch-row">
                    <span>RECEIPT PREVIEW</span>
                    <button
                      type="button"
                      className={`payment-switch ${receiptPreview ? 'is-active' : ''}`}
                      onClick={() => setReceiptPreview((prev) => !prev)}
                      aria-pressed={receiptPreview}
                    >
                      <span className="payment-switch-thumb" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="payment-panel-title-row payment-panel-title-row--split">
                <h4>Customer &amp; Loyalty</h4>
                <span className="muted small">(if applicable)</span>
              </div>

              <div className="payment-panel-card">
                {selectedCustomer ? (
                  <div className="payment-customer-card">
                    <div className="payment-customer-header">
                      <strong>Customer: {selectedCustomer?.full_name || 'Selected customer'}</strong>
                    </div>
                    <div className="payment-summary-divider payment-summary-divider--soft" />
                    <div className="payment-loyalty-block">
                      <div className="payment-loyalty-copy">
                        <span className="payment-loyalty-label">Loyalty Details</span>
                        <strong className="payment-loyalty-points">
                          {Number(loyaltyPoints || 0)} pts
                        </strong>
                      </div>
                      {pointsToRedeem > 0 ? <span className="badge success">Reward claimed</span> : null}
                    </div>
                    <div className="payment-loyalty-actions">
                      {loyaltyPoints > 0 ? (
                        <button type="button" className="primary-button" onClick={handleRedeem}>
                          Redeem ({currency(Math.max(loyaltyPointValue, 0), currentStore?.currency)} reward)
                        </button>
                      ) : (
                        <button type="button" className="primary-button" disabled>
                          Redeem
                        </button>
                      )}
                      <button
                        type="button"
                        className="ghost-button danger"
                        onClick={clearRedeem}
                        disabled={pointsToRedeem <= 0}
                      >
                        Cancel
                      </button>
                    </div>
                    <button type="button" className="payment-benefits-link">
                      View Benefits
                    </button>
                    {pointsToRedeem > 0 ? (
                      <div className="payment-loyalty-applied">
                        Applied reward discount: <strong>{loyaltyDiscountLabel}</strong>
                      </div>
                    ) : null}
                    {loyaltyError ? <div className="payment-inline-error">{loyaltyError}</div> : null}
                  </div>
                ) : (
                  <div className="payment-empty-mini">
                    No customer selected. Add a customer to use loyalty rewards.
                  </div>
                )}
              </div>

              {chapa5Preview?.qualifies ? (
                <div className="payment-panel-card payment-panel-card--reward">
                  <div className="payment-reward-banner">
                    <div className="payment-reward-copy">
                      <strong>
                        <Gift size={16} /> Reward ready
                      </strong>
                      <span>
                        {chapa5Preview.free_items} free item(s) available from this checkout.
                      </span>
                    </div>
                    {canClaimFreeReward ? (
                      <button
                        type="button"
                        className="primary-button"
                        onClick={onClaimChapa5Reward}
                        disabled={submitting}
                      >
                        Claim reward
                      </button>
                    ) : (
                      <span className="badge success">Added to cart</span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="payment-modal-pane payment-modal-pane--right">
              <div className="payment-panel-title-row payment-panel-title-row--split">
                <h4>Payment Allocation</h4>
                {!isFullyCoveredByPoints ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={addPaymentRow}
                    disabled={submitting || stkPushing || !!stkModal}
                  >
                    <Plus size={16} /> Add row
                  </button>
                ) : null}
              </div>

              <div className="payment-panel-card" style={{ display: 'grid', gap: 12 }}>
                <div className="payment-kv-list">
                  <div className="payment-kv-row payment-kv-row--net">
                    <span>ALLOCATED</span>
                    <strong>{currency(totalAllocated, currentStore?.currency)}</strong>
                  </div>
                  <div className="payment-kv-row">
                    <span>REMAINING</span>
                    <strong className={remainingBalance < 0 ? 'danger-text' : remainingIsZero ? 'success-text' : ''}>
                      {currency(Math.abs(remainingBalance), currentStore?.currency)}
                      {remainingBalance < 0 ? ' over' : remainingIsZero ? ' balanced' : ''}
                    </strong>
                  </div>
                  {totalCashChange > 0 ? (
                    <div className="payment-kv-row">
                      <span>CASH CHANGE</span>
                      <strong>{currency(totalCashChange, currentStore?.currency)}</strong>
                    </div>
                  ) : null}
                </div>

                {isFullyCoveredByPoints ? (
                  <div className="payment-covered-banner">
                    ✓ Fully covered by loyalty points — no cash required. Click Process Sale to confirm.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {paymentRows.map((row, index) => {
                      const methodMeta = PAYMENT_METHODS.find((item) => item.key === row.paymentMethod) || PAYMENT_METHODS[0];
                      const Icon = methodMeta.icon;
                      const rowAmount = round2(Math.max(toNum(row.amount), 0));
                      const rowChange =
                        row.paymentMethod === 'cash'
                          ? round2(Math.max(toNum(row.amountTendered || row.amount) - rowAmount, 0))
                          : 0;

                      return (
                        <div
                          key={row.id}
                          className="payment-entry-card"
                          style={{
                            border: '1px solid var(--line)',
                            borderRadius: 16,
                            padding: 14,
                            display: 'grid',
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 12,
                              flexWrap: 'wrap',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span className={`payment-method-tab-icon payment-method-tab-icon--${methodMeta.tone}`}>
                                <Icon size={16} />
                              </span>
                              <strong>Row {index + 1}</strong>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => fillRowWithRemaining(row.id)}
                                disabled={submitting || stkPushing || !!stkModal}
                              >
                                Fill remaining
                              </button>
                              <button
                                type="button"
                                className="ghost-button danger"
                                onClick={() => removePaymentRow(row.id)}
                                disabled={paymentRows.length === 1 || submitting || stkPushing || !!stkModal}
                              >
                                <Trash2 size={14} /> Remove
                              </button>
                            </div>
                          </div>

                          <div className="payment-method-form">
                            <label className="payment-field">
                              <span>Method</span>
                              <select
                                className="text-input"
                                value={row.paymentMethod}
                                onChange={(event) =>
                                  updateRow(row.id, { paymentMethod: event.target.value })
                                }
                              >
                                {PAYMENT_METHODS.map((method) => (
                                  <option key={method.key} value={method.key}>
                                    {method.title}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="payment-field">
                              <span>Allocated amount</span>
                              <input
                                className="text-input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.amount}
                                onChange={(event) =>
                                  updateRow(row.id, { amount: event.target.value })
                                }
                                placeholder="0.00"
                              />
                            </label>

                            {row.paymentMethod === 'cash' ? (
                              <>
                                <label className="payment-field">
                                  <span>Cash tendered</span>
                                  <input
                                    className="text-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={row.amountTendered}
                                    onChange={(event) =>
                                      updateRow(row.id, { amountTendered: event.target.value })
                                    }
                                    placeholder="0.00"
                                  />
                                </label>
                                <div className="payment-field">
                                  <span>Change</span>
                                  <div className="payment-change-box" style={{ marginTop: 6 }}>
                                    <span>Cash row change:</span>
                                    <strong>{currency(rowChange, currentStore?.currency)}</strong>
                                  </div>
                                </div>
                              </>
                            ) : null}

                            {row.paymentMethod === 'mpesa' ? (
                              <>
                                <div className="payment-field payment-field--full mpesa-mode-toggle">
                                  <button
                                    type="button"
                                    className={`mpesa-mode-toggle-btn ${
                                      row.mpesaMode === 'stk' ? 'primary-button' : 'ghost-button'
                                    }`}
                                    onClick={() => updateRow(row.id, { mpesaMode: 'stk', mpesaCode: '' })}
                                  >
                                    STK Push (auto)
                                  </button>
                                  <button
                                    type="button"
                                    className={`mpesa-mode-toggle-btn ${
                                      row.mpesaMode === 'manual' ? 'primary-button' : 'ghost-button'
                                    }`}
                                    onClick={() => updateRow(row.id, { mpesaMode: 'manual' })}
                                  >
                                    Enter code manually
                                  </button>
                                </div>

                                <label className="payment-field payment-field--full">
                                  <span>M-Pesa phone number</span>
                                  <input
                                    className="text-input"
                                    type="tel"
                                    value={row.mpesaPhone}
                                    onChange={(event) =>
                                      updateRow(row.id, { mpesaPhone: event.target.value })
                                    }
                                    placeholder="e.g. 07XXXXXXXX or 2547XXXXXXXX"
                                  />
                                </label>

                                {row.mpesaMode === 'manual' ? (
                                  <label className="payment-field payment-field--full">
                                    <span>M-Pesa transaction code</span>
                                    <input
                                      className="text-input"
                                      type="text"
                                      value={row.mpesaCode}
                                      onChange={(event) =>
                                        updateRow(row.id, {
                                          mpesaCode: event.target.value.toUpperCase(),
                                        })
                                      }
                                      placeholder="e.g. QGH7X8Y2K1"
                                      maxLength={12}
                                    />
                                  </label>
                                ) : (
                                  <div className="payment-empty-mini">
                                    This row will stay pending until the customer confirms the STK prompt.
                                  </div>
                                )}
                              </>
                            ) : null}

                            {row.paymentMethod === 'card' ? (
                              <>
                                <label className="payment-field">
                                  <span>Card holder</span>
                                  <input
                                    className="text-input"
                                    type="text"
                                    value={row.cardHolder}
                                    onChange={(event) =>
                                      updateRow(row.id, { cardHolder: event.target.value })
                                    }
                                    placeholder="Card holder name"
                                  />
                                </label>
                                <label className="payment-field">
                                  <span>Card reference</span>
                                  <input
                                    className="text-input"
                                    type="text"
                                    value={row.cardReference}
                                    onChange={(event) =>
                                      updateRow(row.id, { cardReference: event.target.value })
                                    }
                                    placeholder="POS slip or card reference"
                                  />
                                </label>
                              </>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {paymentError ? <div className="form-error payment-form-error">{paymentError}</div> : null}

              <div className="payment-modal-actions payment-modal-actions--bottom">
                <button
                  type="button"
                  className="primary-button payment-submit-btn"
                  onClick={handleProcessSale}
                  disabled={processButtonDisabled}
                >
                  {billing?.status === 'paid'
                    ? 'Already paid'
                    : stkPushing
                      ? 'Sending STK…'
                      : stkModal
                        ? 'Waiting for M-Pesa…'
                        : submitting
                          ? 'Processing…'
                          : hasAsyncStkRow
                            ? 'Process Sale'
                            : 'Process Sale'}
                </button>
                <button
                  type="button"
                  className="ghost-button payment-cancel-btn"
                  onClick={onClose}
                  disabled={submitting || stkPushing || !!stkModal}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <MpesaStkModal
        isOpen={!!stkModal}
        checkoutRequestId={stkModal?.checkoutRequestId}
        phone={stkModal?.phone}
        amount={stkModal?.amount}
        pollingIntervalMs={stkModal?.pollingIntervalMs}
        pollingTimeoutMs={stkModal?.pollingTimeoutMs}
        currency={currency}
        storeCurrency={currentStore?.currency}
        onSuccess={handleMpesaStkSuccess}
        onFailure={handleMpesaStkFailure}
        onClose={() => setStkModal(null)}
      />
    </>
  );
}
