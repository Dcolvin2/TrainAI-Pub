// lib/api.ts
export async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  // Prefer relative path in browser to avoid cross-origin 404s
  const url =
    typeof window !== 'undefined'
      ? path // relative always
      : process.env.NEXT_PUBLIC_BASE_URL
      ? `${process.env.NEXT_PUBLIC_BASE_URL}${path}`
      : path;

  const res = await fetch(url, init);

  // If server returned HTML (e.g., error page), throw a helpful error
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(
      `Expected JSON but got ${contentType || 'unknown'} (status ${res.status}). First 120 chars: ${text.slice(
        0,
        120
      )}`
    );
  }

  const data = (await res.json()) as T;
  return data;
}
