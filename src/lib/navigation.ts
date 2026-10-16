// Explicit destinations keep OAuth return URLs on this app.
export function signInDestination(value: unknown): string {
  if (value === "create") return "/create";
  if (value === "members") return "/members";
  if (typeof value !== "string") return "/";
  if (["/", "/create", "/create?daily=1", "/collection", "/collection?view=liked", "/members", "/profile"].includes(value)) return value;
  if (/^\/create\?remix=[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return value;
  if (/^\/caption\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return value;
  if (/^\/caption\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\?compare=[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return value;
  return "/";
}
