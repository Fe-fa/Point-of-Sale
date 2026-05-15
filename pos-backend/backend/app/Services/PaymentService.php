<?php

namespace App\Services;

use App\Models\Billing;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class PaymentService
{
    public function __construct(
        private readonly BillingService $billingService,
        private readonly DocumentNumberService $documentNumberService,
        private readonly AuditLogService $auditLogService
    ) {
    }

    public function charge(Billing $billing, User $user, array $data): Payment
    {
        return DB::transaction(function () use ($billing, $user, $data) {
            $billing = $this->billingService->finalizeIfNeeded($billing, $user);
            $billing = $this->billingService->recalculateTotals($billing);

            $method = $data['payment_method'];
            $amountReceived = (float)$data['amount_received'];
            $amountTendered = (float)($data['amount_tendered'] ?? $amountReceived);

            $balanceBefore = (float)$billing->balance_due;
            $changeReturned = 0;

            if ($method === 'cash') {
                if ($amountTendered < $amountReceived) {
                    abort(response()->json([
                        'message' => 'Cash tendered cannot be less than amount received.',
                    ], 422));
                }

                $changeReturned = max($amountTendered - $amountReceived, 0);
            }

            $payment = Payment::create([
                'billing_id' => $billing->billing_id,
                'receiptnumber' => $this->documentNumberService->nextNumber($billing->store_id, 'Receipt'),
                'payment_method' => $method,
                'amount_received' => $amountReceived,
                'amount_tendered' => $amountTendered,
                'change_returned' => $changeReturned,
                'balance_before' => $balanceBefore,
                'balance_after' => max($balanceBefore - $amountReceived, 0),
                'payment_date' => now(),
            ]);

            $paid = (float)$billing->payments()->sum('amount_received');
            $balance = max((float)$billing->total - $paid, 0);

            $billing->update([
                'paid_amount' => $paid,
                'balance_due' => $balance,
                'status' => $balance <= 0 ? 'paid' : 'partial',
                'is_draft' => false,
            ]);

            $this->auditLogService->log(
                'payment.create',
                $payment,
                null,
                $payment->toArray(),
                ['billing_uuid' => $billing->uuid],
                $billing->store_id
            );

            return $payment->fresh()->load('billing.customer');
        });
    }
}
