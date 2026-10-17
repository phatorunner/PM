/* =====================================================================
   GEMINI MORNING PRAYER SERVICE
   - Uses Google AI Studio Gemini 2.5 Flash API
   - Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}
   - Audio generation with Puck voice
   - Handles local caching, browser Audio playback, and loading states
   ===================================================================== */
import { S } from '../core/store.js';
import { toast } from '../ui/toast.js';

export const PRAYER_STATE = {
  isLoading: false,
  isPlaying: false,
  currentAudio: null,
};

/**
 * Retrieves the Gemini API key from user preferences or Vite env
 */
export function getGeminiApiKey() {
  return (S.prefs?.geminiApiKey || '').trim() || import.meta.env.VITE_GEMINI_API_KEY || '';
}

/**
 * Generates and plays the morning prayer using Gemini 2.5 Flash
 */
export async function playDailyMorningPrayer(onStateChange) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    toast('Please configure your Gemini API key in Settings > API', { kind: 'warn' });
    return false;
  }

  // Stop any active prayer audio before starting a new one
  if (PRAYER_STATE.currentAudio) {
    try {
      PRAYER_STATE.currentAudio.pause();
      PRAYER_STATE.currentAudio.currentTime = 0;
    } catch {
      // Ignore
    }
    PRAYER_STATE.currentAudio = null;
  }

  PRAYER_STATE.isLoading = true;
  onStateChange?.(PRAYER_STATE);

  try {
    // -------------------------------------------------------------
    // STEP 1: Have Gemini 3.8 Flash write a full, deep morning prayer (60-100s)
    // -------------------------------------------------------------
    const textEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
    const textPrompt =
      'Write a deep, spiritually wise, grounding, and heartfelt Christian morning prayer. The prayer must be substantive and comprehensive, taking between 60 to 100 seconds to read aloud slowly and reverently (between 160 and 220 words). Touch on wisdom for the day’s work, stillness of mind, protection from distraction, courage under trial, and walking with integrity. Output STRICTLY the prayer words spoken aloud. Do NOT include any intro, title, metadata, quotation marks, or stage notes.';

    const textRes = await fetch(textEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: textPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        },
      }),
    });

    if (!textRes.ok) {
      const errText = await textRes.text();
      let msg = `Text generation HTTP ${textRes.status}`;
      try {
        const parsed = JSON.parse(errText);
        msg = parsed.error?.message || msg;
      } catch {
        // Use raw error
      }
      throw new Error(msg);
    }

    const textData = await textRes.json();
    let prayerScript = textData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    // Clean any unwanted quotation marks, headers, or markdown
    prayerScript = prayerScript
      .replace(/^(["'`]|#+\s*|Prayer:?\s*)+/i, '')
      .replace(/(["'`])+$/i, '')
      .trim();

    if (!prayerScript) {
      throw new Error('No prayer text was generated');
    }

    // -------------------------------------------------------------
    // STEP 2: Send the full prayer script to TTS
    // Voice: 'Orus' (deep, firm, masculine, resonant male profile)
    // -------------------------------------------------------------
    const ttsEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent?key=${apiKey}`;
    const ttsPayload = {
      contents: [
        {
          parts: [{ text: prayerScript }],
        },
      ],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Orus',
            },
          },
        },
      },
    };

    const ttsRes = await fetch(ttsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ttsPayload),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      let msg = `TTS HTTP ${ttsRes.status}`;
      try {
        const parsed = JSON.parse(errText);
        msg = parsed.error?.message || msg;
      } catch {
        // Use raw error
      }
      throw new Error(msg);
    }

    const ttsData = await ttsRes.json();

    // Extract Base64 audio string and mimeType
    const candidate = ttsData.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    let base64Audio = null;
    let mimeType = 'audio/wav';

    for (const part of parts) {
      if (part.inlineData?.data) {
        base64Audio = part.inlineData.data;
        if (part.inlineData.mimeType) mimeType = part.inlineData.mimeType;
        break;
      }
    }

    if (!base64Audio) {
      throw new Error('No audio data returned in response payload');
    }

    // Play audio natively
    const audioSrc = `data:${mimeType};base64,${base64Audio}`;
    const audio = new Audio(audioSrc);
    PRAYER_STATE.currentAudio = audio;

    audio.onended = () => {
      PRAYER_STATE.isPlaying = false;
      PRAYER_STATE.currentAudio = null;
      onStateChange?.(PRAYER_STATE);
    };

    audio.onerror = () => {
      PRAYER_STATE.isPlaying = false;
      PRAYER_STATE.currentAudio = null;
      onStateChange?.(PRAYER_STATE);
      toast('Failed to play prayer audio', { kind: 'err' });
    };

    // Reset loading state and set playing state
    PRAYER_STATE.isLoading = false;
    PRAYER_STATE.isPlaying = true;
    onStateChange?.(PRAYER_STATE);

    await audio.play();
    return true;
  } catch (err) {
    PRAYER_STATE.isLoading = false;
    PRAYER_STATE.isPlaying = false;
    onStateChange?.(PRAYER_STATE);
    toast(`Prayer generation error: ${err.message}`, { kind: 'err' });
    return false;
  }
}

