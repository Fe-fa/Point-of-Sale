<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Store;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Create a Store first (since user belongs to a store)
        $store = Store::firstOrCreate(
            ['name' => 'Main Store'],
            ['location' => 'Default Location']
        );

        // 2. Setup Spatie Roles
        $adminRole = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'sanctum']);
        Role::firstOrCreate(['name' => 'manager', 'guard_name' => 'sanctum']);
        Role::firstOrCreate(['name' => 'cashier', 'guard_name' => 'sanctum']);

        // 3. Create/Update the Admin User
        $admin = User::updateOrCreate(
            ['email' => 'admin@example.com'], // Checks if this email exists
            [
                'first_name' => 'Super',
                'last_name' => 'Admin',
                'username' => 'admin',
                'phone' => '0700000000',
                'password' => Hash::make('password123'),
                'role' => User::ROLE_ADMIN,
                'default_store_id' => $store->store_id, // Links to store above
                'is_active' => true,
                'is_verified' => true,
                'email_verified_at' => now(),
            ]
        );

        // 4. Assign role and sync with store
        $admin->assignRole($adminRole);
        $admin->stores()->syncWithoutDetaching([$store->store_id => ['assigned_at' => now()]]);
        
        $this->command->info('Admin user seeded successfully!');
    }
}