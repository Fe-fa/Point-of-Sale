<?php

namespace App\Services;

use App\Models\Category;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class CategoryService
{
    public function paginate(array $filters = []): LengthAwarePaginator
    {
        $perPage = (int)($filters['per_page'] ?? 15);

        $query = Category::query()
            ->withCount('products')
            ->orderBy('category_name');

        if (!empty($filters['search'])) {
            $search = trim($filters['search']);
            $query->where('category_name', 'like', "%{$search}%");
        }

        return $query->paginate($perPage);
    }

    public function create(array $data): Category
    {
        return Category::create([
            'category_name' => $data['category_name'],
        ])->loadCount('products');
    }

    public function show(Category $category): Category
    {
        return $category->loadCount('products');
    }

    public function update(Category $category, array $data): Category
    {
        $category->update([
            'category_name' => $data['category_name'],
        ]);

        return $category->fresh()->loadCount('products');
    }

    public function delete(Category $category): void
    {
        if ($category->products()->exists()) {
            abort(response()->json([
                'message' => 'Cannot delete category because it has linked products.',
            ], 422));
        }

        $category->delete();
    }
}
