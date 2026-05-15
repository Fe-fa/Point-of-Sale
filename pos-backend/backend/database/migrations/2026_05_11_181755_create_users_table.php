<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->bigIncrements('user_id'); // primary key
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('username')->unique();
            $table->string('email')->unique();
            $table->string('phone')->nullable();
            $table->string('password');
            $table->string('role')->default('cashier'); // default role
            $table->unsignedBigInteger('default_store_id')->nullable();
            $table->string('verification_code')->nullable();
            $table->timestamp('verification_expiry')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_verified')->default(false);
            $table->timestamp('email_verified_at')->nullable();
            $table->rememberToken();
            $table->timestamps();

            // Foreign key to stores table
            $table->foreign('default_store_id')
                  ->references('store_id')
                  ->on('stores')
                  ->onDelete('set null');
        });
    }

        
    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
