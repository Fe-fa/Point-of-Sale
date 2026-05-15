<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Product\StoreProductRequest;
use App\Http\Requests\Product\UpdateProductRequest;
use App\Models\Product;
use App\Services\ProductService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function __construct(private readonly ProductService $service) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'message' => 'Products retrieved successfully.',
            'data' => $this->service->paginate($request->only('search', 'category_id', 'is_active', 'per_page')),
        ]);
    }

    public function store(StoreProductRequest $request): JsonResponse
    {
        return response()->json([
            'message' => 'Product created successfully.',
            'data' => $this->service->create($request->validated()),
        ], 201);
    }

    public function show(Product $product): JsonResponse
    {
        return response()->json([
            'message' => 'Product retrieved successfully.',
            'data' => $this->service->show($product),
        ]);
    }

    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        return response()->json([
            'message' => 'Product updated successfully.',
            'data' => $this->service->update($product, $request->validated()),
        ]);
    }

    public function destroy(Product $product): JsonResponse
    {
        $this->service->delete($product);

        return response()->json([
            'message' => 'Product deleted successfully.',
        ]);
    }
}
