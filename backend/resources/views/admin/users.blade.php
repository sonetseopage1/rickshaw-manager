@extends('admin.layout')
@section('title', 'Users')
@section('content')
<h1>Users</h1>
<form class="tools" method="get">
  <input name="q" value="{{ $q }}" placeholder="Search name or login">
  <button class="btn">Search</button>
</form>
<div class="card scroll">
  <table>
    <tr><th>Name</th><th>Login</th><th>Role</th><th>Garage</th><th>Last login</th><th></th></tr>
    @forelse ($users as $u)
      <tr>
        <td>{{ $u->name }} @if($u->is_blocked)<span class="badge b-blocked">blocked</span>@endif</td>
        <td>{{ $u->login }}</td>
        <td>{{ $u->role }}</td>
        <td>@if($u->garage)<a href="{{ route('admin.garages.show', $u->garage) }}">{{ $u->garage->name }}</a>@endif</td>
        <td class="muted">{{ $u->last_login_at?->diffForHumans() ?? 'never' }}</td>
        <td class="right">
          <form method="post" action="{{ route('admin.users.toggle', $u) }}" style="display:inline">@csrf
            <button class="btn sec sm">{{ $u->is_blocked ? 'Unblock' : 'Block' }}</button></form>
          <form method="post" action="{{ route('admin.users.password', $u) }}" style="display:inline"
                onsubmit="var p=prompt('New password (min 6)'); if(!p) return false; this.password.value=p;">@csrf
            <input type="hidden" name="password"><button class="btn sec sm">Reset password</button></form>
        </td>
      </tr>
    @empty
      <tr><td colspan="6" class="muted">No users.</td></tr>
    @endforelse
  </table>
</div>
@endsection
