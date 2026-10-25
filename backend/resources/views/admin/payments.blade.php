@extends('admin.layout')
@section('title', 'Payments')
@section('content')
<h1>Payments <span class="muted">· total ৳{{ number_format($total) }}</span></h1>
<div class="card scroll">
  <table>
    <tr><th>Date</th><th>Garage</th><th>Plan</th><th class="right">Amount</th><th>Method</th><th>Reference</th><th>Period</th></tr>
    @forelse ($payments as $p)
      <tr>
        <td>{{ $p->paid_at->format('d M Y') }}</td>
        <td>@if($p->garage)<a href="{{ route('admin.garages.show', $p->garage) }}">{{ $p->garage->name }}</a>@endif</td>
        <td>{{ $p->plan?->name }}</td>
        <td class="right">৳{{ number_format($p->amount) }}</td>
        <td>{{ $p->method }}</td><td>{{ $p->reference }}</td>
        <td class="muted">{{ $p->period_start?->format('d M') }} – {{ $p->period_end?->format('d M Y') }}</td>
      </tr>
    @empty
      <tr><td colspan="7" class="muted">No payments yet.</td></tr>
    @endforelse
  </table>
</div>
@endsection
