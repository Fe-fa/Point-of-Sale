<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class DocumentSequence extends Model
{
    protected $table = 'document_sequences';
    protected $primaryKey = 'id';
    public $timestamps = false;
    protected $fillable = [
        'store_id',
        'document_type',
        'prefix',
        'suffix',
        'last_number',
    ];
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class, 'store_id', 'store_id');
    }
}