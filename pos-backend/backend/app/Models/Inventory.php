<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Inventory extends Model
{
    use HasUuid;

    protected $table = 'inventory';
    protected $primaryKey = 'inventory_id';

    protected $fillable = [
        'uuid',
        'store_id',
        'product_id',
        'quantity',
        'reorder_level',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'reorder_level' => 'integer',
    ];

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class, 'store_id', 'store_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id', 'product_id');
    }
}
