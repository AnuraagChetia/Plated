"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardData, Dish, Order } from "../../lib/models";
import { money, nextStatus } from "../../lib/orders";
import { responseJson } from "../../lib/api-client";
import { MenuEditor, ReviewReply, Settings } from "./editors";

const tabs = ["Overview", "Orders", "Menu", "Reviews", "Settings"];
export default function Dashboard({ ownerName }: { ownerName: string }) {
  const [tab, setTab] = useState("Overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [page, setPage] = useState(1), [reviewPage, setReviewPage] = useState(1);
  const [status, setStatus] = useState("ALL"), [search, setSearch] = useState("");
  const [query, setQuery] = useState(""), [revision, setRevision] = useState(0);
  const [automatic, setAutomatic] = useState(true);
  const [notice, setNotice] = useState(""), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [editor, setEditor] = useState<Partial<Dish> | null>(null);
  const previousCount = useRef<number | null>(null);
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        if (document.hidden) return;
        const params = new URLSearchParams({ page:String(page), reviewPage:String(reviewPage), status, search:query });
        const response = await fetch("/api/dashboard?" + params, { signal:controller.signal, cache:"no-store" });
        const result = await responseJson<DashboardData>(response);
        if (controller.signal.aborted) return;
        if (previousCount.current !== null && result.summary.orders > previousCount.current) setNotice("New orders have arrived. Open Orders to review them.");
        previousCount.current = result.summary.orders;
        setData(result); setError("");
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Connection failed.");
      } finally {
        if (automatic && !controller.signal.aborted) timer = setTimeout(load,10000);
      }
    }
    void load();
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange",onVisible);
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange",onVisible); };
  }, [page, reviewPage, status, query, revision, automatic, refresh]);

  async function save(url: string, method: string, body: unknown) {
    setBusy(true); setError("");
    try {
      const response = await fetch(url,{ method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      await responseJson(response);
      setNotice("Changes saved."); refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Connection failed.";
      setError(message); throw new Error(message);
    } finally { setBusy(false); }
  }
  async function updateOrder(order: Order, target: string) {
    try { await save("/api/orders","PATCH",{id:order.id,previous:order.status,status:target}); } catch { /* shown above */ }
  }
  function orderTable(orders: Order[]) {
    return orders.length ? <div className="ordersList">{orders.map(order => <article className="orderCard" key={order.id}>
      <div><strong>#{order.id.slice(0,8).toUpperCase()} · {money(order.total)}</strong>
        <p>{order.customer_name} {order.customer_phone && <a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>}</p>
        <small>{new Date(order.created_at).toLocaleString("en-IN")} · {order.fulfillment || "Legacy order"}</small>
        <p>{order.order_items.map(item => `${item.quantity} × ${item.name}`).join(", ") || "Item details unavailable"}</p>
        {order.delivery_address && <p><b>Delivery:</b> {order.delivery_address}</p>}{order.notes && <p><b>Notes:</b> {order.notes}</p>}
      </div><div className="orderActions"><span className={`status ${order.status.toLowerCase()}`}>{order.status}</span>
        {nextStatus[order.status] && <><button className="accept" disabled={busy} onClick={() => updateOrder(order,nextStatus[order.status])}>
          {order.status === "NEW" ? "Accept order" : order.status === "PREPARING" ? "Mark ready" : "Complete order"}</button>
          <button className="outline" disabled={busy} onClick={() => { if (window.confirm("Cancel this order? The diner will see the cancellation on their order page.")) void updateOrder(order,"CANCELLED"); }}>Cancel order</button></>}
      </div>
    </article>)}</div> : <p>No orders match this view.</p>;
  }
  if (!data) return <main className="authPage"><section className="authCard"><h1>Your dashboard</h1>{error ? <><p role="alert">{error}</p><button className="button" onClick={refresh}>Retry</button><p><a href="/sign-in">Sign in</a></p></> : <p role="status">Loading your restaurant…</p>}</section></main>;
  const { restaurant, summary } = data;
  const newDish = () => { setTab("Menu"); setEditor({name:"",description:"",price:1,category:"Mains",is_available:true}); };
  return <main className="dashboardPage">
    <aside className="dashSidebar"><a className="brand" href="/"><i>P</i> plated</a>
      <div className="restaurantCard"><b>{restaurant.name.slice(0,2).toUpperCase()}</b><span><strong>{restaurant.name}</strong><small>/r/{restaurant.slug}</small></span></div>
      <nav aria-label="Dashboard">{tabs.map(item => <button key={item} onClick={() => setTab(item)} className={tab === item ? "active" : ""} aria-current={tab === item ? "page" : undefined}>
        {item}{item === "Orders" && summary.active > 0 && <b>{summary.active}</b>}</button>)}</nav>
      <a className="storeLink" href={`/r/${restaurant.slug}`}>↗ View storefront</a>
    </aside>
    <section className="dashContent">
      <header className="dashHeader"><div><p className="eyebrow">YOUR RESTAURANT</p><h1>{tab === "Overview" ? `Welcome, ${ownerName}.` : tab}</h1></div>
        <button className="outline" onClick={refresh}>Refresh</button><button className="button" onClick={newDish}>+ Add menu item</button>
      </header>
      <label className="autoRefresh"><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} /> Update automatically every 10 seconds</label>
      {notice && <div className="dashNotice" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}>×</button></div>}
      {error && <p className="authError" role="alert">{error}</p>}
      {(!restaurant.pickup_address || !restaurant.accepting_orders || !restaurant.is_published) && <p className="setupNotice">Check Settings: {!restaurant.pickup_address ? "add your pickup address. " : ""}{!restaurant.accepting_orders ? "orders are paused. " : ""}{!restaurant.is_published ? "your storefront is unpublished." : ""}</p>}
      {tab === "Overview" && <>
        <div className="dashboardStats"><Metric label="ALL ORDERS" value={String(summary.orders)} note="Across your restaurant" />
          <Metric label="COMPLETED ORDER VALUE" value={money(summary.completed_value)} note="Order value; payment handled separately" />
          <Metric label="ACTIVE ORDERS" value={String(summary.active)} note="New, preparing, and ready" />
          <Metric label="DINER RATING" value={summary.rating ? `${summary.rating} ★` : "—"} note={`${summary.reviews} reviews`} /></div>
        <section className="panel queuePanel"><h2>Active queue</h2><p>Oldest 20 active orders. Use Orders to browse the full history.</p>{orderTable(data.queue)}</section>
      </>}
      {tab === "Orders" && <section className="panel">
        <form className="filterBar" onSubmit={event => { event.preventDefault(); setPage(1); setQuery(search); }}>
          <label>Customer name<input maxLength={100} value={search} onChange={event => setSearch(event.target.value)} /></label>
          <label>Status<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>{["ALL","NEW","PREPARING","READY","COMPLETED","CANCELLED"].map(value => <option key={value}>{value}</option>)}</select></label>
          <button className="outline">Search</button></form>
        {orderTable(data.orders)}<Pagination page={page} total={data.orderCount} size={20} onChange={setPage} />
      </section>}
      {tab === "Menu" && <section className="panel">
        <div className="panelTitle"><h2>Your menu</h2><button onClick={newDish}>+ Add dish</button></div>
        {editor && <MenuEditor key={editor.id || "new"} dish={editor} restaurantId={restaurant.id} imageUrl={data.media.find(asset => asset.menu_item_id === editor.id) ? `/api/media/${data.media.find(asset => asset.menu_item_id === editor.id)!.id}?v=${revision}` : undefined} onCancel={() => setEditor(null)} onSaved={() => { setEditor(null); refresh(); }} />}
        {data.menu.map(dish => <div className="tableRow" key={dish.id}><b className="dishCell">{data.media.find(asset => asset.menu_item_id === dish.id) && <img className="menuThumbnail" src={`/api/media/${data.media.find(asset => asset.menu_item_id === dish.id)!.id}?v=${revision}`} alt="" />}<span>{dish.name}<small>{dish.description}</small></span></b><span>{dish.category}</span><b>{money(dish.price)}</b><span>{dish.is_available ? "Available" : "Unavailable"}<button className="outline tiny" disabled={busy} onClick={() => setEditor(dish)}>Edit</button></span></div>)}
        {!data.menu.length && <p>Add your first dish to start taking orders.</p>}
      </section>}
      {tab === "Reviews" && <section className="panel reviewsList"><h2>Diner feedback</h2>
        {data.reviews.map(review => <article key={review.id}><span>★ {review.restaurant_rating}</span><blockquote>{review.comment || "No comment provided."}</blockquote><p><b>{review.customer_name}</b> · {new Date(review.created_at).toLocaleDateString("en-IN")}</p>
          <ReviewReply key={review.id + (review.owner_reply || "")} review={review} busy={busy} onSave={reply => save("/api/reviews","PATCH",{id:review.id,reply})} /></article>)}
        {!data.reviews.length && <p>No reviews yet. Diners can review completed orders from their private order page.</p>}
        <Pagination page={reviewPage} total={data.reviewCount} size={10} onChange={setReviewPage} />
      </section>}
      {tab === "Settings" && <Settings restaurant={restaurant} busy={busy} onSave={settings => save("/api/restaurants","PATCH",settings)} />}
    </section>
  </main>;
}
function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article><span>{label}</span><b>{value}</b><small>{note}</small></article>; }
function Pagination({ page,total,size,onChange }: { page:number;total:number;size:number;onChange:(page:number)=>void }) {
  return <nav className="pagination" aria-label="Pagination"><button className="outline" disabled={page <= 1} onClick={() => onChange(page-1)}>Previous</button>
    <span>Page {page} of {Math.max(1,Math.ceil(total/size))} · {total} results</span><button className="outline" disabled={page*size >= total} onClick={() => onChange(page+1)}>Next</button></nav>;
}
