<?php

namespace App\Services;

use App\Models\Billing;
use App\Models\Inventory;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class BillingService
{
    public function __construct(
        private readonly DocumentNumberService $documentNumberService,
        private readonly AuditLogService $auditLogService
    ) {
    }

    private function allowedStoreIds(User $user)
    {
        return $user->stores()
            ->pluck('stores.store_id')
            ->push($user->default_store_id)
            ->filter()
            ->unique()
            ->values();
    }

    private function scopeAccessible(Builder $query, User $user): Builder
    {
        if ($user->isAdmin() || $user->isManager()) {
            return $query;
        }

        $storeIds = $this->allowedStoreIds($user);

        return $query
            ->whereIn('store_id', $storeIds)
            ->where('user_id', $user->user_id);
    }

    private function authorizeBillingAccess(Billing $billing, ?User $actor = null): void
    {
        $actor = $actor ?: auth()->user();

        if (!$actor) {
            abort(response()->json([
                'message' => 'Unauthenticated.',
            ], 401));
        }

        if ($actor->isAdmin() || $actor->isManager()) {
            return;
        }

        $storeIds = $this->allowedStoreIds($actor)->map(fn ($id) => (string) $id)->all();

        $hasStoreAccess = in_array((string) $billing->store_id, $storeIds, true);
        $ownsBilling = (string) $billing->user_id === (string) $actor->user_id;

        if (!$hasStoreAccess || !$ownsBilling) {
            abort(response()->json([
                'message' => 'You are not allowed to access this billing.',
            ], 403));
        }
    }

    public function paginate(User $user, array $filters = []): LengthAwarePaginator
    {
        $perPage = (int) ($filters['per_page'] ?? 15);

        $query = Billing::query()
            ->with(['customer', 'store', 'user', 'payments'])
            ->withCount('items')
            ->orderByDesc('billing_id');

        $query = $this->scopeAccessible($query, $user);

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (array_key_exists('is_draft', $filters)) {
            $query->where('is_draft', filter_var($filters['is_draft'], FILTER_VALIDATE_BOOLEAN));
        }

        return $query->paginate($perPage);
    }

    public function createDraft(User $user, array $data): Billing
    {
        if (!$user->isAdmin() && !$user->isManager()) {
            $allowedStoreIds = $this->allowedStoreIds($user)->map(fn ($id) => (string) $id)->all();

            if (!in_array((string) $data['store_id'], $allowedStoreIds, true)) {
                abort(response()->json([
                    'message' => 'You cannot create a draft for this store.',
                ], 403));
            }
        }

        $billing = Billing::create([
            'store_id' => $data['store_id'],
            'customer_id' => $data['customer_id'] ?? null,
            'user_id' => $user->user_id,
            'invnumber' => null,
            'status' => 'draft',
            'subtotal' => 0,
            'vat_amount' => 0,
            'total' => 0,
            'paid_amount' => 0,
            'balance_due' => 0,
            'is_draft' => true,
            'billing_date' => now(),
            'notes' => $data['notes'] ?? null,
        ]);

        $this->auditLogService->log(
            'billing.create_draft',
            $billing,
            null,
            $billing->toArray(),
            ['message' => 'Draft billing created'],
            $billing->store_id
        );

        return $billing->load(['customer', 'store', 'items']);
    }

    public function show(Billing $billing): Billing
    {
        $this->authorizeBillingAccess($billing);

        $billing->load(['customer', 'store', 'user', 'items.product.category', 'payments']);

        $this->auditLogService->log(
            'billing.view',
            $billing,
            null,
            null,
            ['message' => 'Billing accessed'],
            $billing->store_id
        );

        return $billing;
    }

    public function updateHeader(Billing $billing, array $data): Billing
    {
        $this->authorizeBillingAccess($billing);

        $old = $billing->toArray();

        $billing->update([
            'customer_id' => array_key_exists('customer_id', $data)
                ? $data['customer_id']
                : $billing->customer_id,
            'notes' => array_key_exists('notes', $data)
                ? $data['notes']
                : $billing->notes,
        ]);

        $this->auditLogService->log(
            'billing.update',
            $billing,
            $old,
            $billing->fresh()->toArray(),
            ['message' => 'Billing header updated'],
            $billing->store_id
        );

        return $billing->fresh()->load(['customer', 'store', 'items.product']);
    }

    public function recalculateTotals(Billing $billing): Billing
    {
        $billing->load('items');
        $subtotal = $billing->items->sum('line_subtotal');
        $vatAmount = $billing->items->sum('vat_amount');
        $total = $subtotal + $vatAmount;

        $paidAmount = $billing->payments()->sum('amount_received');
        $balanceDue = max($total - $paidAmount, 0);

        $billing->update([
            'subtotal' => $subtotal,
            'vat_amount' => $vatAmount,
            'total' => $total,
            'paid_amount' => $paidAmount,
            'balance_due' => $balanceDue,
        ]);

        return $billing->fresh(['items.product', 'payments']);
    }


    public function finalizeIfNeeded(Billing $billing, User $user): Billing
    {
        $this->authorizeBillingAccess($billing, $user);

        return DB::transaction(function () use ($billing, $user) {
            if ($billing->stock_applied_at) {
                return $billing->fresh();
            }

            $billing->load('items.product');

            foreach ($billing->items as $item) {
                $inventory = Inventory::query()
                    ->where('store_id', $billing->store_id)
                    ->where('product_id', $item->product_id)
                    ->lockForUpdate()
                    ->first();

                if (!$inventory || $inventory->quantity < $item->quantity) {
                    abort(response()->json([
                        'message' => "Insufficient stock for {$item->product->product_name}.",
                    ], 422));
                }
                $inventory->decrement('quantity', $item->quantity);
                StockMovement::create([
                    'product_id' => $item->product_id,
                    'store_id' => $billing->store_id,
                    'quantity' => -1 * $item->quantity,
                    'type' => 'sale',
                    'reason' => 'Billing finalized',
                    'user_id' => $user->user_id,
                ]);
            }
            $billing->update([
                'is_draft' => false,
                'status' => 'unpaid',
                'invnumber' => $billing->invnumber ?: $this->documentNumberService->nextNumber(
                    $billing->store_id,
                    'Invoice'
                ),
                'stock_applied_at' => now(),
            ]);

            $this->auditLogService->log(
                'billing.finalize',
                $billing,
                null,
                $billing->fresh()->toArray(),
                ['message' => 'Draft converted to live billing'],
                $billing->store_id
            );

            return $billing->fresh()->load(['items.product', 'payments']);
        });
    }

    public function destroy(Billing $billing): void
    {
        $this->authorizeBillingAccess($billing);

        if (!$billing->is_draft) {
            abort(response()->json([
                'message' => 'Only draft billings can be deleted from cashier POS.',
            ], 422));
        }

        if ($billing->payments()->exists()) {
            abort(response()->json([
                'message' => 'Cannot delete billing with payments.',
            ], 422));
        }

        $old = $billing->load('items')->toArray();

        $billing->items()->delete();
        $billing->delete();

        $this->auditLogService->log(
            'billing.delete',
            null,
            $old,
            null,
            ['message' => 'Billing deleted'],
            $old['store_id'] ?? null
        );
    }
}
