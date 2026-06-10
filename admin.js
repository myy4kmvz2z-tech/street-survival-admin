let firebaseDb = null;
const $ = id => document.getElementById(id);

function log(msg){
  const t = new Date().toLocaleTimeString();
  const el = $("log");
  if(el) el.textContent = `[${t}] ${msg}\n` + el.textContent;
}

function setStatus(text, cls){
  const el = $("firebaseStatus");
  if(!el) return;
  el.textContent = text;
  el.className = "status " + cls;
}

function loadScript(src){
  return new Promise((resolve,reject)=>{
    if(document.querySelector(`script[src="${src}"]`)) return resolve();
    const s=document.createElement("script");
    s.src=src;
    s.onload=resolve;
    s.onerror=reject;
    document.head.appendChild(s);
  });
}

async function initFirebaseAdmin(){
  try{
    if(!window.STREET_SURVIVAL_FIREBASE_ENABLED){
      setStatus("🔥 Firebase: OFF / デモ","status-wait");
      log("Firebase OFF");
      return;
    }
    setStatus("🔥 Firebase: 接続準備中","status-wait");
    await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js");

    if(!firebase.apps.length){
      firebase.initializeApp(window.STREET_SURVIVAL_FIREBASE_CONFIG);
    }
    firebaseDb = firebase.database();
    setStatus("🔥 Firebase: 接続中","status-ok");
    log("Firebase ADMIN 接続中");
  }catch(e){
    console.error(e);
    setStatus("🔥 Firebase: エラー","status-error");
    log("Firebase接続エラー: " + e.message);
  }
}

function sendCommand(type, message){
  const cmd = {
    id: Date.now() + "_" + Math.random().toString(16).slice(2),
    type,
    message: message || "",
    at: new Date().toISOString()
  };

  localStorage.setItem("street_survival_admin_command", JSON.stringify(cmd));

  if(firebaseDb){
    firebaseDb.ref("streetSurvival/currentCommand").set(cmd);
    firebaseDb.ref("streetSurvival/commandLog").push(cmd);
    log("Firebase送信: " + type + (message ? " / " + message : ""));
  }else{
    log("ローカル送信のみ: " + type);
  }
}

document.addEventListener("DOMContentLoaded", ()=>{
  initFirebaseAdmin();

  document.querySelectorAll("[data-type]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const type = btn.dataset.type;
      const message = btn.dataset.radio || type;
      sendCommand(type, message);
    });
  });

  $("radioSend").addEventListener("click", ()=>{
    sendCommand("RADIO", $("radioInput").value || "運営速報");
  });

  document.querySelectorAll("[data-radio]:not([data-type])").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      $("radioInput").value = btn.dataset.radio;
      sendCommand("RADIO", btn.dataset.radio);
    });
  });
});
