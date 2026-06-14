/**
 * Supabase connection config.
 *
 * The publishable key is a *public* client key (akin to a Firebase web API key):
 * it only grants the access your Row-Level Security policies allow, so it is safe
 * to ship in the browser bundle. Never put the `service_role` key here.
 */
export const environment = {
  production: false,
  supabaseUrl: 'https://mdhvgoqmtiufleaweevc.supabase.co',
  supabaseKey: 'sb_publishable_2G4de-dJqXKevbj8dW_OFA_U-r51Cqm',
};
