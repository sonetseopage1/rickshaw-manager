<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>@yield('title', 'Super Admin') · Rickshaw Manager</title>
<link rel="icon" type="image/png" href="{{ asset('assets/admin/logo.png') }}">
<link rel="stylesheet" href="{{ asset('assets/admin/admin.css') }}">
</head>
<body>
<div class="shell">
  <aside class="side">
    <div class="brand"><img src="{{ asset('assets/admin/logo.png') }}" alt="" class="brand-logo"> Rickshaw SaaS</div>
    @php $nav = ['dashboard' => 'Dashboard', 'garages' => 'Garages', 'users' => 'Users', 'plans' => 'Plans', 'payments' => 'Payments', 'settings' => 'Settings']; @endphp
    @foreach ($nav as $route => $label)
      <a class="nav {{ request()->routeIs('admin.'.$route.'*') ? 'on' : '' }}" href="{{ route('admin.'.$route) }}">{{ $label }}</a>
    @endforeach
    <form method="post" action="{{ route('admin.logout') }}">@csrf <button class="btn sec sm">Logout</button></form>
  </aside>
  <main class="main">
    @if (session('ok')) <div class="flash">{{ session('ok') }}</div> @endif
    @if ($errors->any()) <div class="err">{{ $errors->first() }}</div> @endif
    @yield('content')
  </main>
</div>
<script src="{{ asset('assets/admin/admin.js') }}"></script>
</body>
</html>
