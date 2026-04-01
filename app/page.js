'use client';

import { useState, useRef, useCallback } from 'react';

// ─── Language config ───────────────────────────────────────────────
const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇺🇸' },
  { code: 'vi', label: 'Vietnamese', flag: '🇻🇳' },
  { code: 'es', label: 'Spanish',    flag: '🇪🇸' },
  { code: 'fr', label: 'French',     flag: '🇫🇷' },
  { code: 'de', label: 'German',     flag: '🇩🇪' },
  { code: 'ja', label: 'Japanese',   flag: '🇯🇵' },
  { code: 'ko', label: 'Korean',     flag: '🇰🇷' },
  { code: 'zh', label: 'Chinese',    flag: '🇨🇳' },
  { code: 'pt', label: 'Portuguese', flag: '🇧🇷' },
  { code: 'th', label: 'Thai',       flag: '🇹🇭' },
  { code: 'hi', label: 'Hindi',      flag: '🇮🇳' },
];

const getLangLabel = (code) => LANGUAGES.find(l => l.code === code)?.label || code;

export default function TranslatePipe() {
  const [langA, setLangA] = useState('en');
  const [langB, setLangB] = useState('es');
  const [running, setRunning] = useState(false);
  const [entries, setEntries] = useState([]);
  const [partial, setPartial] = useState('');
  const [status, setStatus] = useState('Pick languages and tap Start');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const wsRef = useRef(null);
  const mediaRef = useRef(null);
  const ctxRef = useRef(null);
  const procRef = useRef(null);
  const ttsQueueRef = useRef([]);
  const isSpeakingRef = useRef(false);

  // ─── TTS with hardware mic mute ────────────────────────────────
  const speakText = useCallback(async (text, lang) => {
    if (!autoSpeak || !text.trim()) return;
    ttsQueueRef.current.push({ text, lang });
    if (isSpeakingRef.current) return;

    while (ttsQueueRef.current.length > 0) {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      if (mediaRef.current) mediaRef.current.getAudioTracks().forEach(t => t.enabled = false);

      const item = ttsQueueRef.current.shift();
      try {
        console.log(`[TTS] Speaking "${item.text.substring(0, 40)}..." lang=${item.lang}`);
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: item.text, language: item.lang }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          await new Promise(resolve => { audio.onended = resolve; audio.onerror = resolve; audio.play().catch(resolve); });
          URL.revokeObjectURL(url);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.error('[TTS] Error:', err);
      }
    }

    if (mediaRef.current) mediaRef.current.getAudioTracks().forEach(t => t.enabled = true);
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, [autoSpeak]);

  // ─── Start: ONE session with auto language detection ────────────
  const start = useCallback(async () => {
    try {
      setStatus('Getting microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      mediaRef.current = stream;

      setStatus('Getting auth token...');
      const tokenRes = await fetch('/api/speechmatics-token');
      const tokenData = await tokenRes.json();
      if (!tokenData.key_value) {
        setStatus(`Auth failed: ${tokenData.error || 'no token'}`);
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      setStatus('Connecting...');

      // ONE session with auto language detection
      // Speechmatics detects which language is spoken, transcribes it,
      // and translates to BOTH target languages.
      // We only need the translation that's in the OTHER language.
      const ws = new WebSocket(`wss://eu2.rt.speechmatics.com/v2?jwt=${tokenData.key_value}`);
      wsRef.current = ws;

      let lastOriginal = '';
      let detectedLang = '';

      ws.onopen = () => {
        console.log('[SM] WebSocket opened');
        ws.send(JSON.stringify({
          message: 'StartRecognition',
          audio_format: { type: 'raw', encoding: 'pcm_f32le', sample_rate: 16000 },
          transcription_config: {
            language: 'auto',
            operating_point: 'enhanced',
            enable_partials: true,
            max_delay: 2.0,
          },
          translation_config: {
            target_languages: [langA, langB],
            enable_partials: true,
          },
        }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.message === 'RecognitionStarted') {
          console.log('[SM] RecognitionStarted (auto language)');
          setStatus(`Listening — speak ${getLangLabel(langA)} or ${getLangLabel(langB)}`);
          setRunning(true);
          startAudio(stream, ws);
        }

        if (msg.message === 'AddPartialTranscript') {
          const text = msg.metadata?.transcript || msg.results?.map(r => r.alternatives?.[0]?.content || '').join(' ') || '';
          // Detect language from results
          const lang = msg.results?.[0]?.alternatives?.[0]?.language || '';
          if (text.trim()) setPartial(`[${getLangLabel(lang) || '...'}] ${text.trim()}`);
        }

        if (msg.message === 'AddTranscript') {
          const text = msg.metadata?.transcript || msg.results?.map(r => r.alternatives?.[0]?.content || '').join(' ') || '';
          detectedLang = msg.results?.[0]?.alternatives?.[0]?.language || '';
          if (text.trim()) {
            lastOriginal = text.trim();
            console.log(`[SM] Transcript (${detectedLang}): "${lastOriginal}"`);
          }
        }

        if (msg.message === 'AddPartialTranslation') {
          const lang = msg.language || '';
          const pt = msg.results?.map(r => r.content).join(' ') || '';
          // Only show partial for the OTHER language
          if (pt.trim() && lang !== detectedLang) {
            setPartial(`→ [${getLangLabel(lang)}] ${pt.trim()}`);
          }
        }

        if (msg.message === 'AddTranslation') {
          const translationLang = msg.language || '';
          const translated = msg.results?.map(r => r.content).join(' ') || '';

          if (translated.trim()) {
            // Only use the translation that's in the OTHER language
            // If someone spoke English (detectedLang=en), we want the Spanish translation
            // If someone spoke Spanish (detectedLang=es), we want the English translation
            const isOtherLang = translationLang !== detectedLang;

            console.log(`[TRANSLATE] detected=${detectedLang} translationLang=${translationLang} isOther=${isOtherLang} text="${translated.trim().substring(0, 50)}"`);

            if (isOtherLang && translated.trim() !== lastOriginal) {
              setPartial('');
              const entry = {
                original: lastOriginal || '...',
                translated: translated.trim(),
                sourceLang: detectedLang,
                targetLang: translationLang,
              };
              setEntries(prev => [entry, ...prev]);
              speakText(entry.translated, entry.targetLang);
            }
          }
        }

        if (msg.message === 'Error') {
          console.error('[SM ERROR]', msg);
          setStatus(`Error: ${msg.reason || msg.type}`);
        }
      };

      ws.onerror = () => setStatus('Connection error');
      ws.onclose = (e) => console.log(`[SM] Closed: ${e.code}`);

    } catch (err) {
      console.error('[START ERROR]', err);
      setStatus(`Error: ${err.message}`);
    }
  }, [langA, langB, speakText]);

  // ─── Audio pipeline ─────────────────────────────────────────────
  const startAudio = (stream, ws) => {
    console.log('[AUDIO] Starting pipeline');
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    ctxRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    procRef.current = processor;

    let chunkCount = 0;
    processor.onaudioprocess = (e) => {
      if (isSpeakingRef.current) return;
      if (ws.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const copy = new Float32Array(inputData.length);
      copy.set(inputData);
      ws.send(copy.buffer);

      chunkCount++;
      if (chunkCount % 50 === 0) {
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        console.log(`[AUDIO] chunk #${chunkCount} rms=${Math.sqrt(sum / inputData.length).toFixed(4)}`);
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
    console.log('[AUDIO] Pipeline running');
  };

  // ─── Stop ───────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ message: 'EndOfStream' }));
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }
    if (procRef.current) { procRef.current.disconnect(); procRef.current = null; }
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); ctxRef.current = null; }
    if (mediaRef.current) { mediaRef.current.getTracks().forEach(t => t.stop()); mediaRef.current = null; }
    setRunning(false);
    setPartial('');
    setStatus('Stopped');
  }, []);

  const swapLangs = () => { if (!running) { setLangA(langB); setLangB(langA); } };

  return (
    <div style={styles.page}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } } select option { background: #1a1a2e; color: #fff; }`}</style>
      <h1 style={styles.title}>TranslatePipe</h1>
      <p style={styles.subtitle}>Real-time voice translation</p>
      <div style={styles.container}>
        <div style={styles.langRow}>
          <div>
            <div style={styles.langLabel}>Language A</div>
            <select style={styles.select} value={langA} onChange={e => setLangA(e.target.value)} disabled={running}>
              {LANGUAGES.filter(l => l.code !== langB).map(l => <option key={l.code} value={l.code}>{l.flag}  {l.label}</option>)}
            </select>
          </div>
          <button style={styles.swapBtn} onClick={swapLangs} disabled={running}>⇄</button>
          <div>
            <div style={styles.langLabel}>Language B</div>
            <select style={styles.select} value={langB} onChange={e => setLangB(e.target.value)} disabled={running}>
              {LANGUAGES.filter(l => l.code !== langA).map(l => <option key={l.code} value={l.code}>{l.flag}  {l.label}</option>)}
            </select>
          </div>
        </div>
        <button style={styles.micBtn(running)} onClick={running ? stop : start}>
          <span style={{ fontSize: '2.2rem' }}>{running ? '⏹' : '🎤'}</span>
          <span style={styles.micLabel}>{running ? 'Stop' : 'Translate'}</span>
        </button>
        <div style={styles.toggleRow}>
          <span style={styles.toggleLabel}>Auto-speak translations</span>
          <button style={styles.toggle(autoSpeak)} onClick={() => setAutoSpeak(!autoSpeak)}>
            <div style={styles.toggleKnob(autoSpeak)} />
          </button>
          {isSpeaking && <span style={styles.speakingDot} />}
        </div>
        <div style={styles.transcript}>
          <div style={styles.transcriptHeader}>Translation Feed</div>
          {partial && <div style={styles.partialText}>{partial}...</div>}
          {entries.length === 0 && !partial && <p style={styles.placeholder}>Speak in either language</p>}
          {entries.map((entry, i) => (
            <div key={i}>
              <div style={styles.originalText}>[{getLangLabel(entry.sourceLang)}] {entry.original}</div>
              <div style={styles.translatedText}>[{getLangLabel(entry.targetLang)}] {entry.translated}</div>
            </div>
          ))}
        </div>
        <div style={styles.status}>{status}</div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: 'linear-gradient(145deg, #0a0a0f 0%, #12121f 50%, #0a0f1a 100%)', color: '#e0e0e0', fontFamily: "'SF Pro Display', -apple-system, sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' },
  title: { fontSize: '2.4rem', fontWeight: 200, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fff', marginBottom: '4px' },
  subtitle: { fontSize: '0.85rem', color: '#666', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '48px' },
  container: { width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px' },
  langRow: { display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center' },
  langLabel: { fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#555', textAlign: 'center', marginBottom: '4px' },
  select: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', padding: '14px 20px', fontSize: '1rem', minWidth: '200px', cursor: 'pointer', outline: 'none' },
  swapBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.3rem', color: '#aaa' },
  micBtn: (active) => ({ width: '120px', height: '120px', borderRadius: '50%', border: active ? '3px solid #22c55e' : '3px solid rgba(255,255,255,0.15)', background: active ? 'radial-gradient(circle, rgba(34,197,94,0.25) 0%, rgba(34,197,94,0.05) 70%)' : 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 70%)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: 'all 0.3s ease', margin: '20px auto', boxShadow: active ? '0 0 40px rgba(34,197,94,0.2)' : 'none' }),
  micLabel: { fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#888' },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  toggleLabel: { fontSize: '0.75rem', color: '#777' },
  toggle: (on) => ({ width: '44px', height: '24px', borderRadius: '12px', background: on ? '#22c55e' : 'rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative', border: 'none', padding: 0 }),
  toggleKnob: (on) => ({ position: 'absolute', top: '3px', left: on ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }),
  speakingDot: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 1s infinite' },
  transcript: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px', minHeight: '180px', maxHeight: '400px', overflowY: 'auto' },
  transcriptHeader: { fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#555', marginBottom: '12px' },
  partialText: { color: '#22c55e', fontSize: '0.95rem', fontStyle: 'italic', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid rgba(34,197,94,0.15)' },
  placeholder: { color: '#444', fontStyle: 'italic', fontSize: '0.9rem' },
  originalText: { color: '#888', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '4px', fontStyle: 'italic' },
  translatedText: { color: '#fff', fontSize: '1.15rem', lineHeight: 1.6, marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  status: { textAlign: 'center', fontSize: '0.8rem', color: '#555', marginTop: '12px' },
};
