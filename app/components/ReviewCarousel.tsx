"use client";
import {useEffect,useRef,useState} from "react";
import type {Review} from "../../lib/models";
export default function ReviewCarousel({reviews}:{reviews:Review[]}){
 const recent=[...reviews].sort((a,b)=>Number(!!a.is_demo)-Number(!!b.is_demo)||b.created_at.localeCompare(a.created_at)).slice(0,6);
 const viewport=useRef<HTMLDivElement>(null);
 const [columns,setColumns]=useState(3),[hovered,setHovered]=useState(false),[focused,setFocused]=useState(false),[reduced,setReduced]=useState(false);
 const max=Math.max(0,recent.length-columns);
 function move(direction:number){const node=viewport.current;if(!node)return;const card=node.querySelector<HTMLElement>('article');if(!card)return;const step=card.offsetWidth+24;const current=Math.round(node.scrollLeft/step);const next=current+direction>max?0:current+direction<0?max:current+direction;node.scrollTo({left:next*step,behavior:reduced?"instant":"smooth"});}
 useEffect(()=>{const node=viewport.current;if(!node)return;const measure=()=>{setColumns(Number(getComputedStyle(node).getPropertyValue('--review-columns'))||3);};const observer=new ResizeObserver(measure);observer.observe(node);measure();const media=matchMedia('(prefers-reduced-motion: reduce)');const motion=()=>setReduced(media.matches);motion();media.addEventListener('change',motion);return()=>{observer.disconnect();media.removeEventListener('change',motion);};},[]);
 useEffect(()=>{if(hovered||focused||reduced||max===0)return;const timer=setInterval(()=>{if(!document.hidden)move(1);},5000);return()=>clearInterval(timer);},[hovered,focused,reduced,max]);
 return <div className="reviewCarousel" role="region" aria-roledescription="carousel" aria-label={recent.some(review=>review.is_demo)?"Customer reviews and labeled demo feedback":"Recent customer reviews"} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setFocused(false);}}>
 <div className="reviewViewport" ref={viewport} tabIndex={0} aria-label="Reviews; swipe or scroll to browse">{recent.map((review,i)=><article key={review.id} role="group" aria-roledescription="slide" aria-label={"Review "+(i+1)+" of "+recent.length}><span className="reviewStars" aria-label={review.restaurant_rating+" out of 5 stars"}>{"★".repeat(review.restaurant_rating)}</span>{review.comment&&<p className="customerQuote">{review.comment}</p>}<b className="reviewCustomer"><span aria-hidden="true">{review.customer_name.slice(0,1).toUpperCase()}</span>{review.customer_name}<small>{review.is_demo?"Demo review · fictional":"Verified order"}</small></b></article>)}</div>
 </div>;
}
