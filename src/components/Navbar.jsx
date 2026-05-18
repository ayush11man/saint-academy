import { useEffect, useState } from "react";

const AUTH_PAGES = ["login","signup","dashboard","teacher"];
const NAV_SECTIONS = ["features","pricing","contact"];

export default function Navbar({ page, setPage, user, role, profile, onLogout }) {
  const [scrolled,   setScrolled]   = useState(false);
  const [scrollPct,  setScrollPct]  = useState(0);
  const [activeSection, setActiveSection] = useState("");
  const isAuthPage = AUTH_PAGES.includes(page);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);

      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollPct(total > 0 ? (window.scrollY / total) * 100 : 0);

      // Highlight nav section based on scroll position
      let current = "";
      for (const id of NAV_SECTIONS) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.getBoundingClientRect().top;
          if (top <= 120) current = id;
        }
      }
      // If scrolled near top, highlight nothing (hero)
      if (window.scrollY < 100) current = "";
      setActiveSection(current);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id) => {
    if (page !== "landing") {
      setPage("landing");
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior:"smooth" });
      }, 150);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior:"smooth" });
    }
  };

  const initials = profile?.name
    ? profile.name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)
    : "ST";

  return (
    <nav style={{
      position:"fixed", top:0, left:0, width:"100%", zIndex:100,
      background: scrolled ? "rgba(7,8,15,0.9)" : "transparent",
      backdropFilter: scrolled ? "blur(20px)" : "none",
      borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
      transition:"all 0.3s ease",
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 32px",maxWidth:1200,margin:"0 auto"}}>

        {/* Logo */}
        <div onClick={()=>setPage("landing")} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
          <div style={{width:32,height:32,borderRadius:8,background:"var(--grad)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff",fontFamily:"var(--font-mono)"}}>SA</div>
          <span style={{fontSize:17,fontWeight:600,fontFamily:"var(--font-head)",letterSpacing:"-0.02em",color:"var(--text)"}}>Saint Academy</span>
        </div>

        {/* Center nav links — only on landing */}
        {!isAuthPage && page === "landing" && (
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {NAV_SECTIONS.map(id => (
              <button key={id} onClick={()=>scrollTo(id)} style={{
                background: activeSection===id ? "rgba(124,58,237,0.12)" : "none",
                border: activeSection===id ? "1px solid rgba(124,58,237,0.3)" : "1px solid transparent",
                borderRadius:8,
                cursor:"pointer",
                color: activeSection===id ? "var(--purple3)" : "var(--text2)",
                fontSize:14,
                fontFamily:"var(--font-body)",
                fontWeight: activeSection===id ? 600 : 500,
                textTransform:"capitalize",
                transition:"all 0.2s",
                padding:"6px 14px",
              }}>
                {id}
              </button>
            ))}
          </div>
        )}

        {/* Right side */}
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {user ? (
            <>
              {role==="teacher" && page!=="teacher" && (
                <button onClick={()=>setPage("teacher")} style={{padding:"8px 16px",borderRadius:10,border:"1px solid var(--border2)",background:"transparent",color:"var(--cyan)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"var(--font-body)"}}>
                  Teacher Portal
                </button>
              )}
              {role==="student" && page!=="dashboard" && (
                <button onClick={()=>setPage("dashboard")} style={{padding:"8px 16px",borderRadius:10,border:"1px solid var(--border2)",background:"transparent",color:"var(--cyan)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"var(--font-body)"}}>
                  Dashboard
                </button>
              )}
              <div style={{width:36,height:36,borderRadius:"50%",background:"var(--grad)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer"}} title={profile?.name||"Profile"}>
                {initials}
              </div>
              <button onClick={onLogout} style={{padding:"8px 14px",borderRadius:10,border:"1px solid var(--border)",background:"transparent",color:"var(--text2)",fontSize:13,cursor:"pointer",fontFamily:"var(--font-body)"}}>
                Sign Out
              </button>
            </>
          ) : (
            <>
              {!isAuthPage && (
                <button onClick={()=>setPage("login")} style={{padding:"8px 18px",borderRadius:10,border:"1px solid var(--border2)",background:"transparent",color:"var(--text)",fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"var(--font-body)",transition:"border-color 0.2s"}}>
                  Login
                </button>
              )}
              {!isAuthPage && (
                <button onClick={()=>setPage("signup")} className="grad-btn" style={{padding:"8px 18px",fontSize:14}}>
                  Get Started
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {page==="landing" && (
        <div style={{height:2,background:"var(--border)"}}>
          <div style={{height:"100%",background:"var(--grad)",width:`${scrollPct}%`,transition:"width 0.1s"}}/>
        </div>
      )}
    </nav>
  );
}