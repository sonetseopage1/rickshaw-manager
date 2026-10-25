<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Garage;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public static function normalizeLogin(string $login): string
    {
        return Str::lower(trim($login));
    }

    /** Everything the app needs right after login or on start. */
    public static function session(User $user, ?string $token = null): array
    {
        $user->loadMissing('garage.plan');
        return array_filter([
            'token' => $token,
            'user' => $user->toApp(),
            'garage' => $user->garage?->toApp(),
            'settings' => [
                'announcement' => Setting::get('announcement'),
                'support_phone' => Setting::get('support_phone'),
                'currency' => Setting::get('currency'),
            ],
        ], fn ($v) => $v !== null);
    }

    public function register(Request $request): JsonResponse
    {
        if (Setting::get('registration_open') !== '1') {
            return response()->json(['code' => 'closed', 'message' => 'Registration is closed.'], 403);
        }

        $data = $request->validate([
            'name' => 'required|string|max:100',
            'login' => 'required|string|min:4|max:100',
            'password' => 'required|string|min:6|max:100',
            'garage_name' => 'required|string|max:120',
        ]);
        $login = self::normalizeLogin($data['login']);
        if (User::where('login', $login)->exists()) {
            return response()->json(['message' => 'Login already taken.', 'errors' => ['login' => ['taken']]], 422);
        }

        $user = DB::transaction(function () use ($data, $login) {
            $garage = Garage::create([
                'name' => $data['garage_name'],
                'is_trial' => true,
                'subscription_ends_at' => now()->addDays((int) Setting::get('trial_days'))->endOfDay(),
            ]);
            return User::create([
                'name' => $data['name'],
                'login' => $login,
                'password' => $data['password'],
                'role' => 'admin',
                'garage_id' => $garage->id,
            ]);
        });

        $user->update(['last_login_at' => now()]);
        return response()->json(self::session($user, $user->createToken('app')->plainTextToken), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'login' => 'required|string|max:100',
            'password' => 'required|string|max:100',
        ]);

        $user = User::where('login', self::normalizeLogin($data['login']))->first();
        if (! $user || $user->isSuper() || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['code' => 'bad_credentials', 'message' => 'Wrong login or password.'], 401);
        }
        if ($user->is_blocked) {
            return response()->json(['code' => 'blocked', 'message' => 'Your account has been blocked.'], 403);
        }
        if ($user->garage?->is_blocked) {
            return response()->json([
                'code' => 'blocked',
                'message' => $user->garage->blocked_reason ?: 'This garage has been blocked.',
            ], 403);
        }

        $user->update(['last_login_at' => now()]);
        return response()->json(self::session($user, $user->createToken('app')->plainTextToken));
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(self::session($request->user()));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();
        return response()->json(['ok' => true]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:100',
            'language' => 'sometimes|in:bn,en',
        ]);
        $request->user()->update($data);
        return response()->json(self::session($request->user()));
    }

    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:6|max:100',
        ]);
        $user = $request->user();
        if (! Hash::check($data['current_password'], $user->password)) {
            return response()->json(['code' => 'bad_credentials', 'message' => 'Current password is wrong.'], 422);
        }
        $user->update(['password' => $data['password']]);
        return response()->json(['ok' => true]);
    }
}
