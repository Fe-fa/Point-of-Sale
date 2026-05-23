<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\BillingItemController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\StoreController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\AccessControlController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register'])->name('auth.register');
    Route::post('/login', [AuthController::class, 'login'])->name('auth.login');
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->name('auth.forgot');
    Route::post('/reset-password', [AuthController::class, 'resetPassword'])->name('auth.reset');
});

Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::get('/me', [AuthController::class, 'me'])->name('auth.me');
        Route::post('/logout', [AuthController::class, 'logout'])->name('auth.logout');
        Route::post('/logout-all', [AuthController::class, 'logoutAll'])->name('auth.logoutAll');
        Route::post('/verify-email', [AuthController::class, 'verifyEmail'])->name('auth.verify');
        Route::post('/resend-verification', [AuthController::class, 'resendVerification'])->name('auth.resend');
    });
Route::middleware('auth:sanctum')->prefix('access-control')->group(function () {
    Route::get('/', [AccessControlController::class, 'index']);
    Route::put('/roles/{roleName}/permissions', [AccessControlController::class, 'updateRolePermissions']);
    Route::put('/users/{user}/role', [AccessControlController::class, 'assignUserRole']);
});

    Route::apiResource('stores', StoreController::class);
    Route::apiResource('users', UserController::class);
    Route::post('users/{user}/stores', [UserController::class, 'syncStores'])->name('users.stores.sync');

    Route::apiResource('categories', CategoryController::class);
    Route::apiResource('products', ProductController::class);

    Route::get('inventory/history', [InventoryController::class, 'history'])->name('inventory.history');
    Route::apiResource('inventory', InventoryController::class)->parameters([
        'inventory' => 'inventory',
    ]);

    Route::apiResource('customers', CustomerController::class);
    Route::apiResource('billings', BillingController::class);
    Route::apiResource('billing-items', BillingItemController::class);

    Route::get('billings/{billing}/items', [BillingItemController::class, 'index'])->name('billings.items.index');
    Route::post('billings/{billing}/items', [BillingItemController::class, 'store'])->name('billings.items.store');
    Route::put('billing-items/{billingItem}', [BillingItemController::class, 'update'])->name('billings.items.update');
    Route::delete('billing-items/{billingItem}', [BillingItemController::class, 'destroy'])->name('billings.items.destroy');

    Route::post('billings/{billing}/charge', [PaymentController::class, 'charge'])->name('billings.charge');
});
