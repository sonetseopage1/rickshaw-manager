@extends('admin.layout')
@section('title', 'Dashboard')
@section('content')
<h1>Dashboard</h1>
<div class="grid stats">
  <div class="stat"><b>{{ $stats['garages'] }}</b><span>Garages</span></div>
  <div class="stat"><b>{{ $stats['active'] }}</b><span>Active (paid)</span></div>
  <div class="stat"><b>{{ $stats['trial'] }}</b><span>On trial</span></div>
  <div class="stat"><b>{{ $stats['expired'] }}</b><span>Expired</span></div>
  <div class="stat"><b>{{ $stats['blocked'] }}</b><span>Blocked</span></div>
  <div class="stat"><b>{{ $stats['users'] }}</b><span>Users</span></div>
  <div class="stat"><b>{{ $stats['rickshaws'] }}</b><span>Rickshaws</span></div>
  <div class="stat"><b>৳{{ number_format($stats['revenue_month']) }}</b><span>Revenue this month</span></div>
  <div class="stat"><b>৳{{ number_format($stats['revenue_total']) }}</b><span>Revenue total</span></div>
</div>

<div class="grid g2">
  <div class="card"><h2>Revenue (12 months)</h2><svg class="chart" data-chart='@json($revenueChart)' data-color="#0f766e"></svg></div>
  <div class="card"><h2>New garages (12 months)</h2><svg class="chart" data-chart='@json($signupChart)' data-color="#2563eb"></svg></div>
  <div class="card"><h2>Entries per day (30 days)</h2><svg class="chart" data-chart='@json($activityChart)' data-color="#d97706"></svg></div>

  <div class="card">
    <h2>Expiring within 7 days</h2>
    @forelse ($expiring as $g)
      <div class="row" style="margin-bottom:6px">
        <a href="{{ route('admin.garages.show', $g) }}">{{ $g->name }}</a>
        <span class="muted right">{{ $g->daysLeft() }} day(s) · {{ $g->status() }}</span>
      </div>
    @empty
      <p class="muted">None.</p>
    @endforelse
  </div>
</div>

<div class="card">
  <h2>Latest signups</h2>
  <div class="scroll"><table>
    <tr><th>Garage</th><th>Admin</th><th>Status</th><th>Joined</th></tr>
    @foreach ($recent as $g)
      <tr>
        <td><a href="{{ route('admin.garages.show', $g) }}">{{ $g->name }}</a></td>
        <td>{{ $g->users->firstWhere('role', 'admin')?->name }} <span class="muted">{{ $g->users->firstWhere('role', 'admin')?->login }}</span></td>
        <td><span class="badge b-{{ $g->status() }}">{{ $g->status() }}</span></td>
        <td class="muted">{{ $g->created_at->format('d M Y') }}</td>
      </tr>
    @endforeach
  </table></div>
</div>
@endsection
