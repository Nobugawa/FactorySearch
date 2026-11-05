// Publishable key is safe to expose; RLS protects data.
window.FS_CONFIG = {
  SUPABASE_URL: "https://vixnrugeiclzukzickmq.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ODsRX0NFdFc9gG-qmAxleQ_412Xkh2g",
  // Add Teddy's email as a second entry once known (and in schema RLS arrays).
  // Roles: philoskim990@gmail.com = owner/admin; philos@greymatterfusion.com = reviewer (sees exactly what Teddy will).
  ALLOWED_EMAILS: ["philoskim990@gmail.com", "philos@greymatterfusion.com" /* , "TEDDY_EMAIL" */],
  VERSION: "v1.1.0",
  GA4_MEASUREMENT_ID: "" // optional, e.g. "G-XXXXXXX"; empty = off
};
