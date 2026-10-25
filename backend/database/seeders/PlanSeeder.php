<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    /** Adds the starter plans only if none exist yet. */
    public function run(): void
    {
        if (Plan::query()->exists()) {
            return;
        }
        $plans = [
            ['name' => 'Starter', 'price' => 300, 'max_rickshaws' => 15, 'max_users' => 2, 'sort' => 1],
            ['name' => 'Standard', 'price' => 600, 'max_rickshaws' => 50, 'max_users' => 5, 'sort' => 2],
            ['name' => 'Premium', 'price' => 1200, 'max_rickshaws' => null, 'max_users' => null, 'sort' => 3],
        ];
        foreach ($plans as $p) {
            Plan::create($p + ['duration_days' => 30, 'is_active' => true]);
        }
    }
}
