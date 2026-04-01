'use client';

import { useState, useRef, useCallback } from 'react';

export default function Translator({ sourceLang, targetLang, sourceLabel, targetLabel }) {
  const [running, setRunning] = useState(false);
  const [entries, setEntries] = useState([]);
  const [partial, setPartial] = useState('');
  const [status, setStatus] = useState('Tap Start');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const wsRef = useRef(null);
  const mediaRef = useRef(null);
  const ctxRef = useRef(null);
  const procRef = useRef(null);
  const ttsQueueRef = useRef([]);
  const isSpeakingRef = useRef(false);

  const speakText = useCallback(async (text) => {
    if (!text.trim()) return;
    ttsQueueRef.current.push(text);
    if (isSpeakingRef.current) return;

    while (ttsQueueRef.current.length > 0) {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      if (mediaRef.current) mediaRef.current.getAudioTracks().forEach(t => t.enabled = false);

      const t = ttsQueueRef.current.shift();
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: t, language: targetLang }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          await new Promise(r => { audio.onended = r; audio.onerror = r; audio.play().catch(r); });
          URL.revokeObjectURL(url);
          await new Promise(r => setTimeout(r, 500));
        } else {
          console.error('[TTS] Failed:', res.status);
        }
      } catch (err) {
        console.error('[TTS]', err);
      }
    }

    if (mediaRef.current) mediaRef.current.getAudioTracks().forEach(t => t.enabled = true);
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, [targetLang]);

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
        setStatus('Auth failed');
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      setStatus('Connecting...');
      const ws = new WebSocket('wss://eu2.rt.speechmatics.com/v2/' + sourceLang + '?jwt=' + tokenData.key_value);
      wsRef.current = ws;
      let lastOriginal = '';

      ws.onopen = () => {
        console.log('[SM] Connected ' + sourceLang + '->' + targetLang);
        ws.send(JSON.stringify({
          message: 'StartRecognition',
          audio_format: { type: 'raw', encoding: 'pcm_f32le', sample_rate: 16000 },
          transcription_config: {
            language: sourceLang,
            operating_point: 'enhanced',
            enable_partials: true,
            max_delay: 2.0,
          },
          translation_config: {
            target_languages: [targetLang],
            enable_partials: true,
          },
        }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.message === 'RecognitionStarted') {
          console.log('[SM] RecognitionStarted');
          setRunning(true);
          setStatus('Listening for ' + sourceLabel + '...');

          const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
          ctxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const proc = ctx.createScriptProcessor(4096, 1, 1);
          procRef.current = proc;
          let n = 0;

          proc.onaudioprocess = (e) => {
            if (isSpeakingRef.current) return;
            if (ws.readyState !== WebSocket.OPEN) return;
            const d = e.inputBuffer.getChannelData(0);
            const copy = new Float32Array(d.length);
            copy.set(d);
            ws.send(copy.buffer);
            if (++n % 100 === 0) console.log('[AUDIO] ' + n + ' chunks sent');
          };

          source.connect(proc);
          proc.connect(ctx.destination);
          console.log('[AUDIO] Running');
        }

        if (msg.message === 'AddPartialTranscript') {
          const text = msg.metadata?.transcript || msg.results?.map(r => r.alternatives?.[0]?.content || '').join(' ') || '';
          if (text.trim()) setPartial(text.trim());
        }

        if (msg.message === 'AddTranscript') {
          const text = msg.metadata?.transcript || msg.results?.map(r => r.alternatives?.[0]?.content || '').join(' ') || '';
          if (text.trim()) lastOriginal = text.trim();
        }

        if (msg.message === 'AddPartialTranslation') {
          const pt = msg.results?.map(r => r.content).join(' ') || '';
          if (pt.trim()) setPartial('-> ' + pt.trim());
        }

        if (msg.message === 'AddTranslation') {
          const translated = msg.results?.map(r => r.content).join(' ') || '';
          if (translated.trim()) {
            console.log('[TRANSLATE] "' + lastOriginal + '" -> "' + translated.trim() + '"');
            setPartial('');
            setEntries(prev => [{ original: lastOriginal || '...', translated: translated.trim() }, ...prev]);
            speakText(translated.trim());
            lastOriginal = '';
          }
        }

        if (msg.message === 'Error') {
          console.error('[SM ERROR]', msg);
          setStatus('Error: ' + (msg.reason || msg.type));
        }
      };

      ws.onerror = () => setStatus('Connection error');
      ws.onclose = (e) => console.log('[SM] Closed: ' + e.code);

    } catch (err) {
      setStatus('Error: ' + err.message);
    }
  }, [sourceLang, targetLang, sourceLabel, speakText]);

  const stop = useCallback(() => {
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ message: 'EndOfStream' }));
        wsRef.current.close();
      } catch(e) {}
      wsRef.current = null;
    }
    if (procRef.current) { procRef.current.disconnect(); procRef.current = null; }
    if (ctxRef.current) { ctxRef.current.close().catch(function(){}); ctxRef.current = null; }
    if (mediaRef.current) { mediaRef.current.getTracks().forEach(t => t.stop()); mediaRef.current = null; }
    setRunning(false);
    setPartial('');
    setStatus('Stopped');
  }, []);

  return (
    <div style={S.page}>
      <h1 style={S.title}>TranslatePipe</h1>
      <p style={S.sub}>{sourceLabel} &rarr; {targetLabel}</p>
      <div style={S.box}>
        <button style={S.mic(running)} onClick={running ? stop : start}>
          <span style={{fontSize:'2.5rem'}}>{running ? '⏹' : '🎤'}</span>
          <span style={S.ml}>{running ? 'Stop' : 'Start'}</span>
        </button>
        {isSpeaking && <div style={{textAlign:'center',color:'#22c55e',fontSize:'.8rem'}}>Speaking...</div>}
        <div style={S.feed}>
          {partial && <div style={S.pt}>{partial}...</div>}
          {entries.length === 0 && !partial && <p style={S.ph}>Speak {sourceLabel} — hear {targetLabel}</p>}
          {entries.map((e, i) => (
            <div key={i}>
              <div style={S.orig}>{e.original}</div>
              <div style={S.trans}>{e.translated}</div>
            </div>
          ))}
        </div>
        <div style={S.st}>{status}</div>
      </div>
    </div>
  );
}

var S = {
  page:{minHeight:'100vh',background:'linear-gradient(145deg,#0a0a0f,#12121f,#0a0f1a)',color:'#e0e0e0',fontFamily:"'SF Pro Display',-apple-system,sans-serif",display:'flex',flexDirection:'column',alignItems:'center',padding:'40px 20px'},
  title:{fontSize:'2rem',fontWeight:200,letterSpacing:'.15em',textTransform:'uppercase',color:'#fff',marginBottom:'4px'},
  sub:{fontSize:'1rem',color:'#22c55e',letterSpacing:'.1em',marginBottom:'32px'},
  box:{width:'100%',maxWidth:'500px',display:'flex',flexDirection:'column',gap:'16px'},
  mic:function(on){return{width:'140px',height:'140px',borderRadius:'50%',border:on?'3px solid #22c55e':'3px solid rgba(255,255,255,.15)',background:on?'radial-gradient(circle,rgba(34,197,94,.25),rgba(34,197,94,.05))':'radial-gradient(circle,rgba(255,255,255,.08),rgba(255,255,255,.02))',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'6px',transition:'all .3s',margin:'0 auto',boxShadow:on?'0 0 40px rgba(34,197,94,.2)':'none'}},
  ml:{fontSize:'.7rem',textTransform:'uppercase',letterSpacing:'.15em',color:'#888'},
  feed:{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.06)',borderRadius:'16px',padding:'20px',minHeight:'200px',maxHeight:'50vh',overflowY:'auto'},
  pt:{color:'#22c55e',fontSize:'.95rem',fontStyle:'italic',marginBottom:'12px',paddingBottom:'10px',borderBottom:'1px solid rgba(34,197,94,.15)'},
  ph:{color:'#444',fontStyle:'italic',fontSize:'.9rem',textAlign:'center'},
  orig:{color:'#888',fontSize:'.85rem',lineHeight:1.5,marginBottom:'4px',fontStyle:'italic'},
  trans:{color:'#fff',fontSize:'1.1rem',lineHeight:1.5,marginBottom:'14px',paddingBottom:'14px',borderBottom:'1px solid rgba(255,255,255,.04)'},
  st:{textAlign:'center',fontSize:'.8rem',color:'#555'},
};
