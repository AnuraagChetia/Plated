import "../pages.css";
import PublicFooter from "../components/PublicFooter";
const steps = [
  ["Set the table","Add your restaurant details and first dish. Your ordering site starts with the essentials."],
  ["Make it your own","Upload your logo and cover directly on your storefront. Organize dishes into categories and add menu photos."],
  ["Open your doors","Share your storefront link. Diners can browse the menu and place pickup or delivery orders."],
  ["Keep service flowing","Accept orders, update their status, and reply to reviews. Guests track their orders through a private link."],
];
export default function HowItWorks(){return <main className="detailPage"><section className="detailHero"><p className="brandScript">From your kitchen to their table</p><p className="eyebrow">HOW PLATED WORKS</p><h1>Your restaurant online.<br/>One step at a time.</h1><p>A simple path from your first dish to your next order.</p></section><section className="steps">{steps.map(([title,copy],index)=><article key={title}><b>0{index+1}</b><h2>{title}</h2><p>{copy}</p></article>)}</section><section className="detailCta"><div><p className="brandScript">Ready when you are</p><h2>Your next chapter starts here.</h2></div><a className="button" href="/start">Start your restaurant →</a></section><PublicFooter /></main>}
