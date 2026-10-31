const BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.8-flash';
export const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-preview-tts';
const key = () => { if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY が未設定です'); return process.env.GEMINI_API_KEY; };

async function call(model, body, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key() }, body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    if (res.status === 404) {
      const l = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': key() } }).then((r) => r.json()).catch(() => ({}));
      throw new Error(`モデル ${model} が見つかりません。利用可能: ${(l.models || []).map((m) => m.name.replace('models/', '')).join(', ')}`);
    }
    if (res.status < 500 && res.status !== 429) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
  }
  throw new Error('Gemini: リトライ上限');
}

// JSON を返すテキスト生成。search:true で Google 検索によるグラウンディングを使う（その場合 JSON モードは併用不可）。
export async function generateJson(prompt, { search = false } = {}) {
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8 } };
  if (search) body.tools = [{ google_search: {} }]; else body.generationConfig.responseMimeType = 'application/json';
  const r = await call(TEXT_MODEL, body);
  const parts = r.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || '').join('');
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const json = JSON.parse(m ? m[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const chunks = r.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return { json, sources: chunks.map((c) => c.web).filter(Boolean) };
}

// 男女2話者の掛け合い音声。戻り値は 24kHz/16bit/mono の PCM。
export async function synthesize(lines, voices) {
  const script = lines.map((l) => `${l.speaker}: ${l.text}`).join('\n');
  const names = [...new Set(lines.map((l) => l.speaker))];
  const r = await call(TTS_MODEL, {
    contents: [{ parts: [{ text: `次の対話を、落ち着いた知的で親しみやすい口調の日本語で読み上げてください。\n${script}` }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { multiSpeakerVoiceConfig: { speakerVoiceConfigs: names.map((n) => ({
        speaker: n, voiceConfig: { prebuiltVoiceConfig: { voiceName: voices[n] } } })) } },
    },
  });
  const part = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error('TTS から音声が返りませんでした');
  return Buffer.from(part.inlineData.data, 'base64');
}

export function pcmToWav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
