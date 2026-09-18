"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {createClient} from "../../lib/supabase/client";
export default function AuthForm({mode,store,name:restaurantName}:{mode:"sign-in"|"sign-up";store?:string;name?:string}){
 const router=useRouter(); const [name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const signup=mode==="sign-up", customer=!!store, suffix=store?"?store="+encodeURIComponent(store):"";
 async function submit(event:React.FormEvent){event.preventDefault();if(busy)return;setBusy(true);setMessage("");try{
  const client=createClient();const result=signup?await client.auth.signUp({email,password,options:{data:{name}}}):await client.auth.signInWithPassword({email,password});
  if(result.error)throw result.error;
  if(!result.data.session){setMessage("Check your email to confirm your account, then sign in.");return;}
  const {data:owned,error}=await client.from("restaurants").select("id").eq("owner_id",result.data.user!.id).limit(1).maybeSingle();
  if(error)throw new Error("Signed in, but we could not load your account. Please retry.");
  router.push(owned?"/dashboard":store?"/r/"+store:"/onboarding");router.refresh();
 }catch(cause){setMessage(cause instanceof Error?cause.message:"Please try again.");}finally{setBusy(false);}}
 return <main className={customer?"authPage customerAuth":"authPage"}><div className="authCard"><Link className="brand" href={store?"/r/"+store:"/"}>{customer?restaurantName||store:<><i>P</i> plated</>}</Link><p className="eyebrow">{customer?"YOUR TABLE IS WAITING":signup?"WELCOME TO PLATED":"WELCOME BACK"}</p><h1>{signup?"Create your account.":customer?"Welcome back. Let’s eat.":"Sign in to your restaurant."}</h1><p>{customer?(signup?"Save your delivery details and keep your orders in one place.":"Sign in to keep your delivery details and orders close at hand."):signup?"Start building a direct ordering home for your restaurant.":"Pick up where your team left off."}</p><form onSubmit={submit}>{signup&&<label>Your name<input required maxLength={100} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label>}<label>Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input required type="password" minLength={signup?8:undefined} autoComplete={signup?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)}/></label>{message&&<p className="authError" role="status">{message}</p>}<button className="button" disabled={busy}>{busy?"Please wait…":signup?"Create account →":"Sign in →"}</button></form><footer>{signup?"Already have an account?":"New here?"} <Link href={(signup?"/sign-in":"/sign-up")+suffix}>{signup?"Sign in":"Create an account"}</Link></footer></div></main>;
}
