<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SyncController extends Controller
{
    public function sync(Request $request, SyncService $sync): JsonResponse
    {
        $request->validate([
            'cursor' => 'nullable|integer|min:0',
            'changes' => 'nullable|array',
        ]);

        $user = $request->user();
        $garage = $user->garage()->with('plan')->first();
        $changes = (array) $request->input('changes', []);

        $pushed = 0;
        foreach ($changes as $rows) {
            $pushed += is_array($rows) ? count($rows) : 0;
        }
        if ($pushed > SyncService::MAX_PUSH_ROWS) {
            return response()->json(['code' => 'too_many', 'message' => 'Too many rows in one request.'], 413);
        }

        $result = ['overrides' => [], 'dropped' => []];
        if ($pushed > 0) {
            if ($garage->status() === 'expired') {
                return response()->json([
                    'code' => 'expired',
                    'message' => 'Subscription expired. Data is kept on the phone and will sync after renewal.',
                    'garage' => $garage->toApp(),
                ], 402);
            }
            $result = $sync->push($user, $garage, $changes);
        }

        $pull = $sync->pull($garage, (int) $request->input('cursor', 0));

        return response()->json([
            'cursor' => $pull['cursor'],
            'more' => $pull['more'],
            'changes' => (object) $pull['changes'],
            'overrides' => (object) $result['overrides'],
            'dropped' => $result['dropped'],
            'garage' => $garage->fresh('plan')->toApp(),
        ]);
    }
}
