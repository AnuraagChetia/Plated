export type CustomerProfile={name:string;phone:string};
export type SavedAddress={id:string;label:string;recipient:string;phone:string;address:string};
export type CustomerOrder={id:string;status:string;total:number;created_at:string;tracking_token:string;restaurant_name:string;restaurant_slug:string};
export type CustomerAccount={profile:CustomerProfile;addresses:SavedAddress[];orders:CustomerOrder[]};
export function customerDetails(value:unknown,address=false): Record<string,string> | null {
 if(!value||typeof value!=="object")return null;
 const input=value as Record<string,unknown>;
 const fields=address?{label:[1,40],recipient:[1,100],address:[10,500]}:{name:[1,100]};
 const result:Record<string,string>={};
 for(const [key,bounds] of Object.entries(fields)){const val=input[key];if(typeof val!=="string"||val.trim().length<bounds[0]||val.trim().length>bounds[1])return null;result[key]=val.trim();}
 if(typeof input.phone!=="string"||input.phone.length>25||!/^\+?[0-9 ()-]*$/.test(input.phone))return null;
 const phone=input.phone.replace(/\D/g,"");if(!/^[0-9]{7,15}$/.test(phone)&&(address||phone!==""))return null;
 return {...result,phone};
}
