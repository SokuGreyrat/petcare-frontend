export function randomCode(len: number = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function safeAvatarLetter(name?: string): string {
  const t = (name || '').trim();
  return t ? t[0].toUpperCase() : 'P';
}
