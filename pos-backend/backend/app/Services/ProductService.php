<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

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
        $imageValue = $this->resolveImageValue($data, null);

        return Product::create([
            'category_id'  => $data['category_id'],
            'sku'          => $data['sku'],
            'product_name' => $data['product_name'],
            'price'        => $data['price'],
            'cost_price'   => $data['cost_price'],
            'vat_rate'     => $data['vat_rate'] ?? 0,
            'image_url'    => $imageValue,
            'is_active'    => isset($data['is_active'])
                ? filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN)
                : true,
        ])->load('category');
    }

    public function show(Product $product): Product
    {
        return $product->load(['category', 'inventories.store']);
    }

    public function update(Product $product, array $data): Product
    {
        $updateData = [
            'category_id'  => $data['category_id'] ?? $product->category_id,
            'sku'          => $data['sku'] ?? $product->sku,
            'product_name' => $data['product_name'] ?? $product->product_name,
            'price'        => $data['price'] ?? $product->price,
            'cost_price'   => $data['cost_price'] ?? $product->cost_price,
            'vat_rate'     => array_key_exists('vat_rate', $data) ? $data['vat_rate'] : $product->vat_rate,
            'is_active'    => array_key_exists('is_active', $data)
                ? filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN)
                : $product->is_active,
        ];

        if ($this->shouldUpdateImage($data)) {
            $previous = $product->getRawOriginal('image_url');

            if ($previous && !filter_var($previous, FILTER_VALIDATE_URL)) {
                Storage::disk('public')->delete($previous);
            }

            $updateData['image_url'] = $this->resolveImageValue($data, $previous);
        }

        $product->update($updateData);

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

        $rawImage = $product->getRawOriginal('image_url');

        if ($rawImage && !filter_var($rawImage, FILTER_VALIDATE_URL)) {
            Storage::disk('public')->delete($rawImage);
        }

        $product->delete();
    }

    private function shouldUpdateImage(array $data): bool
    {
        if (!empty($data['clear_image'])) {
            return true;
        }

        if (isset($data['image']) && $data['image'] instanceof UploadedFile) {
            return true;
        }

        if (array_key_exists('image_url', $data) && filled($data['image_url'])) {
            return true;
        }

        return false;
    }

    private function resolveImageValue(array $data, ?string $previous): ?string
    {
        if (!empty($data['clear_image'])) {
            return null;
        }

        if (isset($data['image']) && $data['image'] instanceof UploadedFile) {
            return $data['image']->store('products', 'public');
        }

        if (array_key_exists('image_url', $data) && filled($data['image_url'])) {
            return $data['image_url'];
        }

        return $previous;
    }
}
