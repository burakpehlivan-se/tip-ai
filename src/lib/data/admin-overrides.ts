import { TestSonucu } from "../types";
import { AdminTestOverrides } from "./case-generator";

let cache: AdminTestOverrides | null = null;
let cacheAt = 0;
const TTL_MS = 30_000;

/** Admin deposundan hastalikKey → statikTestler haritası (client) */
export async function fetchAdminTestOverrides(force = false): Promise<AdminTestOverrides> {
  if (!force && cache && Date.now() - cacheAt < TTL_MS) return cache;
  try {
    const res = await fetch("/api/cases/templates");
    if (!res.ok) return cache || {};
    const data = await res.json();
    const map: AdminTestOverrides = {};
    for (const t of data.templates || []) {
      if (t.hastalikKey && t.statikTestler) {
        map[t.hastalikKey] = t.statikTestler as Record<string, TestSonucu>;
      }
    }
    cache = map;
    cacheAt = Date.now();
    return map;
  } catch {
    return cache || {};
  }
}
