export interface HostedContext {status: string; query?: string; expiresAt: number; restartUrl: string; restartOptions?: {url: string; label: string}[]}
let context: {id: string; value: HostedContext} | undefined;
const pending = new Map<string, Promise<HostedContext>>();
export function hostedId() {return window.location.pathname.match(/^\/login\/t\/([A-Za-z0-9_-]{43})$/)?.[1];}
export function getHostedContext() {return context?.id === hostedId() ? context?.value : undefined;}
export function getHostedSearch() {return getHostedContext()?.query ? `?${getHostedContext()!.query}` : window.location.search;}
export async function hostedAction(action: "context" | "status" | "cancel") {
  const id = hostedId();
  if (!id) throw new Error("invalid_hosted_transaction");
  const response = await fetch(`/delegation/hosted/requests/${id}/${action}`, {method: "POST", credentials: "same-origin", headers: {"Content-Type": "application/json"}, body: "{}", signal: AbortSignal.timeout(5000)});
  if (!response.ok) {
    if (response.status === 403 || response.status === 410) {
      const failure = await response.json();
      return {status: "expired", expiresAt: 0, restartUrl: typeof failure.restartUrl === "string" ? failure.restartUrl : "", restartOptions: Array.isArray(failure.restartOptions) ? failure.restartOptions : []};
    }
    throw new Error("hosted_unavailable");
  }
  return response.json() as Promise<HostedContext>;
}
export function loadHostedContext() {
  const id = hostedId();
  if (!id) return Promise.reject(new Error("invalid_hosted_transaction"));
  if (!pending.has(id)) pending.set(id, hostedAction("context").then(value => {
    context = {id, value};
    return value;
  }).catch(error => {pending.delete(id); throw error;}));
  return pending.get(id)!;
}
