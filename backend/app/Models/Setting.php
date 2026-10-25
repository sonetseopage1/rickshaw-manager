<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    public $timestamps = false;
    public $incrementing = false;
    protected $primaryKey = 'key';
    protected $keyType = 'string';
    protected $fillable = ['key', 'value'];

    /** Defaults used until the super admin changes them. */
    public const DEFAULTS = [
        'trial_days' => '14',
        'registration_open' => '1',
        'announcement' => '',
        'support_phone' => '',
        'currency' => '৳',
        'app_build' => '0',
        'app_min_build' => '0',
        'app_apk_url' => '',
        'app_notes' => '',
    ];

    public static function get(string $key, ?string $default = null): ?string
    {
        $row = static::query()->find($key);
        if ($row) {
            return $row->value;
        }
        return $default ?? (self::DEFAULTS[$key] ?? null);
    }

    public static function put(string $key, ?string $value): void
    {
        static::query()->updateOrCreate(['key' => $key], ['value' => $value]);
    }
}
