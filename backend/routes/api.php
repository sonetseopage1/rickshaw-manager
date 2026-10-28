<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\FileController;
use App\Http\Controllers\Api\GarageController;
use App\Http\Controllers\Api\SyncController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/ping', fn () => response()->json(['ok' => true, 'time' => now()->toIso8601String()]));

Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:15,1');

Route::middleware(['auth:sanctum', 'garage.active'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::put('/me', [AuthController::class, 'updateProfile']);
    Route::put('/me/password', [AuthController::class, 'changePassword']);

    Route::post('/sync', [SyncController::class, 'sync']);

    Route::post('/files', [FileController::class, 'store'])->middleware('throttle:240,1');
    Route::get('/files/{id}', [FileController::class, 'show'])->middleware('throttle:600,1');

    Route::put('/garage', [GarageController::class, 'update']);
    Route::get('/logs', [GarageController::class, 'logs']);

    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);
});
