export type ServiceHours={accepting_orders:boolean;is_published?:boolean;opens_at?:string|null;closes_at?:string|null;timezone?:string};
export function validHours(open:unknown,close:unknown,zone:unknown):boolean{
 if(typeof zone!=="string"||zone.length>80)return false;
 try{new Intl.DateTimeFormat("en",{timeZone:zone});}catch{return false;}
 if(open===null&&close===null)return true;
 return typeof open==="string"&&typeof close==="string"&&/^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$/.test(open)&&/^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$/.test(close)&&open.slice(0,5)!==close.slice(0,5);
}
export function serviceStatus(restaurant:ServiceHours,now=new Date()):{open:boolean;message:string}{
 if(!restaurant.accepting_orders||restaurant.is_published===false)return {open:false,message:"This restaurant has stopped taking new orders. Please check back later."};
 if(!restaurant.opens_at||!restaurant.closes_at)return {open:true,message:"Accepting orders"};
 const start=restaurant.opens_at.slice(0,5),end=restaurant.closes_at.slice(0,5),zone=restaurant.timezone||"Asia/Kolkata";
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
 const time=parts.find(p=>p.type==="hour")!.value+":"+parts.find(p=>p.type==="minute")!.value;
 const open=start<end?time>=start&&time<end:time>=start||time<end;
 return {open,message:open?"Accepting orders":"Currently closed. Open daily "+start+"–"+end+" ("+zone+")."};
}
