// @ts-check
// Everything event-specific lives here. For the next event, change these
// values and the EVENT_TAG / EVENT_CODE secrets in Supabase.

export const CONFIG = {
  /** Shown as the page title and heading. */
  eventName: "Frivilligfesten 2026",

  /** Supabase project that runs the `upload` and `get-images` functions. */
  supabaseUrl: "https://yqbnwxwqlekqwdooevyb.supabase.co",

  /**
   * Supabase publishable (anon) key. It is safe to ship to browsers: it only
   * identifies the project, and both functions do their own checks.
   */
  supabaseKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYm53eHdxbGVrcXdkb29ldnliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTI1MTksImV4cCI6MjA3NTc2ODUxOX0.WBP2B6EHr1IEpMMEUOpQYonNoNyVF7HNKKrCgr_dQZI",

  /**
   * Address printed in the QR code. Leave empty to use the address the admin
   * page is opened on (e.g. https://your-site.vercel.app/).
   */
  publicUploadUrl: "",

  /** Max photos a guest can send in one go. */
  maxFiles: 10,

  /** Photos larger than this are shrunk in the browser before upload. */
  maxUploadMB: 10,
};
