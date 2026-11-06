import {useState} from 'react';
import {adminRequest} from './api';
interface Result{checkedAt:string;database:string;storage:string;ok:boolean}
export default function ServiceCheck(){
 const [result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function check(){setBusy(true);setError('');try{setResult(await adminRequest<Result>('/api/admin/health','POST',{action:'check'}));}catch(e){setError(e instanceof Error?e.message:'Verifica non riuscita.');}finally{setBusy(false);}}
 return <section className="panel"><h2>Verifica servizi</h2><p>Controlla il database e prova scrittura, lettura e rimozione di un file temporaneo nello storage. I contenuti della società rimangono invariati.</p><button className="button" disabled={busy} onClick={()=>void check()}>{busy?'Verifica in corso…':'Verifica database e immagini'}</button><p role="alert">{error}</p>{result&&<div role="status"><p>Database: <strong>{result.database==='OK'?'OK':result.database}</strong></p><p>Storage immagini: <strong>{result.storage==='OK'?'OK':result.storage}</strong></p><p>Verifica del {new Date(result.checkedAt).toLocaleString('it-IT')}</p></div>}</section>;
}
