const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key) acc[key.trim()] = val.join('=').trim().replace(/"/g, '');
  return acc;
}, {});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function testQuery() {
  console.log("Checking courses table using service role key...");
  const { data, error } = await supabase.from('courses').select('id, title, sequential_access');
  console.log("Courses:", data);
  if (error) {
    console.error("Error fetching courses:", error);
  }
  process.exit(0);
}

testQuery();
