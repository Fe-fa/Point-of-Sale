<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('billing', function (Blueprint $table) {
            $table->bigIncrements('billing_id');
            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('store_id');
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('user_id');

            $table->string('invnumber')->unique();
            $table->string('status')->default('pending');

            $table->decimal('subtotal', 12, 2)->default(0.00);
            $table->decimal('vat_amount', 12, 2)->default(0.00);
            $table->decimal('total', 12, 2)->default(0.00);
            $table->decimal('paid_amount', 12, 2)->default(0.00);
            $table->decimal('balance_due', 12, 2)->default(0.00);

            $table->boolean('is_draft')->default(true);
            $table->timestamp('stock_applied_at')->nullable();
            $table->dateTime('billing_date')->nullable();

            $table->text('notes')->nullable();

            $table->timestamps();

            // Foreign keys
            $table->foreign('store_id')
                  ->references('store_id')->on('stores')
                  ->onDelete('cascade');

            $table->foreign('customer_id')
                  ->references('customer_id')->on('customers')
                  ->onDelete('set null');

            $table->foreign('user_id')
                  ->references('user_id')->on('users')
                  ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billing');
    }
};
