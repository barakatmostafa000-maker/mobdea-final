const history = new Map();

const phrases = {
  excellent: [
    'والله مبدع يا {name}',
    'مبهر يا {name}',
    'ممتاز يا {name}',
    'إجابة قوية جدًا يا {name}',
    'مجتهد، ربنا يحفظك يا {name}',
    'برافو عليك يا {name}، واضح إنك مذاكر'
  ],
  close: [
    'حلوة منك بس ناقصها سكر يا {name}',
    'قريبة جدًا يا {name}، حاول مرة كمان',
    'لسه ناقص تفصيلة صغيرة يا {name}',
    'فكر بهدوء يا {name}، أنت قريب من الإجابة'
  ],
  retry: [
    'ولا يهمك يا {name}، حاول مرة ثانية',
    'ركز شوية يا {name} وأنت هتوصل',
    'ابدأ من أول خطوة يا {name}',
    'أنت تقدر يا {name}، جرب مرة كمان'
  ],
  calm: [
    'هدوء وتركيز يا {name}',
    'خد وقتك يا {name}',
    'اسمع السؤال للآخر يا {name}',
    'ركز في الكلمة المفتاحية يا {name}'
  ]
};

function pickNonRepeated(type, name) {
  const list = phrases[type] || phrases.excellent;
  const key = `${type}:${name}`;
  const previous = history.get(key);
  const candidates = list.filter((_, index) => index !== previous);
  const selectedText = candidates[Math.floor(Math.random() * candidates.length)];
  const selectedIndex = list.indexOf(selectedText);
  history.set(key, selectedIndex);
  return selectedText.replace('{name}', name);
}

export function speakArabic(text, settings = {}) {
  if (settings.voiceEnabled === false || !text || !('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ar-EG';
  utterance.volume = Math.max(0, Math.min(1, Number(settings.voiceVolume ?? 1)));
  utterance.rate = Number(settings.voiceRate ?? 0.92);

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

export function encourageStudent(type, studentName, settings) {
  const text = pickNonRepeated(type, studentName);
  speakArabic(text, settings);
  return text;
}

export function speakWelcome(settings) {
  return speakArabic('المُبدع مصطفى بركات، المُبدع لتعليم ممتع', settings);
}
