"use client";
import { useEffect, useState } from "react";
import { money, UUID } from "../../../lib/orders";
import { responseJson } from "../../../lib/api-client";

type TrackedOrder = { id:string;status:string;total:number;created_at:string;fulfillment:string;restaurant_name:string;restaurant_slug:string;pickup_address:string;contact_phone:string;estimated_minutes:number;
  items:{name:string;quantity:number;unit_price:number}[];review:{rating:number;comment:string | null;owner_reply:string | null} | null };
const descriptions: Record<string,string> = {
  NEW:"Your order has been received and is waiting for the restaurant to accept it.",
  PREPARING:"The kitchen is preparing your order.",
  READY:"Your order is ready for pickup or delivery by the restaurant’s team.",
  COMPLETED:"Your order is complete. Thank you for ordering directly.",
  CANCELLED:"The restaurant cancelled this order. Contact the restaurant if you need help.",
};
export default function Tracker({ id }: { id:string }) {
  const [token,setToken] = useState("");
  const [order,setOrder] = useState<TrackedOrder | null>(null), [error,setError] = useState("");
  const [revision,setRevision] = useState(0), [rating,setRating] = useState("5"), [comment,setComment] = useState("");
  const [busy,setBusy] = useState(false), [notice,setNotice] = useState("");
  useEffect(() => {
    const access = location.hash.slice(1);
    if (!UUID.test(id) || !UUID.test(access)) setError("This order link is incomplete. Open the private link from your storefront receipt.");
    else setToken(access);
  },[id]);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    let timer:ReturnType<typeof setTimeout>;
    async function load() {
      try {
        if (document.hidden) return;
        const response = await fetch("/api/orders/track",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,token}),signal:controller.signal});
        const result = await responseJson<{order:TrackedOrder}>(response);
        if (!controller.signal.aborted) { setOrder(result.order); setError(""); }
      } catch(cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not refresh order."); }
      finally { if (!controller.signal.aborted) timer = setTimeout(load,10000); }
    }
    void load();
    const onVisible = () => { if (!document.hidden) setRevision(value => value+1); };
    document.addEventListener("visibilitychange",onVisible);
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange",onVisible); };
  },[id,token,revision]);
  async function review(event:React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/reviews",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,token,rating:Number(rating),comment})});
      await responseJson(response);
      setNotice("Your review has been submitted. Thank you!"); setRevision(value => value+1);
    } catch(cause) { setError(cause instanceof Error ? cause.message : "Could not submit review."); }
    finally { setBusy(false); }
  }
  return <main className="trackingPage"><section className="panel">
    <p className="eyebrow">YOUR ORDER</p><h1>{order?.restaurant_name || "Order tracking"}</h1>
    {error && <p role="alert">{error}</p>}
    {!order && !error && <p role="status">Loading your order…</p>}
    {order && <>
      <p>#{order.id.slice(0,8).toUpperCase()} · {order.fulfillment}</p>
      <div className="trackingStatus" role="status" aria-live="polite"><strong>{order.status}</strong><p>{descriptions[order.status]}</p></div>
      <p>Updates every 10 seconds while this page is open.</p>
      <button className="outline" onClick={() => setRevision(value => value+1)}>Refresh status</button>
      <button className="outline" onClick={async () => { try { await navigator.clipboard.writeText(location.href); setNotice("Private order link copied. Anyone with this link can view the status and submit its review."); } catch { setNotice("Copy the address from your browser to save your private order link."); } }}>Copy private order link</button>
      {order.items.map((item,index) => <p className="receiptLine" key={index}><span>{item.quantity} × {item.name}</span><b>{money(item.unit_price*item.quantity)}</b></p>)}
      <p className="receiptLine"><strong>Order total</strong><strong>{money(order.total)}</strong></p><p>Payment is handled directly with the restaurant.</p>
      {order.fulfillment === "PICKUP" && <p><b>Pickup address:</b> {order.pickup_address}</p>}
      {order.contact_phone && <p>Questions? <a href={`tel:${order.contact_phone}`}>Call {order.contact_phone}</a></p>}
      <p><a href={`/r/${order.restaurant_slug}`}>Back to the restaurant</a></p>
      {order.status === "COMPLETED" && (order.review ? <section><h2>Your review</h2><p>★ {order.review.rating}</p><p>{order.review.comment}</p>{order.review.owner_reply && <p><b>Restaurant reply:</b> {order.review.owner_reply}</p>}</section> : <form className="menuEditor" onSubmit={review}>
        <h2>How was your order?</h2><p>Your name and review will appear on the restaurant’s storefront. One review per completed order.</p>
        <label>Rating<select value={rating} onChange={event => setRating(event.target.value)}>{[5,4,3,2,1].map(value => <option key={value} value={value}>{value} stars</option>)}</select></label>
        <label>Your review<textarea maxLength={2000} value={comment} onChange={event => setComment(event.target.value)} /></label>
        <button className="button" disabled={busy}>{busy ? "Submitting…" : "Submit review"}</button>
      </form>)}
    </>}{notice && <p role="status">{notice}</p>}
  </section></main>;
}
