<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('billing_items', function (Blueprint $table) {
            $table->bigIncrements('billing_item_id');
            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('billing_id');
            $table->unsignedBigInteger('product_id');

            $table->integer('quantity')->default(1);
            $table->decimal('unit_price', 10, 2);
            $table->decimal('line_subtotal', 12, 2);
            $table->decimal('vat_rate', 5, 2)->default(0.00);
            $table->decimal('vat_amount', 12, 2)->default(0.00);
            $table->decimal('total_amount', 12, 2);

            $table->timestamps();

            // Foreign keys
            $table->foreign('billing_id')
                  ->references('billing_id')->on('billing')
                  ->onDelete('cascade');

            $table->foreign('product_id')
                  ->references('product_id')->on('products')
                  ->onDelete('restrict');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billing_items');
    }
};
