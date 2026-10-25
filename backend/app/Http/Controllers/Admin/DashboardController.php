<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Garage;
use App\Models\SubscriptionPayment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index()
    {
        $garages = Garage::with('plan')->get();
        $byStatus = $garages->groupBy(fn (Garage $g) => $g->status())->map->count();

        $since = now()->subMonths(11)->startOfMonth();
        $months = collect(range(0, 11))->map(fn ($i) => $since->copy()->addMonths($i)->format('Y-m'));

        $revenue = SubscriptionPayment::where('paid_at', '>=', $since)->get()
            ->groupBy(fn ($p) => $p->paid_at->format('Y-m'))->map->sum('amount');
        $signups = $garages->where('created_at', '>=', $since)
            ->groupBy(fn ($g) => $g->created_at->format('Y-m'))->map->count();

        $from = now()->subDays(29)->toDateString();
        $activity = DB::table('entries')->where('deleted', 0)->where('entry_date', '>=', $from)
            ->selectRaw('entry_date as d, count(*) as n, sum(deposit) as dep')->groupBy('entry_date')->orderBy('entry_date')->get();

        return view('admin.dashboard', [
            'stats' => [
                'garages' => $garages->count(),
                'active' => $byStatus['active'] ?? 0,
                'trial' => $byStatus['trial'] ?? 0,
                'expired' => $byStatus['expired'] ?? 0,
                'blocked' => $byStatus['blocked'] ?? 0,
                'users' => User::where('role', '!=', 'super')->count(),
                'rickshaws' => DB::table('rickshaws')->where('deleted', 0)->count(),
                'entries30' => (int) $activity->sum('n'),
                'revenue_total' => SubscriptionPayment::sum('amount'),
                'revenue_month' => SubscriptionPayment::where('paid_at', '>=', now()->startOfMonth())->sum('amount'),
            ],
            'revenueChart' => $months->map(fn ($m) => ['label' => $m, 'value' => (float) ($revenue[$m] ?? 0)])->values(),
            'signupChart' => $months->map(fn ($m) => ['label' => $m, 'value' => (int) ($signups[$m] ?? 0)])->values(),
            'activityChart' => $activity->map(fn ($r) => ['label' => substr($r->d, 5), 'value' => (int) $r->n])->values(),
            'expiring' => $garages->filter(fn (Garage $g) => in_array($g->status(), ['trial', 'active']) && $g->daysLeft() !== null && $g->daysLeft() <= 7)
                ->sortBy('subscription_ends_at')->values(),
            'recent' => Garage::with('users')->latest()->limit(8)->get(),
        ]);
    }
}
