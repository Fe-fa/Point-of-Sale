<?php

namespace App\Http\Requests\Product;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category_id'  => ['required', 'exists:categories,category_id'],
            'sku'          => ['required', 'string', 'max:50', 'unique:products,sku'],
            'product_name' => ['required', 'string', 'max:255'],
            'price'        => ['required', 'numeric', 'min:0'],
            'cost_price'   => ['required', 'numeric', 'min:0'],
            'vat_rate'     => ['nullable', 'numeric', 'min:0'],
            'image'        => ['nullable', 'file', 'image', 'mimes:jpeg,png,jpg,webp', 'max:2048'],
            'image_url'    => ['nullable', 'url', 'max:2048'],
            'clear_image'  => ['nullable', 'boolean'],
            'is_active'    => ['required', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'is_active'   => filter_var($this->input('is_active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false,
            'clear_image' => filter_var($this->input('clear_image'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false,
        ]);
    }
}
