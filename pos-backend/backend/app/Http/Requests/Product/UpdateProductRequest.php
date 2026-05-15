<?php

namespace App\Http\Requests\Product;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category_id' => ['sometimes', 'exists:categories,category_id'],
            'sku' => ['sometimes', 'string', 'max:50', 'unique:products,sku,' . $this->product->product_id . ',product_id'],
            'product_name' => ['sometimes', 'string', 'max:255'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'cost_price' => ['sometimes', 'numeric', 'min:0'],
            'vat_rate' => ['nullable', 'numeric', 'min:0'],
            'image_url' => ['nullable', 'url', 'max:2048'],
            'is_active' => ['boolean'],
        ];
    }
}
