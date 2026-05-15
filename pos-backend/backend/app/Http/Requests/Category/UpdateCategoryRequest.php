<?php

namespace App\Http\Requests\Category;

use App\Models\Category;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $category = $this->route('category');
        $categoryId = $category instanceof Category ? $category->category_id : $category;

        return [
            'category_name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('categories', 'category_name')->ignore($categoryId, 'category_id'),
            ],
        ];
    }
}
