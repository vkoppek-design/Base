import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function findEnvFile() {
  let currentDir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const envPath = path.join(currentDir, ".env.local");
    if (fs.existsSync(envPath)) {
      return envPath;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  return null;
}

export function createAdminClient() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fallback: If variables are not in process.env, try to find and read .env.local
  if (!url || !serviceRoleKey) {
    try {
      const envPath = findEnvFile();
      if (envPath) {
        console.log("Found .env.local at:", envPath);
        const envContent = fs.readFileSync(envPath, "utf-8");
        
        if (!url) {
          const matchUrl = envContent.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m);
          if (matchUrl && matchUrl[1]) {
            url = matchUrl[1].trim().replace(/"/g, "").replace(/\r/g, "");
          }
        }
        
        if (!serviceRoleKey) {
          const matchKey = envContent.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
          if (matchKey && matchKey[1]) {
            serviceRoleKey = matchKey[1].trim().replace(/"/g, "").replace(/\r/g, "");
          }
        }
      } else {
        console.error("Could not find .env.local file in process.cwd() or parent directories");
      }
    } catch (e) {
      console.error("Failed to read environment variables from .env.local fallback:", e);
    }
  }

  if (!url || !serviceRoleKey) {
    throw new Error(`Missing Supabase URL or Service Role Key in environment variables! (url: ${url ? 'present' : 'missing'}, key: ${serviceRoleKey ? 'present' : 'missing'}, envPathFound: ${findEnvFile() !== null})`);
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
