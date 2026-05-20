<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\StoreInventoryRequest;
use App\Http\Requests\Inventory\UpdateInventoryRequest;
use App\Models\Inventory;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    public function __construct(private readonly InventoryService $service) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'message' => 'Inventory retrieved successfully.',
            'data'    => $this->service->paginate(
                $request->user(),
                $request->only('store_id', 'search', 'per_page')
            ),
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        return response()->json([
            'message' => 'Inventory history retrieved successfully.',
            'data'    => $this->service->paginateHistory(
                $request->user(),
                $request->only('store_id', 'product_id', 'change_type', 'search', 'per_page')
            ),
        ]);
    }

    public function store(StoreInventoryRequest $request): JsonResponse
    {
        return response()->json([
            'message' => 'Inventory created successfully.',
            'data'    => $this->service->create($request->user(), $request->validated()),
        ], 201);
    }

    public function show(Inventory $inventory): JsonResponse
    {
        return response()->json([
            'message' => 'Inventory retrieved successfully.',
            'data'    => $this->service->show($inventory),
        ]);
    }

    public function update(UpdateInventoryRequest $request, Inventory $inventory): JsonResponse
    {
        return response()->json([
            'message' => 'Inventory updated successfully.',
            'data'    => $this->service->update($request->user(), $inventory, $request->validated()),
        ]);
    }

    public function destroy(Inventory $inventory): JsonResponse
    {
        $this->service->delete($inventory);

        return response()->json([
            'message' => 'Inventory deleted successfully.',
        ]);
    }
}
