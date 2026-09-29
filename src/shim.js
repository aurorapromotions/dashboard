/* Local stand-in for the claude.ai Artifact runtime: window.claude.use("db" | "downloads").
   The db mimics the small Firestore-like API the app uses, persisted to localStorage.
   Add ?seed=1 to the URL once to load the example orders; ?reset=1 wipes local data. */
(function(){
"use strict";
const KEY="sn-local-db";
let store;
try{store=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){store={}}
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(store))}catch(e){}};
const listeners=[];
const coll=name=>(store[name]=store[name]||{});
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,10);
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));

function notify(){listeners.forEach(l=>l())}
function snapDoc(c,id){const d=coll(c)[id];return {id,exists:d!==undefined,data:()=>clone(d)}}
function snapColl(c){const docs=Object.keys(coll(c)).map(id=>snapDoc(c,id));return {docs,size:docs.length,empty:!docs.length}}

function docRef(c,id){
  return {
    id,
    async get(){return snapDoc(c,id)},
    async set(data){coll(c)[id]=clone(data);persist();notify()},
    async update(data){if(!coll(c)[id])throw {code:"not_found"};Object.assign(coll(c)[id],clone(data));persist();notify()},
    async delete(){delete coll(c)[id];persist();notify()},
    onSnapshot(cb){const l=()=>cb(snapDoc(c,id));listeners.push(l);setTimeout(l,0);return ()=>listeners.splice(listeners.indexOf(l),1)}
  };
}
function collRef(c){
  return {
    doc(id){return docRef(c,id||newId())},
    async get(){return snapColl(c)},
    async add(data){const id=newId();await docRef(c,id).set(data);return docRef(c,id)},
    onSnapshot(cb){const l=()=>cb(snapColl(c));listeners.push(l);setTimeout(l,0);return ()=>listeners.splice(listeners.indexOf(l),1)}
  };
}
const db={collection:collRef,doc(path){const [c,id]=path.split("/");return docRef(c,id)}};

const downloads={async save({filename,data}){
  const url=URL.createObjectURL(new Blob([data],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}};

window.claude={async use(cap){if(cap==="db")return db;if(cap==="downloads")return downloads;throw {code:"not_granted"}}};

const qs=new URLSearchParams(location.search);
if(qs.has("reset")){store={};persist()}
if(qs.has("seed")){
  const el=document.getElementById("example-orders");
  const rows=el?JSON.parse(el.textContent):[];
  const o=coll("orders");rows.forEach(r=>{o[newId()]=r});persist();
}
if(qs.has("seed")||qs.has("reset"))history.replaceState(null,"",location.pathname);
})();
