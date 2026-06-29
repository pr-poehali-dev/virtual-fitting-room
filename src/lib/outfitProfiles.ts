import type { OutfitFormParams } from "@/components/OutfitReport";

const LOOKBOOKS_API =
  "https://functions.poehali.dev/69de81d7-5596-4e1d-bbd3-4b3e1a520d6b";

export interface OutfitProfile {
  id: number;
  name: string;
  comment: string;
  form_params: OutfitFormParams;
  created_at: string | null;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("session_token");
  return token ? { "X-Session-Token": token } : {};
}

export async function fetchOutfitProfiles(): Promise<OutfitProfile[]> {
  const res = await fetch(`${LOOKBOOKS_API}?action=outfit_profiles`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Не удалось загрузить анкеты");
  const data = await res.json();
  return (data.profiles || []) as OutfitProfile[];
}

export async function saveOutfitProfile(payload: {
  name: string;
  comment: string;
  form_params: OutfitFormParams;
}): Promise<OutfitProfile> {
  const res = await fetch(`${LOOKBOOKS_API}?action=outfit_profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify({ action: "outfit_profiles", ...payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Не удалось сохранить анкету");
  return data as OutfitProfile;
}

export async function deleteOutfitProfile(id: number): Promise<void> {
  const res = await fetch(
    `${LOOKBOOKS_API}?action=outfit_profiles&id=${id}`,
    {
      method: "DELETE",
      headers: authHeaders(),
      credentials: "include",
    },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Не удалось удалить анкету");
  }
}
