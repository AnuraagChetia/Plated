"use client";

import { useEffect, useState } from "react";

const Arrow = () => <span aria-hidden="true">→</span>;
const liveOrders = [["₹ 1,240", "#1048"], ["₹ 780", "#1049"], ["₹ 1,560", "#1050"]];
const billboards = [{ eyebrow: "SAFFRON TABLE · MUMBAI", title: "Food with\nfeeling.", stat: "+42%", caption: "more direct orders in 90 days", dish: "🍛", tone: "saffron" }, { eyebrow: "BAKEHOUSE 22 · BENGALURU", title: "A better\nmorning rush.", stat: "3.1×", caption: "more repeat customers", dish: "🥐", tone: "bakery" }, { eyebrow: "KOKUM COASTAL · GOA", title: "From beachside\ntable to doorstep.", stat: "₹ 8.6L", caption: "in direct orders this month", dish: "🍤", tone: "coastal" }];

export default function Home() {
  const [orderIndex, setOrderIndex] = useState(0);
  const [billboardIndex, setBillboardIndex] = useState(0);
  const [preview, setPreview] = useState("Butter Chicken");
  useEffect(() => {
    const timer = window.setInterval(() => setOrderIndex((current) => (current + 1) % liveOrders.length), 3600);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { const timer = window.setInterval(() => setBillboardIndex((current) => (current + 1) % billboards.length), 5200); return () => window.clearInterval(timer); }, []);
  const billboard = billboards[billboardIndex];
  return <main>
    <div className="announcement">✦ Now serving independent restaurants across India <a href="/how-it-works">See how it works <Arrow /></a></div>
    <section className="hero">
      <div className="heroCopy"><p className="eyebrow">A BETTER WAY TO TAKE ORDERS</p><h1>Your restaurant.<br/><em>Your rules.</em></h1><p className="lede">A beautiful ordering website and the tools to run it — all made for independent restaurants.</p><div className="heroCtas"><a className="button" href="/onboarding">Start for free <Arrow /></a><a className="watch" href="/how-it-works"><b>▶</b> See how it works</a></div><div className="proof"><div className="faces"><i>RS</i><i>AM</i><i>NK</i><i>+</i></div><div><strong>Loved by 500+ restaurant teams</strong><small>★★★★★ <span>4.9 average rating</span></small></div></div></div>
      <div className={`heroVisual billboard ${billboard.tone}`} aria-label="Restaurant success story"><div className="sun"/><span className="spark">✽</span><span className="spark sparkTwo">✦</span><div className="storeCard" key={billboardIndex}><div className="cardTop">{billboard.eyebrow} <b>⋮</b></div><h2>{billboard.title.split("\n").map((line) => <span key={line}>{line}<br/></span>)}</h2><div className="cardFoot"><span><small>POWERED BY PLATED</small><strong>{billboard.caption}</strong></span><button>Read their story <Arrow /></button></div></div><div className="dish">{billboard.dish}</div><div className="successToast"><i>↗</i><span><small>DIRECT ORDER GROWTH</small><strong>{billboard.stat}</strong></span></div><div className="billboardDots">{billboards.map((item,index)=><button aria-label={`Show ${item.eyebrow}`} onClick={()=>setBillboardIndex(index)} className={index===billboardIndex?"active":""} key={item.eyebrow}/>)}</div></div>
    </section>

    <section className="logos"><p>BUILT FOR THE ONES WHO MAKE FOOD MATTER</p><div><span>mamagoto</span><span>THE BOMBAY CANTEEN</span><span>Third Wave</span><span>THEOBROMA</span><span>social</span></div></section>
    <section className="intro" id="how"><p className="eyebrow">ONE PLACE. EVERY ORDER.</p><h2>The direct line between<br/>your food and your people.</h2><p>Plated turns your restaurant into a digital destination that feels entirely yours — not a listing buried in someone else’s app.</p><div className="stats"><div><b>0%</b><span>Commission<br/>on every order</span></div><div><b>3 min</b><span>To launch your<br/>ordering site</span></div><div><b>24/7</b><span>Your business,<br/>always open</span></div></div></section>
    <section className="feature" id="features"><div className="browser"><div className="browserBar">● ● ● <span>plated.site/r/saffron-table</span></div><div className="browserBody"><small>SAFFRON TABLE</small><h3>Made with warmth.<br/>Served with love.</h3><button>Order now</button><div className="foodPreview">{preview === "Butter Chicken" ? "🍛" : preview === "Dal Makhani" ? "🥘" : "🍢"}</div></div><div className="previewTabs">{["Butter Chicken", "Dal Makhani", "Amritsari Fish"].map((dish) => <button className={preview === dish ? "active" : ""} onClick={() => setPreview(dish)} key={dish}>{dish}</button>)}</div></div><div className="featureCopy"><p className="eyebrow">YOUR PLACE, ONLINE</p><h2>Beautiful by<br/>default. <em>Yours</em> by design.</h2><p>Launch a restaurant website that looks unmistakably like you. Add your menu, story, hours and brand — we’ll handle the rest.</p><a href="#start">Explore storefronts　<Arrow /></a></div></section>
    <section className="cta" id="start"><div><p className="eyebrow">YOUR TABLE IS WAITING</p><h2>Ready to take<br/>orders your way?</h2><p>Set up your restaurant in minutes. No commission, no complicated software.</p><a className="button lime" href="/onboarding">Build my restaurant site <Arrow /></a></div><b aria-hidden="true">P</b></section>
    <footer><a className="brand" href="#"><i>P</i> plated</a><span>© 2026 Plated Technologies</span><span>Made for independent restaurants.</span></footer>
  </main>;
}
