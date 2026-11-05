# PROGETTO: PORTALE WEB PER SOCIETÀ CALCISTICA DILETTANTISTICA

Agisci come un Senior Full Stack Developer, Software Architect e UI/UX Designer specializzato in applicazioni sportive.

Voglio sviluppare un portale web professionale per una società calcistica dilettantistica italiana, con Prima Squadra, settore giovanile e diverse categorie.

Il progetto deve essere moderno, veloce, intuitivo, responsive, accessibile e soprattutto semplice da gestire anche da persone con poche competenze informatiche.

Non voglio un semplice sito vetrina, ma una piattaforma completa con sito pubblico, pannello amministrativo e database.

**REQUISITO FONDAMENTALE: NON UTILIZZARE SUPABASE.**

## 1. STACK TECNOLOGICO

Utilizza:

- Astro per il frontend e le pagine pubbliche.
- React e TypeScript per i componenti interattivi.
- Tailwind CSS per il design.
- Neon PostgreSQL come database cloud.
- Netlify per hosting e deploy.
- Netlify Functions per le API backend.
- Better Auth per autenticazione e gestione sessioni, verificando la compatibilità con l'architettura Netlify.
- Drizzle ORM per la gestione del database e delle migrazioni.
- Lucide React per le icone.
- Zod per la validazione dei dati.
- Storage immagini compatibile con il piano gratuito Neon, verificandone le API e i limiti prima dell'implementazione.

Non utilizzare Firebase o Supabase.

Il sito deve essere deployabile su Netlify senza richiedere un server tradizionale sempre acceso.

Non utilizzare localStorage, file JSON o un database locale come fonte persistente dei dati di produzione.

Le credenziali del database devono rimanere esclusivamente sul backend.

## 2. DESIGN E USER EXPERIENCE

Realizza un'interfaccia ispirata ai portali delle società calcistiche professionistiche, ma adatta a una piccola società sportiva.

Caratteristiche:

- Design moderno, elegante e sportivo.
- Mobile-first.
- Colori societari configurabili.
- Logo societario modificabile.
- Supporto a tema chiaro e scuro.
- Animazioni leggere.
- Ottima leggibilità.
- Navigazione semplice.
- Skeleton loading.
- Feedback visivi sulle operazioni.
- Accessibilità WCAG 2.2 AA come obiettivo.
- Ottimizzazione SEO e performance.

La homepage deve dare immediatamente risalto a risultati, prossime partite e notizie.

Utilizza dati dimostrativi realistici, chiaramente identificati come esempi e facilmente sostituibili.

## 3. HOMEPAGE

La homepage deve contenere:

### Header
- Logo della società.
- Nome della società.
- Menu di navigazione.
- Menu mobile.
- Accesso area amministrativa riservata.

### Hero
- Fotografia della squadra.
- Slogan societario.
- Pulsanti per consultare squadre e calendario.
- Possibilità di gestire immagine e testo dal pannello amministrativo.

### Ultimo risultato
Visualizza:
- Categoria.
- Squadra di casa.
- Squadra ospite.
- Loghi.
- Risultato.
- Data.
- Competizione.
- Collegamento alla scheda partita.

### Prossime partite
Mostra le prossime partite delle diverse categorie con:
- Data e ora.
- Squadre.
- Categoria.
- Campo sportivo.
- Indicazione casa/trasferta.
- Collegamento Google Maps.

### Ultime notizie
Visualizza gli articoli più recenti con immagine, titolo, data e categoria.

### Classifiche
Mostra un'anteprima della classifica della Prima Squadra, con collegamento alla classifica completa.

### Sponsor
Sezione con loghi degli sponsor e collegamenti ai loro siti.

### Footer
- Contatti.
- Indirizzo.
- Social network.
- Informazioni societarie.
- Privacy e cookie policy.
- Link amministrazione.

## 4. GESTIONE DELLE CATEGORIE

La società può avere categorie come:

- Prima Squadra.
- Juniores.
- Allievi.
- Giovanissimi.
- Esordienti.
- Pulcini.
- Primi Calci.
- Piccoli Amici.

Le categorie non devono essere hardcoded.

L'amministratore deve poter creare, modificare, disattivare e ordinare le categorie.

Ogni categoria deve avere una pagina dedicata con:

- Nome.
- Stagione sportiva.
- Foto della squadra.
- Descrizione.
- Allenatore.
- Staff.
- Rosa giocatori, dove pubblicabile.
- Calendario.
- Risultati.
- Classifica, se prevista.
- Notizie correlate.
- Orari allenamento.

Prevedere specifiche impostazioni di privacy per le categorie giovanili.

## 5. CALENDARIO E RISULTATI

Creare un sistema completo per gestire le partite.

Ogni partita deve contenere:

- Categoria.
- Stagione.
- Competizione.
- Giornata.
- Squadra di casa.
- Squadra ospite.
- Data.
- Ora.
- Campo.
- Stato della partita.
- Risultato.
- Eventuali marcatori.
- Cronaca.
- Foto.

Stati disponibili:

- Programmata.
- In corso.
- Terminata.
- Rinviata.
- Annullata.
- Sospesa.

Il pannello amministrativo deve consentire l'aggiornamento del risultato in pochi clic.

Quando una partita termina, deve essere possibile pubblicare automaticamente il risultato nella homepage.

Le classifiche devono essere calcolabili dai risultati inseriti, ma prevedere anche rettifiche amministrative per penalizzazioni, punti assegnati a tavolino e altri casi particolari.

Le classifiche devono essere associate a una competizione e a una stagione, non soltanto alla categoria.

Prevedere la possibilità futura di integrare risultati ufficiali FIGC/LND, senza implementare scraping non autorizzato o presumere l'esistenza di API pubbliche.

## 6. MATCH CENTER

Ogni partita deve avere una pagina dedicata.

Mostrare:

- Risultato.
- Stato.
- Data e luogo.
- Formazioni, se disponibili.
- Marcatori.
- Eventi principali.
- Cronaca.
- Galleria fotografica.
- Link per raggiungere il campo.

Prevedere una timeline degli eventi.

Gli aggiornamenti devono poter essere inseriti da un dirigente autorizzato.

Per la prima versione utilizzare aggiornamento periodico leggero o refresh manuale, evitando infrastrutture realtime complesse.

## 7. NEWS E COMUNICAZIONI

Realizzare un sistema editoriale completo.

Funzionalità:

- Creazione articoli.
- Modifica.
- Eliminazione con conferma.
- Bozze.
- Pubblicazione.
- Programmazione della pubblicazione, se supportata dall'architettura.
- Immagine di copertina.
- Galleria fotografica.
- Editor rich text sicuro.
- Categorie e tag.
- Articoli in evidenza.
- Collegamento a una specifica squadra.
- URL SEO-friendly.

Le notizie devono essere consultabili pubblicamente e filtrabili per categoria.

## 8. PANNELLO AMMINISTRATIVO

Creare un'area riservata accessibile tramite /admin.

Il pannello deve essere semplice e moderno, con menu laterale e dashboard.

Sezioni:

1. Dashboard generale.
2. Gestione notizie.
3. Gestione categorie.
4. Gestione squadre.
5. Gestione giocatori.
6. Gestione staff.
7. Gestione partite.
8. Gestione risultati.
9. Gestione classifiche.
10. Gestione competizioni.
11. Gestione stagioni sportive.
12. Gestione sponsor.
13. Gestione gallerie.
14. Gestione campi sportivi.
15. Gestione iscrizioni e richieste.
16. Gestione utenti.
17. Impostazioni societarie.

La dashboard deve mostrare:

- Prossime partite.
- Ultimi risultati.
- Articoli pubblicati.
- Articoli in bozza.
- Richieste ricevute.
- Attività recenti.

### Ruoli

SUPER ADMIN:
Accesso completo.

ADMIN:
Gestione dei contenuti societari.

RESPONSABILE CATEGORIA:
Può gestire soltanto le categorie assegnate.

REDATTORE:
Può creare e modificare notizie secondo i permessi assegnati.

Le autorizzazioni devono essere verificate lato server per ogni operazione.

Non basta nascondere i pulsanti nel frontend.

## 9. ISCRIZIONI E CONTATTI

Creare una pagina dedicata alle iscrizioni.

L'utente deve poter:

- Selezionare la categoria di interesse.
- Richiedere informazioni.
- Prenotare una prova gratuita.
- Inviare una richiesta alla segreteria.

Campi minimi:

- Nome del referente.
- Email.
- Telefono facoltativo.
- Categoria di interesse.
- Messaggio.
- Consenso privacy.

Evitare di raccogliere dati personali dei minori non necessari.

Le richieste devono arrivare nel pannello amministrativo.

Prevedere un sistema antispam e limitazione delle richieste.

## 10. SPONSOR

Realizzare una sezione dedicata agli sponsor.

Ogni sponsor deve avere:

- Nome.
- Logo.
- Descrizione.
- Sito web.
- Categoria di sponsorizzazione.
- Ordine di visualizzazione.
- Stato attivo/non attivo.

Consentire agli amministratori di gestire autonomamente gli sponsor.

## 11. CAMPI SPORTIVI

Gestire uno o più impianti sportivi.

Per ogni campo:

- Nome.
- Indirizzo.
- Comune.
- Indicazioni.
- Collegamento Google Maps.
- Informazioni sul parcheggio.
- Eventuali fotografie.

Le partite devono poter essere associate a un campo.

## 12. FUNZIONALITÀ AGGIUNTIVE

Implementare, ove possibile:

- Ricerca globale delle notizie.
- Filtri per categoria.
- Calendario partite esportabile in formato ICS.
- Condivisione articoli tramite WhatsApp.
- Collegamenti Instagram e Facebook.
- PWA installabile.
- Preferenza della categoria seguita, salvata localmente senza account.
- Notifiche push come modulo futuro, senza introdurre servizi a pagamento.
- Pagina storia della società.
- Pagina organigramma.
- Archivio delle stagioni precedenti.

## 13. DATABASE

Progettare un database PostgreSQL normalizzato.

Entità principali:

- users
- roles
- user_permissions
- seasons
- categories
- teams
- team_staff
- players
- competitions
- competition_teams
- matches
- match_events
- standings_adjustments
- news
- news_categories
- sponsors
- venues
- media
- registration_requests
- site_settings
- audit_logs

Definire correttamente chiavi primarie, esterne, indici e vincoli.

Separare categorie, squadre, stagioni e competizioni.

Prevedere migrazioni versionate e dati seed dimostrativi.

## 14. SICUREZZA

Implementare:

- Autenticazione sicura.
- Sessioni con cookie HttpOnly, Secure e SameSite appropriato.
- Protezione CSRF dove necessaria.
- Password con hashing robusto.
- Autorizzazioni RBAC lato server.
- Validazione Zod.
- Query parametrizzate.
- Protezione XSS.
- Rate limiting per login e form.
- Validazione dei file caricati.
- Limitazione dimensioni immagini.
- Protezione delle API.
- Log delle operazioni amministrative.
- Variabili d'ambiente per tutti i segreti.

Non inserire password, token o stringhe di connessione nel codice frontend.

## 15. PRIVACY

Il progetto deve essere predisposto per il GDPR.

Prevedere:

- Privacy policy.
- Cookie policy.
- Gestione degli eventuali consensi.
- Minimizzazione dei dati.
- Possibilità di eliminare richieste e dati personali.
- Controlli per la pubblicazione delle fotografie.
- Attenzione particolare ai dati dei minorenni.

Non pubblicare automaticamente dati anagrafici o fotografie dei giocatori minorenni.

Non considerare la semplice presenza delle pagine legali come garanzia di conformità GDPR.

## 16. DEPLOY NETLIFY

Configurare il progetto per Netlify.

Fornire:

- netlify.toml.
- Build funzionante.
- Configurazione Netlify Functions.
- Gestione delle variabili d'ambiente.
- Collegamento Neon PostgreSQL.
- Migrazioni database.
- Script di inizializzazione.
- README completo.
- File .env.example.
- Istruzioni per configurare dominio e HTTPS.

Il deploy non deve richiedere modifiche manuali al codice sorgente.

## 17. QUALITÀ DEL CODICE

Il progetto deve essere organizzato in moduli.

Utilizzare:

- TypeScript rigoroso.
- Componenti riutilizzabili.
- Servizi separati.
- API ben strutturate.
- Gestione centralizzata degli errori.
- Loading state.
- Empty state.
- Test per le funzioni critiche.
- Test delle autorizzazioni.
- Controlli di validazione.
- Error boundary dove appropriato.

Evitare componenti monolitici e codice duplicato.

## 18. MODALITÀ DI SVILUPPO

Non limitarti a spiegare come realizzare il progetto.

Devi creare effettivamente tutti i file necessari.

Procedi per fasi:

FASE 1:
Configurazione del progetto, architettura e design system.

FASE 2:
Database, migrazioni e backend.

FASE 3:
Autenticazione e ruoli.

FASE 4:
Homepage e pagine pubbliche.

FASE 5:
Calendari, risultati e classifiche.

FASE 6:
News, squadre e categorie.

FASE 7:
Pannello amministrativo completo.

FASE 8:
Iscrizioni, sponsor e campi sportivi.

FASE 9:
Test, sicurezza e ottimizzazioni.

FASE 10:
Preparazione e verifica deploy Netlify.

Prima di iniziare, verifica la compatibilità attuale delle librerie e dei servizi scelti.

Se una funzionalità non è disponibile nel piano gratuito, proponi e implementa un'alternativa gratuita sostenibile.

Non dichiarare una funzione completata se contiene soltanto dati mock o pulsanti non funzionanti.

Usa dati dimostrativi esclusivamente come seed del database, separandoli dai dati reali.

Al termine di ogni fase:
- Elenca i file creati.
- Spiega cosa funziona.
- Esegui i controlli disponibili.
- Segnala eventuali problemi.
- Prosegui con la fase successiva quando possibile.

OBIETTIVO FINALE:

Ottenere un portale calcistico completo, moderno e pronto per essere personalizzato e pubblicato su Netlify, con un database gratuito su Neon e un pannello amministrativo realmente funzionante.

Inizia creando la struttura del progetto e implementando la prima fase.