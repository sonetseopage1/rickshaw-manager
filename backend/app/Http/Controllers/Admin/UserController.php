<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $q = trim((string) $request->query('q'));
        $users = User::with('garage')->where('role', '!=', 'super')->orderByDesc('id')
            ->when($q !== '', fn ($query) => $query->where(fn ($w) => $w->where('name', 'like', "%$q%")->orWhere('login', 'like', "%$q%")))
            ->limit(300)->get();

        return view('admin.users', compact('users', 'q'));
    }

    public function toggle(User $user)
    {
        abort_if($user->isSuper(), 403);
        $user->update(['is_blocked' => ! $user->is_blocked]);
        if ($user->is_blocked) {
            $user->tokens()->delete();
        }
        return back()->with('ok', $user->is_blocked ? 'User blocked.' : 'User unblocked.');
    }

    public function password(Request $request, User $user)
    {
        abort_if($user->isSuper(), 403);
        $data = $request->validate(['password' => 'required|string|min:6|max:100']);
        $user->update(['password' => $data['password']]);
        $user->tokens()->delete();
        return back()->with('ok', 'Password changed.');
    }
}
