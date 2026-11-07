// Eligibility is selected from the server-validated application, never branding
// query parameters. Short-transaction entry additionally requires a center hosted policy.
const registeredApplications: ReadonlyMap<string, string> = new Map([
  ["marventa-dev", "app-marventa-dev"],
  ["driveacademy-dev", "app-driveacademy-dev"],
  ["releasedesk-dev", "app-releasedesk-dev"],
  ["k8s-headlamp-dev", "app-k8s-headlamp-dev"],
  ["nginx-ui-dev", "app-nginx-ui-dev"],
  ["docmost-book", "app-docmost"],
  ["prism-wechat-pilot", "app-prism"],
  ["browsemate-dev", "app-browsemate-dev"],
  ["releasedesk-live", "app-releasedesk-live"],
]);

export function isHostedApplication(application: {clientId?: string; name?: string} | null | undefined): boolean {
  return typeof application?.clientId === "string" && typeof application.name === "string"
    && registeredApplications.get(application.clientId) === application.name;
}
