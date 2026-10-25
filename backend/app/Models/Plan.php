<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    protected $fillable = ['name', 'price', 'duration_days', 'max_rickshaws', 'max_users', 'is_active', 'sort'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'price' => 'float'];
    }

    public function garages(): HasMany
    {
        return $this->hasMany(Garage::class);
    }
}
