/* Online stand-in for the claude.ai Artifact runtime, backed by Google Firebase (free Spark plan).
   window.claude.use("db") returns Firestore (compat API, which matches what the app calls),
   but only after the viewer signs in with Google. Who may read/write is enforced by firestore.rules.
   Needs FIREBASE_CONFIG from firebase-config.js and the firebase *-compat scripts loaded first. */
(function(){
"use strict";
const configured=window.FIREBASE_CONFIG&&window.FIREBASE_CONFIG.apiKey&&!/PASTE/.test(window.FIREBASE_CONFIG.apiKey);
let ready;

function gate(html){
  let el=document.getElementById("fb-gate");
  if(!el){el=document.createElement("div");el.id="fb-gate";
    el.style.cssText="position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:16px;background:var(--bg,#f3f4f2);font-family:var(--f-body,system-ui)";
    document.body.appendChild(el)}
  el.innerHTML=`<div style="max-width:380px;width:100%;background:var(--surface,#fff);border:1px solid var(--line,#ddd);border-radius:12px;padding:24px;text-align:center">
    <h1 style="font-family:var(--f-display,system-ui);font-size:22px;margin:0 0 6px">Sales Navigator</h1>${html}</div>`;
  return el;
}
const hideGate=()=>{const el=document.getElementById("fb-gate");if(el)el.remove()};
const btn=(id,label)=>`<button id="${id}" style="margin-top:14px;padding:10px 18px;border-radius:8px;border:0;background:var(--accent,#155e63);color:var(--accent-ink,#fff);font-weight:600;cursor:pointer;font:inherit">${label}</button>`;

function signOutButton(auth,email){
  const b=document.createElement("button");b.textContent="Sign out ("+email+")";
  b.style.cssText="position:fixed;left:12px;bottom:12px;z-index:30;font:12px var(--f-body,system-ui);padding:5px 10px;border-radius:7px;border:1px solid var(--line-strong,#ccc);background:var(--surface,#fff);color:var(--ink-2,#555);cursor:pointer";
  b.onclick=()=>auth.signOut().then(()=>location.reload());document.body.appendChild(b);
}

function start(){
  if(!configured){gate(`<p>This copy isn't connected to a database yet.</p><p style="color:#888;font-size:13px">Add your Firebase settings to <code>firebase-config.js</code>.</p>`);return Promise.reject({code:"unavailable"})}
  firebase.initializeApp(window.FIREBASE_CONFIG);
  const auth=firebase.auth(),fs=firebase.firestore();
  return new Promise(resolve=>{
    auth.onAuthStateChanged(async user=>{
      if(!user){
        gate(`<p>Sign in with your Google account to see the orders.</p>${btn("fb-in","Sign in with Google")}`);
        document.getElementById("fb-in").onclick=()=>auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e=>{
          if(e.code==="auth/popup-blocked"||e.code==="auth/operation-not-supported-in-this-environment")auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider())});
        return;
      }
      try{await fs.doc("settings/config").get()}
      catch(e){
        gate(`<p><b>${user.email}</b> doesn't have access yet.</p><p style="color:#888;font-size:13px">Ask the owner to add this email in Firebase.</p>${btn("fb-out","Use a different account")}`);
        document.getElementById("fb-out").onclick=()=>auth.signOut();
        return;
      }
      hideGate();signOutButton(auth,user.email);resolve(fs);
    });
  });
}

const downloads={async save({filename,data}){
  const url=URL.createObjectURL(new Blob([data],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}};

window.claude={async use(cap){
  if(cap==="db"){if(!ready)ready=new Promise(r=>{if(document.body)r();else document.addEventListener("DOMContentLoaded",r)}).then(start);return ready}
  if(cap==="downloads")return downloads;
  throw {code:"not_granted"};
}};
})();
