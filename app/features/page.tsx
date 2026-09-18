import "../pages.css";
import PublicFooter from "../components/PublicFooter";
const features=[
["Your restaurant, front and center","A branded storefront with your logo, cover, restaurant story, and a menu that’s easy to browse."],
["A menu you can make your own","Create categories with their first dishes. Add photos, change prices, and control availability from your dashboard."],
["Orders with a clear next step","Manage pickup and delivery orders in one queue, from acceptance through preparation to completion."],
["Keep your guests in the loop","Private order links let diners follow status updates and see their receipt without creating an account."],
["Feedback from real orders","Guests can review completed orders. Read their feedback and write a public reply from your dashboard."],
["Stay in control of service","Manage contact details, fulfillment options, preparation estimates, and whether you’re accepting new orders."],
];
export default function Features(){return <main className="detailPage"><section className="detailHero"><p className="brandScript">Thoughtfully made for your kitchen</p><p className="eyebrow">PLATED FEATURES</p><h1>Good service starts<br/>with the right tools.</h1><p>Everything works together so you can spend more time on the food and the people in front of you.</p></section><section className="featureList">{features.map(([title,copy],i)=><article key={title}><span>0{i+1}</span><h2>{title}</h2><p>{copy}</p></article>)}</section><section className="detailCta"><div><p className="brandScript">Make room for something good</p><h2>A home for your restaurant.</h2></div><a className="button" href="/start">Start for free →</a></section><PublicFooter /></main>}
