const lastUsedKey = "lastAccessories";

interface Exercise {
  name: string;
  [key: string]: unknown;
}

export function pickAccessories(pool: Exercise[], count: number): Exercise[] {
  const last = JSON.parse(localStorage.getItem(lastUsedKey) || "[]");

  // remove last-used items from the pool
  const freshPool = pool.filter(e => !last.includes(e.name));

  // if pool too small, reset history
  const finalPool = freshPool.length >= count ? freshPool : pool;

  // random shuffle
  const shuffled = finalPool.sort(() => 0.5 - Math.random()).slice(0, count);

  // save names for next call
  localStorage.setItem(lastUsedKey, JSON.stringify(shuffled.map(e => e.name)));

  return shuffled;
} 