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

        // Android app updates: the super admin uploads the new APK here and every installed app shows an "update" prompt.
        $app = $request->validate([
            'app_build' => 'nullable|integer|min:0',
            'app_min_build' => 'nullable|integer|min:0',
            'app_notes' => 'nullable|string|max:300',
            'apk' => 'nullable|file|max:102400|extensions:apk',
        ]);
        Setting::put('app_min_build', (string) ($app['app_min_build'] ?? 0));
        Setting::put('app_notes', (string) ($app['app_notes'] ?? ''));
        if ($request->hasFile('apk')) {
            $build = (int) ($app['app_build'] ?? 0);
            $dir = public_path('downloads');
            if (! is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            $name = 'rickshaw-manager-' . $build . '.apk';
            $request->file('apk')->move($dir, $name);
            Setting::put('app_apk_url', url('downloads/' . $name));
            Setting::put('app_build', (string) $build);
        } elseif (isset($app['app_build'])) {
            Setting::put('app_build', (string) $app['app_build']);
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
