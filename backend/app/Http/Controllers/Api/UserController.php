<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Managers / admins of one garage. Admin only. */
class UserController extends Controller
{
    private function garageUsers(Request $request)
    {
        abort_unless($request->user()->isAdmin(), 403);
        return User::query()->where('garage_id', $request->user()->garage_id);
    }

    public function index(Request $request): JsonResponse
    {
        $users = $this->garageUsers($request)->orderBy('id')->get()->map->toApp();
        return response()->json(['users' => $users]);
    }

    public function store(Request $request): JsonResponse
    {
        $q = $this->garageUsers($request);
        $data = $request->validate([
            'name' => 'required|string|max:100',
            'login' => 'required|string|min:4|max:100',
            'password' => 'required|string|min:6|max:100',
            'role' => 'required|in:admin,manager,owner',
            'owner_ref' => 'required_if:role,owner|nullable|string|size:36',
        ]);
        if ($data['role'] === 'owner') {
            $ok = DB::table('owners')->where('id', $data['owner_ref'])
                ->where('garage_id', $request->user()->garage_id)->where('deleted', 0)->exists();
            if (! $ok) {
                return response()->json(['message' => 'Unknown owner.', 'errors' => ['owner_ref' => ['unknown']]], 422);
            }
        }
        $login = AuthController::normalizeLogin($data['login']);
        if (User::where('login', $login)->exists()) {
            return response()->json(['message' => 'Login already taken.', 'errors' => ['login' => ['taken']]], 422);
        }

        // Rickshaw owners do not count against the plan's staff limit.
        $limit = $request->user()->garage->plan?->max_users;
        if ($data['role'] !== 'owner' && $limit !== null && (clone $q)->where('role', '!=', 'owner')->count() >= $limit) {
            return response()->json(['code' => 'plan_limit', 'message' => 'User limit of your plan reached.'], 403);
        }

        $user = User::create([
            'name' => $data['name'],
            'login' => $login,
            'password' => $data['password'],
            'role' => $data['role'],
            'owner_ref' => $data['role'] === 'owner' ? $data['owner_ref'] : null,
            'garage_id' => $request->user()->garage_id,
        ]);
        return response()->json(['user' => $user->toApp()], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = $this->garageUsers($request)->findOrFail($id);
        $data = $request->validate([
            'name' => 'sometimes|string|max:100',
            'password' => 'sometimes|nullable|string|min:6|max:100',
            'role' => 'sometimes|in:admin,manager,owner',
            'is_blocked' => 'sometimes|boolean',
        ]);
        if (empty($data['password'])) {
            unset($data['password']);
        }

        // An owner login stays an owner login (and staff never become owners).
        if (isset($data['role']) && ($data['role'] === 'owner') !== $user->isOwner()) {
            unset($data['role']);
        }

        $demoting = (isset($data['role']) && $data['role'] !== 'admin') || ! empty($data['is_blocked']);
        if ($user->isAdmin() && $demoting && ! $this->otherActiveAdmin($request, $user)) {
            return response()->json(['code' => 'last_admin', 'message' => 'At least one active admin is required.'], 422);
        }
        if ($user->id === $request->user()->id && ! empty($data['is_blocked'])) {
            return response()->json(['code' => 'self', 'message' => 'You cannot block yourself.'], 422);
        }

        $user->update($data);
        if (! empty($data['password']) || ! empty($data['is_blocked'])) {
            $user->tokens()->delete(); // force re-login
        }
        return response()->json(['user' => $user->fresh()->toApp()]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $this->garageUsers($request)->findOrFail($id);
        if ($user->id === $request->user()->id) {
            return response()->json(['code' => 'self', 'message' => 'You cannot delete yourself.'], 422);
        }
        if ($user->isAdmin() && ! $this->otherActiveAdmin($request, $user)) {
            return response()->json(['code' => 'last_admin', 'message' => 'At least one active admin is required.'], 422);
        }
        $user->tokens()->delete();
        $user->delete();
        return response()->json(['ok' => true]);
    }

    private function otherActiveAdmin(Request $request, User $except): bool
    {
        return User::query()
            ->where('garage_id', $request->user()->garage_id)
            ->where('role', 'admin')->where('is_blocked', false)
            ->where('id', '!=', $except->id)->exists();
    }
}
