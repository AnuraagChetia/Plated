import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import {showcaseReviews} from "../../../lib/storefront-demo";
import Storefront from "./storefront";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;
  const client=await createClient();
  // Never expose unpublished restaurant details in crawler metadata.
  const {data:restaurant}=await client.from("restaurants").select("id,name,slug,description").eq("slug",slug).eq("is_published",true).maybeSingle();
  if(!restaurant)return {title:"Restaurant unavailable",robots:{index:false,follow:false}};
  const base=new URL(process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000");
  const url=new URL("/r/"+encodeURIComponent(restaurant.slug),base).toString();
  const description=restaurant.description?.trim() || "Explore the menu and order directly from "+restaurant.name+".";
  const title=restaurant.name+" — "+(description.length>100?description.slice(0,97).trimEnd()+"…":description);
  const {data:media}=await client.from("media_assets").select("id,kind,alt_text").eq("restaurant_id",restaurant.id).in("kind",["cover","logo"]).order("created_at",{ascending:false});
  const cover=media?.find(image=>image.kind==="cover"),logo=media?.find(image=>image.kind==="logo");
  const photo=cover||logo;
  const images=photo?[{url:new URL("/api/media/"+photo.id,base).toString(),alt:photo.alt_text||restaurant.name}]:[];
  return {title:{absolute:title},description,alternates:{canonical:url},
    openGraph:{type:"website",url,title:restaurant.name,description,siteName:restaurant.name,images},
    twitter:{card:cover?"summary_large_image":"summary",title:restaurant.name,description,images},
    ...(logo?{icons:{icon:new URL("/api/media/"+logo.id,base).toString()}}:{})};
}
export default async function RestaurantPage({ params }: { params:Promise<{slug:string}> }) {
  const { slug } = await params;
  const client = await createClient();
  const { data:restaurant,error } = await client.from("restaurants").select("*").eq("slug",slug).maybeSingle();
  if (error) throw new Error("Unable to load this restaurant.");
  if (!restaurant) notFound();
  const { data: { user } } = await client.auth.getUser();
  const isOwner = !!user && user.id === restaurant.owner_id;
  if (!restaurant.is_published && !isOwner) notFound();
  const [menu,media,reviews] = await Promise.all([
    client.from("menu_items").select("id,name,description,price,category,is_available").eq("restaurant_id",restaurant.id).eq("is_available",true).order("category").order("name"),
    client.from("media_assets").select("id,kind,alt_text,menu_item_id").eq("restaurant_id",restaurant.id).order("created_at",{ascending:false}),
    client.from("reviews").select("id,customer_name,restaurant_rating,comment,owner_reply,created_at").eq("restaurant_id",restaurant.id).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(6),
  ]);
  if (menu.error || media.error || reviews.error) throw new Error("Unable to load the storefront.");
  return <Storefront isOwner={isOwner} restaurant={restaurant} menu={menu.data || []} media={media.data || []} reviews={restaurant.id === "965af1b0-ce5a-4321-a10c-24e6b2d557b6"?showcaseReviews(reviews.data || []):reviews.data || []} />;
}
