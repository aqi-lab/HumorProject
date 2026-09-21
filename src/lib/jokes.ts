export type Joke = {
  id: number;
  setup: string;
  punchline: string;
};

export async function getJokes(): Promise<Joke[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured yet.");
  }

  const url = new URL("/rest/v1/jokes", supabaseUrl);
  url.searchParams.set("select", "id,setup,punchline");
  url.searchParams.set("order", "id.asc");

  const response = await fetch(url, {
    headers: { apikey: supabaseAnonKey },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}).`);
  }

  const rows: unknown = await response.json();
  if (
    !Array.isArray(rows) ||
    !rows.every(
      (row) =>
        typeof row.id === "number" &&
        typeof row.setup === "string" &&
        typeof row.punchline === "string",
    )
  ) {
    throw new Error("Supabase returned unexpected joke data.");
  }

  return rows as Joke[];
}
