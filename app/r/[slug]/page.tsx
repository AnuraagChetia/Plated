import { notFound } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import Storefront from "./storefront";
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
    client.from("reviews").select("id,customer_name,restaurant_rating,comment,owner_reply,created_at").eq("restaurant_id",restaurant.id).order("created_at",{ascending:false}).limit(10),
  ]);
  if (menu.error || media.error || reviews.error) throw new Error("Unable to load the storefront.");
  return <Storefront isOwner={isOwner} restaurant={restaurant} menu={menu.data || []} media={media.data || []} reviews={reviews.data || []} />;
}
