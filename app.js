import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

const SUPABASE_URL='https://kcgsfkffqumrfkxgsewe.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_IBND_oQ9F4zwzbTp-Jp3hA_UF2Dfk9F';

const sb=createClient(SUPABASE_URL,PUBLISHABLE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});

const $=id=>document.getElementById(id);
let S={user:null,org:null,role:null};
const say=(id,text,ok=false)=>{const e=$(id);e.textContent=text||'';e.className='small '+(ok?'ok':'err')};
const clear=e=>{while(e.firstChild)e.removeChild(e.firstChild)};

function jwtClaims(token){
  try{
    const p=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(atob(p+'='.repeat((4-p.length%4)%4)));
  }catch{return{}}
}
function addCheck(text,ok){
  const d=document.createElement('div');
  d.className='check '+(ok?'pass':'fail');
  d.textContent=(ok?'PASS · ':'FAIL · ')+text;
  $('sessionDiag').appendChild(d);
}
function showDeviceResult(text,ok){
  $('deviceResult').classList.remove('hidden');
  $('deviceResultText').textContent=text;
  $('deviceResultText').className='small '+(ok?'ok':'err');
}
function row(box,title,detail,buttons=[]){
  const r=document.createElement('div'); r.className='row';
  const l=document.createElement('div');
  const b=document.createElement('b'); b.textContent=title; l.appendChild(b);
  if(detail){const s=document.createElement('div');s.className='small';s.textContent=detail;l.appendChild(s)}
  const a=document.createElement('div');a.className='actions';buttons.forEach(x=>a.appendChild(x));
  r.append(l,a);box.appendChild(r);
}
function button(text,fn,cls='btn'){
  const b=document.createElement('button');b.className=cls;b.textContent=text;b.onclick=fn;return b;
}

async function renderSessionDiag(){
  clear($('sessionDiag'));
  const {data:{session}}=await sb.auth.getSession();
  if(!session){addCheck('ไม่มี active session',false);return}
  const c=jwtClaims(session.access_token);
  addCheck('มี Supabase session จริง',true);
  addCheck('JWT sub ตรงกับ user',c.sub===session.user.id);
  addCheck('JWT มี session_id',typeof c.session_id==='string'&&c.session_id.length>0);
  addCheck('Access token ยังไม่หมดอายุ',Number(c.exp||0)*1000>Date.now());
}

async function membership(){
  const {data,error}=await sb
    .from('organization_members')
    .select('role,organizations(id,name,slug)')
    .eq('user_id',S.user.id)
    .eq('is_active',true)
    .limit(1);
  if(error) throw error;
  if(!data?.length){S.org=null;S.role=null}
  else{S.org=data[0].organizations;S.role=data[0].role}
}
async function refreshApp(){
  try{
    await membership();
    $('setup').classList.toggle('hidden',!!S.org);
    $('main').classList.toggle('hidden',!S.org);
    if(!S.org)return;
    $('org').textContent=S.org.name;
    $('role').textContent=S.role;
    await Promise.all([loadTasks(),loadApprovals(),loadKnowledge()]);
    say('msg','ข้อมูลล่าสุด',true);
  }catch(e){say('msg',e.message||String(e))}
}
async function loadTasks(){
  const {data,error}=await sb.from('tasks').select('id,title,status,risk_level,requires_approval')
    .eq('organization_id',S.org.id).order('created_at',{ascending:false});
  if(error)throw error;
  clear($('taskList'));
  (data||[]).forEach(t=>row($('taskList'),t.title,t.status+(t.requires_approval?' · ต้องอนุมัติ':'')));
  if(!data?.length)$('taskList').textContent='ยังไม่มีงาน';
}
async function loadApprovals(){
  const {data,error}=await sb.from('approvals').select('id,title,status,risk_level,reason')
    .eq('organization_id',S.org.id).order('created_at',{ascending:false});
  if(error)throw error;
  clear($('approvalList'));
  (data||[]).forEach(a=>{
    const bs=[];
    if(a.status==='pending'&&['owner','admin'].includes(S.role)){
      bs.push(button('อนุมัติ',()=>decide(a.id,true),'btn primary'));
      bs.push(button('ปฏิเสธ',()=>decide(a.id,false),'btn danger'));
    }
    row($('approvalList'),a.title,a.status+' · '+a.risk_level+' · '+(a.reason||''),bs);
  });
  if(!data?.length)$('approvalList').textContent='ยังไม่มีรายการ';
}
async function loadKnowledge(){
  const {data,error}=await sb.from('knowledge_items').select('title,body,sensitivity')
    .eq('organization_id',S.org.id).order('created_at',{ascending:false});
  if(error)throw error;
  clear($('knowledgeList'));
  (data||[]).forEach(k=>row($('knowledgeList'),k.title,k.sensitivity+' · '+k.body));
  if(!data?.length)$('knowledgeList').textContent='ยังไม่มีข้อมูล';
}
async function decide(id,approve){
  const {error}=await sb.rpc('decide_approval',{p_id:id,p_approve:approve});
  if(error)return say('msg',error.message);
  await refreshApp();
}
async function setSession(s){
  S.user=s?.user||null;
  $('auth').classList.toggle('hidden',!!S.user);
  $('app').classList.toggle('hidden',!S.user);
  if(S.user){
    $('who').textContent=S.user.email||S.user.id;
    await renderSessionDiag();
    await refreshApp();
  }
}

$('login').onclick=async()=>{
  const {error}=await sb.auth.signInWithPassword({
    email:$('email').value.trim(),
    password:$('password').value
  });
  if(error)say('authMsg',error.message);
};
$('signup').onclick=async()=>{
  const p=$('password').value;
  if(p.length<12)return say('authMsg','TEST นี้กำหนดรหัสผ่านอย่างน้อย 12 ตัว');
  const {data,error}=await sb.auth.signUp({email:$('email').value.trim(),password:p});
  if(error)return say('authMsg',error.message);
  say('authMsg',data.session?'สมัครสำเร็จ':'สมัครแล้ว กรุณายืนยันอีเมล แล้วกลับมา Login',true);
};
$('resend').onclick=async()=>{
  const email=$('email').value.trim();
  if(!email)return say('authMsg','กรอกอีเมลก่อน');
  const {error}=await sb.auth.resend({type:'signup',email});
  if(error)return say('authMsg',error.message);
  say('authMsg','ส่งอีเมลยืนยันอีกครั้งแล้ว',true);
};
$('logout').onclick=()=>sb.auth.signOut({scope:'global'});

$('verifyUser').onclick=async()=>{
  say('deviceMsg','กำลังตรวจ Auth server...');
  const {data,error}=await sb.auth.getUser();
  const ok=!error&&data?.user?.id===S.user?.id;
  say('deviceMsg',ok?'PASS · Auth server ยืนยัน session นี้':'FAIL · '+(error?.message||'user mismatch'),ok);
  await renderSessionDiag();
};
$('refreshJwt').onclick=async()=>{
  say('deviceMsg','กำลัง refresh...');
  const {data:{session:before}}=await sb.auth.getSession();
  if(!before)return say('deviceMsg','FAIL · ไม่มี session');
  const c1=jwtClaims(before.access_token);
  const {data,error}=await sb.auth.refreshSession();
  if(error||!data.session)return say('deviceMsg','FAIL · '+(error?.message||'refresh failed'));
  const c2=jwtClaims(data.session.access_token);
  const rotated=before.access_token!==data.session.access_token;
  const same=c1.session_id===c2.session_id;
  const ok=rotated&&same;
  say('deviceMsg',(ok?'PASS':'FAIL')+' · token หมุน='+rotated+' · session เดิม='+same,ok);
  await renderSessionDiag();
};
$('logoutVerify').onclick=async()=>{
  say('deviceMsg','กำลัง logout และทดสอบ token เก่า...');
  const {data:{session:old}}=await sb.auth.getSession();
  if(!old)return say('deviceMsg','FAIL · ไม่มี session');
  const oldJwt=old.access_token;
  const orgId=S.org?.id||null;
  const {error:outErr}=await sb.auth.signOut({scope:'global'});
  if(outErr){showDeviceResult('FAIL · logout ไม่สำเร็จ: '+outErr.message,false);return}
  if(!orgId){showDeviceResult('PASS · logout สำเร็จ แต่ยังไม่มี organization สำหรับทดสอบ RLS',true);return}
  const stale=createClient(SUPABASE_URL,PUBLISHABLE_KEY,{
    global:{headers:{Authorization:'Bearer '+oldJwt}},
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });
  const {data,error}=await stale.from('organizations').select('id').eq('id',orgId);
  const blocked=!!error||!data?.length;
  showDeviceResult(
    blocked?'PASS · logout แล้ว token เก่าอ่านข้อมูลองค์กรไม่ได้':'FAIL · token เก่ายังอ่านข้อมูลองค์กรได้',
    blocked
  );
};

$('createOrg').onclick=async()=>{
  const code=$('beta').value.trim();
  const name=$('orgName').value.trim();
  const slug=$('orgSlug').value.trim().toLowerCase();
  if(!code||!name||!/^[a-z0-9-]{2,80}$/.test(slug))return say('setupMsg','กรอก code, ชื่อ และ slug ให้ครบ');
  const r=await sb.rpc('redeem_beta_code',{p_code:code});
  if(r.error)return say('setupMsg',r.error.message);
  if(r.data!==true)return say('setupMsg','Beta code ไม่ถูกต้องหรือถูกใช้แล้ว');
  const c=await sb.rpc('create_organization',{p_name:name,p_slug:slug});
  if(c.error)return say('setupMsg',c.error.message);
  $('beta').value='';
  await refreshApp();
};
$('addTask').onclick=async()=>{
  const t=$('taskTitle').value.trim();if(!t)return;
  const {error}=await sb.from('tasks').insert({
    organization_id:S.org.id,title:t,created_by:S.user.id,status:'backlog',
    requires_approval:$('taskApproval').checked
  });
  if(error)return say('msg',error.message);
  $('taskTitle').value='';
  await refreshApp();
};
$('addApproval').onclick=async()=>{
  const t=$('approvalTitle').value.trim();if(!t)return;
  const {error}=await sb.from('approvals').insert({
    organization_id:S.org.id,action_type:'workflow_request',title:t,
    reason:$('approvalReason').value.trim(),risk_level:$('approvalRisk').value,
    status:'pending',requested_by_user:S.user.id,
    expires_at:new Date(Date.now()+86400000).toISOString()
  });
  if(error)return say('msg',error.message);
  $('approvalTitle').value='';$('approvalReason').value='';
  await refreshApp();
};
$('addKnowledge').onclick=async()=>{
  const t=$('knowledgeTitle').value.trim(),b=$('knowledgeBody').value.trim();
  if(!t||!b)return;
  const {error}=await sb.from('knowledge_items').insert({
    organization_id:S.org.id,title:t,body:b,
    sensitivity:$('knowledgeSensitivity').value,created_by:S.user.id
  });
  if(error)return say('msg',error.message);
  $('knowledgeTitle').value='';$('knowledgeBody').value='';
  await refreshApp();
};

document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('hidden',x.id!==b.dataset.tab));
});

sb.auth.onAuthStateChange((_event,s)=>setSession(s));
const {data:{session:s}}=await sb.auth.getSession();
await setSession(s);
