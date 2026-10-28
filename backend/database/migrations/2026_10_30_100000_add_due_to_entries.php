<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('entries', function (Blueprint $table) {
            // Money the driver still owes for that day. Entered by hand, rarely used.
            $table->decimal('due', 12, 2)->nullable()->after('deposit');
        });
    }

    public function down(): void
    {
        Schema::table('entries', fn (Blueprint $table) => $table->dropColumn('due'));
    }
};
