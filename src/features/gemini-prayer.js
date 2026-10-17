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

  const payload = {
    contents: [
      {
        parts: [
          {
            text: 'Generate a completely unique, uplifting, and peaceful morning prayer. The tone should be calm and grounding. Keep the duration between 45 to 60 seconds when spoken. Do not include any introductory or concluding meta-text.',
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Puck',
          },
        },
      },
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      let msg = `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(errText);
        msg = parsed.error?.message || msg;
      } catch {
        // Use raw error
      }
      throw new Error(msg);
    }

    const data = await res.json();

    // Extract Base64 audio string and mimeType from candidates.content.parts.inlineData
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    let base64Audio = null;
    let mimeType = 'audio/mp3';

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

    // Play native audio with returned mimeType (supports audio/wav, audio/mp3, etc.)
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

    // Reset loading state as audio begins playing
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

