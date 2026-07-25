// One-time script to bulk-create MBT Sales Operations accounts,
// copied from the roles in the MBT Project Pipeline app.
//
// HOW TO RUN:
//   1. Copy .env.admin.example to .env.admin and fill in SUPABASE_URL and
//      SUPABASE_SERVICE_ROLE_KEY (from Supabase dashboard -> Project Settings -> API).
//   2. From the project folder, run:
//        node --env-file=.env.admin scripts/create-team-accounts.mjs
//   3. Save the printed email/password table somewhere safe and share each
//      person's own login with them individually (not as a group broadcast).
//
// Safe to re-run: people who already have an account are skipped, not duplicated.

import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
    'Copy .env.admin.example to .env.admin, fill it in, then run:\n' +
    '  node --env-file=.env.admin scripts/create-team-accounts.mjs'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Roster copied from the MBT Project Pipeline app's user_profiles table.
// 'director' (Joe Anico) and 'pm' (Red Solo) were intentionally left out --
// this app has no equivalent role for them.
const ACCOUNTS = [
  // Sales Engineers
  { email: 'anthony.mendiola@cmip.com.ph', full_name: 'Anthony Mendiola', role: 'sales_engineer' },
  { email: 'agarcia@cmip.com.ph', full_name: 'Archiemidez Garcia', role: 'sales_engineer' },
  { email: 'arjun.enguerra@cmip.com.ph', full_name: 'Arjun Enguerra', role: 'sales_engineer' },
  { email: 'arsen.largo@cmip.com.ph', full_name: 'Arsen Largo', role: 'sales_engineer' },
  { email: 'elmeranthony.cubita@cmip.com.ph', full_name: 'Elmer Anthony Cubita', role: 'sales_engineer' },
  { email: 'irmira.carag@cmip.com.ph', full_name: 'Irmira Carag', role: 'sales_engineer' },
  { email: 'jonas.rico@cmip.com.ph', full_name: 'Jonas Rico', role: 'sales_engineer' },
  { email: 'markorlan.mendoza@cmip.com.ph', full_name: 'Mark Mendoza', role: 'sales_engineer' },
  { email: 'nicoleshantal.lanasa@cmip.com.ph', full_name: 'Nicole Shantal Lanasa', role: 'sales_engineer' },

  // BD Engineers
  { email: 'eray.sonmez@cmip.com.ph', full_name: 'Eray Sonmez', role: 'bd_engineer' },
  { email: 'joel.resurreccion@cmip.com.ph', full_name: 'Joel Resurreccion', role: 'bd_engineer' },
  { email: 'johnmark.abanes@cmip.com.ph', full_name: 'John Mark Abanes', role: 'bd_engineer' },
  { email: 'josephbryan.delespiritusanto@cmip.com.ph', full_name: 'Joseph Bryan Del Espiritu Santo', role: 'bd_engineer' },
  { email: 'paulazeah.bautista@cmip.com.ph', full_name: 'Paula Zeah Bautista', role: 'bd_engineer' },

  // National Sales Manager
  { email: 'jamaica.linsangan@cmip.com.ph', full_name: 'Jamaica Linsangan', role: 'nsm' },

  // Commercial AC Head
  { email: 'ronald.acedillo@cmip.com.ph', full_name: 'Ronald Acedillo', role: 'commercial_ac_head' },
]

function generatePassword() {
  const random = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x')
  return `Mbt!${random}26`
}

const results = []

for (const account of ACCOUNTS) {
  const password = generatePassword()
  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password,
    email_confirm: true, // skip email confirmation, they can log in right away
    user_metadata: {
      role: account.role,
      full_name: account.full_name,
    },
  })

  if (error) {
    const detail = error.message || error.msg || error.error_description || JSON.stringify(error)
    results.push({ ...account, status: `SKIPPED (${detail})`, password: '-' })
  } else {
    results.push({ ...account, status: 'CREATED', password })
  }
}

console.log('\n=== Account creation results ===\n')
for (const r of results) {
  console.log(`${r.status.padEnd(28)} ${r.role.padEnd(20)} ${r.email.padEnd(42)} ${r.password}`)
}

const created = results.filter(r => r.status === 'CREATED').length
const skipped = results.length - created
console.log(`\n${created} account(s) created, ${skipped} skipped (already existed).`)
console.log('Save the passwords above somewhere safe and share each one individually with that person.')
