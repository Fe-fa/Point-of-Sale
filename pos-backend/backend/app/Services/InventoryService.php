<?php

namespace App\Services;

use App\Models\Inventory;
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
            $query->whereHas('product', function ($q) use ($search) {
                $q->where('product_name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        return $query->paginate($perPage);
    }

    public function create(User $user, array $data): Inventory
    {
        return DB::transaction(function () use ($user, $data) {
            $inventory = Inventory::create([
                'store_id' => $data['store_id'],
                'product_id' => $data['product_id'],
                'quantity' => $data['quantity'],
                'reorder_level' => $data['reorder_level'] ?? 0,
            ]);

            if ((int)$inventory->quantity > 0) {
                StockMovement::create([
                    'product_id' => $inventory->product_id,
                    'store_id' => $inventory->store_id,
                    'quantity' => $inventory->quantity,
                    'type' => 'opening_stock',
                    'reason' => 'Opening stock',
                    'user_id' => $user->user_id,
                ]);
            }

            return $inventory->load(['store', 'product.category']);
        });
    }

    public function show(Inventory $inventory): Inventory
    {
        return $inventory->load(['store', 'product.category']);
    }

    public function update(User $user, Inventory $inventory, array $data): Inventory
    {
        return DB::transaction(function () use ($user, $inventory, $data) {
            $oldQty = (int)$inventory->quantity;
            $newQty = (int)$data['quantity'];
            $diff = $newQty - $oldQty;

            $inventory->update([
                'quantity' => $newQty,
                'reorder_level' => $data['reorder_level'] ?? $inventory->reorder_level,
            ]);

            if ($diff !== 0) {
                StockMovement::create([
                    'product_id' => $inventory->product_id,
                    'store_id' => $inventory->store_id,
                    'quantity' => $diff,
                    'type' => 'adjustment',
                    'reason' => 'Manual inventory update',
                    'user_id' => $user->user_id,
                ]);
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
}
