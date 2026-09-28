const BASE_URL = 'http://localhost:3000';

const routes = [
  { path: '/', name: 'Homepage (Landing)' },
  { path: '/rent', name: 'Search & Catalog Page' },
  { path: '/rent/vehicle/veh-swift-1', name: 'Vehicle Detail Page' },
  { path: '/customer', name: 'Customer Dashboard' },
  { path: '/owner', name: 'Owner / Host Portal' },
  { path: '/admin', name: 'Admin Governance Portal' },
  { path: '/privacy', name: 'Privacy & Data Retention' },
  { path: '/policies/terms', name: 'Terms of Service' },
  { path: '/policies/cancellation', name: 'Cancellation Policy' },
  { path: '/policies/privacy', name: 'Privacy Policy' },
];

async function verifyPages() {
  console.log('--- Verifying UI Pages Rendering & SSR Integrity ---');
  let allOk = true;

  for (const r of routes) {
    try {
      const res = await fetch(`${BASE_URL}${r.path}`);
      const text = await res.text();
      if (res.status === 200 && text.length > 500 && !text.includes('Application error') && !text.includes('Unhandled Runtime Error')) {
        console.log(`✓ ${r.name.padEnd(30)} [${r.path}] -> HTTP 200 (${(text.length / 1024).toFixed(1)} KB)`);
      } else {
        console.error(`❌ ${r.name.padEnd(30)} [${r.path}] -> HTTP ${res.status}`);
        allOk = false;
      }
    } catch (e) {
      console.error(`❌ Error fetching ${r.path}:`, e.message);
      allOk = false;
    }
  }

  if (!allOk) {
    process.exit(1);
  }
  console.log('\nAll core user-facing and admin pages rendered with 100% integrity!');
}

verifyPages();
