@extends('admin.layout')
@section('title', 'Plans')
@section('content')
<h1>Subscription plans</h1>
<p class="muted">Garages pay monthly. Leave a limit empty for "unlimited". Payments are recorded by hand on the garage page.</p>

@foreach ($plans as $p)
<div class="card">
  <form method="post" action="{{ route('admin.plans.update', $p) }}">
    @csrf @method('PUT')
    <div class="row">
      <div><label>Name</label><input name="name" value="{{ $p->name }}" required></div>
      <div><label>Price (৳)</label><input type="number" step="0.01" name="price" value="{{ $p->price }}" required></div>
      <div><label>Days per period</label><input type="number" name="duration_days" value="{{ $p->duration_days }}" required></div>
      <div><label>Max rickshaws</label><input type="number" name="max_rickshaws" value="{{ $p->max_rickshaws }}"></div>
      <div><label>Max users</label><input type="number" name="max_users" value="{{ $p->max_users }}"></div>
      <div><label>Order</label><input type="number" name="sort" value="{{ $p->sort }}"></div>
    </div>
    <div class="row" style="margin-top:10px">
      <label style="margin:0;flex:0;white-space:nowrap"><input type="checkbox" name="is_active" value="1" style="width:auto" @checked($p->is_active)> Active</label>
      <span class="muted">{{ $p->garages_count }} garage(s)</span>
      <span style="flex:1"></span>
      <button class="btn sm" style="flex:0">Save</button>
    </div>
  </form>
  <form method="post" action="{{ route('admin.plans.destroy', $p) }}" onsubmit="return confirm('Delete plan?')" style="margin-top:6px">
    @csrf @method('DELETE') <button class="btn sec sm">Delete</button>
  </form>
</div>
@endforeach

<div class="card">
  <h2>Add a plan</h2>
  <form method="post" action="{{ route('admin.plans.store') }}">
    @csrf
    <div class="row">
      <div><label>Name</label><input name="name" required></div>
      <div><label>Price (৳)</label><input type="number" step="0.01" name="price" value="0" required></div>
      <div><label>Days per period</label><input type="number" name="duration_days" value="30" required></div>
      <div><label>Max rickshaws</label><input type="number" name="max_rickshaws"></div>
      <div><label>Max users</label><input type="number" name="max_users"></div>
    </div>
    <p><button class="btn">Add plan</button></p>
  </form>
</div>
@endsection
