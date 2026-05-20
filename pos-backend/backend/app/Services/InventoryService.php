<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\InventoryHistory;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class InventoryService
{
    public function paginate(User $user, array $filters = []): LengthAwarePaginator
    {
        $perPage = (int)($filters['per_page'] ?? 15);

        $query = Inventory::query()
            ->with(['store', 'product.category'])
            ->orderByDesc('inventory_id');

        if (!$user->isAdmin() && !$user->can('stores.manage')) {
            $storeIds = $user->stores()->pluck('stores.store_id')
                ->push($user->default_store_id)
                ->filter()
                ->unique();

            $query->whereIn('store_id', $storeIds);
        }

        if (!empty($filters['store_id'])) {
            $query->where('store_id', $filters['store_id']);
        }

        if (!empty($filters['search'])) {
            $search = trim($filters['search']);
            $query->where(function ($q) use ($search) {
                $q->whereHas('product', function ($pq) use ($search) {
                    $pq->where('product_name', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%");
                })->orWhere('batch_no', 'like', "%{$search}%");
            });
        }

        return $query->paginate($perPage);
    }

    public function paginateHistory(User $user, array $filters = []): LengthAwarePaginator
    {
        $perPage = (int)($filters['per_page'] ?? 25);

        $query = InventoryHistory::query()
            ->with(['store', 'product', 'user'])
            ->orderByDesc('inventory_history_id');

        if (!$user->isAdmin() && !$user->can('stores.manage')) {
            $storeIds = $user->stores()->pluck('stores.store_id')
                ->push($user->default_store_id)
                ->filter()
                ->unique();

            $query->whereIn('store_id', $storeIds);
        }

        if (!empty($filters['store_id'])) {
            $query->where('store_id', $filters['store_id']);
        }

        if (!empty($filters['product_id'])) {
            $query->where('product_id', $filters['product_id']);
        }

        if (!empty($filters['change_type'])) {
            $query->where('change_type', $filters['change_type']);
        }

        if (!empty($filters['search'])) {
            $search = trim($filters['search']);
            $query->where(function ($q) use ($search) {
                $q->whereHas('product', function ($pq) use ($search) {
                    $pq->where('product_name', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%");
                })
                    ->orWhere('batch_no', 'like', "%{$search}%")
                    ->orWhere('reference', 'like', "%{$search}%");
            });
        }

        return $query->paginate($perPage);
    }

    public function create(User $user, array $data): Inventory
    {
        return DB::transaction(function () use ($user, $data) {
            $batchNo = isset($data['batch_no']) ? trim($data['batch_no']) : null;
            $batchNo = $batchNo === '' ? null : $batchNo;

            // Find existing stock line for same store + product + batch_no
            $existing = Inventory::query()
                ->where('store_id', $data['store_id'])
                ->where('product_id', $data['product_id'])
                ->where(function ($q) use ($batchNo) {
                    if ($batchNo === null) {
                        $q->whereNull('batch_no');
                    } else {
                        $q->where('batch_no', $batchNo);
                    }
                })
                ->lockForUpdate()
                ->first();

            $incomingQty = (int) $data['quantity'];

            if ($existing) {
                $before = (int) $existing->quantity;
                $after  = $before + $incomingQty;

                $existing->update([
                    'quantity'      => $after,
                    'reorder_level' => $data['reorder_level'] ?? $existing->reorder_level,
                ]);

                $this->logHistory(
                    inventory: $existing,
                    user: $user,
                    quantityBefore: $before,
                    quantityChanged: $incomingQty,
                    quantityAfter: $after,
                    changeType: 'stock_in',
                    reason: 'Stock received (merged into existing batch)',
                    reference: $batchNo
                );

                // Optional: legacy stock movements table
                if ($incomingQty !== 0 && class_exists(StockMovement::class)) {
                    StockMovement::create([
                        'product_id' => $existing->product_id,
                        'store_id'   => $existing->store_id,
                        'quantity'   => $incomingQty,
                        'type'       => 'stock_in',
                        'reason'     => 'Stock received',
                        'user_id'    => $user->user_id,
                    ]);
                }

                return $existing->fresh()->load(['store', 'product.category']);
            }

            // No existing row → create fresh
            $inventory = Inventory::create([
                'store_id'      => $data['store_id'],
                'product_id'    => $data['product_id'],
                'batch_no'      => $batchNo,
                'quantity'      => $incomingQty,
                'reorder_level' => $data['reorder_level'] ?? 0,
            ]);

            if ($incomingQty > 0) {
                $this->logHistory(
                    inventory: $inventory,
                    user: $user,
                    quantityBefore: 0,
                    quantityChanged: $incomingQty,
                    quantityAfter: $incomingQty,
                    changeType: 'opening_stock',
                    reason: 'Opening stock',
                    reference: $batchNo
                );

                if (class_exists(StockMovement::class)) {
                    StockMovement::create([
                        'product_id' => $inventory->product_id,
                        'store_id'   => $inventory->store_id,
                        'quantity'   => $inventory->quantity,
                        'type'       => 'opening_stock',
                        'reason'     => 'Opening stock',
                        'user_id'    => $user->user_id,
                    ]);
                }
            }

            return $inventory->load(['store', 'product.category']);
        });
    }

    public function show(Inventory $inventory): Inventory
    {
        return $inventory->load(['store', 'product.category', 'histories.user']);
    }

    public function update(User $user, Inventory $inventory, array $data): Inventory
    {
        return DB::transaction(function () use ($user, $inventory, $data) {
            $oldQty = (int) $inventory->quantity;
            $newQty = (int) $data['quantity'];
            $diff   = $newQty - $oldQty;

            $batchNo = array_key_exists('batch_no', $data)
                ? (trim($data['batch_no']) === '' ? null : trim($data['batch_no']))
                : $inventory->batch_no;

            $inventory->update([
                'batch_no'      => $batchNo,
                'quantity'      => $newQty,
                'reorder_level' => $data['reorder_level'] ?? $inventory->reorder_level,
            ]);

            if ($diff !== 0) {
                $this->logHistory(
                    inventory: $inventory,
                    user: $user,
                    quantityBefore: $oldQty,
                    quantityChanged: $diff,
                    quantityAfter: $newQty,
                    changeType: 'adjustment',
                    reason: 'Manual inventory update',
                    reference: $batchNo
                );

                if (class_exists(StockMovement::class)) {
                    StockMovement::create([
                        'product_id' => $inventory->product_id,
                        'store_id'   => $inventory->store_id,
                        'quantity'   => $diff,
                        'type'       => 'adjustment',
                        'reason'     => 'Manual inventory update',
                        'user_id'    => $user->user_id,
                    ]);
                }
            }

            return $inventory->fresh()->load(['store', 'product.category']);
        });
    }

    public function delete(Inventory $inventory): void
    {
        if ((int)$inventory->quantity > 0) {
            abort(response()->json([
                'message' => 'Cannot delete inventory while quantity is above zero.',
            ], 422));
        }

        $inventory->delete();
    }

    private function logHistory(
        Inventory $inventory,
        User $user,
        int $quantityBefore,
        int $quantityChanged,
        int $quantityAfter,
        string $changeType,
        ?string $reason = null,
        ?string $reference = null,
    ): InventoryHistory {
        return InventoryHistory::create([
            'inventory_id'     => $inventory->inventory_id,
            'store_id'         => $inventory->store_id,
            'product_id'       => $inventory->product_id,
            'batch_no'         => $inventory->batch_no,
            'quantity_before'  => $quantityBefore,
            'quantity_changed' => $quantityChanged,
            'quantity_after'   => $quantityAfter,
            'change_type'      => $changeType,
            'reference'        => $reference,
            'reason'           => $reason,
            'user_id'          => $user->user_id ?? null,
        ]);
    }
}
