<?php

namespace App\Services;

/**
 * Describes every table that is synced between the app and the server:
 * allowed columns, their types, required columns and which role may
 * create (c), update (u) or delete (d) rows.
 *
 * Order matters: parents come before children.
 */
class SyncSchema
{
    public const STATUSES = ['active', 'maintenance', 'inactive'];

    public static function tables(): array
    {
        return [
            'owners' => [
                'fields' => [
                    'name' => ['str', 255], 'phone' => ['str', 32], 'address' => ['str', 255],
                    'note' => ['text'], 'is_self' => ['bool'],
                ],
                'required' => ['name'],
                'perm' => ['admin' => 'cud', 'manager' => '', 'owner' => ''],
            ],
            'drivers' => [
                'fields' => [
                    'name' => ['str', 255], 'phone' => ['str', 32], 'nid' => ['str', 32],
                    'address' => ['str', 255], 'note' => ['text'], 'is_active' => ['bool', 1],
                    'photo_id' => ['uuid'], 'nid_front_id' => ['uuid'], 'nid_back_id' => ['uuid'],
                ],
                'required' => ['name'],
                'perm' => ['admin' => 'cud', 'manager' => 'cu', 'owner' => ''],
            ],
            'rickshaws' => [
                'fields' => [
                    'number' => ['str', 100], 'owner_id' => ['uuid'], 'default_rent' => ['dec'],
                    'default_charge' => ['dec'], 'status' => ['enum', self::STATUSES], 'note' => ['text'],
                ],
                'required' => ['number'],
                'perm' => ['admin' => 'cud', 'manager' => '', 'owner' => ''],
            ],
            'assignments' => [
                'fields' => [
                    'rickshaw_id' => ['uuid'], 'driver_id' => ['uuid'], 'start_date' => ['date'],
                    'end_date' => ['date'], 'expected_rent' => ['dec'], 'note' => ['text'],
                ],
                'required' => ['rickshaw_id', 'driver_id', 'start_date'],
                'perm' => ['admin' => 'cud', 'manager' => 'cud', 'owner' => ''],
            ],
            'entries' => [
                'fields' => [
                    'rickshaw_id' => ['uuid'], 'driver_id' => ['uuid'], 'owner_id' => ['uuid'],
                    'entry_date' => ['date'], 'deposit' => ['dec'], 'due' => ['dec'], 'expense' => ['dec'],
                    'expense_type' => ['str', 32], 'garage_charge' => ['dec'],
                    'taken_time' => ['time'], 'deposit_time' => ['time'], 'note' => ['text'],
                ],
                'required' => ['rickshaw_id', 'entry_date'],
                'perm' => ['admin' => 'cud', 'manager' => 'cud', 'owner' => ''],
            ],
            'garage_expenses' => [
                'fields' => [
                    'category' => ['str', 32], 'amount' => ['dec'], 'expense_date' => ['date'], 'note' => ['text'],
                ],
                'required' => ['category', 'amount', 'expense_date'],
                'perm' => ['admin' => 'cud', 'manager' => 'cud', 'owner' => ''],
            ],
        ];
    }

    public static function names(): array
    {
        return array_keys(self::tables());
    }

    public static function can(string $role, string $table, string $action): bool
    {
        $perm = self::tables()[$table]['perm'][$role] ?? '';
        return str_contains($perm, substr($action, 0, 1));
    }

    /** Returns [ok, cleanedValue]. */
    public static function clean(array $def, mixed $v): array
    {
        $type = $def[0];
        if ($type === 'bool') {
            return [true, $v === null ? null : (filter_var($v, FILTER_VALIDATE_BOOLEAN) ? 1 : 0)];
        }
        if ($v === null || $v === '') {
            return [true, null];
        }
        if (! is_scalar($v)) {
            return [false, null];
        }

        switch ($type) {
            case 'str':
                return [true, mb_substr(trim((string) $v), 0, $def[1] ?? 255)];
            case 'text':
                return [true, mb_substr(trim((string) $v), 0, 2000)];
            case 'dec':
                if (! is_numeric($v)) {
                    return [false, null];
                }
                return [true, max(0, min(99999999.99, round((float) $v, 2)))];
            case 'date':
                if (! preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', (string) $v, $m) || ! checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
                    return [false, null];
                }
                return [true, (string) $v];
            case 'time':
                return preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', (string) $v) ? [true, (string) $v] : [false, null];
            case 'uuid':
                return preg_match('/^[0-9a-fA-F-]{36}$/', (string) $v) ? [true, strtolower((string) $v)] : [false, null];
            case 'enum':
                return in_array($v, $def[1], true) ? [true, $v] : [false, null];
        }
        return [false, null];
    }

    /** Shape a DB row for the app (typed values, no internal columns). */
    public static function present(string $table, object|array $row): array
    {
        $row = (array) $row;
        $out = [
            'id' => $row['id'],
            'updated_at' => (int) $row['updated_at'],
            'server_ts' => (int) $row['server_ts'],
            'deleted' => (bool) $row['deleted'],
        ];
        foreach (self::tables()[$table]['fields'] as $name => $def) {
            $v = $row[$name] ?? null;
            if ($v !== null) {
                $v = match ($def[0]) {
                    'dec' => (float) $v,
                    'bool' => (bool) $v,
                    default => (string) $v,
                };
            }
            $out[$name] = $v;
        }
        return $out;
    }
}
