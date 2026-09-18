"use client";
import { useEffect, useState, useRef, useId, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function RestaurantNavigation({ name, slug, logoUrl, logo, children }: { name:string; slug:string; logoUrl?:string; logo?:ReactNode; children?:ReactNode }) {
  const router = useRouter();
  const [menuOpen,setMenuOpen]=useState(false);
  const menuRef=useRef<HTMLDivElement>(null),avatarRef=useRef<HTMLButtonElement>(null);
  const menuId=useId();
  useEffect(()=>{if(!menuOpen)return;
    const outside=(event:PointerEvent)=>{if(!menuRef.current?.contains(event.target as Node))setMenuOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setMenuOpen(false);avatarRef.current?.focus();}};
    document.addEventListener("pointerdown",outside);document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
  },[menuOpen]);
  const [signedIn,setSignedIn] = useState<boolean | null>(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState("");
  useEffect(() => {
    const client = createClient(); let active = true;
    client.auth.getUser().then(({data}) => { if(active) setSignedIn(!!data.user); }).catch(() => { if(active) setSignedIn(false); });
    const {data:{subscription}} = client.auth.onAuthStateChange((_event,session) => { if(active) {setSignedIn(!!session);if(_event==="SIGNED_OUT")window.dispatchEvent(new Event("plated-auth-change"));} });
    return () => { active = false; subscription.unsubscribe(); };
  },[]);
  async function signOut(){
    setBusy(true);setError("");
    try{const {error}=await createClient().auth.signOut();if(error)throw error;setSignedIn(false);setMenuOpen(false);router.refresh();}
    catch{setError("Could not sign out. Please retry.");}finally{setBusy(false);}
  }
  return <header className="restaurantNav" aria-label="Restaurant navigation">
    <div className="restaurantIdentity">{logo || <a href={"/r/"+slug} aria-label={name+" storefront"}>{logoUrl ? <img className="restaurantNavLogo" src={logoUrl} alt={name} /> : <span className="restaurantNavPlaceholder" aria-label="Restaurant logo">{name.slice(0,2).toUpperCase()}</span>}</a>}<a className="restaurantNavName" href={"/r/"+slug}>{name}</a></div>
    <div className="restaurantNavActions">{signedIn === false && <a className="restaurantAuth" href={"/sign-in?store="+encodeURIComponent(slug)}>Sign in</a>}{signedIn === true && <><div className="customerAccountMenu" ref={menuRef} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setMenuOpen(false);}}><button ref={avatarRef} type="button" className="profileAvatar" aria-label="Open account menu" aria-expanded={menuOpen} aria-controls={menuId} onClick={()=>setMenuOpen(value=>!value)}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg></button>{menuOpen&&<nav id={menuId} className="accountDropdown" aria-label="Account"><a href={"/profile?store="+encodeURIComponent(slug)}>My profile</a><a href={"/profile?store="+encodeURIComponent(slug)+"#orders"}>My orders</a><button type="button" disabled={busy} onClick={signOut}>{busy?"Signing out…":"Sign out"}</button></nav>}</div></>}{children}</div>{error && <p className="restaurantNavError" role="alert">{error}</p>}
  </header>;
}
