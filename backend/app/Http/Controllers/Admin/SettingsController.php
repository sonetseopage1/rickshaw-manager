<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

class SettingsController extends Controller
{
    public function form()
    {
        return view('admin.settings', [
            'values' => collect(array_keys(Setting::DEFAULTS))->mapWithKeys(fn ($k) => [$k => Setting::get($k)])->all(),
            'system' => [
                'php' => PHP_VERSION,
                'laravel' => app()->version(),
                'db' => DB::connection()->getDriverName(),
                'migrations' => DB::table('migrations')->count(),
            ],
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'trial_days' => 'required|integer|min:0|max:365',
            'announcement' => 'nullable|string|max:500',
            'support_phone' => 'nullable|string|max:60',
            'currency' => 'required|string|max:5',
        ]);
        foreach ($data as $k => $v) {
            Setting::put($k, (string) $v);
        }
        Setting::put('registration_open', $request->boolean('registration_open') ? '1' : '0');
        return back()->with('ok', 'Settings saved.');
    }

    /** For shared hosting without SSH: run new migrations after uploading an update. */
    public function migrate()
    {
        Artisan::call('migrate', ['--force' => true]);
        return back()->with('ok', trim(Artisan::output()) ?: 'Done.');
    }

    public function clear()
    {
        Artisan::call('optimize:clear');
        return back()->with('ok', 'Caches cleared.');
    }
}
