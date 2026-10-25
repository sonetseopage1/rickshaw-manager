<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Install</title>
<link rel="stylesheet" href="{{ asset('assets/admin/admin.css') }}">
</head>
<body>
<div class="center">
  <div class="card">
    <div class="brand"><i></i> First-time setup</div>
    @if ($keyMissing) <div class="err">INSTALL_KEY is not set in the .env file.</div> @endif
    @if ($errors->any()) <div class="err">{{ $errors->first() }}</div> @endif
    <p class="muted">Creates the database tables and the super admin account.</p>
    <form method="post" action="{{ url('install') }}">
      @csrf
      <label>Install key (INSTALL_KEY from .env)</label>
      <input name="install_key" type="password" required>
      <label>Your name</label>
      <input name="name" value="{{ old('name') }}" required>
      <label>Super admin login</label>
      <input name="login" value="{{ old('login') }}" required minlength="4">
      <label>Password (min 8)</label>
      <input name="password" type="password" required minlength="8">
      <p><button class="btn" style="width:100%">Install</button></p>
    </form>
  </div>
</div>
</body>
</html>
