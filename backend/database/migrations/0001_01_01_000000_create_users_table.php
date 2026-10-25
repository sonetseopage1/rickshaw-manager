<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->decimal('price', 10, 2)->default(0);
            $table->unsignedInteger('duration_days')->default(30);
            $table->unsignedInteger('max_rickshaws')->nullable();
            $table->unsignedInteger('max_users')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('garages', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->foreignId('plan_id')->nullable()->constrained('plans')->nullOnDelete();
            $table->boolean('is_trial')->default(true);
            $table->dateTime('subscription_ends_at')->nullable();
            $table->boolean('is_blocked')->default(false);
            $table->string('blocked_reason')->nullable();
            $table->unsignedBigInteger('sync_seq')->default(0);
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('login')->unique();
            $table->string('password');
            $table->string('role', 16)->default('admin'); // super | admin | manager
            $table->foreignId('garage_id')->nullable()->constrained('garages')->cascadeOnDelete();
            $table->boolean('is_blocked')->default(false);
            $table->string('language', 4)->default('bn');
            $table->dateTime('last_login_at')->nullable();
            $table->timestamps();
        });

        Schema::create('subscription_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('garage_id')->constrained('garages')->cascadeOnDelete();
            $table->foreignId('plan_id')->nullable()->constrained('plans')->nullOnDelete();
            $table->decimal('amount', 10, 2)->default(0);
            $table->string('method', 32)->nullable(); // bkash, nagad, cash...
            $table->string('reference')->nullable();
            $table->string('note')->nullable();
            $table->dateTime('paid_at');
            $table->dateTime('period_start')->nullable();
            $table->dateTime('period_end')->nullable();
            $table->unsignedBigInteger('recorded_by')->nullable();
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->text('value')->nullable();
        });

        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('garage_id')->constrained('garages')->cascadeOnDelete();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('user_name')->nullable();
            $table->string('action', 16); // create | update | delete
            $table->string('entity', 32);
            $table->char('entity_id', 36)->nullable();
            $table->string('label')->nullable();
            $table->json('changes')->nullable();
            $table->dateTime('created_at');
            $table->index(['garage_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('settings');
        Schema::dropIfExists('subscription_payments');
        Schema::dropIfExists('users');
        Schema::dropIfExists('garages');
        Schema::dropIfExists('plans');
    }
};
