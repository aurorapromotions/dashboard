/* Aurora Promotions Dashboard: shared sign-in, access levels and top bar for every page.
   A page sets window.PAGE = {tool: "home" | "team" | <tool key>, base: "../"} before loading this file,
   then waits on APP.ready, which resolves once the viewer is signed in and allowed on that page.
   Who may do what is enforced by firestore.rules; this file only decides what to show.
   On localhost, ?demo=admin|lead|rep runs without Firebase against browser storage (for testing). */
(function(){
"use strict";
const OWNER="ihsan@aurorapromotions.ca";
const TOOLS=[
  {k:"sales",l:"Sales Navigator",href:"sales/",desc:"Orders, sales and profit by month, rep and customer.",ready:true},
  {k:"clients",l:"Clients & Seasons",href:"clients/",desc:"Your clients, seasonal outreach (golf, holidays…) with catalog links, and follow-up reminders.",ready:true},
  {k:"acceptance",l:"Order Acceptance",href:"acceptance/",desc:"Terms & Conditions (versioned, printable). Next: clients accept orders online with the invoice.",ready:true},
  {k:"projects",l:"Projects",href:"projects/",desc:"One project per client order: tasks, assignments, due dates and progress.",ready:true},
  {k:"handbook",l:"Handbook",href:"handbook/",desc:"How the dashboard works, how to change it, move it to your own website, or rebuild it.",ready:true,readOnly:true},
];
const LEVELS={none:"No access",limited:"Limited",full:"Full"};
const LEVEL_HELP={limited:"Own records only · can add and edit, not delete",full:"Everything in this tool, including delete and settings"};
const PAGE=Object.assign({tool:"home",base:""},window.PAGE||{});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const isLocal=/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
let demoRole=null;
if(isLocal){
  const q=new URLSearchParams(location.search).get("demo");
  try{if(q==="off")sessionStorage.removeItem("ap-demo");else if(q)sessionStorage.setItem("ap-demo",q);demoRole=sessionStorage.getItem("ap-demo")}catch(e){demoRole=q&&q!=="off"?q:null}
}

const APP={OWNER,TOOLS,LEVELS,LEVEL_HELP,page:PAGE,member:null,isAdmin:false,demo:!!demoRole,fs:null,auth:null,esc,
  level(tool){if(!APP.member)return "none";if(APP.isAdmin)return "full";return (APP.member.access||{})[tool]||"none"},
  roleLabel(m){if(!m)return "";if(m.role==="admin")return "Admin";return Object.values(m.access||{}).includes("full")?"Team lead":"Member"},
  toast(msg){const t=document.createElement("div");t.className="ap-toast";t.setAttribute("role","status");t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3000)},
};
window.APP=APP;

// ---------- screens ----------
function gate(inner){
  let el=document.getElementById("ap-gate");
  if(!el){el=document.createElement("div");el.id="ap-gate";el.className="ap-gate";(document.body||document.documentElement).appendChild(el)}
  el.innerHTML=`<div class="ap-card"><h1>Aurora Promotions <span>Dashboard</span></h1>${inner}</div>`;
  return el;
}
const hideGate=()=>{const el=document.getElementById("ap-gate");if(el)el.remove()};
function blocked(msg,showHome){
  gate(`<p class="ap-muted">${msg}</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">${showHome?`<a class="ap-btn ap-primary" href="${PAGE.base}">Go to dashboard home</a>`:""}<button class="ap-btn" id="ap-out2">Sign out</button></div>`);
  document.getElementById("ap-out2").onclick=signOut;
}
const AUTH_ERR={"auth/invalid-credential":"Wrong email or password.","auth/wrong-password":"Wrong email or password.","auth/user-not-found":"Wrong email or password.",
  "auth/invalid-email":"That email address doesn't look right.","auth/too-many-requests":"Too many tries. Wait a few minutes, or reset your password.",
  "auth/user-disabled":"This login has been turned off.","auth/network-request-failed":"No connection. Check your internet and try again.",
  "auth/popup-closed-by-user":"The Google window was closed before signing in."};
const authMsg=e=>AUTH_ERR[e&&e.code]||"Couldn't sign in. Please try again.";

function signInScreen(auth){
  gate(`<p class="ap-muted" style="margin:0 0 14px">Sign in to continue.</p>
    <button class="ap-btn ap-primary ap-wide" id="ap-google">Sign in with Google</button>
    <div class="ap-or">or with email and password</div>
    <form id="ap-pw" novalidate>
      <label>Email<input type="email" id="ap-email" autocomplete="username" required></label>
      <label>Password<input type="password" id="ap-pass" autocomplete="current-password" required></label>
      <button class="ap-btn ap-wide" type="submit">Sign in</button>
    </form>
    <button class="ap-link" id="ap-forgot" type="button">Forgot your password, or setting it for the first time?</button>
    <p class="ap-msg" id="ap-msg" role="status"></p>`);
  const msg=(t,cls)=>{const m=document.getElementById("ap-msg");m.textContent=t;m.className="ap-msg "+(cls||"")};
  document.getElementById("ap-google").onclick=()=>{
    const p=new firebase.auth.GoogleAuthProvider();p.setCustomParameters({prompt:"select_account"});
    auth.signInWithPopup(p).catch(e=>{
      if(e.code==="auth/popup-blocked"||e.code==="auth/operation-not-supported-in-this-environment")auth.signInWithRedirect(p);
      else if(e.code!=="auth/cancelled-popup-request")msg(authMsg(e),"err")});
  };
  document.getElementById("ap-pw").onsubmit=e=>{e.preventDefault();
    const em=document.getElementById("ap-email").value.trim(),pw=document.getElementById("ap-pass").value;
    if(!em||!pw){msg("Enter your email and password.","err");return}
    msg("Signing in…");auth.signInWithEmailAndPassword(em,pw).catch(err=>msg(authMsg(err),"err"))};
  document.getElementById("ap-forgot").onclick=()=>{
    const em=document.getElementById("ap-email").value.trim();
    if(!em){msg("Type your email above first, then click this again.","err");document.getElementById("ap-email").focus();return}
    auth.sendPasswordResetEmail(em).then(()=>msg(`If ${em} has a login, an email with a link to set your password is on its way.`,"ok"),err=>msg(authMsg(err),"err"))};
}

function allowedHere(){
  if(PAGE.tool==="home")return true;
  if(PAGE.tool==="team")return APP.isAdmin;
  return APP.level(PAGE.tool)!=="none";
}
function renderBar(){
  const links=TOOLS.filter(t=>t.ready&&APP.level(t.k)!=="none").map(t=>[t.k,t.l,t.href]);
  if(APP.isAdmin)links.push(["team","Team & Access","team/"]);
  const m=APP.member;
  const b=document.createElement("header");b.className="ap-bar";
  b.innerHTML=`<div class="ap-bar-in"><a class="ap-brand" href="${PAGE.base||"./"}">Aurora Promotions <span>Dashboard</span></a>
    <nav class="ap-nav" aria-label="Tools">${links.map(([k,l,h])=>`<a href="${PAGE.base}${h}"${PAGE.tool===k?' aria-current="page"':""}>${esc(l)}</a>`).join("")}</nav>
    <div class="ap-user">${APP.demo?'<span class="ap-demo">Demo</span>':""}<span><b>${esc(m.name||m.email)}</b> · ${APP.roleLabel(m)}</span><button class="ap-btn ap-small" id="ap-out">Sign out</button></div></div>`;
  document.body.prepend(b);
  document.getElementById("ap-out").onclick=signOut;
}
function signOut(){
  if(APP.demo){try{sessionStorage.removeItem("ap-demo")}catch(e){}location.href=location.pathname+"?demo=off";return}
  APP.auth.signOut().then(()=>location.reload());
}
function admit(m,resolve){
  APP.member=Object.assign({access:{}},m);APP.isAdmin=m.role==="admin";
  if(!allowedHere()){blocked(PAGE.tool==="team"?"Only admins can manage the team.":"You don't have access to this tool. Ask an admin if you need it.",true);return}
  hideGate();renderBar();resolve(APP);
}

// ---------- Firebase ----------
function startFirebase(resolve){
  const cfg=window.FIREBASE_CONFIG;
  if(!cfg||!cfg.apiKey||/PASTE/.test(cfg.apiKey)){gate(`<p class="ap-muted">This copy isn't connected to a database yet.</p>`);return}
  firebase.initializeApp(cfg);
  const auth=firebase.auth(),fs=firebase.firestore();APP.auth=auth;APP.fs=fs;
  auth.onAuthStateChanged(async user=>{
    if(!user){signInScreen(auth);return}
    gate(`<p class="ap-muted">Signing in…</p>`);
    const email=(user.email||"").toLowerCase();
    const google=user.providerData.some(p=>p&&p.providerId==="google.com");
    const ref=fs.collection("members").doc(email);
    let m=null;
    try{const s=await ref.get();if(s.exists)m=s.data()}catch(e){m=null}
    if(email===OWNER&&google&&(!m||m.role!=="admin"||m.active!==true)){
      // the main admin always has access, even before anyone has set up the team
      m=Object.assign({name:user.displayName||"Ihsan",access:{}},m||{},{email,role:"admin",active:true,loginType:"google"});
      try{await ref.set(m)}catch(e){}
    }
    if(!m||m.active!==true){blocked(`<b>${esc(email)}</b> doesn't have access to the dashboard. Ask an admin to add you.`);return}
    if(!google&&m.uid!==user.uid){blocked(`This email/password login isn't linked to <b>${esc(email)}</b> yet. Ask an admin to check your account.`);return}
    APP.user=user;admit(Object.assign({},m,{email}),resolve);
  });
}
APP.createPasswordLogin=async email=>{
  if(APP.demo)return "demo-"+Math.random().toString(36).slice(2,10);
  // a second Firebase instance creates the login without signing the admin out
  const sec=firebase.apps.find(a=>a.name==="ap-secondary")||firebase.initializeApp(window.FIREBASE_CONFIG,"ap-secondary");
  await sec.auth().setPersistence(firebase.auth.Auth.Persistence.NONE);
  const pwd=Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(36)).join("")+"Aa1!";
  const cred=await sec.auth().createUserWithEmailAndPassword(email,pwd);
  const uid=cred.user.uid;await sec.auth().signOut();
  await APP.auth.sendPasswordResetEmail(email);
  return uid;
};
APP.sendPasswordEmail=email=>APP.demo?Promise.resolve():APP.auth.sendPasswordResetEmail(email);

// ---------- demo (localhost only) ----------
function demoDb(){
  const KEY="ap-demo-db";let store;try{store=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){store={}}
  const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(store))}catch(e){}};
  const listeners=new Set(),notify=()=>listeners.forEach(l=>l());
  const coll=n=>(store[n]=store[n]||{});
  const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
  const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,10);
  const snapDoc=(c,id)=>{const d=coll(c)[id];return {id,exists:d!==undefined,data:()=>clone(d),ref:docRef(c,id)}};
  const watch=(fn,cb)=>{const l=()=>cb(fn());listeners.add(l);setTimeout(l,0);return ()=>listeners.delete(l)};
  function docRef(c,id){return {id,
    get:async()=>snapDoc(c,id),
    set:async(d,o)=>{coll(c)[id]=o&&o.merge?Object.assign(coll(c)[id]||{},clone(d)):clone(d);persist();notify()},
    update:async d=>{if(!coll(c)[id])throw {code:"not-found"};Object.assign(coll(c)[id],clone(d));persist();notify()},
    delete:async()=>{delete coll(c)[id];persist();notify()},
    onSnapshot:(cb)=>watch(()=>snapDoc(c,id),cb)}}
  function query(c,filters){
    const snap=()=>{const docs=Object.keys(coll(c)).filter(id=>filters.every(([f,op,v])=>op==="array-contains"?Array.isArray(coll(c)[id][f])&&coll(c)[id][f].includes(v):coll(c)[id][f]===v)).map(id=>snapDoc(c,id));return {docs,size:docs.length,empty:!docs.length,forEach:fn=>docs.forEach(fn)}};
    return {where:(f,op,v)=>query(c,[...filters,[f,op,v]]),doc:id=>docRef(c,id||newId()),get:async()=>snap(),onSnapshot:(cb)=>watch(snap,cb)};
  }
  return {store,persist,collection:c=>query(c,[]),doc:p=>{const [c,id]=p.split("/");return docRef(c,id)},
    runTransaction:async fn=>fn({get:r=>r.get(),set:(r,d,o)=>{r.set(d,o)},update:(r,d)=>{r.update(d)}}),
    batch(){const ops=[];return {set:(r,d,o)=>ops.push(()=>r.set(d,o)),update:(r,d)=>ops.push(()=>r.update(d)),delete:r=>ops.push(()=>r.delete()),commit:async()=>{for(const o of ops)await o()}}}};
}
async function startDemo(resolve){
  const db=demoDb();APP.fs=db;
  const qs=new URLSearchParams(location.search);
  if(qs.has("reset")){try{localStorage.removeItem("ap-demo-db")}catch(e){}location.replace(location.pathname);return}
  if(!db.store.members||!Object.keys(db.store.members).length){
    db.store.members={
      [OWNER]:{name:"Ihsan",email:OWNER,role:"admin",active:true,loginType:"google",access:{}},
      "lead@example.com":{name:"Sam (sales lead)",email:"lead@example.com",role:"member",active:true,loginType:"password",uid:"demo-lead",access:{sales:"full",projects:"full",clients:"full"}},
      "rep@example.com":{name:"Rep 1",email:"rep@example.com",role:"member",active:true,loginType:"password",uid:"demo-rep",access:{sales:"limited",projects:"limited",clients:"limited"}},
    };db.persist();
  }
  if(qs.has("seed")){
    const rows=await fetch(PAGE.base+"assets/example-orders.json").then(r=>r.json()).catch(()=>[]);
    const o=(db.store.orders=db.store.orders||{});rows.forEach((r,i)=>{o["ex"+i+Math.random().toString(36).slice(2,6)]=r});db.persist();
    history.replaceState(null,"",location.pathname);
  }
  const email={admin:OWNER,lead:"lead@example.com",rep:"rep@example.com"}[demoRole]||OWNER;
  const m=db.store.members[email];
  if(!m||m.active!==true){blocked(`Demo user ${esc(email)} has no access.`);return}
  admit(Object.assign({},m,{email}),resolve);
}

// ---------- boot ----------
const downloads={async save({filename,data}){
  const url=URL.createObjectURL(new Blob([data],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}};
APP.ready=new Promise(resolve=>{
  const go=()=>{if(demoRole)startDemo(resolve);else startFirebase(resolve)};
  if(document.body)go();else document.addEventListener("DOMContentLoaded",go);
});
// the Sales Navigator page was first built for claude.ai, which provides window.claude; this keeps it working unchanged
window.claude={async use(cap){
  if(cap==="db"){await APP.ready;return APP.fs}
  if(cap==="downloads")return downloads;
  throw {code:"not_granted"};
}};
})();
