'use client';

import { useState, useRef, useCallback } from 'react';

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

// Speechmatics bilingual packs — one session handles both languages
// For pairs WITHOUT a bilingual pack, we fall back to dual sessions
const BILINGUAL_PACKS = {
  'en+es': { language: 'es', domain: 'bilingual-en' },
  'en+cmn': { language: 'cmn_en' },
  'en+ar': { language: 'ar_en' },
  'en+ms': { language: 'en_ms' },
  'en+ta': { language: 'en_ta' },
};

function getBilingualConfig(a, b) {
  return BILINGUAL_PACKS[`${a}+${b}`] || BILINGUAL_PACKS[`${b}+${a}`] || null;
}

const getLangLabel = (code) => LANGUAGES.find(l => l.code === code)?.label || code;

export default function TranslatePipe() {
  const [langA, setLangA] = useState('en');
  const [langB, setLangB] = useState('es');
  const [running, setRunning] = useState(false);
  const [entries, setEntries] = useState([]);
  const [partial, setPartial] = useState('');
  const [status, setStatus] = useState('Pick languages and tap Translate');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const wsRef = useRef(null);
  const wsARef = useRef(null);
  const wsBRef = useRef(null);
  const mediaRef = useRef(null);
  const ctxRef = useRef(null);
  const procRef = useRef(null);
  const ttsQueueRef = useRef([]);
  const isSpeakingRef = useRef(false);

  const bilingualPack = getBilingualConfig(langA, langB);

  // ─── TTS with hardware mic mute + cooldown ─────────────────────
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
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: item.text, language: item.lang }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          await new Promise(r => { audio.onended = r; audio.onerror = r; audio.play().catch(r); });
          URL.revokeObjectURL(url);
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (err) {
        console.error('[TTS]', err);
      }
    }

    if (mediaRef.current) mediaRef.current.getAudioTracks().forEach(t => t.enabled = true);
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, [autoSpeak]);

  // ─── Audio pipeline — sends to one or two WebSockets ───────────
  const startAudio = (stream, wsList) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    ctxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    procRef.current = proc;
    let n = 0;

    proc.onaudioprocess = (e) => {
      if (isSpeakingRef.current) return;
      const d = e.inputBuffer.getChannelData(0);
      for (const ws of wsList) {
        if (ws?.readyState === WebSocket.OPEN) {
          const copy = new Float32Array(d.length);
          copy.set(d);
          ws.send(copy.buffer);
        }
      }
      if (++n % 50 === 0) {
        let s = 0; for (let i = 0; i < d.length; i++) s += d[i]*d[i];
        console.log(`[AUDIO] #${n} rms=${Math.sqrt(s/d.length).toFixed(4)}`);
      }
    };

    source.connect(proc);
    proc.connect(ctx.destination);
    console.log('[AUDIO] Running');
  };

  // ─── Translation handler (shared by both modes) ────────────────
  const handleTranslation = useCallback((entry) => {
    setPartial('');
    setEntries(prev => [entry, ...prev]);
    speakText(entry.translated, entry.targetLang);
  }, [speakText]);

  // ─── Start ─────────────────────────────────────────────────────
  const start = useCallback(async () => {
    try {
      setStatus('Getting microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      mediaRef.current = stream;

      setStatus('Authenticating...');
      const tokenRes = await fetch('/api/speechmatics-token');
      const tokenData = await tokenRes.json();
      if (!tokenData.key_value) {
        setStatus('Auth failed: ' + (tokenData.error || 'no token'));
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const jwt = tokenData.key_value;

      if (bilingualPack) {
        // ═══ BILINGUAL MODE ═══════════════════════════════════════
        // Single session handles both languages natively
        console.log('[SM] Bilingual mode:', bilingualPack);
        setStatus('Connecting (bilingual)...');

        const urlLang = bilingualPack.language;
        const ws = new WebSocket(`wss://eu2.rt.speechmatics.com/v2/${urlLang}?jwt=${jwt}`);
        wsRef.current = ws;
        let lastOriginal = '';
        let detectedLang = '';

        ws.onopen = () => {
          console.log('[SM] Connected (bilingual)');
          const config = {
            message: 'StartRecognition',
            audio_format: { type: 'raw', encoding: 'pcm_f32le', sample_rate: 16000 },
            transcription_config: {
              language: urlLang,
              operating_point: 'enhanced',
              enable_partials: true,
              max_delay: 2.0,
            },
            translation_config: {
              target_languages: [langA, langB],
              enable_partials: true,
            },
          };
          if (bilingualPack.domain) {
            config.transcription_config.domain = bilingualPack.domain;
          }
          ws.send(JSON.stringify(config));
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);

          if (msg.message === 'RecognitionStarted') {
            console.log('[SM] RecognitionStarted (bilingual)');
            setRunning(true);
            setStatus(`Listening — speak ${getLangLabel(langA)} or ${getLangLabel(langB)}`);
            startAudio(stream, [ws]);
          }

          if (msg.message === 'AddPartialTranscript') {
            const text = msg.metadata?.transcript || msg.results?.map(r => r.alternatives?.[0]?.content || '').join(' ') || '';
            const lang = msg.results?.[0]?.alternatives?.[0]?.language || '';
            if (text.trim()) setPartial(`[${getLangLabel(lang) || '?'}] ${text.trim()}`);
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
            if (pt.trim() && lang !== detectedLang) setPartial(`-> [${getLangLabel(lang)}] ${pt.trim()}`);
          }

          if (msg.message === 'AddTranslation') {
            const tLang = msg.language || '';
            const translated = msg.results?.map(r => r.content).join(' ') || '';
            if (translated.trim() && tLang !== detectedLang) {
              console.log(`[TRANSLATE] ${detectedLang}->${tLang}: "${translated.trim().substring(0, 60)}"`);
              handleTranslation({ original: lastOriginal || '...', translated: translated.trim(), sourceLang: detectedLang, targetLang: tLang });
            }
          }

          if (msg.message === 'Error') {
            console.error('[SM ERROR]', msg);
            setStatus(`Error: ${msg.reason || msg.type || JSON.stringify(msg)}`);
          }
        };

        ws.onerror = () => setStatus('Connection error');
        ws.onclose = (e) => console.log(`[SM] Closed: ${e.code} ${e.reason}`);

      } else {
        // ═══ DUAL SESSION MODE ════════════════════════════════════
        // No bilingual pack available — use two sessions
        console.log(`[SM] Dual mode: ${langA} + ${langB}`);
        setStatus('Connecting (dual)...');

        let readyCount = 0;
        const checkReady = () => {
          readyCount++;
          console.log(`[SM] Sessions ready: ${readyCount}/2`);
          if (readyCount >= 2) {
            setRunning(true);
            setStatus(`Listening — speak ${getLangLabel(langA)} or ${getLangLabel(langB)} (dual mode)`);
            startAudio(stream, [wsARef.current, wsBRef.current]);
          }
        };

        wsARef.current = openSession(jwt, langA, langB, checkReady, handleTranslation, setPartial);
        wsBRef.current = openSession(jwt, langB, langA, checkReady, handleTranslation, setPartial);
      }

    } catch (err) {
      console.error('[START]', err);
      setStatus('Error: ' + err.message);
    }
  }, [langA, langB, bilingualPack, speakText, handleTranslation]);

  // ─── Stop ──────────────────────────────────────────────────────
  const stop = useCallback(() => {
    [wsRef, wsARef, wsBRef].forEach(ref => {
      if (ref.current) {
        try {
          if (ref.current.readyState === WebSocket.OPEN) ref.current.send(JSON.stringify({ message: 'EndOfStream' }));
          ref.current.close();
        } catch(e) {}
        ref.current = null;
      }
    });
    if (procRef.current) { procRef.current.disconnect(); procRef.current = null; }
    if (ctxRef.current) { ctxRef.current.close().catch(()=>{}); ctxRef.current = null; }
    if (mediaRef.current) { mediaRef.current.getTracks().forEach(t => t.stop()); mediaRef.current = null; }
    setRunning(false);
    setPartial('');
    setStatus('Stopped');
  }, []);

  const swapLangs = () => { if (!running) { setLangA(langB); setLangB(langA); } };

  // ─── UI ────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}} select option{background:#1a1a2e;color:#fff}`}</style>
      <h1 style={S.title}>TranslatePipe</h1>
      <p style={S.sub}>Real-time voice translation</p>
      <div style={S.box}>
        <div style={S.langRow}>
          <div>
            <div style={S.ll}>Language A</div>
            <select style={S.sel} value={langA} onChange={e=>setLangA(e.target.value)} disabled={running}>
              {LANGUAGES.filter(l=>l.code!==langB).map(l=><option key={l.code} value={l.code}>{l.flag}  {l.label}</option>)}
            </select>
          </div>
          <button style={S.swap} onClick={swapLangs} disabled={running}>&#8644;</button>
          <div>
            <div style={S.ll}>Language B</div>
            <select style={S.sel} value={langB} onChange={e=>setLangB(e.target.value)} disabled={running}>
              {LANGUAGES.filter(l=>l.code!==langA).map(l=><option key={l.code} value={l.code}>{l.flag}  {l.label}</option>)}
            </select>
          </div>
        </div>

        {bilingualPack && <div style={S.badge}>Bilingual mode available</div>}
        {!bilingualPack && langA && langB && <div style={S.badgeWarn}>Dual session mode (may interleave)</div>}

        <button style={S.mic(running)} onClick={running ? stop : start}>
          <span style={{fontSize:'2.2rem'}}>{running ? '\u23F9' : '\uD83C\uDFA4'}</span>
          <span style={S.ml}>{running ? 'Stop' : 'Translate'}</span>
        </button>

        <div style={S.tr}>
          <span style={S.tl}>Auto-speak</span>
          <button style={S.tog(autoSpeak)} onClick={()=>setAutoSpeak(!autoSpeak)}>
            <div style={S.knob(autoSpeak)}/>
          </button>
          {isSpeaking && <span style={S.dot}/>}
        </div>

        <div style={S.feed}>
          <div style={S.fh}>Translation Feed</div>
          {partial && <div style={S.pt}>{partial}...</div>}
          {entries.length===0 && !partial && <p style={S.ph}>Speak in either language</p>}
          {entries.map((e,i)=>(
            <div key={i}>
              <div style={S.orig}>[{getLangLabel(e.sourceLang)}] {e.original}</div>
              <div style={S.trans}>[{getLangLabel(e.targetLang)}] {e.translated}</div>
            </div>
          ))}
        </div>

        <div style={S.st}>{status}</div>
      </div>
    </div>
  );
}

// ─── Dual session helper (for non-bilingual pairs) ───────────────
function openSession(jwt, sourceLang, targetLang, onReady, onTranslation, onPartial) {
  const ws = new WebSocket(`wss://eu2.rt.speechmatics.com/v2/${sourceLang}?jwt=${jwt}`);
  let lastOriginal = '';

  ws.onopen = () => {
    console.log(`[SM] Opened ${sourceLang}->${targetLang}`);
    ws.send(JSON.stringify({
      message: 'StartRecognition',
      audio_format: { type: 'raw', encoding: 'pcm_f32le', sample_rate: 16000 },
      transcription_config: { language: sourceLang, operating_point: 'enhanced', enable_partials: true, max_delay: 2.0 },
      translation_config: { target_languages: [targetLang], enable_partials: true },
    }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.message === 'RecognitionStarted') { console.log(`[SM] Ready ${sourceLang}->${targetLang}`); onReady(); }
    if (msg.message === 'AddPartialTranscript') {
      const text = msg.metadata?.transcript || msg.results?.map(r => r.alternatives?.[0]?.content || '').join(' ') || '';
      if (text.trim()) onPartial(`[${getLangLabel(sourceLang)}] ${text.trim()}`);
    }
    if (msg.message === 'AddTranscript') {
      const text = msg.metadata?.transcript || msg.results?.map(r => r.alternatives?.[0]?.content || '').join(' ') || '';
      if (text.trim()) lastOriginal = text.trim();
    }
    if (msg.message === 'AddPartialTranslation') {
      const pt = msg.results?.map(r => r.content).join(' ') || '';
      if (pt.trim()) onPartial(`-> ${pt.trim()}`);
    }
    if (msg.message === 'AddTranslation') {
      const translated = msg.results?.map(r => r.content).join(' ') || '';
      if (translated.trim()) {
        console.log(`[TRANSLATE] ${sourceLang}->${targetLang}: "${translated.trim().substring(0, 60)}"`);
        onTranslation({ original: lastOriginal || '...', translated: translated.trim(), sourceLang, targetLang });
        lastOriginal = '';
      }
    }
    if (msg.message === 'Error') console.error(`[SM ERROR] ${sourceLang}:`, msg);
  };

  ws.onerror = () => console.error(`[SM] Error ${sourceLang}`);
  ws.onclose = (e) => console.log(`[SM] Closed ${sourceLang}: ${e.code}`);
  return ws;
}

// ─── Styles ──────────────────────────────────────────────────────
const S = {
  page:{minHeight:'100vh',background:'linear-gradient(145deg,#0a0a0f,#12121f,#0a0f1a)',color:'#e0e0e0',fontFamily:"'SF Pro Display',-apple-system,sans-serif",display:'flex',flexDirection:'column',alignItems:'center',padding:'40px 20px'},
  title:{fontSize:'2.4rem',fontWeight:200,letterSpacing:'.15em',textTransform:'uppercase',color:'#fff',marginBottom:'4px'},
  sub:{fontSize:'.85rem',color:'#666',letterSpacing:'.3em',textTransform:'uppercase',marginBottom:'48px'},
  box:{width:'100%',maxWidth:'800px',display:'flex',flexDirection:'column',gap:'24px'},
  langRow:{display:'flex',alignItems:'center',gap:'16px',justifyContent:'center'},
  ll:{fontSize:'.65rem',textTransform:'uppercase',letterSpacing:'.15em',color:'#555',textAlign:'center',marginBottom:'4px'},
  sel:{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:'12px',color:'#fff',padding:'14px 20px',fontSize:'1rem',minWidth:'200px',cursor:'pointer',outline:'none'},
  swap:{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.12)',borderRadius:'50%',width:'48px',height:'48px',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'1.3rem',color:'#aaa'},
  badge:{textAlign:'center',fontSize:'.7rem',color:'#22c55e',letterSpacing:'.1em'},
  badgeWarn:{textAlign:'center',fontSize:'.7rem',color:'#eab308',letterSpacing:'.1em'},
  mic:(on)=>({width:'120px',height:'120px',borderRadius:'50%',border:on?'3px solid #22c55e':'3px solid rgba(255,255,255,.15)',background:on?'radial-gradient(circle,rgba(34,197,94,.25),rgba(34,197,94,.05))':'radial-gradient(circle,rgba(255,255,255,.08),rgba(255,255,255,.02))',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'4px',transition:'all .3s',margin:'20px auto',boxShadow:on?'0 0 40px rgba(34,197,94,.2)':'none'}),
  ml:{fontSize:'.65rem',textTransform:'uppercase',letterSpacing:'.15em',color:'#888'},
  tr:{display:'flex',alignItems:'center',justifyContent:'center',gap:'10px'},
  tl:{fontSize:'.75rem',color:'#777'},
  tog:(on)=>({width:'44px',height:'24px',borderRadius:'12px',background:on?'#22c55e':'rgba(255,255,255,.1)',cursor:'pointer',position:'relative',border:'none',padding:0}),
  knob:(on)=>({position:'absolute',top:'3px',left:on?'23px':'3px',width:'18px',height:'18px',borderRadius:'50%',background:'#fff',transition:'left .2s'}),
  dot:{display:'inline-block',width:'8px',height:'8px',borderRadius:'50%',background:'#22c55e',animation:'pulse 1s infinite'},
  feed:{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.06)',borderRadius:'16px',padding:'24px',minHeight:'180px',maxHeight:'400px',overflowY:'auto'},
  fh:{fontSize:'.7rem',textTransform:'uppercase',letterSpacing:'.2em',color:'#555',marginBottom:'12px'},
  pt:{color:'#22c55e',fontSize:'.95rem',fontStyle:'italic',marginBottom:'14px',paddingBottom:'12px',borderBottom:'1px solid rgba(34,197,94,.15)'},
  ph:{color:'#444',fontStyle:'italic',fontSize:'.9rem'},
  orig:{color:'#888',fontSize:'.9rem',lineHeight:1.6,marginBottom:'4px',fontStyle:'italic'},
  trans:{color:'#fff',fontSize:'1.15rem',lineHeight:1.6,marginBottom:'16px',paddingBottom:'16px',borderBottom:'1px solid rgba(255,255,255,.04)'},
  st:{textAlign:'center',fontSize:'.8rem',color:'#555',marginTop:'12px'},
};
