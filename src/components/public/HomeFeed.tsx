import {useEffect,useState} from 'react';
import type {Article,Match} from '../../shared/content';
import NewsCard from './NewsCard';
import MatchCard from './MatchCard';
interface Feed{news:Article[];upcoming:Match[];latest:Match|null}
export default function HomeFeed(){
 const [data,setData]=useState<Feed|null>(null),[error,setError]=useState(false);
 async function load(){setError(false);try{const response=await fetch('/api/club-feed',{cache:'no-store'});if(!response.ok)throw new Error();setData(await response.json() as Feed);}catch{setError(true);}}
 useEffect(()=>{void load();},[]);
 if(error)return <section className="container section"><h2>Dal campo e dalla società</h2><p className="notice" role="status">Risultati e notizie non sono disponibili in questo momento.</p><button className="button" onClick={()=>void load()}>Riprova</button></section>;
 if(!data)return <section className="container section" aria-label="Aggiornamenti del club"><div role="status"><span className="sr-only">Caricamento notizie e partite</span><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/></div></section>;
 return <><section className="container section"><div className="section-heading"><div><p className="eyebrow">OGNI PARTITA, INSIEME</p><h2>Dal campo.</h2></div><a className="text-link" href="/partite">Calendario e risultati →</a></div><div className="feed-grid"><div><h3>Ultimo risultato</h3>{data.latest?<MatchCard match={data.latest}/>:<p className="empty-state">Nessun risultato ancora pubblicato.</p>}</div><div><h3>Prossime partite</h3>{data.upcoming.length?data.upcoming.map(match=><MatchCard match={match} key={match.id}/>):<p className="empty-state">Le prossime partite saranno pubblicate qui.</p>}</div></div></section><section className="project-section"><div className="container section"><div className="section-heading"><div><p className="eyebrow">LA VITA DEL CLUB</p><h2>Notizie dalla società.</h2></div><a className="text-link" href="/notizie">Tutte le notizie →</a></div>{data.news.length?<div className="values-grid">{data.news.map(article=><NewsCard article={article} key={article.id}/>)}</div>:<p className="empty-state">Non ci sono ancora notizie pubblicate.</p>}</div></section></>;
}
