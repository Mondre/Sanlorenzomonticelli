import { useEffect, useState } from 'react';
import { Menu, X, Moon, Sun } from 'lucide-react';
export default function Navigation({ pathname }: { pathname: string }) {
 const [open, setOpen] = useState(false);
 const [dark, setDark] = useState(false);
 useEffect(() => {
   setDark(document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches));
 }, []);
 function toggleTheme() {
   const next = !dark;
   document.documentElement.dataset.theme = next ? 'dark' : 'light';
   setDark(next);
 }
 return <div className="navigation">
   <button className="icon-button mobile-toggle" aria-label={open ? 'Chiudi menu' : 'Apri menu'} aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)}>{open ? <X size={22}/> : <Menu size={22}/>}</button>
   <nav id="main-navigation" aria-label="Navigazione principale" className={open ? 'nav-links is-open' : 'nav-links'}>
    <a href="/" aria-current={pathname === '/' ? 'page' : undefined} onClick={() => setOpen(false)}>Home</a>
    <a href="/#societa" onClick={() => setOpen(false)}>La società</a>
    <a href="/notizie" aria-current={pathname.startsWith('/notizie')?'page':undefined} onClick={()=>setOpen(false)}>Notizie</a>
    <a href="/partite" aria-current={pathname.startsWith('/partite')?'page':undefined} onClick={()=>setOpen(false)}>Partite</a>
    <a href="/classifiche" aria-current={pathname==='/classifiche'?'page':undefined} onClick={()=>setOpen(false)}>Classifiche</a>
    <a href="/admin" onClick={() => setOpen(false)}>Area riservata</a>
   </nav>
   <button className="icon-button" onClick={toggleTheme} aria-label="Cambia tema" aria-pressed={dark}>{dark ? <Sun size={20}/> : <Moon size={20}/>}</button>
 </div>;
}
