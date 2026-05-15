<?php

namespace App\Services;

use App\Models\Billing;
use App\Models\BillingItem;
use App\Models\Product;

class BillingItemService
{
    public function __construct(
        private readonly BillingService $billingService,
        private readonly AuditLogService $auditLogService
    ) {
    }

    public function addItem(Billing $billing, array $data): BillingItem
    {
        if (!$billing->is_draft && $billing->payments()->exists()) {
            abort(response()->json([
                'message' => 'Cannot modify items after payment has started.',
            ], 422));
        }

        $product = Product::query()->findOrFail($data['product_id']);

        if (!$product->is_active) {
            abort(response()->json([
                'message' => 'Selected product is inactive.',
            ], 422));
        }

        $qty = (int)$data['quantity'];
        $unitPrice = (float)($data['unit_price'] ?? $product->price);
        $lineSubtotal = $qty * $unitPrice;
        $vatRate = (float)$product->vat_rate;
        $vatAmount = $lineSubtotal * ($vatRate / 100);
        $totalAmount = $lineSubtotal + $vatAmount;

        $item = BillingItem::create([
            'billing_id' => $billing->billing_id,
            'product_id' => $product->product_id,
            'quantity' => $qty,
            'unit_price' => $unitPrice,
            'line_subtotal' => $lineSubtotal,
            'vat_rate' => $vatRate,
            'vat_amount' => $vatAmount,
            'total_amount' => $totalAmount,
        ]);

        $this->billingService->recalculateTotals($billing);

        $this->auditLogService->log(
            'billing_item.create',
            $item,
            null,
            $item->toArray(),
            ['billing_uuid' => $billing->uuid],
            $billing->store_id
        );

        return $item->load('product.category');
    }

    public function updateItem(BillingItem $item, array $data): BillingItem
    {
        $billing = $item->billing;

        if (!$billing->is_draft && $billing->payments()->exists()) {
            abort(response()->json([
                'message' => 'Cannot modify items after payment has started.',
            ], 422));
        }

        $old = $item->toArray();

        $product = $item->product;
        $qty = (int)$data['quantity'];
        $unitPrice = (float)($data['unit_price'] ?? $item->unit_price);
        $lineSubtotal = $qty * $unitPrice;
        $vatRate = (float)$product->vat_rate;
        $vatAmount = $lineSubtotal * ($vatRate / 100);
        $totalAmount = $lineSubtotal + $vatAmount;

        $item->update([
            'quantity' => $qty,
            'unit_price' => $unitPrice,
            'line_subtotal' => $lineSubtotal,
            'vat_rate' => $vatRate,
            'vat_amount' => $vatAmount,
            'total_amount' => $totalAmount,
        ]);
        $this->billingService->recalculateTotals($billing);
        $this->auditLogService->log(
            'billing_item.update',
            $item,
            $old,
            $item->fresh()->toArray(),
            ['billing_uuid' => $billing->uuid],
            $billing->store_id
        );
        return $item->fresh()->load('product.category');
    }
    public function deleteItem(BillingItem $item): void
    {
        $billing = $item->billing;
        if (!$billing->is_draft && $billing->payments()->exists()) {
            abort(response()->json([
                'message' => 'Cannot delete items after payment has started.',
            ], 422));
        }
        $old = $item->toArray();
        $item->delete();

        $this->billingService->recalculateTotals($billing);

        $this->auditLogService->log(
            'billing_item.delete',
            null,
            $old,
            null,
            ['billing_uuid' => $billing->uuid],
            $billing->store_id
        );
    }
    public function getItems(Billing $billing)
    {
        $items = $billing->items()->with('product.category')->get();

        $this->auditLogService->log(
            'billing_item.view',
            $billing,
            null,
            null,
            ['items_count' => $items->count()],
            $billing->store_id
        );
        return $items;
    }
}
