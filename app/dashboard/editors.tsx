"use client";
import { useState } from "react";
import { Dish, Restaurant, Review } from "../../lib/models";
import { ImageField, ImageChange, saveImage } from "../components/image-field";
import { responseJson } from "../../lib/api-client";

export function MenuEditor({ dish, restaurantId, imageUrl, onCancel, onSaved }: { dish:Partial<Dish>; restaurantId:string; imageUrl?:string; onCancel:()=>void; onSaved:()=>void }) {
  const [draft,setDraft] = useState(dish);
  const [change,setChange] = useState<ImageChange>();
  const [busy,setBusy] = useState(false), [error,setError] = useState("");
  return <form className="menuEditor" onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    let saved = false;
    try {
      const result = await responseJson<{dish:{id:string}}>(await fetch("/api/menu", {method:draft.id ? "PATCH" : "POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...draft,restaurant_id:restaurantId})}));
      setDraft({...draft,id:result.dish.id}); saved = true;
      await saveImage(restaurantId,"menu_item",change,result.dish.id);
      onSaved();
    } catch(cause) { setError((saved ? "Dish details saved, but the image was not saved. Retry Save dish. " : "") + (cause instanceof Error ? cause.message : "Could not save dish.")); }
    finally { setBusy(false); }
  }}>
    <fieldset className="dishFields" disabled={busy}>
    <label>Dish name<input required maxLength={100} value={draft.name || ""} onChange={event => setDraft({...draft,name:event.target.value})} /></label>
    <label>Description<textarea maxLength={1000} value={draft.description || ""} onChange={event => setDraft({...draft,description:event.target.value})} /></label>
    <label>Price (₹)<input required type="number" min="1" max="100000" step="1" value={draft.price ?? ""} onChange={event => setDraft({...draft,price:event.target.value === "" ? undefined : Number(event.target.value)})} /></label>
    <label>Category<input required maxLength={60} value={draft.category || ""} onChange={event => setDraft({...draft,category:event.target.value})} /></label>
    <label className="checkLabel"><input type="checkbox" checked={draft.is_available ?? true} onChange={event => setDraft({...draft,is_available:event.target.checked})} /> Available to order</label>
    <ImageField current={imageUrl} value={change} onChange={setChange} disabled={busy} />
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <div className="formActions"><button className="button" disabled={busy}>{busy ? "Saving…" : "Save dish"}</button><button className="outline" type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}

export function ReviewReply({ review,busy,onSave }: { review:Review;busy:boolean;onSave:(reply:string)=>Promise<void> }) {
  const [reply,setReply] = useState(review.owner_reply || "");
  const [saved,setSaved] = useState(false);
  return <form className="replyForm" onSubmit={async event => { event.preventDefault(); try { await onSave(reply); setSaved(true); } catch {} }}>
    <label>Your public reply<textarea maxLength={1000} value={reply} onChange={event => { setReply(event.target.value); setSaved(false); }} /></label>
    <button className="outline" disabled={busy}>Save reply</button>{saved && <small role="status">Reply saved.</small>}
  </form>;
}

export function Settings({ restaurant,busy,onSave }: { restaurant:Restaurant;busy:boolean;onSave:(settings:Restaurant)=>Promise<void> }) {
  const [draft,setDraft] = useState(restaurant), [saved,setSaved] = useState(false);
  return <section className="panel"><h2>Restaurant settings</h2><form className="menuEditor" onSubmit={async event => { event.preventDefault(); try { await onSave(draft); setSaved(true); } catch {} }} onChange={() => setSaved(false)}>
    <label>Name<input required maxLength={100} value={draft.name} onChange={event => setDraft({...draft,name:event.target.value})} /></label>
    <label>Description<textarea required maxLength={1000} value={draft.description} onChange={event => setDraft({...draft,description:event.target.value})} /></label>
    <label>Theme<select value={draft.theme} onChange={event => setDraft({...draft,theme:event.target.value})}><option value="saffron">Saffron</option><option value="olive">Olive</option></select></label>
    <label>Pickup address<textarea required={draft.accepts_pickup} minLength={10} maxLength={500} value={draft.pickup_address} onChange={event => setDraft({...draft,pickup_address:event.target.value})} /></label>
    <label>Restaurant phone<input required type="tel" maxLength={25} value={draft.contact_phone} onChange={event => setDraft({...draft,contact_phone:event.target.value})} /></label>
    <label>Estimated preparation time (minutes)<input required type="number" min="5" max="180" value={draft.estimated_minutes} onChange={event => setDraft({...draft,estimated_minutes:Number(event.target.value)})} /></label>
    {(["accepts_pickup","accepts_delivery","accepting_orders","is_published"] as const).map((key,index) => <label className="checkLabel" key={key}><input type="checkbox" checked={draft[key]} onChange={event => setDraft({...draft,[key]:event.target.checked})} />{["Offer pickup","Offer delivery (handled by your team)","Accept new orders","Publish storefront"][index]}</label>)}
    <p>Customers pay your team directly. Preparation time is an estimate, not a guaranteed delivery time.</p>
    <button className="button" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>{saved && <p role="status">Settings saved.</p>}
  </form></section>;
}

