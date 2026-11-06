export type SourceCode='SOURCE_HTTP_ERROR'|'SOURCE_CHALLENGE'|'SOURCE_TIMEOUT'|'SOURCE_NETWORK_ERROR'|'SOURCE_CONTENT_TYPE'|'SOURCE_TOO_LARGE'|'SOURCE_ENCODING_ERROR'|'SOURCE_FORMAT_CHANGED';
export class SourceError extends Error{
 code:SourceCode;stage:'calendar'|'standings'|'parse';httpStatus:number|null;
 constructor(code:SourceCode,stage:'calendar'|'standings'|'parse',httpStatus:number|null=null){super(code);this.code=code;this.stage=stage;this.httpStatus=httpStatus;}
}
export function importDiagnostic(error:unknown,phase:'source'|'save',reference:string){
 const source=error instanceof SourceError?error:null;
 const code=source?.code??(phase==='save'?'DATABASE_WRITE_FAILED':error instanceof Error&&error.message==='SOURCE_FORMAT_CHANGED'?'SOURCE_FORMAT_CHANGED':'SOURCE_REQUEST_FAILED');
 const messages:Record<string,string>={
  SOURCE_HTTP_ERROR:`La fonte ha risposto con errore HTTP${source?.httpStatus?' '+source.httpStatus:''}.`,
  SOURCE_CHALLENGE:'La fonte richiede una verifica del browser e non ha fornito i dati.',
  SOURCE_TIMEOUT:'La fonte non ha risposto entro il tempo disponibile.',
  SOURCE_NETWORK_ERROR:'Il server non riesce a collegarsi alla fonte.',
  SOURCE_CONTENT_TYPE:'La fonte ha restituito una risposta di tipo inatteso.',
  SOURCE_TOO_LARGE:'La pagina della fonte supera la dimensione prevista.',
  SOURCE_ENCODING_ERROR:'La codifica della pagina della fonte non è riconosciuta.',
  SOURCE_FORMAT_CHANGED:'I dati della fonte non superano i controlli di formato, stagione o completezza.',
  SOURCE_REQUEST_FAILED:'Non è stato possibile completare la lettura della fonte.',
  DATABASE_WRITE_FAILED:'I dati sono stati letti, ma il salvataggio nel database non è riuscito.',
 };
 return {code,stage:source?.stage??phase,httpStatus:source?.httpStatus??null,reference,message:messages[code]!};
}
