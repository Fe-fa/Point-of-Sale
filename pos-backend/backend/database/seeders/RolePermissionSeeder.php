<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            'stores.manage',
            'users.manage',
            'users.assign',
            'categories.manage',
            'customers.manage',
            'products.manage',
            'inventory.manage',
            'billings.manage',
            'orders.manage',
            'payments.charge',
        ];

        foreach ($permissions as $permission) {
            Permission::findOrCreate($permission, 'sanctum');
        }

        $admin = Role::findOrCreate(User::ROLE_ADMIN, 'sanctum');
        $manager = Role::findOrCreate(User::ROLE_MANAGER, 'sanctum');
        $cashier = Role::findOrCreate(User::ROLE_CASHIER, 'sanctum');

        $admin->syncPermissions($permissions);

        $manager->syncPermissions([
            'users.manage',
            'users.assign',
            'categories.manage',
            'customers.manage',
            'products.manage',
            'inventory.manage',
            'billings.manage',
            'orders.manage',
            'payments.charge',
        ]);

        $cashier->syncPermissions([
            'billings.manage',
            'payments.charge',
        ]);
    }
}
