<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Columns shared by every synced table. */
    private function base(Blueprint $t): void
    {
        $t->char('id', 36)->primary();
        $t->unsignedBigInteger('garage_id');
        $t->unsignedBigInteger('updated_at');            // client clock, ms
        $t->unsignedBigInteger('server_ts')->default(0); // per-garage sync sequence
        $t->boolean('deleted')->default(false);
        $t->unsignedBigInteger('updated_by')->nullable();
        $t->index(['garage_id', 'server_ts']);
    }

    public function up(): void
    {
        Schema::create('owners', function (Blueprint $t) {
            $this->base($t);
            $t->string('name');
            $t->string('phone', 32)->nullable();
            $t->string('address')->nullable();
            $t->text('note')->nullable();
            $t->boolean('is_self')->default(false);
        });

        Schema::create('drivers', function (Blueprint $t) {
            $this->base($t);
            $t->string('name');
            $t->string('phone', 32)->nullable();
            $t->string('nid', 32)->nullable();
            $t->string('address')->nullable();
            $t->text('note')->nullable();
            $t->boolean('is_active')->default(true);
        });

        Schema::create('rickshaws', function (Blueprint $t) {
            $this->base($t);
            $t->string('number');
            $t->char('owner_id', 36)->nullable();
            $t->decimal('default_rent', 12, 2)->nullable();
            $t->decimal('default_charge', 12, 2)->nullable();
            $t->string('status', 16)->default('active'); // active | maintenance | inactive
            $t->text('note')->nullable();
        });

        Schema::create('assignments', function (Blueprint $t) {
            $this->base($t);
            $t->char('rickshaw_id', 36);
            $t->char('driver_id', 36);
            $t->date('start_date');
            $t->date('end_date')->nullable();
            $t->decimal('expected_rent', 12, 2)->nullable();
            $t->text('note')->nullable();
        });

        Schema::create('entries', function (Blueprint $t) {
            $this->base($t);
            $t->char('rickshaw_id', 36);
            $t->char('driver_id', 36)->nullable();
            $t->char('owner_id', 36)->nullable();
            $t->date('entry_date');
            $t->decimal('deposit', 12, 2)->nullable();
            $t->decimal('expense', 12, 2)->nullable();
            $t->string('expense_type', 32)->nullable();
            $t->decimal('garage_charge', 12, 2)->nullable();
            $t->string('taken_time', 5)->nullable();
            $t->string('deposit_time', 5)->nullable();
            $t->text('note')->nullable();
            $t->index(['garage_id', 'entry_date']);
        });

        Schema::create('garage_expenses', function (Blueprint $t) {
            $this->base($t);
            $t->string('category', 32);
            $t->decimal('amount', 12, 2)->default(0);
            $t->date('expense_date');
            $t->text('note')->nullable();
            $t->index(['garage_id', 'expense_date']);
        });
    }

    public function down(): void
    {
        foreach (['garage_expenses', 'entries', 'assignments', 'rickshaws', 'drivers', 'owners'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
