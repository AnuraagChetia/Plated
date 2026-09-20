"use client";

import DishArtwork from "../../components/DishArtwork";
import ReviewCarousel from "../../components/ReviewCarousel";
import OrderConfirmation from "../../components/OrderConfirmation";
import {CustomerAccount,SavedAddress} from "../../../lib/customer";
import {serviceStatus} from "../../../lib/hours";
import RestaurantNavigation from "../../components/RestaurantNavigation";
import { useRouter } from "next/navigation";
import { StorefrontImageEditor } from "../../components/image-field";
import { useEffect, useRef, useState } from "react";
import { Checkout, money, OrderInput, parseOrder, restoreCart, UUID } from "../../../lib/orders";
import { Dish, Media, Restaurant, Review } from "../../../lib/models";
import { readStored, removeStored, writeStored } from "../../../lib/browser-storage";
import { ApiError, responseJson } from "../../../lib/api-client";

type Receipt = { id:string;token:string };
export default function Storefront({ restaurant,menu,media:initialMedia,reviews,isOwner = false }: { isOwner?:boolean;restaurant:Restaurant;menu:Dish[];media:Media[];reviews:Review[] }) {
  const router = useRouter();
  const [account,setAccount]=useState<CustomerAccount|null>(null);
  const [selectedAddress,setSelectedAddress]=useState("");
  const [saveContact,setSaveContact]=useState(true);
  const [saveAddress,setSaveAddress]=useState(true),[addressLabel,setAddressLabel]=useState("Delivery");
  const [confirmationOpen,setConfirmationOpen]=useState(false),[confirmationNote,setConfirmationNote]=useState("");
  const dirtyContact=useRef(false);
  const [availability,setAvailability]=useState(()=>serviceStatus(restaurant));
  const [serviceOptions,setServiceOptions]=useState({accepts_pickup:restaurant.accepts_pickup,accepts_delivery:restaurant.accepts_delivery});
  const [cartOpen,setCartOpen] = useState(false);
  const cartDialog = useRef<HTMLDialogElement>(null);
  const cartButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!cartOpen) return;
    const dialog = cartDialog.current;
    if (!dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; cartButton.current?.focus(); };
  }, [cartOpen]);
  const [imageRevision,setImageRevision] = useState(0);
  const [media,setMedia]=useState(initialMedia);
  useEffect(()=>setMedia(initialMedia),[initialMedia]);
  function refreshImages(kind:"logo"|"cover",saved:Media|null) {
    setMedia(current=>[...(saved?[saved]:[]),...current.filter(asset=>asset.kind!==kind)]);
    setImageRevision(value => value + 1); router.refresh();
  }
  const [cart,setCart] = useState<Record<string,number>>({});
  const [customerName,setCustomerName] = useState("");
  const pickup = serviceOptions.accepts_pickup && !!restaurant.pickup_address.trim();
  const [details,setDetails] = useState<Checkout>({phone:"",fulfillment:pickup ? "PICKUP" : "DELIVERY",address:"",notes:""});
  const [attempt,setAttempt] = useState<OrderInput | null>(null), [receipt,setReceipt] = useState<Receipt | null>(null);
  const [ready,setReady] = useState(false), [pending,setPending] = useState(false), [error,setError] = useState("");
  const [search,setSearch] = useState(""), [category,setCategory] = useState("All");
  const cartKey = "plated:cart:"+restaurant.slug, attemptKey = "plated:checkout:"+restaurant.slug, receiptKey = "plated:receipt:"+restaurant.slug;
  useEffect(() => {
    const saved = restoreCart(readStored(cartKey));
    const draft = parseOrder(readStored(attemptKey));
    if (draft && draft.slug === restaurant.slug) {
      setAttempt(draft); setCustomerName(draft.customerName); setDetails(draft.checkout);
      setCart(Object.fromEntries(draft.items.map(item => [item.id,item.quantity])));
    } else setCart(saved);
    const last = readStored(receiptKey) as Receipt | null;
    if (last && typeof last.id === "string" && UUID.test(last.id) && typeof last.token === "string" && UUID.test(last.token)) setReceipt(last);
    setReady(true);
  }, [cartKey,attemptKey,receiptKey,restaurant.slug]);
  useEffect(() => { if (ready) writeStored(cartKey,cart); },[cart,ready,cartKey]);
  useEffect(()=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    async function refreshStatus(){try{if(document.hidden)return;const result=await responseJson<{open:boolean;message:string;hours?:typeof serviceOptions}>(await fetch("/api/store-status?slug="+encodeURIComponent(restaurant.slug),{signal:controller.signal}));if(!controller.signal.aborted){setAvailability(result);if(result.hours)setServiceOptions(result.hours);}}catch{}finally{if(!controller.signal.aborted)timer=setTimeout(refreshStatus,15000);}}
    void refreshStatus();const visible=()=>{if(!document.hidden){clearTimeout(timer);void refreshStatus();}};document.addEventListener("visibilitychange",visible);return()=>{controller.abort();clearTimeout(timer);document.removeEventListener("visibilitychange",visible);};
  },[restaurant.slug]);
  useEffect(()=>{
    let controller:AbortController;
    async function loadAccount(){controller?.abort();controller=new AbortController();const active=controller;
      try{const result=await responseJson<CustomerAccount>(await fetch("/api/profile",{signal:active.signal}));if(active.signal.aborted)return;setAccount(result);
        if(!dirtyContact.current&&!parseOrder(readStored(attemptKey))){const first=result.addresses[0];setCustomerName(result.profile.name||first?.recipient||"");setDetails(current=>({...current,phone:result.profile.phone||first?.phone||"",address:first?.address||""}));if(first)setSelectedAddress(first.id);}
      }catch(cause){if(active.signal.aborted)return;if(cause instanceof ApiError&&cause.status===401)setAccount(null);}
    }
    void loadAccount();const authChange=()=>{if(!parseOrder(readStored(attemptKey))){dirtyContact.current=false;setCustomerName("");setDetails(current=>({...current,phone:"",address:""}));setSelectedAddress("");}void loadAccount();};
    addEventListener("plated-auth-change",authChange);return()=>{controller?.abort();removeEventListener("plated-auth-change",authChange);};
  },[attemptKey]);

  const lines = menu.filter(item => cart[item.id] > 0);
  const stale = Object.keys(cart).filter(id => cart[id] > 0 && !menu.some(item => item.id === id));
  const total = lines.reduce((sum,item) => sum + item.price*cart[item.id],0);
  const count = lines.reduce((sum,item) => sum + cart[item.id],0);
  const canOrder = availability.open && (pickup || serviceOptions.accepts_delivery);
  const locked = pending || !!attempt || !ready;
  function change(id:string,delta:number) { setCart(current => ({...current,[id]:Math.max(0,Math.min(99,(current[id] || 0)+delta))})); }
  async function order(event:React.FormEvent) {
    event.preventDefault(); if (pending || !ready) return;
    setError("");
    const draft = attempt || parseOrder({slug:restaurant.slug,customerName,checkout:details,requestId:crypto.randomUUID(),items:lines.map(item => ({id:item.id,quantity:cart[item.id]}))});
    if (!draft) { setError("Enter your name, a valid phone number, and any required delivery address."); return; }
    if (!writeStored(attemptKey,draft)) { setError("Browser storage is unavailable. Enable it or free some space so your order can be retried safely."); return; }
    setAttempt(draft); setPending(true);
    try {
      const response = await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(draft)});
      const result = await responseJson<{order:Receipt}>(response);
      if (!result.order || !UUID.test(result.order.id) || !UUID.test(result.order.token)) throw new Error("The order response was incomplete. Retry to confirm it safely.");
      setReceipt(result.order); setCart({}); writeStored(cartKey,{});
      if (writeStored(receiptKey,result.order)) removeStored(attemptKey);
      setAttempt(null);setCartOpen(false);setConfirmationNote("");setConfirmationOpen(true);
      if(account&&saveContact){
        void fetch("/api/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:draft.customerName,phone:draft.checkout.phone})}).then(response=>responseJson(response)).then(()=>setAccount(current=>current?{...current,profile:{name:draft.customerName,phone:draft.checkout.phone}}:current)).catch(()=>setConfirmationNote(current=>current+" Your order is confirmed, but contact details could not be saved. Update them from My account."));
      }
      if(account&&saveAddress&&draft.checkout.fulfillment==="DELIVERY"){
        void fetch("/api/profile/addresses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({label:addressLabel,recipient:draft.customerName,phone:draft.checkout.phone,address:draft.checkout.address})}).then(response=>responseJson<{address:SavedAddress}>(response)).then(result=>{setAccount(current=>current?{...current,addresses:[...current.addresses.filter(a=>a.id!==result.address.id),result.address]}:current);setSelectedAddress(result.address.id);}).catch(()=>setConfirmationNote("Your order is confirmed, but the address could not be saved. You can add it from My account."));
      }
    } catch(cause) {
      if (cause instanceof ApiError && [400,401,403,404,429].includes(cause.status)) { setAttempt(null); removeStored(attemptKey); }
      if(cause instanceof ApiError&&cause.status===409&&/stopped taking|currently closed/.test(cause.message)){setAttempt(null);removeStored(attemptKey);setAvailability({open:false,message:cause.message});}
      setError(cause instanceof Error ? cause.message : "Connection interrupted. Retry this order to check whether it was received.");
    }
    finally { setPending(false); }
  }
  const visibleMenu = menu.filter(item => (category === "All" || item.category === category) && (item.name+" "+item.description).toLowerCase().includes(search.toLowerCase()));
  const cover = media.find(asset => asset.kind === "cover"), logo = media.find(asset => asset.kind === "logo");
  return <main className="publicStore">
    {confirmationOpen&&receipt&&<OrderConfirmation receipt={receipt} note={confirmationNote} onClose={()=>setConfirmationOpen(false)}/>}
    <div className="storeContactBar"><span>{restaurant.pickup_address || "Order directly from our kitchen"}</span><div>{restaurant.contact_phone && <a href={`tel:${restaurant.contact_phone}`}>{restaurant.contact_phone}</a>}{isOwner && <a href="/dashboard">Owner dashboard ↗</a>}</div></div>
    <RestaurantNavigation name={restaurant.name} slug={restaurant.slug} logo={<div className="storeLogoArea">{isOwner ? <StorefrontImageEditor restaurantId={restaurant.id} kind="logo" current={logo ? `/api/media/${logo.id}?v=${imageRevision}` : undefined} onSaved={saved=>refreshImages("logo",saved)}>{logo ? <img className="storeLogo" src={`/api/media/${logo.id}?v=${imageRevision}`} alt={restaurant.name} /> : <span className="logoPlaceholder" aria-label="Restaurant logo">{restaurant.name.slice(0,2).toUpperCase()}</span>}</StorefrontImageEditor> : logo ? <img className="storeLogo" src={`/api/media/${logo.id}?v=${imageRevision}`} alt={restaurant.name} /> : <span className="logoPlaceholder" aria-label="Restaurant logo">{restaurant.name.slice(0,2).toUpperCase()}</span>}</div>}><button ref={cartButton} type="button" className="cartToggle" aria-label={`Open cart, ${count} items`} aria-haspopup="dialog" aria-expanded={cartOpen} aria-controls="store-cart" onClick={() => setCartOpen(true)}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 3h2l2.5 12h11l2-8H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg><span className="cartBadge" aria-hidden="true">{count}</span>
    </button></RestaurantNavigation>
    {receipt&&<div className="latestOrder"><button type="button" onClick={()=>{setConfirmationNote("");setConfirmationOpen(true);}} aria-label="Track your latest order" title="Track your latest order"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span aria-hidden="true">Track</span></button></div>}
    {!availability.open&&<div className="storeClosedNotice" role="status"><span className="closedNoticeIcon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1.5"/><rect x="14" y="4" width="5" height="16" rx="1.5"/></svg></span><div><strong>{availability.message.includes("closed")?"Kitchen is closed":"Ordering is paused"}</strong><p>{availability.message}</p></div></div>}
    <section className="storeHero"><div className={`storeCoverArea ${!cover ? "emptyCover" : ""}`}>{cover && <img className="storeCover" src={`/api/media/${cover.id}?v=${imageRevision}`} alt={cover.alt_text || restaurant.name} />}{isOwner && <StorefrontImageEditor restaurantId={restaurant.id} kind="cover" current={cover ? `/api/media/${cover.id}?v=${imageRevision}` : undefined} onSaved={saved=>refreshImages("cover",saved)} />}</div></section>
    <section id="about" className="storeDetails">
      <p className="scriptHeading">Welcome to our table</p><h1>{restaurant.name}</h1><div className="sectionOrnament" aria-hidden="true"><span />✧<span /></div><p className="restaurantStory">{restaurant.description}</p>
      <div className="serviceDetails"><span><i aria-hidden="true">◷</i>{canOrder ? `Prepared in about ${restaurant.estimated_minutes} minutes` : availability.message}</span><span><i aria-hidden="true">⌖</i>{restaurant.pickup_address || "Contact us for collection details"}</span></div>
      {restaurant.opens_at&&restaurant.closes_at&&<p className="openingHours">Open daily {restaurant.opens_at.slice(0,5)}–{restaurant.closes_at.slice(0,5)} · {restaurant.timezone||"Asia/Kolkata"}</p>}
      <a className="storePrimaryLink" href="#menu">Explore our menu <span aria-hidden="true">→</span></a>
    </section>
    <section id="menu" className="storeMenu">
      <div className="menuHeading"><p className="scriptHeading">Fresh from our kitchen</p><h2>Made for your appetite</h2><div className="sectionOrnament" aria-hidden="true"><span />✧<span /></div></div>
      <div className="menuToolbar"><div className="menuCategories" role="group" aria-label="Menu categories">{["All",...new Set(menu.map(item => item.category))].map(value => <button type="button" key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value === "All" ? "All dishes" : value}</button>)}</div>
        <label className="menuSearch"><span>Find a dish</span><input value={search} onChange={event => setSearch(event.target.value)} type="search" placeholder="Search the menu…" /></label>
      </div>
      <div className="menuDishGrid">{visibleMenu.map(item => {
        const photo = media.find(asset => asset.kind === "menu_item" && asset.menu_item_id === item.id);
        return <article className="menuDish" key={item.id}>{photo ? <img className="dishPhoto" src={`/api/media/${photo.id}`} alt={photo.alt_text || item.name} loading="lazy" /> : <DishArtwork category={item.category}/>}
          <div className="dishCopy"><div className="dishTitleLine"><h3>{item.name}</h3><span aria-hidden="true"/><b>{money(item.price)}</b></div><p>{item.description || item.category}</p><div className="dishBottom"><small>{item.category}{item.is_demo&&" · Demo dish"}</small>
          {item.is_demo?<span className="demoDishBadge">Preview only</span>:cart[item.id]>0?<div className="menuQuantity" role="group" aria-label={item.name+" quantity"}><button disabled={locked} aria-label={"Remove one "+item.name+" from menu"} onClick={()=>change(item.id,-1)}>−</button><span aria-live="polite">{cart[item.id]}</span><button disabled={locked||!canOrder||cart[item.id]>=99} aria-label={"Add one "+item.name+" from menu"} onClick={()=>change(item.id,1)}>+</button></div>:<button disabled={locked || !canOrder || cart[item.id] >= 99 || (!cart[item.id] && lines.length >= 50)} onClick={() => change(item.id,1)} aria-label={`Add ${item.name} to cart`}>Add to cart <span aria-hidden="true">+</span></button>}</div></div>
        </article>;
      })}</div>
      {!visibleMenu.length && <p className="menuEmpty">{menu.length ? "No dishes match your search. Try another name or category." : "Our menu is being prepared. Please check back soon."}</p>}
    </section>
    <dialog ref={cartDialog} id="store-cart" className="cartDrawer" aria-labelledby="cart-title" onCancel={() => setCartOpen(false)} onClose={() => setCartOpen(false)} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setCartOpen(false); } }}>
      <div className="cartDrawerHeading"><div><p className="eyebrow">{count} ITEMS</p><h2 id="cart-title">Your next good meal.</h2><p className="cartSubtitle">Fresh from {restaurant.name}</p></div><button type="button" className="cartClose" aria-label="Close cart" onClick={() => setCartOpen(false)}>×</button></div>
      <div className="orderBag"><form onSubmit={order}>
      {!ready && <p role="status">Restoring your bag…</p>}
      {!availability.open&&<div className="storeClosedNotice" role="alert"><span className="closedNoticeIcon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1.5"/><rect x="14" y="4" width="5" height="16" rx="1.5"/></svg></span><div><strong>Not accepting orders right now</strong><p>{availability.message}</p></div></div>}
      {lines.map(item => <div className="cartLine" key={item.id}><div className="cartDishHeading">{media.find(asset => asset.menu_item_id === item.id) ? <img className="cartDishPhoto" src={`/api/media/${media.find(asset => asset.menu_item_id === item.id)!.id}`} alt="" /> : <span className="cartDishIcon" aria-hidden="true">♨</span>}<p>{item.name} <b>{money(item.price*cart[item.id])}</b></p></div>
        <div className="quantityControls"><button type="button" disabled={locked} aria-label={`Remove one ${item.name}`} onClick={() => change(item.id,-1)}>−</button><span>{cart[item.id]}</span>
          <button type="button" disabled={locked || cart[item.id] >= 99} aria-label={`Add one ${item.name}`} onClick={() => change(item.id,1)}>+</button></div></div>)}
      {!lines.length && <div className="cartEmpty"><span aria-hidden="true">♨</span><h3>Something delicious awaits</h3><p>Find your favorite dish and make a meal of it.</p><button type="button" onClick={() => setCartOpen(false)}>Explore the menu →</button></div>}
      {!!stale.length && <p>Some saved items are no longer available. {!attempt && <button type="button" onClick={() => setCart(current => Object.fromEntries(Object.entries(current).filter(([id]) => !stale.includes(id))))}>Remove unavailable items</button>}</p>}
      <div className="cartSummary"><span>Made fresh, just for you</span><strong>Order total <span>{money(total)}</span></strong><p>Pay the restaurant directly · No online payment required</p></div><h3 className="cartDetailsTitle">Make it yours</h3>
      <label>Your name<input required autoComplete="name" maxLength={100} disabled={locked} value={customerName} onChange={event => {dirtyContact.current=true;setCustomerName(event.target.value);}} /></label>
      <label>Phone number<input required type="tel" autoComplete="tel" maxLength={25} disabled={locked} value={details.phone} onChange={event => {dirtyContact.current=true;setDetails({...details,phone:event.target.value});}} /></label>
      {account&&<div className="saveAddressOption"><label><input type="checkbox" checked={saveContact} disabled={locked} onChange={e=>setSaveContact(e.target.checked)}/>Save name and phone to my profile</label></div>}
      <label>Order type<select disabled={locked} value={details.fulfillment} onChange={event => setDetails({...details,fulfillment:event.target.value as Checkout["fulfillment"]})}>
        {(pickup || attempt?.checkout.fulfillment === "PICKUP") && <option value="PICKUP">Pickup</option>}{(serviceOptions.accepts_delivery || attempt?.checkout.fulfillment === "DELIVERY") && <option value="DELIVERY">Delivery</option>}
      </select></label>
      {account&&details.fulfillment==="DELIVERY"&&<label>Saved delivery address<select disabled={locked} value={selectedAddress} onChange={e=>{dirtyContact.current=true;setSelectedAddress(e.target.value);const address=account.addresses.find(a=>a.id===e.target.value);if(address){setCustomerName(address.recipient);setDetails({...details,address:address.address,phone:address.phone});setAddressLabel(address.label);}else setDetails({...details,address:""});}}><option value="">Use a new or edited address</option>{account.addresses.map(address=><option value={address.id} key={address.id}>{address.label} · {address.address}</option>)}</select><a href={"/profile?store="+encodeURIComponent(restaurant.slug)}>Manage saved addresses</a></label>}
      {details.fulfillment === "PICKUP" ? <p>Collect from: {restaurant.pickup_address}</p> : <label>Delivery address<textarea required minLength={10} maxLength={500} autoComplete="street-address" disabled={locked} value={details.address} onChange={event => {dirtyContact.current=true;setSelectedAddress("");setDetails({...details,address:event.target.value});}} /></label>}
      {account&&details.fulfillment==="DELIVERY"&&<div className="saveAddressOption"><label><input type="checkbox" checked={saveAddress} disabled={locked} onChange={e=>setSaveAddress(e.target.checked)}/>Save these delivery details for next time</label>{saveAddress&&<label>Address label<input required maxLength={40} disabled={locked} value={addressLabel} onChange={e=>setAddressLabel(e.target.value)}/></label>}</div>}
      <label>Order notes (optional)<textarea maxLength={500} disabled={locked} value={details.notes} onChange={event => setDetails({...details,notes:event.target.value})} /></label>
      {error && <p role="alert">{error}</p>}
      {attempt && !pending && <p>Your last order has not been confirmed. Retry below with the same details; it will not create a duplicate.</p>}
      <button disabled={pending || !ready || (!attempt && (!lines.length || !!stale.length || !canOrder))}>{pending ? "Confirming order…" : attempt ? "Retry and confirm order" : `Place order · ${money(total)} →`}</button>
    </form></div></dialog>
    {media.some(asset => asset.kind === "gallery") && <section className="storeGallery"><h2>A taste of our place</h2><div className="mediaGrid">{media.filter(asset => asset.kind === "gallery").map(asset => <img key={asset.id} src={`/api/media/${asset.id}`} alt={asset.alt_text || restaurant.name} loading="lazy" />)}</div></section>}
    <section id="reviews" className="storeReviews"><p className="scriptHeading">Around our table</p><h2>Words from our guests</h2><div className="sectionOrnament" aria-hidden="true"><span />✧<span /></div>{reviews.length?<ReviewCarousel reviews={reviews}/>:<p className="reviewEmpty">The first story is yours to tell. Review your meal from your order tracking page after it’s completed.</p>}</section>
    <footer className="storeFooter"><div><strong>{restaurant.name}</strong><p>{restaurant.pickup_address}</p>{restaurant.contact_phone && <a href={`tel:${restaurant.contact_phone}`}>{restaurant.contact_phone}</a>}</div><div><a href="#menu">Browse the menu ↑</a><p>Order directly. Enjoy every bite.</p><a className="poweredBy" href="/">Powered by Plated</a></div></footer>
  </main>;
}
