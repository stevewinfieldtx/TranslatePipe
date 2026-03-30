// Proxy for ElevenLabs TTS. Takes translated text + target language voice,
// returns audio stream. Keeps ElevenLabs API key server-side.

// Default voices per language — can be overridden
const VOICE_MAP = {
  en: 'JBFqnCBsd6RMkjVDRZzb',  // George — clear male English
  vi: 'pFZP5JQG7iQjIQuC4Bku',  // Lily — works well for Vietnamese
  es: 'onwK4e9ZLuTAKqWW03F9',  // Daniel
  fr: 'XB0fDUnXU5powFXDhCwa',  // Charlotte
  de: 'pqHfZKP75CvOlQylNhV4',  // Bill
  ja: 'Xb7hH8MSUJpSbSDYk0k2',  // Alice
  ko: 'pFZP5JQG7iQjIQuC4Bku',  // Lily
  zh: 'Xb7hH8MSUJpSbSDYk0k2',  // Alice
  pt: 'onwK4e9ZLuTAKqWW03F9',  // Daniel
  th: 'pFZP5JQG7iQjIQuC4Bku',  // Lily
  hi: 'pFZP5JQG7iQjIQuC4Bku',  // Lily
};

export async function POST(request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ELEVENLABS_API_KEY not set' }, { status: 500 });
  }

  try {
    const { text, language, voiceId } = await request.json();

    if (!text || !text.trim()) {
      return Response.json({ error: 'No text provided' }, { status: 400 });
    }

    const voice = voiceId || VOICE_MAP[language] || VOICE_MAP['en'];
    console.log(`[TTS-ROUTE] language=${language} voice=${voice} text="${text.trim().substring(0, 50)}"`);

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: 'eleven_turbo_v2_5', // fastest multilingual model
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0, // no style exaggeration for clean translation
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('ElevenLabs TTS error:', res.status, errText);
      return Response.json({ error: 'TTS failed' }, { status: res.status });
    }

    // Stream the audio back
    return new Response(res.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    console.error('TTS error:', err);
    return Response.json({ error: 'TTS request failed' }, { status: 500 });
  }
}
