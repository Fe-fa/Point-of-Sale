<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Billing\StoreBillingRequest;
use App\Http\Requests\Billing\UpdateBillingRequest;
use App\Models\Billing;
use App\Services\BillingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BillingController extends Controller
{
    public function __construct(private readonly BillingService $service) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'message' => 'Billings retrieved successfully.',
            'data' => $this->service->paginate($request->user(), $request->only('status', 'is_draft', 'per_page')),
        ]);
    }

    public function store(StoreBillingRequest $request): JsonResponse
    {
        return response()->json([
            'message' => 'Draft billing created successfully.',
            'data' => $this->service->createDraft($request->user(), $request->validated()),
        ], 201);
    }

public function show($id): JsonResponse 
{
    // 1. Manually try to find the billing record
    $billing = \App\Models\Billing::find($id);

    // 2. If it's not there, return a friendly JSON error instead of crashing
    if (!$billing) {
        return response()->json([
            'message' => "Billing record #{$id} was not found in our system.",
            'data' => null
        ], 404);
    }

    // 3. If it IS there, continue as normal
    return response()->json([
        'message' => 'Billing retrieved successfully.',
        'data' => $this->service->show($billing),
    ]);
}

   public function update(UpdateBillingRequest $request, $id): JsonResponse
{
    $billing = Billing::find($id);

    if (!$billing) {
        return response()->json([
            'message' => "Update failed: Billing record #{$id} does not exist.",
            'debug_info' => 'Check if the record was deleted or if the database was refreshed.'
        ], 404);
    }

    return response()->json([
        'message' => 'Billing updated successfully.',
        'data' => $this->service->updateHeader($billing, $request->validated()),
    ]);
}

    public function destroy(Billing $billing): JsonResponse
    {
        $this->service->destroy($billing);

        return response()->json([
            'message' => 'Billing deleted successfully.',
        ]);
    }
}
