/* MoneyManager settings — the only file you need to edit.
   Find these values in Supabase: Project Settings → API (or "Connect" → App frameworks).
   The anon / publishable key is safe to put in a website: row-level security
   (supabase/schema.sql) makes sure each user can only read and write their own data. */
window.MM_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT-ID.supabase.co",
  supabaseAnonKey: "YOUR-ANON-OR-PUBLISHABLE-KEY",

  // Shown in the "Want help putting this plan in place?" box on every report
  advisor: { org: "DareToDreams Financial Group", phone: "870-543-0062" }
};
