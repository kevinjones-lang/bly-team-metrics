import { microsoftConfigured, microsoftRedirectUri } from "./outlook.ts";

const PAGES = "https://kevinjones-lang.github.io/bly-team-metrics/microsoft-auth.html";
const LOCAL = "http://localhost:5173/bly-team-metrics/microsoft-auth.html";

/** Shown when the site was built without a Microsoft app id. Drafts stay off a blank email. */
export default function OutlookSetup() {
  if (microsoftConfigured()) return null;
  const here = typeof window !== "undefined" ? microsoftRedirectUri() : PAGES;
  return (
    <div className="rh-note" role="status">
      <p><b>Outlook is not connected for this agent yet.</b> Drafts are supposed to be created in each person’s own Outlook. This site was built without a Microsoft app id, so that path is off.</p>
      <p>The owner registers a Microsoft Entra single-page application and rebuilds the site with these GitHub Actions secrets:</p>
      <ul>
        <li><b>VITE_MICROSOFT_CLIENT_ID</b> — the application (client) ID. This is public build config, not an Azure client secret.</li>
        <li><b>VITE_MICROSOFT_TENANT_ID</b> — the directory (tenant) ID for a single-tenant app. Leave it empty only if the app is registered for any work account (`organizations`).</li>
      </ul>
      <p>In that app registration:</p>
      <ul>
        <li>Platform: Single-page application. Do not create a client secret for the browser.</li>
        <li>Delegated Microsoft Graph permissions: Mail.ReadWrite and User.Read. Grant admin consent.</li>
        <li>Redirect URI: <b>{PAGES}</b></li>
        <li>Local preview redirect URI: <b>{LOCAL}</b></li>
        {here !== PAGES && here !== LOCAL ? <li>This browser’s redirect URI is <b>{here}</b>. Add that too if it is different.</li> : null}
      </ul>
      <p>Until the client id is in the build, Create Outlook draft uses the team-mailbox fallback (the referral-outlook function) when those Edge secrets exist. The filled PDF is still required. A blank email is not opened.</p>
    </div>
  );
}
