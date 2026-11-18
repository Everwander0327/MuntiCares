import { createClient } from 'npm:@supabase/supabase-js@2.106.0';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Content-Type': 'application/json' };
const reply = (body: unknown, status=200) => new Response(JSON.stringify(body),{headers,status});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers});
 if(req.method!=='POST') return reply({error:'Method not allowed'},405);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const anon=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await admin.auth.getUser(req.headers.get('authorization')?.replace(/^Bearer /i,'')||'');
 if(authError||!user?.email) return reply({error:'Sign in again to complete setup.'},401);
 const {data:profile}=await admin.from('users').select('is_banned').eq('id',user.id).maybeSingle();
 if(!profile||profile.is_banned) return reply({error:'Account unavailable.'},403);
 try {
 const body=await req.json();
 if(body.action==='password') {
  if(typeof body.password!=='string'||body.password.length<8||body.password.length>128) return reply({error:'Use a password between 8 and 128 characters.'},400);
  const {error}=await admin.auth.admin.updateUserById(user.id,{password:body.password});
  if(error) return reply({error:'Unable to set that password. Please try another password.'},400);
  return reply({ok:true});
 }
 if(body.action==='send') {
  const {error}=await anon.auth.signInWithOtp({email:user.email,options:{shouldCreateUser:false}});
  if(error) return reply({error:'Unable to send a code right now. Wait a minute and retry.'},429);
  return reply({ok:true});
 }
 if(body.action==='verify') {
  if(typeof body.code!=='string'||!/^\d{6,10}$/.test(body.code)) return reply({error:'Enter the code from your email.'},400);
  const {data,error}=await anon.auth.verifyOtp({email:user.email,token:body.code,type:'email'});
  if(error||data.user?.id!==user.id) return reply({error:'Invalid or expired code. Please retry or request a new code.'},400);
  // Revoke only the temporary OTP session; the caller retains their original session.
  if(data.session) await admin.auth.admin.signOut(data.session.access_token,'local');
  const {error:completeError}=await admin.rpc('complete_google_account_setup',{target_user:user.id});
  if(completeError) return reply({error:'Create your password before verifying your email.'},400);
  return reply({ok:true});
 }
 return reply({error:'Invalid action'},400);
 }catch{return reply({error:'Setup unavailable. Please retry.'},503);}
});
