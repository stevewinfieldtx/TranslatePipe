'use client';

export default function Home() {
  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(145deg,#0a0a0f,#12121f,#0a0f1a)',color:'#e0e0e0',fontFamily:"'SF Pro Display',-apple-system,sans-serif",display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 20px',gap:'32px'}}>
      <h1 style={{fontSize:'2.4rem',fontWeight:200,letterSpacing:'.15em',textTransform:'uppercase',color:'#fff'}}>TranslatePipe</h1>
      <p style={{fontSize:'.85rem',color:'#666',letterSpacing:'.3em',textTransform:'uppercase'}}>Pick your language</p>

      <a href="/a" style={{display:'block',width:'100%',maxWidth:'400px',padding:'24px',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:'16px',textAlign:'center',textDecoration:'none',color:'#fff',fontSize:'1.2rem'}}>
        I speak English<br/><span style={{fontSize:'.8rem',color:'#22c55e'}}>Hear translations in Spanish</span>
      </a>

      <a href="/b" style={{display:'block',width:'100%',maxWidth:'400px',padding:'24px',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:'16px',textAlign:'center',textDecoration:'none',color:'#fff',fontSize:'1.2rem'}}>
        Hablo Espanol<br/><span style={{fontSize:'.8rem',color:'#22c55e'}}>Escuchar traducciones en ingles</span>
      </a>
    </div>
  );
}
