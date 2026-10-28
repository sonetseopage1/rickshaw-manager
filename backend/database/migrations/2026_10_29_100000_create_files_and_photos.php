<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('files', function (Blueprint $table) {
            $table->char('id', 36)->primary();          // generated on the phone, so uploads can be retried safely
            $table->unsignedBigInteger('garage_id')->index();
            $table->string('kind', 24);                  // avatar | driver_photo | nid_front | nid_back
            $table->string('mime', 64);
            $table->unsignedInteger('size');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->char('avatar_id', 36)->nullable()->after('owner_ref');
        });

        Schema::table('drivers', function (Blueprint $table) {
            $table->char('photo_id', 36)->nullable();
            $table->char('nid_front_id', 36)->nullable();
            $table->char('nid_back_id', 36)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('drivers', fn (Blueprint $t) => $t->dropColumn(['photo_id', 'nid_front_id', 'nid_back_id']));
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn('avatar_id'));
        Schema::dropIfExists('files');
    }
};
