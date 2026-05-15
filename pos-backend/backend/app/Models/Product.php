<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasUuid;

    protected $table = 'products';
    protected $primaryKey = 'product_id';

    protected $fillable = [
        'uuid',
        'store_id',
        'category_id',
        'sku',
        'product_name',
        'price',
        'cost_price',
        'vat_rate',
        'image_url',
        'is_active',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'cost_price' => 'decimal:2',
        'vat_rate' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id', 'category_id');
    }

    public function inventories(): HasMany
    {
        return $this->hasMany(Inventory::class, 'product_id', 'product_id');
    }

    public function billingItems(): HasMany
    {
        return $this->hasMany(BillingItem::class, 'product_id', 'product_id');
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class, 'product_id', 'product_id');
    }
}
