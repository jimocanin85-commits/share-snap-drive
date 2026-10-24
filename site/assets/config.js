// @ts-check
// Everything event-specific in the browser lives here. For the next event,
// change these values and the EVENT_TAG / EVENT_CODE variables in Vercel.

export const CONFIG = {
  /** Shown as the page title and heading. */
  eventName: "Frivilligfesten 2026",

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
