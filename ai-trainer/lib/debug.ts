/* ⚠️ DEBUG ONLY – remove when fixed */
export function dbg(label: string, data?: any) {
  //  eslint-disable-next-line no-console
  console.log(`🔍 ${label}:`, JSON.stringify(data, null, 2));
} 