@extends('admin.layout')
@section('title', $garage->name)
@section('content')
<p><a href="{{ route('admin.garages') }}">← Garages</a></p>
<h1>{{ $garage->name }} <span class="badge b-{{ $garage->status() }}">{{ $garage->status() }}</span></h1>

<div class="grid stats">
  <div class="stat"><b>{{ $usage['rickshaws'] }}</b><span>Rickshaws</span></div>
  <div class="stat"><b>{{ $usage['drivers'] }}</b><span>Drivers</span></div>
  <div class="stat"><b>{{ $usage['owners'] }}</b><span>Owners</span></div>
  <div class="stat"><b>{{ $usage['entries'] }}</b><span>Entries (all)</span></div>
  <div class="stat"><b>৳{{ number_format($usage['deposit30']) }}</b><span>Deposits, 30 days</span></div>
  <div class="stat"><b>৳{{ number_format($usage['expense30']) }}</b><span>Rickshaw expenses, 30 days</span></div>
  <div class="stat"><b>৳{{ number_format($usage['charge30']) }}</b><span>Garage charge, 30 days</span></div>
  <div class="stat"><b>৳{{ number_format($usage['utility30']) }}</b><span>Utility costs, 30 days</span></div>
</div>

<div class="card"><h2>Deposits per day (30 days)</h2><svg class="chart" data-chart='@json($chart)'></svg></div>

<div class="grid g2">
  <div class="card">
    <h2>Details & subscription</h2>
    <form method="post" action="{{ route('admin.garages.update', $garage) }}">
      @csrf @method('PUT')
      <label>Name</label><input name="name" value="{{ $garage->name }}" required>
      <div class="row">
        <div><label>Phone</label><input name="phone" value="{{ $garage->phone }}"></div>
        <div><label>Address</label><input name="address" value="{{ $garage->address }}"></div>
      </div>
      <div class="row">
        <div><label>Plan</label>
          <select name="plan_id"><option value="">— none (trial) —</option>
            @foreach ($plans as $p)<option value="{{ $p->id }}" @selected($garage->plan_id === $p->id)>{{ $p->name }}</option>@endforeach
          </select></div>
        <div><label>Subscription ends</label><input type="date" name="subscription_ends_at" value="{{ $garage->subscription_ends_at?->format('Y-m-d') }}"></div>
      </div>
      <p><button class="btn">Save</button></p>
    </form>
    <p class="muted">Joined {{ $garage->created_at->format('d M Y') }} ·
      @if ($garage->daysLeft() !== null) {{ $garage->daysLeft() >= 0 ? $garage->daysLeft().' day(s) left' : 'expired '.abs($garage->daysLeft()).' day(s) ago' }} @endif</p>

    @if ($garage->is_blocked)
      <form method="post" action="{{ route('admin.garages.unblock', $garage) }}">@csrf
        <p class="muted">Blocked: {{ $garage->blocked_reason ?: 'no reason given' }}</p>
        <button class="btn">Unblock garage</button></form>
    @else
      <form method="post" action="{{ route('admin.garages.block', $garage) }}" class="row">@csrf
        <input name="reason" placeholder="Reason (shown to the user)">
        <button class="btn bad" style="flex:0">Block garage</button></form>
    @endif
  </div>

  <div class="card">
    <h2>Record payment</h2>
    <form method="post" action="{{ route('admin.garages.payment', $garage) }}">
      @csrf
      <div class="row">
        <div><label>Plan</label><select name="plan_id" id="payPlan">
          @foreach ($plans->where('is_active', true) as $p)<option value="{{ $p->id }}" data-price="{{ $p->price }}" @selected($garage->plan_id === $p->id)>{{ $p->name }} — ৳{{ number_format($p->price) }}</option>@endforeach
        </select></div>
        <div><label>Months</label><input type="number" name="months" id="payMonths" value="1" min="1" max="36"></div>
        <div><label>Amount (৳)</label><input type="number" step="0.01" name="amount" id="payAmount" required></div>
      </div>
      <div class="row">
        <div><label>Method</label><input name="method" placeholder="bKash / Nagad / Cash"></div>
        <div><label>Reference</label><input name="reference" placeholder="TrxID"></div>
      </div>
      <label>Note</label><input name="note">
      <p><button class="btn">Save payment & extend</button></p>
    </form>
    <hr style="border:0;border-top:1px solid var(--line)">
    <form method="post" action="{{ route('admin.garages.extend', $garage) }}" class="row">
      @csrf
      <div><label>Give free days</label><input type="number" name="days" value="7" min="1"></div>
      <button class="btn sec" style="flex:0">Extend</button>
    </form>
  </div>
</div>

<div class="card scroll">
  <h2>Users</h2>
  <table>
    <tr><th>Name</th><th>Login</th><th>Role</th><th>Last login</th><th></th></tr>
    @foreach ($garage->users as $u)
      <tr>
        <td>{{ $u->name }} @if($u->is_blocked)<span class="badge b-blocked">blocked</span>@endif</td>
        <td>{{ $u->login }}</td><td>{{ $u->role }}</td>
        <td class="muted">{{ $u->last_login_at?->diffForHumans() ?? 'never' }}</td>
        <td class="right">
          <form method="post" action="{{ route('admin.users.toggle', $u) }}" style="display:inline">@csrf
            <button class="btn sec sm">{{ $u->is_blocked ? 'Unblock' : 'Block' }}</button></form>
          <form method="post" action="{{ route('admin.users.password', $u) }}" style="display:inline"
                onsubmit="var p=prompt('New password (min 6)'); if(!p) return false; this.password.value=p;">@csrf
            <input type="hidden" name="password"><button class="btn sec sm">Reset password</button></form>
        </td>
      </tr>
    @endforeach
  </table>
</div>

<div class="card scroll">
  <h2>Payments</h2>
  <table>
    <tr><th>Date</th><th>Plan</th><th class="right">Amount</th><th>Method</th><th>Period</th><th>Reference</th></tr>
    @forelse ($payments as $p)
      <tr><td>{{ $p->paid_at->format('d M Y') }}</td><td>{{ $p->plan?->name }}</td><td class="right">৳{{ number_format($p->amount) }}</td>
        <td>{{ $p->method }}</td><td class="muted">{{ $p->period_start?->format('d M') }} – {{ $p->period_end?->format('d M Y') }}</td><td>{{ $p->reference }}</td></tr>
    @empty
      <tr><td colspan="6" class="muted">No payments yet.</td></tr>
    @endforelse
  </table>
</div>

<div class="card scroll">
  <h2>Recent activity</h2>
  <table>
    <tr><th>When</th><th>User</th><th>Action</th><th>What</th></tr>
    @forelse ($logs as $l)
      <tr><td class="muted">{{ $l->created_at->format('d M H:i') }}</td><td>{{ $l->user_name }}</td><td>{{ $l->action }}</td><td>{{ $l->entity }} · {{ $l->label }}</td></tr>
    @empty
      <tr><td colspan="4" class="muted">No activity yet.</td></tr>
    @endforelse
  </table>
</div>

<div class="card">
  <details>
    <summary style="color:var(--bad)">Delete this garage</summary>
    <form method="post" action="{{ route('admin.garages.destroy', $garage) }}" class="row" onsubmit="return confirm('Delete everything permanently?')">
      @csrf @method('DELETE')
      <div><label>Type the garage name to confirm. All its data will be erased.</label><input name="confirm" required></div>
      <button class="btn bad" style="flex:0">Delete</button>
    </form>
  </details>
</div>

<script>
(function () {
  var plan = document.getElementById('payPlan'), months = document.getElementById('payMonths'), amount = document.getElementById('payAmount');
  function calc() { var o = plan.options[plan.selectedIndex]; if (o) amount.value = (parseFloat(o.dataset.price) * (parseInt(months.value) || 1)).toFixed(2); }
  plan.onchange = months.oninput = calc; calc();
})();
</script>
@endsection
