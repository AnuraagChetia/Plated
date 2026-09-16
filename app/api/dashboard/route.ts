import { withApi } from "../../../lib/api-server";
import { routeClient } from "../../../lib/supabase/route";
const orderColumns = "id,customer_name,customer_phone,delivery_address,notes,fulfillment,total,status,created_at,order_items(name,quantity)";
async function handleGET(request: Request) {
  const { client, json } = routeClient(request);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "Please sign in again." }, 401);
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") || 1), reviewPage = Number(params.get("reviewPage") || 1);
  const status = params.get("status") || "ALL", search = (params.get("search") || "").trim();
  if (![page,reviewPage].every(value => Number.isInteger(value) && value >= 1 && value <= 100000) || search.length > 100 || !["ALL","NEW","PREPARING","READY","COMPLETED","CANCELLED"].includes(status)) return json({ error: "Invalid filters." },400);
  const { data: restaurant, error } = await client.from("restaurants").select("*").eq("owner_id",user.id).order("created_at").limit(1).maybeSingle();
  if (error) return json({ error: "Could not load your restaurant." },503);
  if (!restaurant) return json({ error: "Create a restaurant first." },404);
  let ordersQuery = client.from("orders").select(orderColumns,{ count: "exact" }).eq("restaurant_id",restaurant.id);
  if (status !== "ALL") ordersQuery = ordersQuery.eq("status",status);
  if (search) ordersQuery = ordersQuery.ilike("customer_name",`%${search.replace(/[\\%_]/g,"\\$&")}%`);
  const [orders, queue, menu, reviews, media, summary] = await Promise.all([
    ordersQuery.order("created_at",{ ascending:false }).order("id").range((page-1)*20,page*20-1),
    client.from("orders").select(orderColumns).eq("restaurant_id",restaurant.id).in("status",["NEW","PREPARING","READY"]).order("created_at").order("id").limit(20),
    client.from("menu_items").select("id,name,description,price,category,is_available").eq("restaurant_id",restaurant.id).order("category").order("name"),
    client.from("reviews").select("id,customer_name,restaurant_rating,comment,owner_reply,created_at",{ count:"exact" }).eq("restaurant_id",restaurant.id).order("created_at",{ ascending:false }).order("id").range((reviewPage-1)*10,reviewPage*10-1),
    client.from("media_assets").select("id,kind,alt_text,menu_item_id").eq("kind","menu_item").eq("restaurant_id",restaurant.id).order("created_at",{ ascending:false }),
    client.rpc("dashboard_summary",{ restaurant_id_value:restaurant.id }),
  ]);
  if ([orders,queue,menu,reviews,media,summary].some(result => result.error)) return json({ error: "Could not load dashboard data. Check that all migrations have been applied." },503);
  return json({ restaurant, orders:orders.data, orderCount:orders.count, queue:queue.data, menu:menu.data, reviews:reviews.data, reviewCount:reviews.count, media:media.data, summary:summary.data });
}

export const GET = withApi(handleGET);
