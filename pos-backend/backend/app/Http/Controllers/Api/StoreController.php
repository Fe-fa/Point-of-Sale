<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Store\StoreRequest;
use App\Http\Requests\Store\UpdateStoreRequest;
use App\Models\Store;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StoreController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Store::query()->withCount('assignedUsers')->orderBy('store_name');

        if (! $user->isAdmin()) {
            $allowedStoreIds = $user->stores()->pluck('stores.store_id')
                ->push($user->default_store_id)
                ->filter()
                ->unique()
                ->values();

            $query->whereIn('store_id', $allowedStoreIds);
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    public function store(StoreRequest $request): JsonResponse
    {
        if (! $request->user()->isAdmin()) {
            return response()->json(['message' => 'Only the system admin can create stores.'], 403);
        }

        $store = Store::create($request->validated());

        return response()->json([
            'message' => 'Store created successfully.',
            'data' => $store,
        ], 201);
    }

    public function show(Request $request, Store $store): JsonResponse
    {
        if (! $this->canAccessStore($request->user(), $store->store_id)) {
            return response()->json(['message' => 'You do not have access to this store.'], 403);
        }

        $store->loadCount('assignedUsers');

        return response()->json([
            'data' => $store,
        ]);
    }

    public function update(UpdateStoreRequest $request, Store $store): JsonResponse
    {
        if (! $request->user()->isAdmin()) {
            return response()->json(['message' => 'Only the system admin can update stores.'], 403);
        }

        $store->update($request->validated());

        return response()->json([
            'message' => 'Store updated successfully.',
            'data' => $store->fresh(),
        ]);
    }

    public function destroy(Request $request, Store $store): JsonResponse
    {
        if (! $request->user()->isAdmin()) {
            return response()->json(['message' => 'Only the system admin can deactivate stores.'], 403);
        }

        $store->update(['is_active' => false]);

        return response()->json([
            'message' => 'Store deactivated successfully.',
        ]);
    }

    private function canAccessStore($user, int $storeId): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return (int) $user->default_store_id === $storeId
            || $user->stores()->where('stores.store_id', $storeId)->exists();
    }
}
