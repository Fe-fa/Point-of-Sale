<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\StoreCustomerRequest;
use App\Http\Requests\Customer\UpdateCustomerRequest;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int)($request->get('per_page', 15));

        $q = Customer::query()->orderByDesc('customer_id');

        if ($request->filled('search')) {
            $s = trim((string)$request->search);
            $q->where(function ($w) use ($s) {
                $w->where('full_name', 'like', "%{$s}%")
                  ->orWhere('phone', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%");
            });
        }

        return response()->json([
            'message' => 'Customers retrieved successfully.',
            'data' => $q->paginate($perPage),
        ]);
    }

    public function store(StoreCustomerRequest $request): JsonResponse
    {
        $customer = Customer::create($request->validated());

        return response()->json([
            'message' => 'Customer created successfully.',
            'data' => $customer,
        ], 201);
    }

    public function show(Customer $customer): JsonResponse
    {
        return response()->json([
            'message' => 'Customer retrieved successfully.',
            'data' => $customer->loadCount('billings'),
        ]);
    }

    public function update(UpdateCustomerRequest $request, Customer $customer): JsonResponse
    {
        $customer->update($request->validated());

        return response()->json([
            'message' => 'Customer updated successfully.',
            'data' => $customer->fresh(),
        ]);
    }

    public function destroy(Customer $customer): JsonResponse
    {
        if ($customer->billings()->exists()) {
            return response()->json([
                'message' => 'Cannot delete customer with existing billings.',
            ], 422);
        }

        $customer->delete();

        return response()->json(['message' => 'Customer deleted successfully.']);
    }
}
