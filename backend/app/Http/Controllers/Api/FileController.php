<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StoredFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Profile pictures, driver photos and NID scans. Files live on the private disk
 * and are only served to signed-in members of the same garage.
 */
class FileController extends Controller
{
    private const KINDS = ['avatar', 'driver_photo', 'nid_front', 'nid_back'];

    /** Who may upload / download which kind. Owners can only view driver pictures. */
    private function allowed(Request $request, string $kind): bool
    {
        $user = $request->user();
        if ($kind === 'avatar') {
            return true;
        }
        if ($user->isPartner()) {
            return $request->isMethod('get'); // view-only, like an admin who cannot change anything
        }
        if ($user->isOwner()) {
            // An owner may look at the photo and NID scans of the drivers on their rickshaws, never upload them.
            return in_array($kind, ['driver_photo', 'nid_front', 'nid_back'], true) && $request->isMethod('get');
        }
        return true; // admin and manager
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id' => ['required', 'string', 'size:36', 'regex:/^[0-9a-fA-F-]{36}$/'],
            'kind' => 'required|in:' . implode(',', self::KINDS),
            'file' => 'required|file|image|max:4096',
        ]);
        $user = $request->user();
        $id = strtolower($data['id']);

        if (! $this->allowed($request, $data['kind'])) {
            return response()->json(['code' => 'forbidden', 'message' => 'Not allowed.'], 403);
        }
        if ($user->garage->status() === 'expired') {
            return response()->json(['code' => 'expired', 'message' => 'Subscription expired.'], 402);
        }

        $existing = StoredFile::find($id);
        if ($existing && $existing->garage_id !== $user->garage_id) {
            return response()->json(['code' => 'forbidden', 'message' => 'Not allowed.'], 403);
        }

        $file = $request->file('file');
        $mime = $file->getMimeType() ?: 'image/jpeg';
        $size = $file->getSize();
        Storage::disk('local')->putFileAs(StoredFile::dir($user->garage_id), $file, $id);
        StoredFile::updateOrCreate(['id' => $id], [
            'garage_id' => $user->garage_id,
            'kind' => $data['kind'],
            'mime' => $mime,
            'size' => $size,
            'created_by' => $user->id,
        ]);

        return response()->json(['ok' => true, 'id' => $id], 201);
    }

    public function show(Request $request, string $id): StreamedResponse|JsonResponse
    {
        $row = StoredFile::where('id', strtolower($id))->where('garage_id', $request->user()->garage_id)->first();
        if (! $row || ! Storage::disk('local')->exists($row->path())) {
            return response()->json(['code' => 'not_found', 'message' => 'File not found.'], 404);
        }
        if (! $this->allowed($request, $row->kind)) {
            return response()->json(['code' => 'forbidden', 'message' => 'Not allowed.'], 403);
        }

        return Storage::disk('local')->response($row->path(), null, [
            'Content-Type' => $row->mime,
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }
}
