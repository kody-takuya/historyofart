// TTS が音声の末尾に付けることがある、クリッピングしたノイズ（最後の無音の後に出る短い破裂音）を取り除く。
// 24kHz/16bit/mono の PCM を受け取り、フェードアウトを付けた PCM を返す。
const RATE = 24000;

export function cleanTail(pcm) {
  const n = Math.floor(pcm.length / 2);
  const s = new Int16Array(n);
  for (let i = 0; i < n; i++) s[i] = pcm.readInt16LE(i * 2);

  const win = RATE / 100; // 10ms
  const rms = (from) => { let a = 0; for (let i = from; i < from + win; i++) a += s[i] * s[i]; return Math.sqrt(a / win); };
  let end = n;

  // 末尾1秒以内で、最後の「80ms以上の無音」を探し、その後ろが 0.7 秒未満かつクリッピングを含むなら切り捨てる
  const scanFrom = Math.max(0, n - RATE);
  let runStart = -1, lastSilence = -1;
  for (let i = scanFrom; i + win <= n; i += win) {
    if (rms(i) < 60) { if (runStart < 0) runStart = i; if (i + win - runStart >= RATE * 0.08) lastSilence = runStart; }
    else runStart = -1;
  }
  if (lastSilence >= 0) {
    const tailStart = lastSilence + Math.floor(RATE * 0.08);
    let clipped = false;
    for (let i = tailStart; i < n; i++) if (Math.abs(s[i]) >= 32000) { clipped = true; break; }
    if (clipped && n - tailStart < RATE * 0.7) { end = tailStart; console.log(`末尾のノイズを ${((n - end) / RATE).toFixed(2)} 秒分除去しました`); }
  }

  // 末尾 200ms をフェードアウトし、その後に 300ms の無音を足す
  const fade = Math.min(end, Math.floor(RATE * 0.2));
  for (let i = 0; i < fade; i++) s[end - fade + i] = Math.round(s[end - fade + i] * (1 - i / fade));
  const out = Buffer.alloc((end + Math.floor(RATE * 0.3)) * 2);
  for (let i = 0; i < end; i++) out.writeInt16LE(s[i], i * 2);
  return out;
}
