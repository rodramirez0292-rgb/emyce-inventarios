export type SerialDraft = {
  candidate: string | null;
  originalCode: string;
  photo: string;
  notes: string;
  condition: string;
};
export function readSerialDraft(key: string): Partial<SerialDraft> {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    if (!value || typeof value !== "object") return {};
    const draft: Partial<SerialDraft> = {};
    for (const field of ["candidate", "originalCode", "photo", "notes", "condition"] as const)
      if (typeof value[field] === "string") draft[field] = value[field];
    return draft;
  } catch { return {}; }
}
export function saveSerialDraft(key: string, draft: SerialDraft): boolean {
  try {
    if (draft.candidate === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch { return false; }
}
