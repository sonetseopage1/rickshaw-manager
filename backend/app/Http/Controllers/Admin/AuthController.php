<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function form()
    {
        if (Auth::check() && Auth::user()->isSuper()) {
            return redirect()->route('admin.dashboard');
        }
        return view('admin.login');
    }

    public function login(Request $request)
    {
        $data = $request->validate(['login' => 'required|string', 'password' => 'required|string']);

        $user = User::where('login', mb_strtolower(trim($data['login'])))->where('role', 'super')->first();
        if (! $user || $user->is_blocked || ! Hash::check($data['password'], $user->password)) {
            return back()->withErrors(['login' => 'Wrong login or password.'])->onlyInput('login');
        }

        Auth::login($user);
        $request->session()->regenerate();
        return redirect()->route('admin.dashboard');
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->route('admin.login');
    }
}
