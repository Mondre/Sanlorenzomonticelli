export async function adminRequest<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
 const data=await response.json().catch(()=>null) as {error?:{message?:string;fields?:{field:string;message:string}[]}}|null;
 if(!response.ok)throw new Error(response.status===401?'Sessione scaduta. Ricarica la pagina e accedi.':data?.error?.message??'Operazione non riuscita. Riprova.');
 return data as T;
}
export function localInput(value:string|null){if(!value)return '';const d=new Date(value);const pad=(v:number)=>String(v).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
export function utcInput(value:FormDataEntryValue|null){return typeof value==='string'&&value?new Date(value).toISOString():null;}
