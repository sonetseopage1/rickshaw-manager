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
        $entry = ['id' => (string) Str::uuid(), 'updated_at' => now()->getTimestampMs(), 'rickshaw_id' => $rick['id'], 'entry_date' => '2026-10-25', 'deposit' => 500, 'due' => 30, 'garage_charge' => 50];
        $this->postJson('/api/sync', ['changes' => ['entries' => [$entry]]], $this->h($token))->assertOk();
        $this->assertSame(1, \DB::table('entries')->count());
        $this->assertEquals(30, \DB::table('entries')->value('due'));

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

    public function test_rickshaw_owner_sees_only_own_data_read_only(): void
    {
        [$admin] = $this->register();
        $now = now()->getTimestampMs();
        $ownA = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'name' => 'Owner A'];
        $ownB = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'name' => 'Owner B'];
        $rA = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'number' => 'A-1', 'owner_id' => $ownA['id'], 'note' => 'secret note'];
        $rB = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'number' => 'B-1', 'owner_id' => $ownB['id']];
        $d1 = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'name' => 'Driver 1', 'nid' => '12345', 'phone' => '017'];
        $d2 = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'name' => 'Driver 2'];
        $asA = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'rickshaw_id' => $rA['id'], 'driver_id' => $d1['id'], 'start_date' => '2026-10-01'];
        $eA = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'rickshaw_id' => $rA['id'], 'owner_id' => $ownA['id'], 'entry_date' => '2026-10-02', 'deposit' => 400, 'garage_charge' => 50];
        $eB = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'rickshaw_id' => $rB['id'], 'owner_id' => $ownB['id'], 'entry_date' => '2026-10-02', 'deposit' => 999];
        $cost = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'category' => 'rent', 'amount' => 5000, 'expense_date' => '2026-10-02'];
        $this->postJson('/api/sync', ['changes' => [
            'owners' => [$ownA, $ownB], 'rickshaws' => [$rA, $rB], 'drivers' => [$d1, $d2],
            'assignments' => [$asA], 'entries' => [$eA, $eB], 'garage_expenses' => [$cost],
        ]], $this->h($admin))->assertOk();

        $this->postJson('/api/users', ['name' => 'Mr A', 'login' => 'ownera', 'password' => 'secret12', 'role' => 'owner', 'owner_ref' => $ownA['id']], $this->h($admin))
            ->assertCreated()->assertJsonPath('user.owner_ref', $ownA['id']);
        $this->postJson('/api/users', ['name' => 'X', 'login' => 'ownerx', 'password' => 'secret12', 'role' => 'owner', 'owner_ref' => (string) Str::uuid()], $this->h($admin))->assertStatus(422);

        $token = $this->postJson('/api/auth/login', ['login' => 'ownera', 'password' => 'secret12'])->assertOk()->json('token');
        $res = $this->postJson('/api/sync', ['cursor' => 0], $this->h($token))->assertOk();
        $c = $res->json('changes');

        $this->assertSame(['Owner A'], array_column($c['owners'], 'name'));
        $this->assertSame(['A-1'], array_column($c['rickshaws'], 'number'));
        $this->assertSame(['Driver 1'], array_column($c['drivers'], 'name'));
        $this->assertCount(1, $c['entries']);
        $this->assertEquals(400, $c["entries"][0]["deposit"]);
        $this->assertArrayNotHasKey('garage_expenses', $c);
        $this->assertSame('12345', $c['drivers'][0]['nid']);
        $this->assertSame('017', $c['drivers'][0]['phone']);
        $this->assertNull($c['rickshaws'][0]['note']);

        // read-only, no logs, no staff management
        $this->postJson('/api/sync', ['changes' => ['entries' => [array_merge($eA, ['deposit' => 1, 'updated_at' => $now + 5000])]]], $this->h($token))->assertStatus(403);
        $this->assertEquals(400, \DB::table('entries')->where('id', $eA['id'])->value('deposit'));
        $this->getJson('/api/logs', $this->h($token))->assertForbidden();
        $this->getJson('/api/users', $this->h($token))->assertForbidden();

        // a driver newly assigned to Owner A's rickshaw reaches the owner even though the driver row is old
        $asB = ['id' => (string) Str::uuid(), 'updated_at' => $now + 10, 'rickshaw_id' => $rA['id'], 'driver_id' => $d2['id'], 'start_date' => '2026-10-20'];
        $this->postJson('/api/sync', ['changes' => ['assignments' => [$asB]]], $this->h($admin))->assertOk();
        $res2 = $this->postJson('/api/sync', ['cursor' => $res->json('cursor')], $this->h($token))->assertOk();
        $this->assertContains('Driver 2', array_column($res2->json('changes.drivers'), 'name'));
    }

    public function test_profile_pictures_driver_photos_and_nid_scans(): void
    {
        \Illuminate\Support\Facades\Storage::fake('local');
        [$admin] = $this->register();
        [$other] = $this->register('other_admin');
        $img = fn () => \Illuminate\Http\UploadedFile::fake()->image('p.jpg', 120, 120)->size(40);
        $now = now()->getTimestampMs();

        // avatar: upload, then attach to the profile
        $avatar = (string) Str::uuid();
        $this->post('/api/files', ['id' => $avatar, 'kind' => 'avatar', 'file' => $img()], $this->h($admin) + ['Accept' => 'application/json'])->assertCreated();
        $this->putJson('/api/me', ['avatar_id' => (string) Str::uuid()], $this->h($admin))->assertStatus(422);
        $this->putJson('/api/me', ['avatar_id' => $avatar], $this->h($admin))->assertOk()->assertJsonPath('user.avatar_id', $avatar);
        $this->get("/api/files/$avatar", $this->h($admin))->assertOk();
        $this->get("/api/files/$avatar", $this->h($other))->assertNotFound(); // other garage

        // driver with photo + NID images (uploaded by an admin, then read by a manager)
        $photo = (string) Str::uuid(); $front = (string) Str::uuid(); $back = (string) Str::uuid();
        foreach ([[$photo, 'driver_photo'], [$front, 'nid_front'], [$back, 'nid_back']] as [$fid, $kind]) {
            $this->post('/api/files', ['id' => $fid, 'kind' => $kind, 'file' => $img()], $this->h($admin) + ['Accept' => 'application/json'])->assertCreated();
        }
        $driver = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'name' => 'Photo Driver', 'photo_id' => $photo, 'nid_front_id' => $front, 'nid_back_id' => $back];
        $this->postJson('/api/sync', ['changes' => ['drivers' => [$driver]]], $this->h($admin))->assertOk()
            ->assertJsonPath('changes.drivers.0.nid_front_id', $front);

        $this->postJson('/api/users', ['name' => 'Mgr', 'login' => 'mgrphoto', 'password' => 'secret12', 'role' => 'manager'], $this->h($admin))->assertCreated();
        $mgr = $this->postJson('/api/auth/login', ['login' => 'mgrphoto', 'password' => 'secret12'])->json('token');
        $this->get("/api/files/$front", $this->h($mgr))->assertOk();
        $newFront = (string) Str::uuid();
        $this->post('/api/files', ['id' => $newFront, 'kind' => 'nid_front', 'file' => $img()], $this->h($mgr) + ['Accept' => 'application/json'])->assertCreated();

        // a rickshaw owner sees the photo but never the NID scans
        $own = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'name' => 'Owner P'];
        $rick = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'number' => 'P-1', 'owner_id' => $own['id']];
        $asg = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'rickshaw_id' => $rick['id'], 'driver_id' => $driver['id'], 'start_date' => '2026-10-01'];
        $this->postJson('/api/sync', ['changes' => ['owners' => [$own], 'rickshaws' => [$rick], 'assignments' => [$asg]]], $this->h($admin))->assertOk();
        $this->postJson('/api/users', ['name' => 'Owner P', 'login' => 'ownerphoto', 'password' => 'secret12', 'role' => 'owner', 'owner_ref' => $own['id']], $this->h($admin))->assertCreated();
        $ot = $this->postJson('/api/auth/login', ['login' => 'ownerphoto', 'password' => 'secret12'])->json('token');
        $d = $this->postJson('/api/sync', ['cursor' => 0], $this->h($ot))->json('changes.drivers.0');
        $this->assertSame($photo, $d['photo_id']);
        $this->assertSame($front, $d['nid_front_id']);
        $this->assertNull($d['address']);
        $this->get("/api/files/$photo", $this->h($ot))->assertOk();
        $this->get("/api/files/$front", $this->h($ot))->assertOk();
        $this->post('/api/files', ['id' => (string) Str::uuid(), 'kind' => 'nid_front', 'file' => $img()], $this->h($ot) + ['Accept' => 'application/json'])->assertForbidden();
        $this->post('/api/files', ['id' => (string) Str::uuid(), 'kind' => 'driver_photo', 'file' => $img()], $this->h($ot) + ['Accept' => 'application/json'])->assertForbidden();
        $this->post('/api/files', ['id' => (string) Str::uuid(), 'kind' => 'avatar', 'file' => $img()], $this->h($ot) + ['Accept' => 'application/json'])->assertCreated();

        // only images are accepted
        $txt = \Illuminate\Http\UploadedFile::fake()->create('x.txt', 5, 'text/plain');
        $this->post('/api/files', ['id' => (string) Str::uuid(), 'kind' => 'avatar', 'file' => $txt], $this->h($admin) + ['Accept' => 'application/json'])->assertStatus(422);
    }

    public function test_partner_sees_everything_but_changes_nothing(): void
    {
        \Illuminate\Support\Facades\Storage::fake('local');
        [$admin] = $this->register();
        $now = now()->getTimestampMs();
        $img = fn () => \Illuminate\Http\UploadedFile::fake()->image('p.jpg', 100, 100)->size(30);
        $own = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'name' => 'Partner Self', 'is_self' => true];
        $rick = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'number' => 'P-1', 'owner_id' => $own['id']];
        $front = (string) Str::uuid();
        $drv = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'name' => 'Drv', 'nid' => '555', 'address' => 'street', 'nid_front_id' => $front];
        $cost = ['id' => (string) Str::uuid(), 'updated_at' => $now, 'category' => 'rent', 'amount' => 900, 'expense_date' => '2026-10-02'];
        $this->post('/api/files', ['id' => $front, 'kind' => 'nid_front', 'file' => $img()], $this->h($admin) + ['Accept' => 'application/json'])->assertCreated();
        $this->postJson('/api/sync', ['changes' => ['owners' => [$own], 'rickshaws' => [$rick], 'drivers' => [$drv], 'garage_expenses' => [$cost]]], $this->h($admin))->assertOk();

        // the partner may point to an owner record (their own rickshaws); it is optional
        $this->postJson('/api/users', ['name' => 'Partner', 'login' => 'partner1', 'password' => 'secret12', 'role' => 'partner', 'owner_ref' => $own['id']], $this->h($admin))
            ->assertCreated()->assertJsonPath('user.role', 'partner')->assertJsonPath('user.owner_ref', $own['id']);
        $this->postJson('/api/users', ['name' => 'Partner Two', 'login' => 'partner2', 'password' => 'secret12', 'role' => 'partner'], $this->h($admin))
            ->assertCreated()->assertJsonPath('user.owner_ref', null);
        $this->postJson('/api/users', ['name' => 'Bad', 'login' => 'partner3', 'password' => 'secret12', 'role' => 'partner', 'owner_ref' => (string) Str::uuid()], $this->h($admin))->assertStatus(422);

        $pt = $this->postJson('/api/auth/login', ['login' => 'partner1', 'password' => 'secret12'])->assertOk()->json('token');

        // sees all of it: other owners, garage costs, NID
        $c = $this->postJson('/api/sync', ['cursor' => 0], $this->h($pt))->assertOk()->json('changes');
        $this->assertSame('street', $c['drivers'][0]['address']);
        $this->assertSame($front, $c['drivers'][0]['nid_front_id']);
        $this->assertSame(900.0, (float) $c['garage_expenses'][0]['amount']);
        $this->get("/api/files/$front", $this->h($pt))->assertOk();

        // but cannot write anything
        $this->postJson('/api/sync', ['changes' => ['rickshaws' => [array_merge($rick, ['number' => 'HACK', 'updated_at' => $now + 9000])]]], $this->h($pt))->assertStatus(403);
        $this->assertSame('P-1', \DB::table('rickshaws')->where('id', $rick['id'])->value('number'));
        $this->post('/api/files', ['id' => (string) Str::uuid(), 'kind' => 'nid_front', 'file' => $img()], $this->h($pt) + ['Accept' => 'application/json'])->assertForbidden();
        $this->post('/api/files', ['id' => (string) Str::uuid(), 'kind' => 'avatar', 'file' => $img()], $this->h($pt) + ['Accept' => 'application/json'])->assertCreated();
        $this->putJson('/api/garage', ['name' => 'Renamed'], $this->h($pt))->assertForbidden();
        $this->postJson('/api/users', ['name' => 'X', 'login' => 'sneaky', 'password' => 'secret12', 'role' => 'admin'], $this->h($pt))->assertForbidden();
        $this->putJson('/api/users/1', ['role' => 'manager'], $this->h($pt))->assertForbidden();

        // may look at the staff list and the whole activity log
        $this->getJson('/api/users', $this->h($pt))->assertOk()->assertJsonCount(3, 'users');
        $this->getJson('/api/logs', $this->h($pt))->assertOk();
        $this->assertGreaterThan(1, count($this->getJson('/api/logs', $this->h($pt))->json('logs')));

        // may change their own password
        $this->putJson('/api/me/password', ['current_password' => 'secret12', 'password' => 'newsecret1'], $this->h($pt))->assertOk();
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
        // app update: super admin uploads an APK and the app settings expose it
        $apk = \Illuminate\Http\UploadedFile::fake()->create('app-debug.apk', 50);
        $this->put('/admin/settings', [
            'trial_days' => 14, 'currency' => '৳', 'registration_open' => 1,
            'app_build' => 7, 'app_min_build' => 3, 'app_notes' => 'New register', 'apk' => $apk,
        ])->assertSessionHasNoErrors();
        $token = $this->postJson('/api/auth/login', ['login' => 'admin1', 'password' => 'secret12'])->assertOk();
        $token->assertJsonPath('settings.app_build', 7)->assertJsonPath('settings.app_min_build', 3);
        $this->assertStringContainsString('rickshaw-manager-7.apk', $token->json('settings.app_apk_url'));
        $this->assertFileExists(public_path('downloads/rickshaw-manager-7.apk'));
        @unlink(public_path('downloads/rickshaw-manager-7.apk'));

        $this->post("/admin/garages/{$garage->id}/block", ['reason' => 'x'])->assertSessionHasNoErrors();
        $this->assertSame('blocked', $garage->fresh()->status());

        // garage users cannot use the super panel
        $token = $this->postJson('/api/auth/login', ['login' => 'super', 'password' => 'superpass1'])->assertStatus(401);
    }
}
