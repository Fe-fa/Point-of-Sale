<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\BillingItem\StoreBillingItemRequest;
use App\Http\Requests\BillingItem\UpdateBillingItemRequest;
use App\Models\Billing;
use App\Models\BillingItem;
use App\Services\BillingItemService;
use Illuminate\Http\JsonResponse;

class BillingItemController extends Controller
{
    public function __construct(private readonly BillingItemService $service) {}

    public function index(Billing $billing): JsonResponse
    {
        return response()->json([
            'message' => 'Billing items retrieved successfully.',
            'data' => $this->service->getItems($billing),
        ]);
    }
    public function store(StoreBillingItemRequest $request, Billing $billing): JsonResponse
    {
        return response()->json([
            'message' => 'Billing item created successfully.',
            'data' => $this->service->addItem($billing, $request->validated()),
        ], 201);
    }
    public function show(BillingItem $billingItem): JsonResponse
{
    return response()->json([
        'message' => 'Billing item retrieved successfully.',
        'data' => $billingItem,
    ]);
}

    public function update(UpdateBillingItemRequest $request, BillingItem $billingItem): JsonResponse
    {
        return response()->json([
            'message' => 'Billing item updated successfully.',
            'data' => $this->service->updateItem($billingItem, $request->validated()),
        ]);
    }
    public function destroy(BillingItem $billingItem): JsonResponse
    {
        $this->service->deleteItem($billingItem);

        return response()->json([
            'message' => 'Billing item deleted successfully.',
        ]);
    }
}
