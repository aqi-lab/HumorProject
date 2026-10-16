// Set NEXT_PUBLIC_ENABLE_REMIX=false and redeploy to remove the entire reuse flow.
// Photos, creation, voting and saved captions do not depend on this feature.
export const reusePromptEnabled = process.env.NEXT_PUBLIC_ENABLE_REMIX !== "false";

export function reusePromptPath(id: string) {
  return `/create?remix=${id}`;
}
