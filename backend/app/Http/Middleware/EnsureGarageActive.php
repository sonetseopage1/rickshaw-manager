<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Only garage staff whose account and garage are not blocked may use the API. */
class EnsureGarageActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || $user->isSuper() || ! $user->garage_id) {
            return response()->json(['code' => 'forbidden', 'message' => 'Not allowed.'], 403);
        }
        if ($user->is_blocked) {
            return response()->json(['code' => 'blocked', 'message' => 'Your account has been blocked.'], 403);
        }
        $garage = $user->garage;
        if (! $garage || $garage->is_blocked) {
            return response()->json([
                'code' => 'blocked',
                'message' => $garage?->blocked_reason ?: 'This garage has been blocked.',
            ], 403);
        }

        return $next($request);
    }
}
