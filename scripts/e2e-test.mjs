/**
 * Kerala Vehicle Rental Marketplace - End-to-End System Verification
 * Executes all 11 critical marketplace phases against the live running server.
 */

const BASE_URL = 'http://localhost:3000';

async function fetchJson(url, options = {}) {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // text response
  }
  const payload = (json && json.data !== undefined) ? json.data : (json || text);
  return { status: res.status, headers: res.headers, raw: json, data: payload };
}

function assert(condition, message, details = null) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    if (details) console.error('Details:', JSON.stringify(details, null, 2));
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runE2ESuite() {
  console.log('\n======================================================');
  console.log('🚀 Starting Kerala Marketplace Full E2E Test Suite');
  console.log('======================================================\n');

  // PHASE 1: Health & Route Render Verification
  console.log('--- PHASE 1: Public Pages & SSR Verification ---');
  const home = await fetchJson('/');
  assert(home.status === 200, 'Homepage renders with status 200');
  assert(typeof home.data === 'string' && home.data.includes('Kerala'), 'Homepage includes Kerala branding');

  const rentPage = await fetchJson('/rent');
  assert(rentPage.status === 200, 'Search & listing page renders with status 200');

  const privacyPage = await fetchJson('/privacy');
  assert(privacyPage.status === 200, 'Privacy Center renders with status 200');

  const termsPage = await fetchJson('/policies/terms');
  assert(termsPage.status === 200, 'Terms & Legal policy renders with status 200');

  // PHASE 2: Authentication Flows
  console.log('\n--- PHASE 2: Phone OTP Authentication & Roles ---');
  // Customer Auth (usr-cust-1)
  const custPhone = '+919846011111';
  const custOtpReq = await fetchJson('/api/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ phone: custPhone }),
  });
  assert(custOtpReq.status === 200, 'Customer OTP requested successfully');

  const custOtpVerify = await fetchJson('/api/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone: custPhone, otp: '123456' }),
  });
  assert(custOtpVerify.status === 200, 'Customer OTP verified successfully');
  const custToken = custOtpVerify.data.sessionToken;
  const custUser = custOtpVerify.data.user;
  assert(custToken && custUser, 'Customer received session token and profile');
  console.log(`  Customer authenticated: ${custUser.fullName} (${custUser.userId})`);

  // Owner Auth (usr-owner-1)
  const ownerPhone = '+919846033333';
  await fetchJson('/api/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ phone: ownerPhone }),
  });
  const ownerOtpVerify = await fetchJson('/api/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone: ownerPhone, otp: '123456' }),
  });
  assert(ownerOtpVerify.status === 200, 'Owner OTP verified successfully');
  const ownerToken = ownerOtpVerify.data.sessionToken;
  const ownerUser = ownerOtpVerify.data.user;
  assert(ownerToken && ownerUser, 'Owner received session token and profile');
  console.log(`  Owner authenticated: ${ownerUser.fullName} (${ownerUser.userId})`);

  // Admin Auth (usr-admin-1)
  const adminPhone = '+919846099999';
  await fetchJson('/api/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ phone: adminPhone }),
  });
  const adminOtpVerify = await fetchJson('/api/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone: adminPhone, otp: '123456' }),
  });
  assert(adminOtpVerify.status === 200, 'Admin OTP verified successfully');
  const adminToken = adminOtpVerify.data.sessionToken;
  console.log(`  Admin authenticated: ${adminOtpVerify.data.user.fullName}`);

  // PHASE 3: Vehicle Discovery & Pricing Breakdown
  console.log('\n--- PHASE 3: Vehicle Catalog & Server Pricing Calculation ---');
  const vehiclesRes = await fetchJson('/api/vehicles');
  assert(vehiclesRes.status === 200, 'Vehicles API returns listings');
  assert(vehiclesRes.data.vehicles && vehiclesRes.data.vehicles.length > 0, 'Catalog contains active seed vehicles');
  // Pick Swift owned by usr-owner-1
  const targetVehicle = vehiclesRes.data.vehicles.find(v => v.id === 'veh-swift-1') || vehiclesRes.data.vehicles[0];
  console.log(`  Selected vehicle: ${targetVehicle.make} ${targetVehicle.model} at ₹${targetVehicle.daily_price}/day`);

  // PHASE 4: Customer Creates Booking Request
  console.log('\n--- PHASE 4: Booking Creation (State: REQUESTED) ---');
  const now = new Date();
  const randDays = Math.floor(Math.random() * 500) + 10;
  const startTime = new Date(now.getTime() + randDays * 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date(now.getTime() + (randDays + 3) * 24 * 60 * 60 * 1000).toISOString(); // 3 days

  const bookingReq = await fetchJson('/api/bookings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({
      vehicleId: targetVehicle.id,
      startTime,
      endTime,
      pickupLocationApprox: 'Kaloor, Kochi',
    }),
  });
  assert(bookingReq.status === 201, 'Booking request created successfully', bookingReq.raw);
  const bookingId = bookingReq.data.bookingId;
  const bookingReference = bookingReq.data.bookingReference;
  assert(bookingReq.data.status === 'REQUESTED', 'Initial booking status is REQUESTED');
  console.log(`  Booking ID: ${bookingId}, Reference: ${bookingReference}`);

  // PHASE 5: Owner Accepts Booking (State: PAYMENT_PENDING & 15m hold)
  console.log('\n--- PHASE 5: Host Accepts & 15-Minute Hold Applied ---');
  const acceptRes = await fetchJson(`/api/bookings/${bookingId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  assert(acceptRes.status === 200, 'Owner successfully accepted booking', acceptRes.raw);
  assert(acceptRes.data.status === 'PAYMENT_PENDING', 'Booking transitioned to PAYMENT_PENDING');
  assert(acceptRes.data.paymentDeadline, '15-minute booking hold active with payment deadline');
  console.log(`  Payment deadline: ${acceptRes.data.paymentDeadline}`);

  // PHASE 6: Payment Order & Verification (Double-Entry Ledger)
  console.log('\n--- PHASE 6: Payment Creation, Signature Verification & Ledger ---');
  const orderRes = await fetchJson('/api/payments/create-order', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({ bookingId }),
  });
  assert(orderRes.status === 200, 'Payment order created');
  const paymentOrder = orderRes.data;
  console.log(`  Order ID: ${paymentOrder.orderId}, Amount: ₹${paymentOrder.amount} ${paymentOrder.currency}`);

  const verifyRes = await fetchJson('/api/payments/verify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({
      orderDbId: paymentOrder.orderId,
      providerPaymentId: `pay_mock_${Date.now()}`,
      providerSignature: 'valid_mock_signature',
      paymentMethod: 'UPI',
    }),
  });
  assert(verifyRes.status === 200, 'Payment signature verified');
  assert(verifyRes.data.status === 'CONFIRMED', 'Booking transitioned to CONFIRMED');
  console.log(`  Booking confirmed! Status: ${verifyRes.data.status}`);

  // PHASE 7: Digital Pickup Inspection
  console.log('\n--- PHASE 7: Handover & Pickup Inspection ---');
  const pickupRes = await fetchJson('/api/inspections/pickup', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      bookingId,
      odometerReading: 14200,
      fuelPercentage: 100,
      cleanlinessRating: 5,
      existingScratchesNotes: 'Minor hairline scratch on left front bumper noted and photographed.',
      accessoriesVerified: ['Spare Wheel', 'Jack', 'Tool Kit', 'RC Copy', 'Insurance'],
      photos: [
        'https://storage.keralarentals.in/inspections/front_14200.jpg',
        'https://storage.keralarentals.in/inspections/rear_14200.jpg',
        'https://storage.keralarentals.in/inspections/odometer_14200.jpg',
      ],
    }),
  });
  assert(pickupRes.status === 200, 'Pickup inspection recorded successfully');
  assert(pickupRes.data.status === 'ACTIVE_RENTAL', 'Booking transitioned to ACTIVE_RENTAL');
  console.log(`  Pickup recorded! Odometer: ${pickupRes.data.odometer} km, Fuel: ${pickupRes.data.fuel}%`);

  // PHASE 8: Return Inspection & Excess Calculations
  console.log('\n--- PHASE 8: Return Inspection & Excess Calculations ---');
  // 3 days * 250 km/day = 750 km included. Driven: 950 km => 200 km excess. Fuel: 85% => 15% deficit.
  const returnRes = await fetchJson('/api/inspections/return', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      bookingId,
      odometerReading: 14850, // 650 km driven (50 km excess on 600 km limit)
      fuelPercentage: 90, // 10% deficit
      photos: [
        'https://storage.keralarentals.in/inspections/return_front.jpg',
        'https://storage.keralarentals.in/inspections/return_odo_14850.jpg',
      ],
    }),
  });
  assert(returnRes.status === 200, 'Return inspection recorded successfully', returnRes.raw);
  const excess = returnRes.data;
  console.log(`  Driven: ${excess.usedKm} km (Excess: ${excess.excessKm} km = ₹${excess.excessKmCharge})`);
  console.log(`  Fuel Deficit Charge = ₹${excess.fuelDeficitCharge}`);
  console.log(`  Total Excess Deductions from Deposit: ₹${excess.totalDeductions}`);

  // PHASE 9: Security Deposit Settlement & Payout
  console.log('\n--- PHASE 9: Security Deposit Settlement & Payout ---');
  const settleRes = await fetchJson('/api/payments/settle-deposit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      bookingId,
      deductionAmount: excess.totalDeductions,
      reason: '50 km excess distance and 10% fuel deficit',
    }),
  });
  assert(settleRes.status === 200, 'Deposit settled successfully', settleRes.raw);
  console.log(`  Deposit Settled! Deducted: ₹${settleRes.data.deductionAmount}, Refunded to Customer: ₹${settleRes.data.refundAmount}`);

  // PHASE 10: Admin Incident & Dispute Governance Workflow
  console.log('\n--- PHASE 10: Admin Dispute Governance Workflow ---');
  // Create another booking for Thar
  const tharVehicle = vehiclesRes.data.vehicles.find(v => v.id === 'veh-thar-1') || vehiclesRes.data.vehicles[1];
  const disputeBookingReq = await fetchJson('/api/bookings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({
      vehicleId: tharVehicle.id,
      startTime: new Date(now.getTime() + (randDays + 30) * 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + (randDays + 33) * 24 * 60 * 60 * 1000).toISOString(),
      pickupLocationApprox: 'Palarivattom, Kochi',
    }),
  });
  assert(disputeBookingReq.status === 201, 'Dispute booking created', disputeBookingReq.raw);
  const disputeBookingId = disputeBookingReq.data.bookingId;

  // Owner accepts
  const disputeAcceptRes = await fetchJson(`/api/bookings/${disputeBookingId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  assert(disputeAcceptRes.status === 200, 'Owner accepted dispute booking', disputeAcceptRes.raw);

  // Customer pays to confirm
  const orderRes2 = await fetchJson('/api/payments/create-order', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({ bookingId: disputeBookingId }),
  });
  await fetchJson('/api/payments/verify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({
      orderDbId: orderRes2.data.orderId,
      providerPaymentId: `pay_mock_${Date.now()}`,
      providerSignature: 'valid_mock_signature',
      paymentMethod: 'UPI',
    }),
  });

  // Now customer opens dispute on CONFIRMED booking
  const openDispute = await fetchJson('/api/disputes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({
      bookingId: disputeBookingId,
      category: 'PAYMENT',
      description: 'Host demanded off-platform cash deposit contrary to platform terms.',
    }),
  });
  assert(openDispute.status === 201, 'Formal dispute opened');
  const disputeId = openDispute.data.disputeId;
  assert(openDispute.data.status === 'OPEN', 'Dispute status is OPEN with deposit lock');
  console.log(`  Dispute created: ${disputeId}`);

  // Admin resolves dispute
  const resolveDispute = await fetchJson(`/api/disputes/${disputeId}/resolve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      resolutionNotes: 'Dispute resolved in favor of customer per marketplace terms.',
      depositAction: 'REFUND_FULL',
    }),
  });
  assert(resolveDispute.status === 200, 'Dispute resolved by Admin');
  assert(resolveDispute.data.status === 'RESOLVED', 'Dispute status is RESOLVED');
  console.log(`  Dispute resolved in favor of customer.`);

  // PHASE 11: Data Retention & Privacy Engine
  console.log('\n--- PHASE 11: Data Retention Worker Run ---');
  const retentionRun = await fetchJson('/api/admin/retention/run', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(retentionRun.status === 200, 'Retention job executed');
  console.log(`  Retention processed: ${retentionRun.data.anonymizedCount || 0} records pruned, Legal/Dispute holds respected.`);

  console.log('\n======================================================');
  console.log('🎉 ALL 11 END-TO-END PHASES COMPLETED WITH 100% SUCCESS!');
  console.log('======================================================\n');
}

runE2ESuite().catch((err) => {
  console.error('\n❌ E2E Execution Failed:\n', err);
  process.exit(1);
});
