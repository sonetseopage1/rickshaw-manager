<?php

namespace Tests\Feature;

use App\Models\Garage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class SyncTest extends TestCase
{
    use RefreshDatabase;

    /** The test app instance caches the resolved user between requests; real requests do not. */
    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null)
    {
        $this->app['auth']->forgetGuards();
        return parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
    }

    private function register(string $login = 'admin1'): array
    {
        $r = $this->postJson('/api/auth/register', [
            'name' => 'Admin', 'login' => $login, 'password' => 'secret12', 'garage_name' => 'Garage ' . $login,
        ])->assertCreated();
        return [$r->json('token'), $r->json('user.id')];
    }

    private function h(string $token): array
    {
        return ['Authorization' => "Bearer $token"];
    }

    private function rickshaw(string $number = 'R-1', ?int $ts = null): array
    {
        return ['id' => (string) Str::uuid(), 'updated_at' => $ts ?? now()->getTimestampMs(), 'deleted' => false,
            'number' => $number, 'status' => 'active', 'default_rent' => 400];
    }

    public function test_register_login_and_me(): void
    {
        [$token] = $this->register();
        $this->getJson('/api/me', $this->h($token))->assertOk()
            ->assertJsonPath('user.role', 'admin')->assertJsonPath('garage.status', 'trial');
        $this->postJson('/api/auth/login', ['login' => 'ADMIN1 ', 'password' => 'secret12'])->assertOk();
        $this->postJson('/api/auth/login', ['login' => 'admin1', 'password' => 'bad'])->assertStatus(401);
        $this->getJson('/api/me')->assertStatus(401);
    }

    public function test_push_then_pull_roundtrip_and_idempotent_retry(): void
    {
        [$token] = $this->register();
        $r = $this->rickshaw();
        $owner = ['id' => (string) Str::uuid(), 'updated_at' => now()->getTimestampMs(), 'name' => 'Owner A', 'is_self' => true];
        $payload = ['cursor' => 0, 'changes' => ['owners' => [$owner], 'rickshaws' => [$r + ['owner_id' => $owner['id']]]]];

        $res = $this->postJson('/api/sync', $payload, $this->h($token))->assertOk();
        $res->assertJsonPath('changes.rickshaws.0.number', 'R-1')->assertJsonPath('changes.rickshaws.0.default_rent', 400);
        $cursor = $res->json('cursor');
        $this->assertSame(2, $cursor);

        // retry the same push: no new sequence numbers, no duplicate log
        $this->postJson('/api/sync', $payload, $this->h($token))->assertOk();
        $this->assertSame(2, Garage::first()->sync_seq);
        $this->getJson('/api/logs', $this->h($token))->assertJsonCount(2, 'logs');

        // pull from cursor returns nothing new
        $this->postJson('/api/sync', ['cursor' => $cursor], $this->h($token))->assertJsonPath('more', false)->assertJsonCount(0, 'changes');
    }

    public function test_conflict_last_write_wins_and_override_is_returned(): void
    {
        [$token] = $this->register();
        $r = $this->rickshaw('R-1', 2000);
        $this->postJson('/api/sync', ['changes' => ['rickshaws' => [$r]]], $this->h($token))->assertOk();

        $stale = $r; $stale['updated_at'] = 1000; $stale['number'] = 'OLD';
        $res = $this->postJson('/api/sync', ['cursor' => 99, 'changes' => ['rickshaws' => [$stale]]], $this->h($token))->assertOk();
        $res->assertJsonPath('overrides.rickshaws.0.number', 'R-1');

        $newer = $r; $newer['updated_at'] = 3000; $newer['number'] = 'NEW';
        $this->postJson('/api/sync', ['changes' => ['rickshaws' => [$newer]]], $this->h($token))->assertOk();
        $this->assertSame('NEW', \DB::table('rickshaws')->where('id', $r['id'])->value('number'));
    }

    public function test_manager_permissions(): void
    {
        [$admin] = $this->register();
        $mgr = $this->postJson('/api/users', ['name' => 'Mgr', 'login' => 'mgr1', 'password' => 'secret12', 'role' => 'manager'], $this->h($admin))->assertCreated();
        $token = $this->postJson('/api/auth/login', ['login' => 'mgr1', 'password' => 'secret12'])->json('token');

        $rick = $this->rickshaw();
        $this->postJson('/api/sync', ['changes' => ['rickshaws' => [$rick]]], $this->h($admin))->assertOk();

        // manager cannot create/alter rickshaws
        $new = $this->rickshaw('R-9');
        $res = $this->postJson('/api/sync', ['cursor' => 99, 'changes' => ['rickshaws' => [$new, array_merge($rick, ['number' => 'HACK', 'updated_at' => now()->getTimestampMs() + 5000])]]], $this->h($token))->assertOk();
        $res->assertJsonPath('dropped.0.reason', 'forbidden')->assertJsonPath('overrides.rickshaws.0.number', 'R-1');
        $this->assertSame(1, \DB::table('rickshaws')->count());

        // manager can add entries
        $entry = ['id' => (string) Str::uuid(), 'updated_at' => now()->getTimestampMs(), 'rickshaw_id' => $rick['id'], 'entry_date' => '2026-10-25', 'deposit' => 500, 'garage_charge' => 50];
        $this->postJson('/api/sync', ['changes' => ['entries' => [$entry]]], $this->h($token))->assertOk();
        $this->assertSame(1, \DB::table('entries')->count());

        // manager cannot manage users and sees only own logs
        $this->getJson('/api/users', $this->h($token))->assertForbidden();
        $this->getJson('/api/logs', $this->h($token))->assertJsonCount(1, 'logs');
        $this->getJson('/api/logs', $this->h($admin))->assertJsonCount(2, 'logs');
    }

    public function test_validation_rejects_bad_rows_and_cross_garage_ids(): void
    {
        [$a] = $this->register('a_admin');
        [$b] = $this->register('b_admin');
        $r = $this->rickshaw();
        $this->postJson('/api/sync', ['changes' => ['rickshaws' => [$r]]], $this->h($a))->assertOk();

        // other garage cannot touch this id
        $evil = array_merge($r, ['number' => 'STOLEN', 'updated_at' => now()->getTimestampMs() + 9999]);
        $this->postJson('/api/sync', ['changes' => ['rickshaws' => [$evil]]], $this->h($b))->assertOk()->assertJsonCount(0, 'changes');
        $this->assertSame('R-1', \DB::table('rickshaws')->where('id', $r['id'])->value('number'));

        // invalid date / missing required are dropped
        $bad = ['id' => (string) Str::uuid(), 'updated_at' => 1, 'rickshaw_id' => $r['id'], 'entry_date' => '2026-13-45'];
        $res = $this->postJson('/api/sync', ['changes' => ['entries' => [$bad]]], $this->h($a))->assertOk();
        $res->assertJsonPath('dropped.0.table', 'entries');
        $this->assertSame(0, \DB::table('entries')->count());

        // data isolation on pull
        $this->postJson('/api/sync', ['cursor' => 0], $this->h($b))->assertJsonCount(0, 'changes');
    }

    public function test_soft_delete_and_blocking_and_expiry(): void
    {
        [$token, $uid] = $this->register();
        $r = $this->rickshaw();
        $this->postJson('/api/sync', ['changes' => ['rickshaws' => [$r]]], $this->h($token))->assertOk();
        $del = array_merge($r, ['deleted' => true, 'updated_at' => now()->getTimestampMs() + 10]);
        $res = $this->postJson('/api/sync', ['cursor' => 0, 'changes' => ['rickshaws' => [$del]]], $this->h($token))->assertOk();
        $res->assertJsonPath('changes.rickshaws.0.deleted', true);

        // expired: writes refused with 402, reads still fine
        Garage::first()->update(['subscription_ends_at' => now()->subDay()]);
        $this->postJson('/api/sync', ['changes' => ['rickshaws' => [$this->rickshaw('R-2')]]], $this->h($token))->assertStatus(402);
        $this->postJson('/api/sync', ['cursor' => 0], $this->h($token))->assertOk()->assertJsonPath('garage.status', 'expired');

        // blocked garage
        Garage::first()->update(['is_blocked' => true, 'blocked_reason' => 'unpaid']);
        $this->getJson('/api/me', $this->h($token))->assertStatus(403)->assertJsonPath('code', 'blocked');
        $this->postJson('/api/auth/login', ['login' => 'admin1', 'password' => 'secret12'])->assertStatus(403);
    }

    public function test_plan_limit_for_rickshaws(): void
    {
        [$token] = $this->register();
        $plan = \App\Models\Plan::create(['name' => 'Tiny', 'price' => 1, 'max_rickshaws' => 1, 'duration_days' => 30]);
        Garage::first()->update(['plan_id' => $plan->id, 'is_trial' => false, 'subscription_ends_at' => now()->addMonth()]);

        $res = $this->postJson('/api/sync', ['changes' => ['rickshaws' => [$this->rickshaw('A'), $this->rickshaw('B')]]], $this->h($token))->assertOk();
        $res->assertJsonPath('dropped.0.reason', 'plan_limit');
        $this->assertSame(1, \DB::table('rickshaws')->count());
    }

    public function test_admin_user_rules(): void
    {
        [$token, $uid] = $this->register();
        $this->putJson("/api/users/$uid", ['role' => 'manager'], $this->h($token))->assertStatus(422)->assertJsonPath('code', 'last_admin');
        $this->deleteJson("/api/users/$uid", [], $this->h($token))->assertStatus(422);
    }

    public function test_super_admin_panel_and_install_lock(): void
    {
        $this->register();
        config(['app.install_key' => 'k3y']);
        $lock = sys_get_temp_dir() . '/rm-test-installed-' . uniqid() . '.lock';
        config(['app.install_lock' => $lock]);
        $this->post('/install', ['install_key' => 'wrong', 'name' => 'S', 'login' => 'super', 'password' => 'superpass1'])->assertSessionHasErrors('install_key');
        $this->post('/install', ['install_key' => 'k3y', 'name' => 'S', 'login' => 'super', 'password' => 'superpass1'])->assertRedirect('/admin/login');
        $this->get('/install')->assertNotFound();
        @unlink($lock);

        $this->get('/admin')->assertRedirect('/admin/login');
        $this->post('/admin/login', ['login' => 'admin1', 'password' => 'secret12'])->assertSessionHasErrors();
        $this->post('/admin/login', ['login' => 'super', 'password' => 'superpass1'])->assertRedirect('/admin');

        foreach (['/admin', '/admin/garages', '/admin/users', '/admin/plans', '/admin/payments', '/admin/settings'] as $url) {
            $this->get($url)->assertOk();
        }
        $garage = Garage::first();
        $this->get("/admin/garages/{$garage->id}")->assertOk();

        $plan = \App\Models\Plan::first();
        $this->post("/admin/garages/{$garage->id}/payment", ['plan_id' => $plan->id, 'months' => 2, 'amount' => 600, 'method' => 'bkash'])->assertSessionHasNoErrors();
        $garage->refresh();
        $this->assertSame('active', $garage->status());
        $this->post("/admin/garages/{$garage->id}/block", ['reason' => 'x'])->assertSessionHasNoErrors();
        $this->assertSame('blocked', $garage->fresh()->status());

        // garage users cannot use the super panel
        $token = $this->postJson('/api/auth/login', ['login' => 'super', 'password' => 'superpass1'])->assertStatus(401);
    }
}
