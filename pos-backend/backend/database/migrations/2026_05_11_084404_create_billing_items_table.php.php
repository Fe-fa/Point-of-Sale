<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('billing_items', function (Blueprint $table) {
            $table->id('billing_item_id');
            
            // Foreign keys
            $table->unsignedBigInteger('billing_id');
            $table->unsignedBigInteger('product_id');

            // Item details
            $table->integer('quantity')->default(1);
            $table->decimal('unit_price', 10, 2);
            $table->decimal('amount', 10, 2);

            // Timestamps
            $table->timestamps();

            // Constraints
            $table->foreign('billing_id')
                  ->references('billing_id')
                  ->on('billing')
                  ->onDelete('cascade');

            $table->foreign('product_id')
                  ->references('product_id')
                  ->on('products')
                  ->onDelete('restrict');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billing_items');
    }
};
