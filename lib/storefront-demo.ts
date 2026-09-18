import type {Dish,Review} from "./models";
// Labeled demo fixtures; never stored as verified customer feedback.
export const demoDishes: Dish[] = [
 {id:"demo-masor-tenga",name:"Masor Tenga",description:"A light, tangy Assamese fish curry with tomatoes and fresh herbs.",price:280,category:"Mains",is_available:false,is_demo:true},
 {id:"demo-chicken-curry",name:"Homestyle Chicken Curry",description:"Slow-cooked chicken in a warming onion and ginger gravy.",price:260,category:"Mains",is_available:false,is_demo:true},
 {id:"demo-aloo-pitika",name:"Aloo Pitika",description:"Comforting mashed potatoes with mustard oil, onion, and green chilli.",price:110,category:"Sides",is_available:false,is_demo:true},
 {id:"demo-rice",name:"Steamed Joha Rice",description:"Fragrant Assamese rice, steamed fresh and served warm.",price:90,category:"Sides",is_available:false,is_demo:true},
 {id:"demo-pitha",name:"Til Pitha",description:"Delicate rice rolls filled with toasted sesame and jaggery.",price:130,category:"Desserts",is_available:false,is_demo:true},
 {id:"demo-lemon",name:"Gondhoraj Lemon Cooler",description:"A bright citrus cooler with mint and a touch of rock salt.",price:100,category:"Drinks",is_available:false,is_demo:true},
];
export const demoReviews: Review[] = [
 ["Maya",5,"The tangy fish curry and fragrant rice made such a comforting lunch. A lovely combination of simple flavors."],
 ["Arjun",5,"Aloo pitika was my favorite part of the meal. Fresh, familiar, and full of flavor."],
 ["Nina",4,"The chicken curry had a gentle warmth, and the portions were just right for lunch. I would try the fish next time."],
 ["Rohan",5,"Finished with the sesame pitha and a lemon cooler. A sweet little ending to a satisfying meal."],
 ["Leela",4,"A welcoming menu with plenty to share. The rice and sides worked beautifully together."],
].map(([name,rating,comment],index)=>({id:"demo-review-"+index,customer_name:String(name),restaurant_rating:Number(rating),comment:String(comment),owner_reply:null,created_at:"2026-09-18T00:00:00Z",is_demo:true}));

/** Keep real feedback first; fill only empty carousel positions with labeled fixtures. */
export function showcaseReviews(reviews:Review[]):Review[]{
 const real=[...reviews].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,6);
 return [...real,...demoReviews.slice(0,Math.max(0,6-real.length))];
}
