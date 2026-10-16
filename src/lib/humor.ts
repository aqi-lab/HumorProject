const scenes = [
  "You left Butler Library for a quick coffee. It is now a three-hour side quest.",
  "The subway says your train is one minute away. It has said that for ten minutes.",
  "Your dorm room is smaller than the closet you grew up with in the Midwest.",
  "You went downtown for a cheap weekend. Your bank account would like a word.",
  "You dressed for fall in New York. The weather chose all four seasons.",
  "You called a fifteen-dollar salad a little treat between classes.",
  "Your group chat has planned a city adventure. Nobody has left campus.",
  "You tried to explain the Core Curriculum to someone at a party.",
  "The dining hall menu called this an international experience.",
  "You finally found a quiet study spot. Someone opens a bag of chips.",
  "You told your Midwest family that a twenty-minute walk is basically next door.",
  "You took the express train with local-train confidence.",
  "Your weekend itinerary has six neighborhoods and a budget of twelve dollars.",
  "You made eye contact with a pigeon that clearly pays rent here.",
];

export function dailyChallenge(now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const day = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86400000);
  return { date, scene: scenes[day % scenes.length] };
}

export type Caption = {
  id: string;
  scene: string;
  caption: string;
  style: string;
  challenge_date: string | null;
  created_at: string;
  score: number;
  vote_count: number;
  photo_url?: string;
  input_scene?: string;
  caption_instructions?: string;
  source_caption_id?: string;
  image_origin?: "uploaded" | "generated";
};
export type ActionState = { error?: string; success?: string };
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
