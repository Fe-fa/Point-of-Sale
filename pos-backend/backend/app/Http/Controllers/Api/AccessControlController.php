<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AccessControl\AssignUserRoleRequest;
use App\Http\Requests\AccessControl\UpdateRolePermissionsRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class AccessControlController extends Controller
{
    public function index(): JsonResponse
    {
        $permissions = Permission::query()
            ->where('guard_name', 'sanctum')
            ->orderBy('name')
            ->get()
            ->map(fn ($permission) => [
                'name' => $permission->name,
                'label' => $permission->name,
            ])
            ->values();

        $roles = Role::query()
            ->where('guard_name', 'sanctum')
            ->whereIn('name', [User::ROLE_ADMIN, User::ROLE_MANAGER, User::ROLE_CASHIER])
            ->orderBy('name')
            ->get()
            ->map(function ($role) {
                return [
                    'name' => $role->name,
                    'permissions' => $role->permissions()->pluck('name')->values(),
                ];
            })
            ->values();

        $users = User::query()
            ->with(['stores:store_id,store_name'])
            ->orderByDesc('user_id')
            ->get()
            ->map(function ($user) {
                $fullName = $user->full_name
                    ?? trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? ''))
                    ?: ($user->name ?? $user->email);

                return [
                    'user_id' => $user->user_id,
                    'full_name' => $fullName,
                    'email' => $user->email,
                    'role' => $user->getRoleNames()->first() ?? $user->role,
                    'stores' => $user->stores->map(fn ($store) => [
                        'store_id' => $store->store_id,
                        'store_name' => $store->store_name,
                    ])->values(),
                ];
            })
            ->values();

        return response()->json([
            'message' => 'Access control data retrieved successfully.',
            'permissions' => $permissions,
            'roles' => $roles,
            'users' => $users,
        ]);
    }

    public function updateRolePermissions(
        UpdateRolePermissionsRequest $request,
        string $roleName
    ): JsonResponse {
        if (!in_array($roleName, [User::ROLE_MANAGER, User::ROLE_CASHIER], true)) {
            return response()->json([
                'message' => 'Only manager and cashier role templates can be edited.',
            ], 422);
        }

        $role = Role::findByName($roleName, 'sanctum');
        $role->syncPermissions($request->validated('permissions', []));

        return response()->json([
            'message' => ucfirst($roleName) . ' permissions updated successfully.',
            'data' => [
                'name' => $role->name,
                'permissions' => $role->permissions()->pluck('name')->values(),
            ],
        ]);
    }

    public function assignUserRole(
        AssignUserRoleRequest $request,
        User $user
    ): JsonResponse {
        $roleName = $request->validated('role');
        $role = Role::findByName($roleName, 'sanctum');

        $user->syncRoles([$role->name]);

        if (isset($user->role)) {
            $user->role = $role->name;
            $user->save();
        }

        return response()->json([
            'message' => 'User role assigned successfully.',
            'data' => [
                'user_id' => $user->user_id,
                'role' => $role->name,
            ],
        ]);
    }
}
