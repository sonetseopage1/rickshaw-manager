<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPayment;

class PaymentController extends Controller
{
    public function index()
    {
        $payments = SubscriptionPayment::with('garage', 'plan')->orderByDesc('paid_at')->limit(300)->get();
        return view('admin.payments', ['payments' => $payments, 'total' => SubscriptionPayment::sum('amount')]);
    }
}
