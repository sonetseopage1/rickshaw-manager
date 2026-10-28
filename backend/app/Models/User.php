<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;

    protected $fillable = [
        'name', 'login', 'password', 'role', 'garage_id', 'owner_ref', 'avatar_id', 'is_blocked', 'language', 'last_login_at',
    ];

    protected $hidden = ['password'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_blocked' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    public function garage(): BelongsTo
    {
        return $this->belongsTo(Garage::class);
    }

    public function isSuper(): bool
    {
        return $this->role === 'super';
    }

    /** Sees everything like an admin, changes nothing. May also own rickshaws (owner_ref). */
    public function isPartner(): bool
    {
        return $this->role === 'partner';
    }

    public function isOwner(): bool
    {
        return $this->role === 'owner';
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    /** Safe representation for the mobile/web app. */
    public function toApp(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'login' => $this->login,
            'role' => $this->role,
            'owner_ref' => $this->owner_ref,
            'avatar_id' => $this->avatar_id,
            'language' => $this->language,
            'is_blocked' => $this->is_blocked,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
        ];
    }
}
