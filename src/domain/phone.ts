export function normalizePhone(input: string): string {
  if (!input) return '';
  let s = input.trim().replace(/[\s()-]/g, '');
  if (s.startsWith('+62')) {
    s = '62' + s.slice(3);
  } else if (s.startsWith('62')) {
    // keep
  } else if (s.startsWith('0')) {
    s = '62' + s.slice(1);
  }
  return s;
}

export function isValidPhone(input: string): boolean {
  const n = normalizePhone(input);
  if (!/^62[0-9]+$/.test(n)) return false;
  const rest = n.slice(2);
  if (rest.length < 9 || rest.length > 13) return false;
  if (!rest.startsWith('8')) return false;
  return true;
}
