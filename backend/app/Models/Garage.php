<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Garage extends Model
{
    protected $fillable = [
        'name', 'phone', 'address', 'plan_id', 'is_trial', 'subscription_ends_at',
        'is_blocked', 'blocked_reason', 'sync_seq',
    ];

    protected function casts(): array
    {
        return [
            'is_trial' => 'boolean',
            'is_blocked' => 'boolean',
            'subscription_ends_at' => 'datetime',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SubscriptionPayment::class);
    }

    /** blocked | expired | trial | active */
    public function status(): string
    {
        if ($this->is_blocked) {
            return 'blocked';
        }
        if ($this->subscription_ends_at && $this->subscription_ends_at->isPast()) {
            return 'expired';
        }
        return $this->is_trial ? 'trial' : 'active';
    }

    public function daysLeft(): ?int
    {
        if (! $this->subscription_ends_at) {
            return null;
        }
        return (int) now()->startOfDay()->diffInDays($this->subscription_ends_at->copy()->startOfDay(), false);
    }

    /** Info sent to the app so it can show plan limits and subscription banners. */
    public function toApp(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'address' => $this->address,
            'status' => $this->status(),
            'blocked_reason' => $this->blocked_reason,
            'ends_at' => $this->subscription_ends_at?->toIso8601String(),
            'days_left' => $this->daysLeft(),
            'plan' => $this->plan ? [
                'name' => $this->plan->name,
                'max_rickshaws' => $this->plan->max_rickshaws,
                'max_users' => $this->plan->max_users,
            ] : null,
        ];
    }
}
