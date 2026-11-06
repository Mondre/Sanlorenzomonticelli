import { useEffect,useState,type SubmitEvent } from 'react';
import { LockKeyhole,LogOut,RefreshCw } from 'lucide-react';
import SponsorsManager from './SponsorsManager';
import VenuesManager from './VenuesManager';
import UsersManager from './UsersManager';
import ChangePassword from './ChangePassword';
import TeamsManager from './TeamsManager';
import RequestsManager from './RequestsManager';
import SetupManager from './SetupManager';
import NewsManager from './NewsManager';
import MatchesManager from './MatchesManager';
type Dashboard={user:{name:string};roles:string[];metrics:{published:number;drafts:number;requests:number}|null};
type State={kind:'loading'}|{kind:'login'}|{kind:'error';message:string}|{kind:'dashboard';data:Dashboard};
export default function AdminApp(){
 const [state,setState]=useState<State>({kind:'loading'});
 const [section,setSection]=useState<'dashboard'|'news'|'matches'|'setup'|'teams'|'requests'|'users'|'password'|'sponsors'|'venues'>('dashboard');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(){
  setState({kind:'loading'});
  try{
   const response=await fetch('/api/admin/dashboard',{credentials:'same-origin',cache:'no-store'});
   if(response.status===401){setState({kind:'login'});return;}
   if(response.status===403){setState({kind:'error',message:'Il tuo account non ha permessi per accedere. Contatta un amministratore.'});return;}
   if(!response.ok)throw new Error();
   setState({kind:'dashboard',data:await response.json() as Dashboard});
  }catch{setState({kind:'error',message:'Area riservata temporaneamente non disponibile. Riprova o contatta la segreteria.'});}
 }
 useEffect(()=>{void load();},[]);
 async function login(event:SubmitEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');
  const form=event.currentTarget,data=new FormData(form);
  try{
   const response=await fetch('/api/auth/sign-in/email',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:data.get('email'),password:data.get('password'),rememberMe:false})});
   if(!response.ok){setError(response.status===429?'Troppi tentativi. Attendi un minuto prima di riprovare.':response.status>=500?'Accesso temporaneamente non disponibile.':response.status===403?'Account senza accesso attivo. Contatta l’amministratore.':'Email o password non corrette.');return;}
   form.reset();await load();
  }catch{setError('Connessione non riuscita. Riprova.');}finally{setBusy(false);}
 }
 async function logout(){
  setBusy(true);setError('');
  try{const r=await fetch('/api/auth/sign-out',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw new Error();setState({kind:'login'});}catch{setError('Uscita non riuscita. Riprova.');}finally{setBusy(false);}
 }
 if(state.kind==='loading')return <div role="status" className="admin-loading"><p>Verifica dell’accesso…</p><div className="skeleton"/><div className="skeleton"/></div>;
 if(state.kind==='error')return <div className="panel admin-login"><LockKeyhole aria-hidden="true"/><h1 className="page-title">Area riservata</h1><p role="alert">{state.message}</p><button className="button button-secondary" onClick={()=>void load()}><RefreshCw size={16}/> Riprova</button></div>;
 if(state.kind==='login')return <div className="panel admin-login"><p className="eyebrow">PER CHI FA VIVERE IL CLUB</p><h1 className="page-title">Bentornato.</h1><p>Accedi con l’account assegnato dalla società.</p><form onSubmit={login} className="admin-form"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required maxLength={254} disabled={busy}/><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} disabled={busy}/><p role="alert" className="error-message">{error}</p><button className="button button-secondary" disabled={busy}>{busy?'Accesso in corso…':'Accedi'} <LockKeyhole size={16}/></button></form><p>Non hai un account o hai dimenticato la password? Contatta l’amministratore della società.</p></div>;
 const {data}=state;
 return <div className="admin-dashboard"><div className="section-heading"><div><p className="eyebrow">AREA RISERVATA</p><h1 className="page-title">Ciao, {data.user.name}.</h1><p>Il tuo spazio per la società.</p></div><button className="button button-secondary" onClick={()=>void logout()} disabled={busy}>Esci <LogOut size={16}/></button></div><p className="error-message" role="alert">{error}</p><nav className="admin-tabs" aria-label="Gestione contenuti"><button className="button" aria-pressed={section==='dashboard'} onClick={()=>setSection('dashboard')}>Dashboard</button><button className="button" aria-pressed={section==='news'} onClick={()=>setSection('news')}>Notizie</button>{data.roles.some(role=>['super_admin','admin','category_manager'].includes(role))&&<><button className="button" aria-pressed={section==='teams'} onClick={()=>setSection('teams')}>Squadre e staff</button><button className="button" aria-pressed={section==='matches'} onClick={()=>setSection('matches')}>Partite e risultati</button></>}{data.roles.some(role=>['super_admin','admin'].includes(role))&&<><button className="button" aria-pressed={section==='sponsors'} onClick={()=>setSection('sponsors')}>Sponsor</button><button className="button" aria-pressed={section==='venues'} onClick={()=>setSection('venues')}>Campi sportivi</button><button className="button" aria-pressed={section==='requests'} onClick={()=>setSection('requests')}>Richieste</button><button className="button" aria-pressed={section==='setup'} onClick={()=>setSection('setup')}>Configurazione sportiva</button></>}{data.roles.includes('super_admin')&&<button className="button" aria-pressed={section==='users'} onClick={()=>setSection('users')}>Utenti e permessi</button>}<button className="button" aria-pressed={section==='password'} onClick={()=>setSection('password')}>La mia password</button></nav>{section==='news'?<NewsManager/>:section==='matches'?<MatchesManager/>:section==='setup'?<SetupManager/>:section==='teams'?<TeamsManager/>:section==='requests'?<RequestsManager/>:section==='users'?<UsersManager/>:section==='password'?<ChangePassword/>:section==='sponsors'?<SponsorsManager/>:section==='venues'?<VenuesManager/>:<>{data.metrics?<div className="values-grid"><article className="value-card"><p>Notizie pubblicate</p><h2>{data.metrics.published}</h2></article><article className="value-card"><p>Articoli in bozza</p><h2>{data.metrics.drafts}</h2></article><article className="value-card"><p>Nuove richieste</p><h2>{data.metrics.requests}</h2></article></div>:<p className="notice">L’accesso è limitato ai contenuti assegnati al tuo account. Usa le sezioni disponibili per gestirli.</p>}<div className="panel admin-progress"><h2>La società, ogni giorno</h2><p>Apri Notizie per scrivere e pubblicare un articolo, oppure Partite e risultati per aggiornare il calendario.</p><button className="button" onClick={()=>void load()}><RefreshCw size={16}/> Aggiorna i dati</button></div></>}</div>;
}
