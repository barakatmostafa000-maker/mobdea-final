import { acquireAssetUrl, releaseAssetUrl } from './assetStore';

const history = new Map();

const phrases = {
  excellent: ['والله مبدع يا {name}', 'مبهر يا {name}', 'ممتاز يا {name}', 'إجابة قوية جدًا يا {name}', 'مجتهد، ربنا يحفظك يا {name}', 'برافو عليك يا {name}، واضح إنك مذاكر'],
  close: ['حلوة منك بس ناقصها سكر يا {name}', 'قريبة جدًا يا {name}، حاول مرة كمان', 'لسه ناقص تفصيلة صغيرة يا {name}', 'فكر بهدوء يا {name}، أنت قريب من الإجابة'],
  retry: ['ولا يهمك يا {name}، حاول مرة ثانية', 'ركز شوية يا {name} وأنت هتوصل', 'ابدأ من أول خطوة يا {name}', 'أنت تقدر يا {name}، جرب مرة كمان'],
  calm: ['هدوء وتركيز يا {name}', 'خد وقتك يا {name}', 'اسمع السؤال للآخر يا {name}', 'ركز في الكلمة المفتاحية يا {name}'],
  comic: ['اتقي الله يا {name}', 'يا رب استرها علينا من {name}', 'هو إحنا هنفضل كده يا {name}', 'فين المذاكرة يا {name}', 'ده أنت هتجيبلي الضغط يا {name}'],
};

function pickNonRepeated(type, name) {
  const list = phrases[type] || phrases.excellent;
  const key = `${type}:${name}`;
  const previous = history.get(key);
  const candidates = list.filter((_, index) => index !== previous);
  const selectedText = candidates[Math.floor(Math.random() * candidates.length)] || list[0];
  history.set(key, list.indexOf(selectedText));
  return selectedText.replace('{name}', name);
}

function playAudioUrl(url, onDone) {
  if (!url) return false;
  try {
    const audio = new Audio(url);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      onDone?.();
    };
    audio.preload = 'auto';
    audio.addEventListener('ended', cleanup, { once: true });
    audio.addEventListener('error', cleanup, { once: true });
    audio.play().catch(cleanup);
    return true;
  } catch {
    onDone?.();
    return false;
  }
}

function findClip(settings, phraseType) {
  const clips = Array.isArray(settings?.voiceClips) ? settings.voiceClips : [];
  const normalized = String(phraseType || '').toLowerCase();
  const playable = (clip) => Boolean(clip?.assetId || clip?.url);
  const exact = clips.filter((clip) => playable(clip) && String(clip.phraseType || clip.type || '').toLowerCase() === normalized);
  if (exact.length) return exact[exact.length - 1];
  return clips.find((clip) => playable(clip) && clip?.text && String(clip.text).toLowerCase().includes(normalized)) || null;
}

function playClipInBackground(clip) {
  if (clip?.url) return playAudioUrl(clip.url);
  if (!clip?.assetId) return false;
  acquireAssetUrl(clip.assetId)
    .then((url) => {
      if (!url) return;
      playAudioUrl(url, () => releaseAssetUrl(clip.assetId));
    })
    .catch(() => {});
  return true;
}

function speakWithFallback(text, settings = {}, style = 'normal') {
  if (settings.voiceEnabled === false || !text || !globalThis.window || !('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ar-EG';
  utterance.volume = Math.max(0, Math.min(1, Number(settings.voiceVolume ?? 1)));
  utterance.rate = style === 'bored' ? 0.72 : style === 'excited' ? 1.02 : Number(settings.voiceRate ?? 0.92);
  utterance.pitch = style === 'bored' ? 0.82 : style === 'excited' ? 1.08 : 1;
  const voices = window.speechSynthesis.getVoices();
  const arabic = voices.filter((voice) => voice.lang?.toLowerCase().startsWith('ar'));
  const preferred = settings.voiceGender === 'female'
    ? arabic.find((voice) => /female|woman|أنثى/i.test(voice.name))
    : settings.voiceGender === 'male'
      ? arabic.find((voice) => /male|man|ذكر/i.test(voice.name))
      : null;
  utterance.voice = preferred || arabic[0] || null;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function playVoiceClip(settings, phraseType) {
  const clip = findClip(settings, phraseType);
  if (!clip) return null;
  return playClipInBackground(clip) ? clip : null;
}

export function speakArabic(text, settings = {}, style = 'normal') {
  const clipType = style === 'bored' ? 'comic' : style === 'excited' ? 'excellent' : null;
  if (clipType && playVoiceClip(settings, clipType)) return true;
  return speakWithFallback(text, settings, style);
}

export function encourageStudent(type, studentName, settings) {
  const played = playVoiceClip(settings, type);
  if (played) return played.title || played.text || pickNonRepeated(type, studentName);
  const text = pickNonRepeated(type, studentName);
  speakWithFallback(text, settings, type === 'comic' ? 'bored' : type === 'excellent' ? 'excited' : 'normal');
  return text;
}

export function speakWelcome(settings) {
  if (playVoiceClip(settings, 'welcome')) return true;
  return speakWithFallback('السلام عليكم ورحمة الله وبركاته، أهلاً بك أستاذ مصطفى بركات. نورت منصة المُبدع لتعليم ممتع.', settings, 'normal');
}
