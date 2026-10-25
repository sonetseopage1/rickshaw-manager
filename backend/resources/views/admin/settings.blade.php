@extends('admin.layout')
@section('title', 'Settings')
@section('content')
<h1>Settings</h1>
<div class="grid g2">
  <div class="card">
    <h2>Platform</h2>
    <form method="post" action="{{ route('admin.settings.update') }}">
      @csrf @method('PUT')
      <label>Free trial days for new garages</label>
      <input type="number" name="trial_days" value="{{ $values['trial_days'] }}" min="0" max="365" required>
      <label>Support phone (shown when a subscription expires)</label>
      <input name="support_phone" value="{{ $values['support_phone'] }}">
      <label>Announcement shown inside every app (leave empty for none)</label>
      <textarea name="announcement" rows="3">{{ $values['announcement'] }}</textarea>
      <label>Currency symbol</label>
      <input name="currency" value="{{ $values['currency'] }}" maxlength="5" required>
      <label style="display:flex;gap:8px;align-items:center;color:var(--text)">
        <input type="checkbox" name="registration_open" value="1" style="width:auto" @checked($values['registration_open'] === '1')> New garages may sign up
      </label>
      <p><button class="btn">Save</button></p>
    </form>
  </div>
  <div class="card">
    <h2>System</h2>
    <p class="muted">PHP {{ $system['php'] }} · Laravel {{ $system['laravel'] }} · {{ $system['db'] }} · {{ $system['migrations'] }} migrations</p>
    <p>After uploading an update that adds database tables, run the migrations here (no SSH needed).</p>
    <form method="post" action="{{ route('admin.system.migrate') }}" style="display:inline">@csrf <button class="btn">Run migrations</button></form>
    <form method="post" action="{{ route('admin.system.clear') }}" style="display:inline">@csrf <button class="btn sec">Clear cache</button></form>
  </div>
</div>
@endsection
