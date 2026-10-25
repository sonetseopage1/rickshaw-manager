<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\InstallController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/app/');

Route::get('/install', [InstallController::class, 'form']);
Route::post('/install', [InstallController::class, 'run'])->middleware('throttle:10,1');

Route::prefix('admin')->name('admin.')->group(function () {
    Route::get('/login', [Admin\AuthController::class, 'form'])->name('login');
    Route::post('/login', [Admin\AuthController::class, 'login'])->middleware('throttle:10,1');

    Route::middleware(['auth', 'super'])->group(function () {
        Route::post('/logout', [Admin\AuthController::class, 'logout'])->name('logout');
        Route::get('/', [Admin\DashboardController::class, 'index'])->name('dashboard');

        Route::get('/garages', [Admin\GarageController::class, 'index'])->name('garages');
        Route::get('/garages/{garage}', [Admin\GarageController::class, 'show'])->name('garages.show');
        Route::put('/garages/{garage}', [Admin\GarageController::class, 'update'])->name('garages.update');
        Route::post('/garages/{garage}/block', [Admin\GarageController::class, 'block'])->name('garages.block');
        Route::post('/garages/{garage}/unblock', [Admin\GarageController::class, 'unblock'])->name('garages.unblock');
        Route::post('/garages/{garage}/payment', [Admin\GarageController::class, 'payment'])->name('garages.payment');
        Route::post('/garages/{garage}/extend', [Admin\GarageController::class, 'extend'])->name('garages.extend');
        Route::delete('/garages/{garage}', [Admin\GarageController::class, 'destroy'])->name('garages.destroy');

        Route::get('/users', [Admin\UserController::class, 'index'])->name('users');
        Route::post('/users/{user}/toggle', [Admin\UserController::class, 'toggle'])->name('users.toggle');
        Route::post('/users/{user}/password', [Admin\UserController::class, 'password'])->name('users.password');

        Route::get('/plans', [Admin\PlanController::class, 'index'])->name('plans');
        Route::post('/plans', [Admin\PlanController::class, 'store'])->name('plans.store');
        Route::put('/plans/{plan}', [Admin\PlanController::class, 'update'])->name('plans.update');
        Route::delete('/plans/{plan}', [Admin\PlanController::class, 'destroy'])->name('plans.destroy');

        Route::get('/payments', [Admin\PaymentController::class, 'index'])->name('payments');

        Route::get('/settings', [Admin\SettingsController::class, 'form'])->name('settings');
        Route::put('/settings', [Admin\SettingsController::class, 'update'])->name('settings.update');
        Route::post('/system/migrate', [Admin\SettingsController::class, 'migrate'])->name('system.migrate');
        Route::post('/system/clear', [Admin\SettingsController::class, 'clear'])->name('system.clear');
    });
});
