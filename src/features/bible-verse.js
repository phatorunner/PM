/* =====================================================================
   BIBLE VERSE ROTATION SERVICE (YourVision / Bible API)
   - Rotates to a different Bible verse every 60 minutes.
   - Preserves hourly stability in localStorage and memory.
   - Graceful fallback with rich authentic passages if API is unreachable.
   - Generates direct passage links for Bible.com (YouVersion) / BibleGateway.
   ===================================================================== */
import { render } from '../shell/render.js';

const STORAGE_KEY = 'hanhpm_bible_verse_cache';

// Curated pool of foundational scripture references
export const SCRIPTURE_POOL = [
  { ref: 'John 3:16', text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' },
  { ref: 'Jeremiah 29:11', text: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.' },
  { ref: 'Proverbs 3:5-6', text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.' },
  { ref: 'Philippians 4:13', text: 'I can do all things through Christ which strengtheneth me.' },
  { ref: 'Romans 8:28', text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.' },
  { ref: 'Isaiah 40:31', text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.' },
  { ref: 'Psalm 23:1', text: 'The LORD is my shepherd; I shall not want.' },
  { ref: 'Matthew 6:33', text: 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.' },
  { ref: 'Joshua 1:9', text: 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.' },
  { ref: 'Psalm 46:1', text: 'God is our refuge and strength, a very present help in trouble.' },
  { ref: '2 Timothy 1:7', text: 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.' },
  { ref: 'Proverbs 29:18', text: 'Where there is no vision, the people perish: but he that keepeth the law, happy is he.' },
  { ref: 'Habakkuk 2:2', text: 'And the LORD answered me, and said, Write the vision, and make it plain upon tables, that he may run that readeth it.' },
  { ref: 'Psalm 119:105', text: 'Thy word is a lamp unto my feet, and a light unto my path.' },
  { ref: 'Galatians 5:22-23', text: 'But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith, meekness, temperance: against such there is no law.' },
  { ref: 'Colossians 3:23', text: 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men.' },
  { ref: 'Hebrews 11:1', text: 'Now faith is the substance of things hoped for, the evidence of things not seen.' },
  { ref: '1 Corinthians 13:4', text: 'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up.' },
  { ref: 'Ephesians 2:8', text: 'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God.' },
  { ref: 'Psalm 121:1-2', text: 'I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth.' }
];

let _activeVerse = null;
let _rotationTimer = null;

/**
 * Returns an epoch hour integer for 60-minute interval stability
 */
export function getCurrentHourIndex() {
  return Math.floor(Date.now() / (60 * 60 * 1000));
}

/**
 * Gets a stable deterministic fallback verse for the current hour
 */
export function getHourFallbackVerse(hourIndex) {
  const idx = Math.abs(hourIndex) % SCRIPTURE_POOL.length;
  const item = SCRIPTURE_POOL[idx];
  return {
    ref: item.ref,
    text: item.text,
    hourIndex,
    url: buildBibleUrl(item.ref)
  };
}

/**
 * Builds a direct reading link on Bible.com (YouVersion)
 */
export function buildBibleUrl(ref) {
  if (!ref) return 'https://www.bible.com/bible/1/JHN.3.KJV';
  const cleanRef = encodeURIComponent(ref.trim());
  return `https://www.bible.com/search/bible?q=${cleanRef}`;
}

/**
 * Load cached verse from localStorage if it matches the current hour
 */
function loadCachedVerse(currentHour) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.hourIndex === currentHour && parsed.text && parsed.ref) {
      return parsed;
    }
  } catch {
    // Ignore storage issues
  }
  return null;
}

/**
 * Save verse to localStorage
 */
function saveCachedVerse(verse) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(verse));
  } catch {
    // Ignore storage quota/security issues
  }
}

/**
 * Fetches the verse text from YourVision / Bible-API for the given reference
 */
async function fetchVerseFromApi(ref) {
  const query = encodeURIComponent(ref);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(`https://bible-api.com/${query}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && data.text) {
      const cleanText = data.text.replace(/\s+/g, ' ').trim();
      return {
        ref: data.reference || ref,
        text: cleanText,
        url: buildBibleUrl(data.reference || ref)
      };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('YourVision/Bible API fetch failed or timed out:', err.message);
  }
  return null;
}

/**
 * Gets the current Bible verse, maintaining stability for 60 minutes
 */
export function getActiveBibleVerse() {
  const currentHour = getCurrentHourIndex();

  if (_activeVerse && _activeVerse.hourIndex === currentHour) {
    return _activeVerse;
  }

  const cached = loadCachedVerse(currentHour);
  if (cached) {
    _activeVerse = cached;
    return _activeVerse;
  }

  // Fallback immediately so UI renders synchronously with zero delay
  const fallback = getHourFallbackVerse(currentHour);
  _activeVerse = fallback;
  saveCachedVerse(fallback);

  // Asynchronously query API to refresh text
  fetchVerseFromApi(fallback.ref).then(apiResult => {
    if (apiResult && apiResult.text) {
      const updated = {
        ref: apiResult.ref,
        text: apiResult.text,
        hourIndex: currentHour,
        url: apiResult.url || buildBibleUrl(apiResult.ref)
      };
      _activeVerse = updated;
      saveCachedVerse(updated);
      render();
    }
  });

  return _activeVerse;
}

/**
 * Schedules rotation every hour
 */
export function startBibleVerseRotation() {
  if (_rotationTimer) clearInterval(_rotationTimer);

  // Check every 60 seconds if the hour boundary has changed
  _rotationTimer = setInterval(() => {
    const curHour = getCurrentHourIndex();
    if (!_activeVerse || _activeVerse.hourIndex !== curHour) {
      getActiveBibleVerse();
      render();
    }
  }, 60 * 1000);
}
