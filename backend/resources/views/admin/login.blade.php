<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Super Admin Login</title>
<link rel="stylesheet" href="{{ asset('assets/admin/admin.css') }}">
</head>
<body>
<div class="center">
  <div class="card">
    <div class="brand"><i></i> Rickshaw SaaS</div>
    @if (session('ok')) <div class="flash">{{ session('ok') }}</div> @endif
    @if ($errors->any()) <div class="err">{{ $errors->first() }}</div> @endif
    <form method="post" action="{{ url('admin/login') }}">
      @csrf
      <label>Login</label>
      <input name="login" value="{{ old('login') }}" autocomplete="username" required autofocus>
      <label>Password</label>
      <input name="password" type="password" autocomplete="current-password" required>
      <p><button class="btn" style="width:100%">Sign in</button></p>
    </form>
  </div>
</div>
</body>
</html>
