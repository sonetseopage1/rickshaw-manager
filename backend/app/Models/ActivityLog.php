<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'garage_id', 'user_id', 'user_name', 'action', 'entity', 'entity_id', 'label', 'changes', 'created_at',
    ];

    protected function casts(): array
    {
        return ['changes' => 'array', 'created_at' => 'datetime'];
    }
}
