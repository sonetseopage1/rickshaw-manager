<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GarageController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), 403);

        $data = $request->validate([
            'name' => 'required|string|max:120',
            'phone' => 'nullable|string|max:32',
            'address' => 'nullable|string|max:255',
        ]);
        $garage = $request->user()->garage;
        $garage->update($data);

        return response()->json(['garage' => $garage->fresh('plan')->toApp()]);
    }

    /** Admins see everything; managers only their own actions. */
    public function logs(Request $request): JsonResponse
    {
        $user = $request->user();
        $limit = min(max((int) $request->query('limit', 50), 1), 100);

        $q = ActivityLog::query()->where('garage_id', $user->garage_id)->orderByDesc('id');
        if (! $user->isAdmin()) {
            $q->where('user_id', $user->id);
        }
        if ($before = (int) $request->query('before', 0)) {
            $q->where('id', '<', $before);
        }
        if ($entity = $request->query('entity')) {
            $q->where('entity', $entity);
        }

        $rows = $q->limit($limit)->get()->map(fn ($l) => [
            'id' => $l->id,
            'user_name' => $l->user_name,
            'action' => $l->action,
            'entity' => $l->entity,
            'entity_id' => $l->entity_id,
            'label' => $l->label,
            'changes' => $l->changes,
            'at' => $l->created_at->toIso8601String(),
        ]);

        return response()->json(['logs' => $rows, 'more' => $rows->count() === $limit]);
    }
}
