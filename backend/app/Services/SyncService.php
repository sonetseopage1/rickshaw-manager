<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Garage;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SyncService
{
    public const PULL_LIMIT = 1000;
    public const MAX_PUSH_ROWS = 400;

    private array $nameCache = [];

    /**
     * Apply rows sent by a device.
     *
     * @return array{overrides: array, dropped: array}
     *   overrides: server rows the device must adopt (it lost a conflict or was refused)
     *   dropped:   rows that do not exist on the server and must be removed locally
     */
    public function push(User $user, Garage $garage, array $changes): array
    {
        $overrides = [];
        $dropped = [];
        $role = $user->role;
        $schema = SyncSchema::tables();
        $nowMs = (int) (microtime(true) * 1000);

        DB::transaction(function () use ($changes, $garage, $user, $role, $schema, $nowMs, &$overrides, &$dropped) {
            // Lock the garage row: sequence numbers are handed out in commit order.
            $locked = Garage::query()->lockForUpdate()->findOrFail($garage->id);
            $seq = (int) $locked->sync_seq;
            $rickshawCount = null;

            foreach ($schema as $table => $def) {
                foreach ($changes[$table] ?? [] as $in) {
                    if (! is_array($in) || ! isset($in['id']) || ! preg_match('/^[0-9a-fA-F-]{36}$/', (string) $in['id'])) {
                        continue;
                    }
                    $id = strtolower((string) $in['id']);
                    $clientTs = min((int) ($in['updated_at'] ?? 0), $nowMs + 60000);
                    $deleted = filter_var($in['deleted'] ?? false, FILTER_VALIDATE_BOOLEAN);

                    $existing = DB::table($table)->where('id', $id)->first();
                    if ($existing && (int) $existing->garage_id !== (int) $garage->id) {
                        continue; // id belongs to someone else, ignore silently
                    }

                    $action = ! $existing ? 'create' : ($deleted && ! $existing->deleted ? 'delete' : 'update');
                    if (! SyncSchema::can($role, $table, $action)) {
                        $this->refuse($table, $existing, $id, $overrides, $dropped);
                        continue;
                    }

                    if ($existing && $clientTs < (int) $existing->updated_at) {
                        $overrides[$table][] = SyncSchema::present($table, $existing); // lost the conflict
                        continue;
                    }

                    // Sanitise the payload.
                    $data = [];
                    $valid = true;
                    foreach ($def['fields'] as $name => $fdef) {
                        [$ok, $val] = SyncSchema::clean($fdef, $in[$name] ?? null);
                        if (! $ok) {
                            $valid = false;
                            break;
                        }
                        if ($val === null && $fdef[0] === 'bool') {
                            $val = $fdef[1] ?? 0;
                        }
                        if ($val === null && $name === 'status') {
                            $val = 'active';
                        }
                        $data[$name] = $val;
                    }
                    foreach ($def['required'] as $req) {
                        if (($data[$req] ?? null) === null || $data[$req] === '') {
                            $valid = false;
                        }
                    }
                    if (! $valid) {
                        if ($action === 'delete' && $existing) {
                            // A tombstone only needs the flag; keep the old content.
                            $data = array_intersect_key((array) $existing, $def['fields']);
                        } else {
                            $this->refuse($table, $existing, $id, $overrides, $dropped);
                            continue;
                        }
                    }

                    // Plan limit on rickshaws.
                    if ($table === 'rickshaws' && $action === 'create' && ! $deleted) {
                        $limit = $locked->plan?->max_rickshaws;
                        if ($limit !== null) {
                            $rickshawCount ??= DB::table('rickshaws')->where('garage_id', $garage->id)->where('deleted', 0)->count();
                            if ($rickshawCount >= $limit) {
                                $dropped[] = ['table' => $table, 'id' => $id, 'reason' => 'plan_limit'];
                                continue;
                            }
                            $rickshawCount++;
                        }
                    }

                    // Nothing changed? Acknowledge without writing (safe retries).
                    if ($existing) {
                        $same = (bool) $existing->deleted === $deleted;
                        foreach ($data as $k => $v) {
                            if ($this->differs($existing->$k, $v, $def['fields'][$k][0])) {
                                $same = false;
                                break;
                            }
                        }
                        if ($same) {
                            continue;
                        }
                    }

                    $seq++;
                    $row = $data + [
                        'updated_at' => $clientTs,
                        'server_ts' => $seq,
                        'deleted' => $deleted ? 1 : 0,
                        'updated_by' => $user->id,
                    ];
                    if ($existing) {
                        DB::table($table)->where('id', $id)->update($row);
                    } else {
                        DB::table($table)->insert($row + ['id' => $id, 'garage_id' => $garage->id]);
                    }

                    $this->log($user, $garage, $table, $id, $action, $existing, $data);
                }
            }

            if ($seq !== (int) $locked->sync_seq) {
                $locked->sync_seq = $seq;
                $locked->save();
            }
        });

        return ['overrides' => $overrides, 'dropped' => $dropped];
    }

    /**
     * Rows changed after $cursor (a per-garage sequence number).
     *
     * @return array{changes: array, cursor: int, more: bool}
     */
    public function pull(Garage $garage, int $cursor, ?User $user = null): array
    {
        $scope = $user && $user->isOwner() ? $this->ownerScope($garage, (string) $user->owner_ref) : null;
        $limit = self::PULL_LIMIT;
        // Read the committed sequence first: every row up to it is already visible below.
        $seqBefore = (int) Garage::query()->whereKey($garage->id)->value('sync_seq');
        $all = [];
        foreach (SyncSchema::names() as $table) {
            $q = DB::table($table)->where('garage_id', $garage->id);
            // An owner's small reference lists (who owns / drives what) are always sent in full,
            // because a driver can become relevant to them without the driver row itself changing.
            if ($scope === null || ! in_array($table, ['owners', 'rickshaws', 'drivers'], true)) {
                $q->where('server_ts', '>', $cursor);
            }
            if ($scope !== null && ! $this->scopeQuery($q, $table, $scope)) {
                continue; // this table is not visible to owners
            }
            $rows = $q->orderBy('server_ts')->limit($limit + 1)->get();
            foreach ($rows as $r) {
                $all[] = [$table, $r];
            }
        }
        usort($all, fn ($a, $b) => $a[1]->server_ts <=> $b[1]->server_ts);

        $more = count($all) > $limit;
        $all = array_slice($all, 0, $limit);

        $changes = [];
        $newCursor = $cursor;
        foreach ($all as [$table, $r]) {
            $changes[$table][] = $scope !== null ? $this->redact($table, SyncSchema::present($table, $r)) : SyncSchema::present($table, $r);
            $newCursor = max($newCursor, (int) $r->server_ts);
        }
        if (! $more) {
            // Nothing newer is waiting: skip ahead so we do not re-read our own writes.
            $newCursor = max($newCursor, $seqBefore);
        }

        return ['changes' => $changes, 'cursor' => $newCursor, 'more' => $more];
    }

    /**
     * What a rickshaw owner may see: only their own rickshaws, the entries and
     * assignments of those, and the drivers involved. Never garage costs.
     */
    private function ownerScope(Garage $garage, string $ref): array
    {
        $own = fn ($q) => $q->where('owner_id', $ref)->orWhere(fn ($w) => $w->whereNull('owner_id')
            ->whereIn('rickshaw_id', DB::table('rickshaws')->where('garage_id', $garage->id)->where('owner_id', $ref)->select('id')));

        $rickshaws = DB::table('rickshaws')->where('garage_id', $garage->id)->where('owner_id', $ref)->pluck('id')->all();
        $entryRickshaws = DB::table('entries')->where('garage_id', $garage->id)->where($own)->distinct()->pluck('rickshaw_id')->all();
        $rids = array_values(array_unique(array_merge($rickshaws, $entryRickshaws)));

        $drivers = array_merge(
            DB::table('assignments')->where('garage_id', $garage->id)->whereIn('rickshaw_id', $rids)->distinct()->pluck('driver_id')->all(),
            DB::table('entries')->where('garage_id', $garage->id)->where($own)->whereNotNull('driver_id')->distinct()->pluck('driver_id')->all(),
        );

        return ['ref' => $ref, 'rickshaws' => $rids, 'drivers' => array_values(array_unique($drivers)), 'own' => $own];
    }

    /** Narrow a table query for an owner. Returns false when the table is hidden. */
    private function scopeQuery($q, string $table, array $scope): bool
    {
        switch ($table) {
            case 'owners':
                $q->where('id', $scope['ref']);
                return true;
            case 'rickshaws':
                $q->whereIn('id', $scope['rickshaws']);
                return true;
            case 'assignments':
                $q->whereIn('rickshaw_id', $scope['rickshaws']);
                return true;
            case 'drivers':
                $q->whereIn('id', $scope['drivers']);
                return true;
            case 'entries':
                $q->where($scope['own']);
                return true;
        }
        return false; // garage_expenses
    }

    /** Owners get names and money, not private contact or internal notes. */
    private function redact(string $table, array $row): array
    {
        $hide = ['drivers' => ['nid', 'address', 'note'], 'rickshaws' => ['note'], 'assignments' => ['note'], 'owners' => ['note']];
        foreach ($hide[$table] ?? [] as $f) {
            $row[$f] = null;
        }
        return $row;
    }

    private function refuse(string $table, ?object $existing, string $id, array &$overrides, array &$dropped): void
    {
        if ($existing) {
            $overrides[$table][] = SyncSchema::present($table, $existing);
        } else {
            $dropped[] = ['table' => $table, 'id' => $id, 'reason' => 'forbidden'];
        }
    }

    private function differs(mixed $old, mixed $new, string $type): bool
    {
        if ($old === null || $new === null) {
            return $old !== $new;
        }
        return match ($type) {
            'dec' => abs((float) $old - (float) $new) > 0.0001,
            'bool' => (int) $old !== (int) $new,
            default => (string) $old !== (string) $new,
        };
    }

    private function log(User $user, Garage $garage, string $table, string $id, string $action, ?object $old, array $data): void
    {
        $changes = null;
        if ($action === 'create') {
            $changes = array_filter($data, fn ($v) => $v !== null && $v !== '');
        } elseif ($action === 'update') {
            $changes = [];
            foreach ($data as $k => $v) {
                $ov = $old->$k ?? null;
                if ($this->differs($ov, $v, SyncSchema::tables()[$table]['fields'][$k][0])) {
                    $changes[$k] = [$ov, $v];
                }
            }
        }

        ActivityLog::create([
            'garage_id' => $garage->id,
            'user_id' => $user->id,
            'user_name' => $user->name,
            'action' => $action,
            'entity' => $table,
            'entity_id' => $id,
            'label' => mb_substr($this->label($table, $data, $old), 0, 250),
            'changes' => $changes ?: null,
            'created_at' => now(),
        ]);
    }

    private function label(string $table, array $data, ?object $old): string
    {
        $get = fn (string $k) => $data[$k] ?? ($old->$k ?? null);
        return match ($table) {
            'owners', 'drivers' => (string) $get('name'),
            'rickshaws' => (string) $get('number'),
            'garage_expenses' => $get('category') . ' ' . $get('amount'),
            'entries' => $get('entry_date') . ' · ' . $this->lookup('rickshaws', 'number', $get('rickshaw_id')),
            'assignments' => $this->lookup('rickshaws', 'number', $get('rickshaw_id')) . ' → ' . $this->lookup('drivers', 'name', $get('driver_id')),
            default => '',
        };
    }

    private function lookup(string $table, string $col, ?string $id): string
    {
        if (! $id) {
            return '?';
        }
        return $this->nameCache[$table][$id] ??= (string) (DB::table($table)->where('id', $id)->value($col) ?? '?');
    }
}
