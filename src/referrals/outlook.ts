// Staff Microsoft sign-in (public SPA) and Graph draft creation in that person's mailbox.
// The client id is not a secret. A blank mailto is never used.
import { BrowserCacheLocation, PublicClientApplication, type AccountInfo } from "@azure/msal-browser";
import { graphAttachment, graphMessage, type OutlookDraftInput } from "./outlookDraft.ts";

const SCOPES = ["User.Read", "Mail.ReadWrite"];

export type DraftResult = { webLink: string | null; account: string; mailbox: string | null };

let pcaPromise: Promise<PublicClientApplication> | null = null;

export function microsoftClientId(): string {
  return (import.meta.env.VITE_MICROSOFT_CLIENT_ID ?? "").trim();
}

export function microsoftConfigured(): boolean {
  return microsoftClientId().length > 0;
}

export function microsoftRedirectUri(): string {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return new URL("microsoft-auth.html", `${window.location.origin}${base}`).href;
}

function authority(): string {
  const tenant = (import.meta.env.VITE_MICROSOFT_TENANT_ID ?? "").trim() || "organizations";
  return `https://login.microsoftonline.com/${tenant}`;
}

async function getPca(): Promise<PublicClientApplication> {
  if (!microsoftConfigured()) throw new Error("Microsoft sign-in is not configured on this site.");
  if (!pcaPromise) {
    const app = new PublicClientApplication({
      auth: {
        clientId: microsoftClientId(),
        authority: authority(),
        redirectUri: microsoftRedirectUri(),
      },
      cache: { cacheLocation: BrowserCacheLocation.LocalStorage },
    });
    pcaPromise = app.initialize().then(() => app);
  }
  return pcaPromise;
}

/** Popup redirect page. Processes the Microsoft response and lets the opener finish. */
export async function handleMicrosoftRedirect(): Promise<void> {
  if (!microsoftConfigured()) return;
  const app = await getPca();
  await app.handleRedirectPromise();
}

export async function microsoftAccount(): Promise<AccountInfo | null> {
  if (!microsoftConfigured()) return null;
  const app = await getPca();
  return app.getAllAccounts()[0] ?? null;
}

export async function connectMicrosoft(): Promise<AccountInfo> {
  const app = await getPca();
  const result = await app.loginPopup({ scopes: SCOPES, prompt: "select_account", redirectUri: microsoftRedirectUri() });
  return result.account;
}

async function accessToken(): Promise<{ token: string; account: AccountInfo }> {
  const app = await getPca();
  const existing = app.getAllAccounts()[0];
  const account = existing ?? await connectMicrosoft();
  try {
    const silent = await app.acquireTokenSilent({ scopes: SCOPES, account });
    return { token: silent.accessToken, account };
  } catch {
    const popup = await app.acquireTokenPopup({ scopes: SCOPES, account, redirectUri: microsoftRedirectUri() });
    return { token: popup.accessToken, account };
  }
}

export async function createStaffDraft(input: OutlookDraftInput): Promise<DraftResult> {
  const { token, account } = await accessToken();
  const created = await graphJson(token, "POST", "https://graph.microsoft.com/v1.0/me/messages", graphMessage(input));
  const id = typeof created.id === "string" ? created.id : "";
  if (!id) throw new Error("Microsoft did not return a draft id.");
  const attached = await graphJson(token, "POST", `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(id)}/attachments`, graphAttachment(input));
  if (!attached.ok) {
    await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
    throw new Error(attached.error || "Microsoft rejected the PDF attachment. The empty draft was removed.");
  }
  const webLink = typeof created.webLink === "string" ? created.webLink : null;
  const who = account.username || account.name || "your Microsoft account";
  return { webLink, account: who, mailbox: null };
}

async function graphJson(token: string, method: string, url: string, body: unknown): Promise<{ ok: boolean; id?: string; webLink?: string; error?: string }> {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let payload: { id?: unknown; webLink?: unknown; error?: { message?: unknown; code?: unknown } } = {};
  try { payload = await res.json() as typeof payload; } catch { /* empty */ }
  if (!res.ok) {
    const message = typeof payload.error?.message === "string" ? payload.error.message : `Microsoft Graph returned ${res.status}.`;
    if (url.endsWith("/attachments")) return { ok: false, error: message };
    throw new Error(message);
  }
  return {
    ok: true,
    id: typeof payload.id === "string" ? payload.id : undefined,
    webLink: typeof payload.webLink === "string" ? payload.webLink : undefined,
  };
}
