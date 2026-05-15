<?php

namespace App\Http\Requests\Product;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Or add policy checks later
    }

    public function rules(): array
    {
        return [
            'category_id' => ['required', 'exists:categories,category_id'],
            'sku' => ['required', 'string', 'max:50', 'unique:products,sku'],
            'product_name' => ['required', 'string', 'max:255'],
            'price' => ['required', 'numeric', 'min:0'],
            'cost_price' => ['required', 'numeric', 'min:0'],
            'vat_rate' => ['nullable', 'numeric', 'min:0'],
            'image_url' => ['nullable', 'url', 'max:2048'],
            'is_active' => ['boolean'],
        ];
    }
}
