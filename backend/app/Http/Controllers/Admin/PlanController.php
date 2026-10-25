<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use Illuminate\Http\Request;

class PlanController extends Controller
{
    private function rules(): array
    {
        return [
            'name' => 'required|string|max:60',
            'price' => 'required|numeric|min:0',
            'duration_days' => 'required|integer|min:1|max:3650',
            'max_rickshaws' => 'nullable|integer|min:1',
            'max_users' => 'nullable|integer|min:1',
            'sort' => 'nullable|integer|min:0',
        ];
    }

    public function index()
    {
        return view('admin.plans', ['plans' => Plan::withCount('garages')->orderBy('sort')->orderBy('id')->get()]);
    }

    public function store(Request $request)
    {
        Plan::create($request->validate($this->rules()) + ['is_active' => true]);
        return back()->with('ok', 'Plan added.');
    }

    public function update(Request $request, Plan $plan)
    {
        $data = $request->validate($this->rules());
        $data['is_active'] = $request->boolean('is_active');
        $data['max_rickshaws'] = $data['max_rickshaws'] ?? null;
        $data['max_users'] = $data['max_users'] ?? null;
        $plan->update($data);
        return back()->with('ok', 'Plan saved.');
    }

    public function destroy(Plan $plan)
    {
        if ($plan->garages()->exists()) {
            return back()->withErrors(['plan' => 'Plan is used by garages. Deactivate it instead.']);
        }
        $plan->delete();
        return back()->with('ok', 'Plan deleted.');
    }
}
