"use client";
import { useState } from "react";
import { Dish, Restaurant } from "../../lib/models";
import { ImageField, ImageChange, saveImage } from "../components/image-field";
import { storefrontSlug } from "../../lib/restaurant-validation";
import { responseJson } from "../../lib/api-client";

export function MenuEditor({ dish, restaurantId, imageUrl, categories, onCancel, onSaved }: { dish:Partial<Dish>; categories:string[]; restaurantId:string; imageUrl?:string; onCancel:()=>void; onSaved:()=>void }) {
  const [draft,setDraft] = useState(dish);
  const [newCategory,setNewCategory] = useState(!dish.category || !categories.includes(dish.category));
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
    <label>Category<select value={newCategory ? "__new__" : draft.category || ""} onChange={event => {
      const creating = event.target.value === "__new__"; setNewCategory(creating); setDraft({...draft,category:creating ? "" : event.target.value});
    }}>{categories.map(category => <option key={category} value={category}>{category}</option>)}<option value="__new__">+ Create new category</option></select></label>
    {newCategory && <label>New category name<input required maxLength={60} value={draft.category || ""} placeholder="e.g. Starters, Desserts, Drinks" onChange={event => setDraft({...draft,category:event.target.value})} /><small>The category is created when you save this dish.</small></label>}
    <label className="checkLabel"><input type="checkbox" checked={draft.is_available ?? true} onChange={event => setDraft({...draft,is_available:event.target.checked})} /> Available to order</label>
    <ImageField current={imageUrl} value={change} onChange={setChange} disabled={busy} />
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <div className="formActions"><button className="button" disabled={busy}>{busy ? "Saving…" : "Save dish"}</button><button className="outline" type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}

export function Settings({ restaurant,busy,onSave }: { restaurant:Restaurant;busy:boolean;onSave:(settings:Restaurant)=>Promise<void> }) {
  const [draft,setDraft] = useState(restaurant);
  return <section className="panel"><h2>Restaurant settings</h2><form className="menuEditor" onSubmit={async event => { event.preventDefault(); try { await onSave(draft); } catch {} }}>
    <label>Name<input required maxLength={100} value={draft.name} onChange={event => setDraft({...draft,name:event.target.value,slug:storefrontSlug(event.target.value)})} /></label>
    <label>Storefront URL<input required maxLength={80} pattern="[a-z0-9]+([-_][a-z0-9]+)*" title="Use lowercase letters, numbers, and single hyphens or underscores." value={draft.slug} onChange={event => setDraft({...draft,slug:event.target.value})} /><small>Address: /r/{draft.slug || "your-restaurant"}. Changing the name updates this address; you can customize it before saving. Previous storefront links will stop working.</small></label>
    <label>Description<textarea required maxLength={1000} value={draft.description} onChange={event => setDraft({...draft,description:event.target.value})} /></label>
    <label>Pickup address<textarea required={draft.accepts_pickup} minLength={10} maxLength={500} value={draft.pickup_address} onChange={event => setDraft({...draft,pickup_address:event.target.value})} /></label>
    <label>Restaurant phone<input required type="tel" maxLength={25} value={draft.contact_phone} onChange={event => setDraft({...draft,contact_phone:event.target.value})} /></label>
    <label>Estimated preparation time (minutes)<input required type="number" min="5" max="180" value={draft.estimated_minutes} onChange={event => setDraft({...draft,estimated_minutes:Number(event.target.value)})} /></label>
    {(["accepts_pickup","accepts_delivery","accepting_orders","is_published"] as const).map((key,index) => <label className="checkLabel" key={key}><input type="checkbox" checked={draft[key]} onChange={event => setDraft({...draft,[key]:event.target.checked})} />{["Offer pickup","Offer delivery (handled by your team)","Accept new orders","Publish storefront"][index]}</label>)}
    <fieldset disabled={busy}><legend>Daily opening hours</legend><label className="checkLabel"><input type="checkbox" checked={draft.opens_at != null} onChange={e=>setDraft({...draft,opens_at:e.target.checked?"09:00":null,closes_at:e.target.checked?"22:00":null,timezone:draft.timezone||"Asia/Kolkata"})}/>Limit ordering to opening hours</label>{draft.opens_at != null&&<><label>Opens at<input required type="time" value={draft.opens_at.slice(0,5)} onChange={e=>setDraft({...draft,opens_at:e.target.value})}/></label><label>Closes at<input required type="time" value={(draft.closes_at||"").slice(0,5)} onChange={e=>setDraft({...draft,closes_at:e.target.value})}/></label><label>Timezone<input required maxLength={80} value={draft.timezone||"Asia/Kolkata"} onChange={e=>setDraft({...draft,timezone:e.target.value})}/></label><small>Use an IANA timezone such as Asia/Kolkata. Closing after midnight is supported. Switching off “Accept new orders” pauses orders immediately.</small></>}</fieldset>
    <p>Customers pay your team directly. Preparation time is an estimate, not a guaranteed delivery time.</p>
    <button className="button" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
  </form></section>;
}

