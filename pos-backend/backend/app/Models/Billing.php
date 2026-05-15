<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Billing extends Model
{
    use HasUuid;

    protected $table = 'billing';
    protected $primaryKey = 'billing_id';

    protected $fillable = [
        'uuid',
        'store_id',
        'customer_id',
        'user_id',
        'invnumber',
        'status',
        'subtotal',
        'vat_amount',
        'total',
        'paid_amount',
        'balance_due',
        'is_draft',
        'stock_applied_at',
        'billing_date',
        'notes',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'vat_amount' => 'decimal:2',
        'total' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'balance_due' => 'decimal:2',
        'is_draft' => 'boolean',
        'stock_applied_at' => 'datetime',
        'billing_date' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->invnumber)) {
                $lastId = Billing::max('billing_id') ?? 0;
                $model->invnumber = 'INV-' . str_pad($lastId + 1, 4, '0', STR_PAD_LEFT);
            }
        });
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class, 'store_id', 'store_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id', 'customer_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(BillingItem::class, 'billing_id', 'billing_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'billing_id', 'billing_id');
    }
    public function getRouteKeyName()
{
    return 'billing_id';
}
}
