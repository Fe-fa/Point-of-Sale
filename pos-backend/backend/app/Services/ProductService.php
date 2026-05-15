<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class ProductService
{
    public function paginate(array $filters = []): LengthAwarePaginator
    {
        $perPage = (int)($filters['per_page'] ?? 15);

        $query = Product::query()
            ->with(['category'])
            ->withCount('inventories')
            ->orderByDesc('product_id');

        if (!empty($filters['search'])) {
            $search = trim($filters['search']);
            $query->where(function ($q) use ($search) {
                $q->where('product_name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        if (!empty($filters['category_id'])) {
            $query->where('category_id', (int) $filters['category_id']);
        }

        if (array_key_exists('is_active', $filters) && $filters['is_active'] !== '') {
            $query->where('is_active', filter_var($filters['is_active'], FILTER_VALIDATE_BOOLEAN));
        }

        return $query->paginate($perPage);
    }

    public function create(array $data): Product
    {
        return Product::create([
            'category_id' => $data['category_id'],
            'sku' => $data['sku'],
            'product_name' => $data['product_name'],
            'price' => $data['price'],
            'cost_price' => $data['cost_price'],
            'vat_rate' => $data['vat_rate'] ?? 0,
            'image_url' => $data['image_url'] ?? null,
            'is_active' => $data['is_active'] ?? true,
        ])->load('category');
    }

    public function show(Product $product): Product
    {
        return $product->load(['category', 'inventories.store']);
    }

    public function update(Product $product, array $data): Product
    {
        $product->update([
            'category_id' => $data['category_id'] ?? $product->category_id,
            'sku' => $data['sku'] ?? $product->sku,
            'product_name' => $data['product_name'] ?? $product->product_name,
            'price' => $data['price'] ?? $product->price,
            'cost_price' => $data['cost_price'] ?? $product->cost_price,
            'vat_rate' => array_key_exists('vat_rate', $data) ? $data['vat_rate'] : $product->vat_rate,
            'image_url' => array_key_exists('image_url', $data) ? $data['image_url'] : $product->image_url,
            'is_active' => array_key_exists('is_active', $data) ? $data['is_active'] : $product->is_active,
        ]);

        return $product->fresh()->load('category');
    }

    public function delete(Product $product): void
    {
        if ($product->billingItems()->exists()) {
            abort(response()->json([
                'message' => 'Cannot delete product because it already appears in billing items.',
            ], 422));
        }

        if ($product->inventories()->where('quantity', '>', 0)->exists()) {
            abort(response()->json([
                'message' => 'Cannot delete product because inventory still exists.',
            ], 422));
        }

        $product->delete();
    }
}
