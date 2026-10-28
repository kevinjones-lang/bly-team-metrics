import { handleMicrosoftRedirect, microsoftConfigured } from "./referrals/outlook.ts";

const note = document.querySelector("p");
if (!microsoftConfigured()) {
  if (note) note.textContent = "Microsoft sign-in is not configured on this site.";
} else {
  handleMicrosoftRedirect().then(() => {
    if (note) note.textContent = "Microsoft sign-in finished. You can close this window.";
  }).catch(() => {
    if (note) note.textContent = "Microsoft sign-in did not finish. Close this window and try Connect Microsoft again.";
  });
}
