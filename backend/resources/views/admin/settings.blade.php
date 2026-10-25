@extends('admin.layout')
@section('title', 'Settings')
@section('content')
<h1>Settings</h1>
<div class="grid g2">
  <div class="card">
    <h2>Platform</h2>
    <form method="post" enctype="multipart/form-data" action="{{ route('admin.settings.update') }}">
      @csrf @method('PUT')
      <label>Free trial days for new garages</label>
      <input type="number" name="trial_days" value="{{ $values['trial_days'] }}" min="0" max="365" required>
      <label>Support phone (shown when a subscription expires)</label>
      <input name="support_phone" value="{{ $values['support_phone'] }}">
      <label>Announcement shown inside every app (leave empty for none)</label>
      <textarea name="announcement" rows="3">{{ $values['announcement'] }}</textarea>
      <label>Currency symbol</label>
      <input name="currency" value="{{ $values['currency'] }}" maxlength="5" required>
      <h2 style="margin-top:18px">Android app update</h2>
      <p class="muted">Build the new APK on GitHub (Actions → Build #N), upload it here and type the same number N. Installed apps then show an "Update" prompt.</p>
      <div class="row">
        <div><label>Latest build number</label><input type="number" name="app_build" min="0" value="{{ $values['app_build'] }}"></div>
        <div><label>Minimum build (older apps are forced to update)</label><input type="number" name="app_min_build" min="0" value="{{ $values['app_min_build'] }}"></div>
      </div>
      <label>New APK file</label><input type="file" name="apk" accept=".apk">
      @if ($values['app_apk_url']) <p class="muted">Current file: <a href="{{ $values['app_apk_url'] }}">{{ $values['app_apk_url'] }}</a></p> @endif
      <label>What is new (shown in the prompt)</label><input name="app_notes" maxlength="300" value="{{ $values['app_notes'] }}">
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
