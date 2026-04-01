// MiniMax TTS proxy. Takes translated text + target language,
// returns audio stream. Keeps API key server-side.
//
// MiniMax Speech-02 supports 40+ languages including Vietnamese.
// Docs: https://platform.minimax.io/docs/api-reference/speech-t2a-intro

export async function POST(request) {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'MINIMAX_API_KEY not set' }, { status: 500 });
  }

  try {
    const { text, language } = await request.json();

    if (!text || !text.trim()) {
      return Response.json({ error: 'No text provided' }, { status: 400 });
    }

    console.log(`[TTS] MiniMax language=${language} text="${text.trim().substring(0, 50)}"`);

    // MiniMax non-streaming TTS — returns hex-encoded audio
    const res = await fetch('https://api.minimaxi.chat/v1/t2a_v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'speech-02-turbo',
        text: text.trim(),
        stream: false,
        voice_setting: {
          voice_id: 'male-qn-qingse',
          speed: 1.0,
          vol: 1.0,
          pitch: 0,
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: 'mp3',
          channel: 1,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[TTS] MiniMax error:', res.status, errText);
      return Response.json({ error: 'TTS failed: ' + res.status }, { status: res.status });
    }

    const data = await res.json();

    // Check for API-level errors
    if (data.base_resp?.status_code !== 0) {
      console.error('[TTS] MiniMax API error:', data.base_resp);
      return Response.json({ error: 'TTS API error: ' + (data.base_resp?.status_msg || 'unknown') }, { status: 500 });
    }

    // MiniMax returns audio as hex string in data.data.audio
    const audioHex = data.data?.audio;
    if (!audioHex) {
      console.error('[TTS] No audio in response');
      return Response.json({ error: 'No audio returned' }, { status: 500 });
    }

    // Convert hex to binary buffer
    const audioBuffer = Buffer.from(audioHex, 'hex');
    console.log(`[TTS] Generated ${audioBuffer.length} bytes of audio`);

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (err) {
    console.error('[TTS] Error:', err);
    return Response.json({ error: 'TTS request failed' }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ status: 'MiniMax TTS endpoint ready' });
}
