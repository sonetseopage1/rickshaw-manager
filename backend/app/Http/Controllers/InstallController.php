<?php

namespace App\Http\Controllers;

use App\Models\User;
use Database\Seeders\PlanSeeder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

/**
 * First-time setup for hosting without SSH: creates the tables and the
 * super admin. Protected by INSTALL_KEY from .env and locked afterwards.
 */
class InstallController extends Controller
{
    private function flag(): string
    {
        return config('app.install_lock') ?: storage_path('app/installed.lock');
    }

    private function installed(): bool
    {
        if (File::exists($this->flag())) {
            return true;
        }
        try {
            return Schema::hasTable('users') && User::where('role', 'super')->exists();
        } catch (\Throwable) {
            return false;
        }
    }

    public function form()
    {
        abort_if($this->installed(), 404);
        return view('install', ['keyMissing' => ! config('app.install_key')]);
    }

    public function run(Request $request)
    {
        abort_if($this->installed(), 404);

        $data = $request->validate([
            'install_key' => 'required|string',
            'name' => 'required|string|max:100',
            'login' => 'required|string|min:4|max:100',
            'password' => 'required|string|min:8|max:100',
        ]);

        $key = (string) config('app.install_key');
        if ($key === '' || ! hash_equals($key, $data['install_key'])) {
            return back()->withErrors(['install_key' => 'Wrong install key.'])->withInput($request->except('password', 'install_key'));
        }

        try {
            Artisan::call('migrate', ['--force' => true]);
        } catch (\Throwable $e) {
            return back()->withErrors(['install_key' => 'Database error: ' . $e->getMessage()])->withInput($request->except('password', 'install_key'));
        }
        (new PlanSeeder)->run();

        User::create([
            'name' => $data['name'],
            'login' => mb_strtolower(trim($data['login'])),
            'password' => $data['password'],
            'role' => 'super',
        ]);

        File::put($this->flag(), now()->toDateTimeString());
        return redirect()->route('admin.login')->with('ok', 'Installed. You can log in now.');
    }
}
