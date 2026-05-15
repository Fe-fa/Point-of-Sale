<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use HasUuid;

    protected $table = 'customers';
    protected $primaryKey = 'customer_id';

    protected $fillable = [
        'uuid',
        'full_name',
        'email',
        'phone',
        'current_balance',
    ];

    protected $casts = [
        'current_balance' => 'decimal:2',
    ];

    public function billings(): HasMany
    {
        return $this->hasMany(Billing::class, 'customer_id', 'customer_id');
    }
}
