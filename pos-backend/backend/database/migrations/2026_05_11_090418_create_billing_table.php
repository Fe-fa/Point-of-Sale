<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('billing', function (Blueprint $table) {
            $table->id('billing_id');

            // Foreign keys
            $table->unsignedBigInteger('store_id');
            $table->unsignedBigInteger('customer_id');
            $table->unsignedBigInteger('user_id');

            // Invoice details
            $table->string('invnumber')->unique();
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('VAT', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);

            // Status (e.g., pending, paid, cancelled)
            $table->string('status')->default('pending');

            // Billing date
            $table->timestamp('billing_date')->nullable();

            // Timestamps
            $table->timestamps();

            // Constraints
            $table->foreign('store_id')
                  ->references('store_id')
                  ->on('stores')
                  ->onDelete('cascade');

            $table->foreign('customer_id')
                  ->references('customer_id')
                  ->on('customers')
                  ->onDelete('cascade');

            $table->foreign('user_id')
                  ->references('user_id')
                  ->on('users')
                  ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billing');
    }
};
