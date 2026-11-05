import {database} from '../src/server/db/client.ts';
import {requestService} from '../src/server/requests/service.ts';
const result=await requestService(database()).purge();
console.log('Pulizia completata:',result);
