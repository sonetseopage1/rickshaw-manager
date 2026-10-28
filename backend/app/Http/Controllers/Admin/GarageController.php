<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Garage;
use App\Models\Plan;
use App\Models\SubscriptionPayment;
use App\Services\SyncSchema;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GarageController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->query('status');
        $q = trim((string) $request->query('q'));

        $garages = Garage::with('plan')->withCount('users')->orderByDesc('id')
            ->when($q !== '', fn ($query) => $query->where(function ($w) use ($q) {
                $w->where('name', 'like', "%$q%")->orWhere('phone', 'like', "%$q%")
                    ->orWhereHas('users', fn ($u) => $u->where('login', 'like', "%$q%")->orWhere('name', 'like', "%$q%"));
            }))
            ->get();
        if ($status) {
            $garages = $garages->filter(fn (Garage $g) => $g->status() === $status)->values();
        }

        $counts = DB::table('rickshaws')->where('deleted', 0)->selectRaw('garage_id, count(*) n')->groupBy('garage_id')->pluck('n', 'garage_id');

        return view('admin.garages', compact('garages', 'counts', 'status', 'q'));
    }

    public function show(Garage $garage)
    {
        $garage->load('plan', 'users');
        $count = fn (string $t) => DB::table($t)->where('garage_id', $garage->id)->where('deleted', 0)->count();

        $from = now()->subDays(29)->toDateString();
        $daily = DB::table('entries')->where('garage_id', $garage->id)->where('deleted', 0)->where('entry_date', '>=', $from)
            ->selectRaw('entry_date as d, sum(deposit) as dep, sum(expense) as exp, sum(garage_charge) as chg, count(*) as n')
            ->groupBy('entry_date')->orderBy('entry_date')->get();

        return view('admin.garage', [
            'garage' => $garage,
            'plans' => Plan::orderBy('sort')->orderBy('id')->get(),
            'usage' => [
                'rickshaws' => $count('rickshaws'), 'drivers' => $count('drivers'), 'owners' => $count('owners'),
                'entries' => $count('entries'),
                'deposit30' => (float) $daily->sum('dep'), 'expense30' => (float) $daily->sum('exp'), 'charge30' => (float) $daily->sum('chg'),
                'utility30' => (float) DB::table('garage_expenses')->where('garage_id', $garage->id)->where('deleted', 0)->where('expense_date', '>=', $from)->sum('amount'),
            ],
            'chart' => $daily->map(fn ($r) => ['label' => substr($r->d, 5), 'value' => (float) $r->dep])->values(),
            'payments' => $garage->payments()->with('plan')->orderByDesc('paid_at')->get(),
            'logs' => ActivityLog::where('garage_id', $garage->id)->orderByDesc('id')->limit(40)->get(),
        ]);
    }

    public function update(Request $request, Garage $garage)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'phone' => 'nullable|string|max:32',
            'address' => 'nullable|string|max:255',
            'plan_id' => 'nullable|exists:plans,id',
            'subscription_ends_at' => 'nullable|date',
        ]);
        $garage->update($data);
        return back()->with('ok', 'Saved.');
    }

    public function block(Request $request, Garage $garage)
    {
        $garage->update(['is_blocked' => true, 'blocked_reason' => $request->input('reason') ?: null]);
        return back()->with('ok', 'Garage blocked.');
    }

    public function unblock(Garage $garage)
    {
        $garage->update(['is_blocked' => false, 'blocked_reason' => null]);
        return back()->with('ok', 'Garage unblocked.');
    }

    /** Record a manual payment (bKash, cash...) and extend the subscription. */
    public function payment(Request $request, Garage $garage)
    {
        $data = $request->validate([
            'plan_id' => 'required|exists:plans,id',
            'months' => 'required|integer|min:1|max:36',
            'amount' => 'required|numeric|min:0',
            'method' => 'nullable|string|max:32',
            'reference' => 'nullable|string|max:255',
            'note' => 'nullable|string|max:255',
        ]);
        $plan = Plan::findOrFail($data['plan_id']);

        $start = $this->base($garage);
        $end = $start->copy()->addDays($plan->duration_days * (int) $data['months'])->endOfDay();

        DB::transaction(function () use ($garage, $plan, $data, $start, $end, $request) {
            SubscriptionPayment::create([
                'garage_id' => $garage->id, 'plan_id' => $plan->id, 'amount' => $data['amount'],
                'method' => $data['method'] ?? null, 'reference' => $data['reference'] ?? null, 'note' => $data['note'] ?? null,
                'paid_at' => now(), 'period_start' => $start, 'period_end' => $end, 'recorded_by' => $request->user()->id,
            ]);
            $garage->update(['plan_id' => $plan->id, 'is_trial' => false, 'subscription_ends_at' => $end]);
        });

        return back()->with('ok', 'Payment recorded, subscription extended to ' . $end->format('d M Y') . '.');
    }

    /** Give free days without a payment (e.g. extended trial). */
    public function extend(Request $request, Garage $garage)
    {
        $data = $request->validate(['days' => 'required|integer|min:1|max:3650']);
        $end = $this->base($garage)->addDays($data['days'])->endOfDay();
        $garage->update(['subscription_ends_at' => $end]);
        return back()->with('ok', 'Extended to ' . $end->format('d M Y') . '.');
    }

    public function destroy(Request $request, Garage $garage)
    {
        $request->validate(['confirm' => 'required|in:' . $garage->name]);

        DB::transaction(function () use ($garage) {
            foreach (SyncSchema::names() as $table) {
                DB::table($table)->where('garage_id', $garage->id)->delete();
            }
            \Illuminate\Support\Facades\Storage::disk('local')->deleteDirectory(\App\Models\StoredFile::dir($garage->id));
            \App\Models\StoredFile::where('garage_id', $garage->id)->delete();
            $garage->users->each(fn ($u) => $u->tokens()->delete());
            $garage->delete(); // users, payments, logs cascade
        });

        return redirect()->route('admin.garages')->with('ok', 'Garage deleted.');
    }

    /** A renewal starts from today, or from the current end if still valid. */
    private function base(Garage $garage)
    {
        $end = $garage->subscription_ends_at;
        return ($end && $end->isFuture()) ? $end->copy() : now();
    }
}
