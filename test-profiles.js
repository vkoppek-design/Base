const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key) acc[key.trim()] = val.join('=').trim().replace(/"/g, '').replace(/\r/g, '');
  return acc;
}, {});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY // Actually we need service_role, but let's try anon or just list profiles
);

async function checkProfiles() {
  const { data, error } = await supabase.from('profiles').select('*');
  console.log("Profiles:", data);
  process.exit(0);
}

checkProfiles();
