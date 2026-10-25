@extends('admin.layout')
@section('title', 'Garages')
@section('content')
<h1>Garages</h1>
<form class="tools" method="get">
  <input name="q" value="{{ $q }}" placeholder="Search garage, name or login">
  <select name="status" onchange="this.form.submit()">
    <option value="">All statuses</option>
    @foreach (['active', 'trial', 'expired', 'blocked'] as $s)
      <option value="{{ $s }}" @selected($status === $s)>{{ ucfirst($s) }}</option>
    @endforeach
  </select>
  <button class="btn">Search</button>
</form>
<div class="card scroll">
  <table>
    <tr><th>Garage</th><th>Status</th><th>Plan</th><th>Ends</th><th class="right">Users</th><th class="right">Rickshaws</th><th>Joined</th></tr>
    @forelse ($garages as $g)
      <tr>
        <td><a href="{{ route('admin.garages.show', $g) }}">{{ $g->name }}</a><br><span class="muted">{{ $g->phone }}</span></td>
        <td><span class="badge b-{{ $g->status() }}">{{ $g->status() }}</span></td>
        <td>{{ $g->plan?->name ?? ($g->is_trial ? 'Trial' : '—') }}</td>
        <td>{{ $g->subscription_ends_at?->format('d M Y') ?? '—' }}</td>
        <td class="right">{{ $g->users_count }}</td>
        <td class="right">{{ $counts[$g->id] ?? 0 }}</td>
        <td class="muted">{{ $g->created_at->format('d M Y') }}</td>
      </tr>
    @empty
      <tr><td colspan="7" class="muted">No garages found.</td></tr>
    @endforelse
  </table>
</div>
@endsection
