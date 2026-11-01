/* MoneyManager settings — the only file you need to edit.
   Find these in Supabase: Project Settings → API (or the "Connect" button).
   The anon / publishable key is safe in a website: row-level security
   (supabase/schema.sql) lets each user read and write only their own data.
   Never put the service_role / secret key here.
   Until both values are filled in, the site runs in Demo mode.
   Project: moneymanager (US East) in the aig61-money-manager organization. */
window.MM_CONFIG = {
  supabaseUrl: "https://bhtpbnvmtgggiuscqzgz.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJodHBibnZtdGdnZ2l1c2Nxemd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MDgyMzMsImV4cCI6MjEwOTA4NDIzM30.MzjTeRpY-C79DV69N8iPtcmjgHsoNUgzD05n46ja4-o",

  // Shown in the "Want help putting this plan in place?" box on every report
  advisor: { org: "DareToDreams Financial Group", phone: "870-543-0062" }
};
