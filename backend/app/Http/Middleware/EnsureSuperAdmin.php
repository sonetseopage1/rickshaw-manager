<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSuperAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return redirect()->route('admin.login');
        }
        if (! $user->isSuper() || $user->is_blocked) {
            auth()->logout();
            return redirect()->route('admin.login')->withErrors(['login' => 'Not allowed.']);
        }

        return $next($request);
    }
}
