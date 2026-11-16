/* Supabase connection for the live content store.
   Fill these in from Supabase → Project Settings → API. The anon key is
   public by design: Row Level Security (supabase/setup.sql) only lets the
   signed-in editor account write. Leave `url` empty to fall back to
   data/content.json. */
window.VCOH_SUPABASE = {
  url: "",            /* e.g. "https://abcdefghijkl.supabase.co" */
  anonKey: "",        /* the "anon" / "publishable" key */
  editorEmail: "",    /* the editor login you created in Authentication → Users */
  bucket: "site-media"
};
