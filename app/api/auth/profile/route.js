import { authorizePersonaAdmin } from '../../../../lib/personas/index.js';
export async function GET(request){
 try{await authorizePersonaAdmin(request);return Response.json({is_admin:true},{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({is_admin:false},{headers:{'Cache-Control':'no-store'}});}
}
