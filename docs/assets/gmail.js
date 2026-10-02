/* Aurora Promotions Dashboard: send email from the signed-in person's own Google Workspace mailbox.
   Runs in the browser with Google's own sign-in (Google Identity Services + Gmail API); there is no server
   and nothing secret is stored. Every send is triggered by that person's click; nothing sends on its own.
   Scopes: gmail.send (send) and gmail.metadata (see whether a thread got a reply; never message bodies).
   Needs window.GOOGLE_OAUTH_CLIENT_ID (firebase-config.js) and an "Internal" OAuth app in Google Cloud.
   In demo mode (localhost ?demo=…) sending is simulated. */
(function(){
"use strict";
const SCOPES="https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.metadata";
const API="https://gmail.googleapis.com/gmail/v1/users/me";
let token="",exp=0,loader=null,client=null,pending=null;
try{const t=JSON.parse(sessionStorage.getItem("ap-gmail")||"{}");if(t.exp>Date.now()+60000){token=t.token;exp=t.exp}}catch(e){}

function load(){
  if(window.google&&google.accounts&&google.accounts.oauth2)return Promise.resolve();
  if(!loader)loader=new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.async=true;s.onload=res;s.onerror=()=>rej(new Error("Couldn't load Google sign-in."));document.head.appendChild(s)});
  return loader;
}
const email=()=>((window.APP&&APP.member&&APP.member.email)||"").toLowerCase();
const domain=()=>(window.WORKSPACE_DOMAIN||"aurorapromotions.ca").toLowerCase();

const GMAIL={
  // only company (Google Workspace) addresses can use the internal Gmail connection
  available(){return !!(window.APP&&APP.demo)||(!!window.GOOGLE_OAUTH_CLIENT_ID&&email().endsWith("@"+domain()))},
  connected(){return !!(window.APP&&APP.demo)||(!!token&&exp>Date.now()+60000)},
  address(){return email()},
  // must be called from a click: may open Google's permission window the first time
  async connect(){
    if(APP.demo)return "demo";
    if(GMAIL.connected())return token;
    await load();
    return new Promise((resolve,reject)=>{
      pending={resolve,reject};
      if(!client)client=google.accounts.oauth2.initTokenClient({client_id:window.GOOGLE_OAUTH_CLIENT_ID,scope:SCOPES,hint:email(),
        callback:r=>{const p=pending;pending=null;if(!p)return;
          if(r.error){p.reject(new Error(r.error==="access_denied"?"Gmail permission was not given.":"Couldn't connect to Gmail."));return}
          token=r.access_token;exp=Date.now()+(+r.expires_in||3600)*1000;
          try{sessionStorage.setItem("ap-gmail",JSON.stringify({token,exp}))}catch(e){}
          p.resolve(token)},
        error_callback:e=>{const p=pending;pending=null;if(p)p.reject(new Error(e&&e.type==="popup_closed"?"The Google window was closed.":"Couldn't connect to Gmail. Allow pop-ups for this site."))}});
      client.requestAccessToken({prompt:"",login_hint:email()});
    });
  },
  async call(path,opts){
    const r=await fetch(API+path,Object.assign({},opts,{headers:Object.assign({Authorization:"Bearer "+token,"Content-Type":"application/json"},(opts||{}).headers||{})}));
    if(r.status===401){token="";exp=0;try{sessionStorage.removeItem("ap-gmail")}catch(e){}throw new Error("Gmail connection expired. Click again to reconnect.")}
    if(!r.ok){let m="";try{m=(await r.json()).error.message}catch(e){}throw new Error("Gmail said: "+(m||r.status))}
    return r.json();
  },
  // send a plain-text email; pass threadId + inReplyTo to keep a follow-up in the same conversation
  async send({to,subject,body,threadId,inReplyTo}){
    if(!to||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))throw new Error("The client's email address doesn't look right.");
    if(APP.demo)return {id:"demo-"+Date.now(),threadId:threadId||"demo-thread-"+Date.now(),messageId:"<demo-"+Date.now()+"@demo>"};
    await GMAIL.connect();
    const b64=s=>btoa(unescape(encodeURIComponent(s)));
    const hdr=s=>/^[\x20-\x7e]*$/.test(s)?s:"=?UTF-8?B?"+b64(s)+"?=";
    const head=[`To: ${to}`,`Subject: ${hdr(subject||"")}`,"MIME-Version: 1.0","Content-Type: text/plain; charset=UTF-8","Content-Transfer-Encoding: base64"];
    if(inReplyTo)head.push(`In-Reply-To: ${inReplyTo}`,`References: ${inReplyTo}`);
    // headers are ASCII (non-ASCII subjects are encoded above) and the body is base64, so the whole message is ASCII
    const msg=head.join("\r\n")+"\r\n\r\n"+b64(String(body||"").replace(/\r?\n/g,"\r\n")).replace(/.{76}/g,"$&\r\n");
    const raw=btoa(msg).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
    const sent=await GMAIL.call("/messages/send",{method:"POST",body:JSON.stringify(threadId?{raw,threadId}:{raw})});
    let messageId="";
    try{const m=await GMAIL.call(`/messages/${sent.id}?format=metadata&metadataHeaders=Message-ID`);messageId=((m.payload&&m.payload.headers)||[]).find(h=>/^message-id$/i.test(h.name))?.value||""}catch(e){}
    return {id:sent.id,threadId:sent.threadId,messageId};
  },
  // true when someone other than the sender wrote in this conversation
  async hasReply(threadId){
    if(APP.demo||!threadId)return false;
    const t=await GMAIL.call(`/threads/${threadId}?format=metadata&metadataHeaders=From`);
    return (t.messages||[]).some(m=>!(m.labelIds||[]).includes("SENT")&&!(m.labelIds||[]).includes("DRAFT"));
  },
};
window.GMAIL=GMAIL;
})();
