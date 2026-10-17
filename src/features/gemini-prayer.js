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
    // STEP 1: Have Gemini write a deep, spiritually wise morning prayer
    // -------------------------------------------------------------
    const textEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
    const textPrompt =
      'Write a deep, spiritually wise, grounding, and heartfelt Christian morning prayer for today. The tone must be calm, reverent, masculine, and spiritually mature. It should take about 60 to 90 seconds to speak aloud (around 130-180 words). Output ONLY the prayer text itself. Do not include any title, greeting to the user, introduction, quotation marks, or stage directions.';

    const textRes = await fetch(textEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: textPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      }),
    });

    let prayerScript = '';
    if (textRes.ok) {
      const textData = await textRes.json();
      prayerScript = textData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    }

    // High quality spiritually wise fallback script if text generation fails
    if (!prayerScript) {
      prayerScript =
        'Heavenly Father, as the dawn breaks and this new day begins, I stand before You with a quiet heart and a steady spirit. Thank You for the gift of life, for breath in my lungs, and for Your steadfast love that is renewed every morning. Grant me wisdom to navigate the challenges ahead, courage to act justly, and patience to lead and serve with humility. Anchor my thoughts in Your truth, protect my mind from distraction and anxiety, and strengthen my hands for the work You have set before me. May everything I build and every word I speak honor Your name and bless those around me. Guide my steps today in strength, peace, and steadfast faith. In Jesus’ name, Amen.';
    }

    // -------------------------------------------------------------
    // STEP 2: Send the written prayer script to TTS to speak out loud
    // using Fenrir (deep, calm, masculine voice profile)
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
              voiceName: 'Fenrir',
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
      let msg = `HTTP ${ttsRes.status}`;
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

