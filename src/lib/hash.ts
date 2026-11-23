/** 그림 비밀번호 해시 (이 기기 체험 모드용). 서버 모드는 DB의 pgcrypto가 해시한다. */
export async function hashPin(salt: string, pin: string): Promise<string> {
  const text = `${salt}:${pin}`;
  if (globalThis.crypto?.subtle) {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // 보안 연결이 아닌 곳(교실 내부 http)에서의 대체 해시
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'fnv' + (h >>> 0).toString(16);
}
