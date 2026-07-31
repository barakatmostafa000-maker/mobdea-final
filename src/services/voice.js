import { Capacitor, registerPlugin } from '@capacitor/core';

const DEFAULT_LANGUAGE = 'ar-EG';
const NativeTextToSpeech = registerPlugin('MobdeaTextToSpeech');

let cachedVoices = [];
let voicesLoadingPromise = null;

function hasSpeechSupport() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

function isVoiceEnabled(settings = {}) {
  return !(
    settings.voiceEnabled === false ||
    settings.speechEnabled === false ||
    settings.soundEnabled === false ||
    settings.audioEnabled === false ||
    settings.muted === true ||
    settings.mute === true
  );
}

function clampNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function getVolume(settings = {}) {
  return clampNumber(
    settings.voiceVolume ?? settings.volume ?? settings.soundVolume,
    0,
    1,
    1,
  );
}

function getRate(settings = {}, style = 'normal') {
  const styleRates = {
    slow: 0.78,
    calm: 0.86,
    normal: 0.94,
    excited: 1.04,
    fast: 1.08,
  };

  return clampNumber(
    settings.voiceRate ?? settings.speechRate,
    0.5,
    1.5,
    styleRates[style] || styleRates.normal,
  );
}

function getPitch(settings = {}, style = 'normal') {
  const stylePitch = {
    calm: 0.95,
    normal: 1,
    excited: 1.08,
  };

  return clampNumber(
    settings.voicePitch ?? settings.speechPitch,
    0.5,
    1.5,
    stylePitch[style] || stylePitch.normal,
  );
}

function readCurrentVoices() {
  if (!hasSpeechSupport()) return [];
  const voices = window.speechSynthesis.getVoices() || [];
  if (voices.length) cachedVoices = voices;
  return voices.length ? voices : cachedVoices;
}

function waitForVoices(timeout = 1600) {
  const existing = readCurrentVoices();
  if (existing.length) return Promise.resolve(existing);
  if (voicesLoadingPromise) return voicesLoadingPromise;

  voicesLoadingPromise = new Promise((resolve) => {
    const synth = window.speechSynthesis;
    let finished = false;
    let timer;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      synth.removeEventListener?.('voiceschanged', handleVoicesChanged);
      const voices = readCurrentVoices();
      voicesLoadingPromise = null;
      resolve(voices);
    };

    const handleVoicesChanged = () => {
      if (readCurrentVoices().length) finish();
    };

    synth.addEventListener?.('voiceschanged', handleVoicesChanged);
    timer = window.setTimeout(finish, timeout);
    window.setTimeout(readCurrentVoices, 60);
  });

  return voicesLoadingPromise;
}

function selectArabicVoice(voices, settings = {}) {
  if (!Array.isArray(voices) || !voices.length) return null;
  const preferredName = String(
    settings.voiceName || settings.preferredVoice || '',
  )
    .trim()
    .toLowerCase();

  if (preferredName) {
    const preferred = voices.find((voice) =>
      String(voice.name || '')
        .toLowerCase()
        .includes(preferredName),
    );
    if (preferred) return preferred;
  }

  return (
    voices.find(
      (voice) => String(voice.lang || '').toLowerCase() === 'ar-eg',
    ) ||
    voices.find((voice) => /^ar[-_]/i.test(String(voice.lang || ''))) ||
    voices.find((voice) =>
      /arabic|عربي/i.test(`${voice.name || ''} ${voice.lang || ''}`),
    ) ||
    null
  );
}

function findClip(settings = {}, phraseType = '') {
  const collections = [
    settings.voiceClips,
    settings.audioClips,
    settings.soundClips,
    settings.clips,
    settings.voice?.clips,
  ];

  for (const collection of collections) {
    if (!collection || typeof collection !== 'object') continue;
    const clip = collection[phraseType];
    if (!clip) continue;
    if (typeof clip === 'string') return clip;
    if (typeof clip.url === 'string') return clip.url;
    if (typeof clip.src === 'string') return clip.src;
  }
  return '';
}

export async function playVoiceClip(settings = {}, phraseType = '') {
  if (!isVoiceEnabled(settings) || typeof Audio === 'undefined') {
    return false;
  }

  const url = findClip(settings, phraseType);
  if (!url) return false;

  try {
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.volume = getVolume(settings);
    await audio.play();
    return true;
  } catch (error) {
    console.warn('Voice clip could not be played:', error);
    return false;
  }
}

async function speakWithAndroid(text, settings, style) {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await NativeTextToSpeech.speak({
      text,
      language:
        settings.voiceLanguage || settings.language || DEFAULT_LANGUAGE,
      rate: getRate(settings, style),
      pitch: getPitch(settings, style),
      volume: getVolume(settings),
    });
    return true;
  } catch (error) {
    console.warn('Native Arabic speech failed:', error);
    return false;
  }
}

async function speakWithBrowser(text, settings, style) {
  if (!hasSpeechSupport()) return false;
  const synth = window.speechSynthesis;

  try {
    const voices = await waitForVoices();
    const utterance = new SpeechSynthesisUtterance(text);
    const arabicVoice = selectArabicVoice(voices, settings);
    utterance.lang =
      arabicVoice?.lang ||
      settings.voiceLanguage ||
      settings.language ||
      DEFAULT_LANGUAGE;
    if (arabicVoice) utterance.voice = arabicVoice;
    utterance.rate = getRate(settings, style);
    utterance.pitch = getPitch(settings, style);
    utterance.volume = getVolume(settings);

    if (synth.paused) synth.resume();
    if (settings.queueVoice !== true) synth.cancel();

    return await new Promise((resolve) => {
      let completed = false;
      const finish = (result) => {
        if (completed) return;
        completed = true;
        window.clearTimeout(timeout);
        resolve(result);
      };
      utterance.onend = () => finish(true);
      utterance.onerror = (event) => {
        console.warn('Arabic speech error:', event.error || event);
        finish(false);
      };
      const timeout = window.setTimeout(
        () => finish(true),
        Math.max(5000, text.length * 180),
      );
      window.setTimeout(() => {
        if (synth.paused) synth.resume();
        synth.speak(utterance);
      }, 40);
    });
  } catch (error) {
    console.warn('Arabic speech could not be started:', error);
    return false;
  }
}

export async function speakArabic(
  text,
  settings = {},
  style = 'normal',
) {
  const message = String(text || '').trim();
  if (!message || !isVoiceEnabled(settings)) return false;

  const nativeSpoken = await speakWithAndroid(message, settings, style);
  if (nativeSpoken) return true;
  return speakWithBrowser(message, settings, style);
}

export function buildEncouragementPhrase(type, studentName = '') {
  const name = String(studentName || '').trim();
  const student = name ? ` يا ${name}` : '';
  const phrases = {
    excellent: `ممتاز${student}، إجابة رائعة.`,
    correct: `أحسنت${student}، إجابة صحيحة.`,
    success: `رائع${student}، استمر بهذا التميز.`,
    good: `عمل جميل${student}، واصل التقدم.`,
    comic: `برافو${student}، أنت نجم الحصة اليوم.`,
    calm: `خطوة جميلة${student}، أكمل بهدوء وثقة.`,
    try: `حاول مرة أخرى${student}، أنت تستطيع.`,
    wrong: `لا بأس${student}، حاول مرة أخرى.`,
    start: `هيا نبدأ${student}.`,
    complete: `أحسنت${student}، تم إكمال المهمة بنجاح.`,
    welcome: `مرحباً بك${student} في منصة المبدع.`,
  };
  return phrases[type] || phrases.good;
}

export function encourageStudent(
  type,
  studentName = '',
  settings = {},
) {
  const phrase = buildEncouragementPhrase(type, studentName);
  const style = ['excellent', 'correct', 'success', 'complete'].includes(
    type,
  )
    ? 'excited'
    : type === 'calm'
      ? 'calm'
      : 'normal';
  return speakArabic(phrase, settings, style);
}

export async function speakWelcome(settings = {}) {
  const clipPlayed = await playVoiceClip(settings, 'welcome');
  if (clipPlayed) return true;
  const customWelcome =
    settings.welcomeMessage ||
    settings.voiceWelcomeMessage ||
    'مرحباً بك في منصة المبدع، نتمنى لك تعلماً ممتعاً.';
  return speakArabic(customWelcome, settings, 'calm');
}

if (hasSpeechSupport()) {
  readCurrentVoices();
  const unlockSpeech = () => {
    try {
      window.speechSynthesis.resume();
      readCurrentVoices();
    } catch {
      // لا يلزم اتخاذ إجراء.
    }
  };
  window.addEventListener('pointerdown', unlockSpeech, { passive: true });
  window.addEventListener('touchend', unlockSpeech, { passive: true });
  window.addEventListener('keydown', unlockSpeech, { passive: true });
}
