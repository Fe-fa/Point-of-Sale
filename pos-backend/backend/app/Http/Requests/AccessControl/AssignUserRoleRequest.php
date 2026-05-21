<?php

namespace App\Http\Requests\AccessControl;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AssignUserRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'role' => [
                'required',
                'string',
                Rule::in([User::ROLE_ADMIN, User::ROLE_MANAGER, User::ROLE_CASHIER]),
            ],
        ];
    }
}
