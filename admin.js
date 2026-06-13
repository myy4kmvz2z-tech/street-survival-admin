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

function showToast(msg){
  const el = $("toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => {
    el.classList.add("hidden");
  }, 1500);
}

function showFlash(msg){
  const el = $("flash");
  if(!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => {
    el.classList.add("hidden");
  }, 800);
}

function setText(id, text){
  const el = $(id);
  if(el) el.textContent = text;
}

function normalizeRole(role){
  return String(role || "RUNNER").toUpperCase();
}

function updatePlayerStats(players){
  const list = players || {};
  const values = Object.values(list);

  const total = values.length;
  const hunters = values.filter(p => normalizeRole(p.role) === "HUNTER").length;
  const runners = values.filter(p => normalizeRole(p.role) === "RUNNER").length;
  const bosses = values.filter(p => normalizeRole(p.role) === "BOSS").length;
  const missions = values.filter(p => p.mission === true || String(p.status || "").toUpperCase() === "MISSION").length;
  const safes = values.filter(p => String(p.area || "").toUpperCase() === "SAFE" || String(p.status || "").toUpperCase() === "SAFE").length;

  setText("playerCount", String(total));
  setText("hunterCount", String(hunters));
  setText("runnerCount", String(runners));
  setText("bossCount", String(bosses));
  setText("missionCount", String(missions));
  setText("safeCount", String(safes));

  log("参加者更新: " + total + "人 / RUNNER " + runners + " / HUNTER " + hunters);
}

function watchPlayers(){
  if(!firebaseDb) return;

  firebaseDb.ref("streetSurvival/players").on("value", snap => {
    const players = snap.val() || {};
    updatePlayerStats(players);
  });

  log("参加者監視開始");
}

function loadScript(src){
  return new Promise((resolve, reject) => {
    if(document.querySelector(`script[src="${src}"]`)) return resolve();

    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("読み込み失敗: " + src));
    document.head.appendChild(s);
  });
}

async function initFirebaseAdmin(){
  try{
    if(!window.STREET_SURVIVAL_FIREBASE_ENABLED){
      setStatus("🔥 Firebase: OFF / デモ", "status-wait");
      log("Firebase OFF。現在はローカル送信のみです。");
      return;
    }

    if(!window.STREET_SURVIVAL_FIREBASE_CONFIG){
      setStatus("🔥 Firebase: 設定なし", "status-error");
      log("firebase-config.js が読み込めていません。");
      return;
    }

    setStatus("🔥 Firebase: 接続準備中", "status-wait");

    await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js");

    if(!firebase.apps.length){
      firebase.initializeApp(window.STREET_SURVIVAL_FIREBASE_CONFIG);
    }

    firebaseDb = firebase.database();

watchPlayers();

setStatus("🔥 Firebase: 接続OK", "status-ok");
log("Firebase ADMIN 接続OK");
  }catch(e){
    console.error(e);
    firebaseDb = null;
    setStatus("🔥 Firebase: エラー", "status-error");
    log("Firebase接続エラー: " + e.message);
  }
}

async function sendCommand(type, message){
  const cmd = {
    id: Date.now() + "_" + Math.random().toString(16).slice(2),
    type,
    message: message || "",
    at: new Date().toISOString()
  };

  localStorage.setItem("street_survival_admin_command", JSON.stringify(cmd));

  try{
    if(firebaseDb){
      await firebaseDb.ref("streetSurvival/currentCommand").set(cmd);
      await firebaseDb.ref("streetSurvival/commandLog").push(cmd);

      log("Firebase送信OK: " + type + (message ? " / " + message : ""));
      showToast("送信成功: " + type);
      showFlash(message || type);
    }else{
      log("ローカル送信のみ: " + type + (message ? " / " + message : ""));
      showToast("デモ送信: " + type);
      showFlash(message || type);
    }
  }catch(e){
    console.error(e);
    log("送信エラー: " + e.message);
    showToast("送信エラー");
    setStatus("🔥 Firebase: 送信エラー", "status-error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initFirebaseAdmin();

  document.querySelectorAll("[data-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      const message = btn.dataset.radio || type;
      sendCommand(type, message);
    });
  });

  const radioSend = $("radioSend");
  if(radioSend){
    radioSend.addEventListener("click", () => {
      const input = $("radioInput");
      sendCommand("RADIO", input?.value || "運営速報");
    });
  }

  document.querySelectorAll("[data-radio]:not([data-type])").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = $("radioInput");
      if(input) input.value = btn.dataset.radio;
      sendCommand("RADIO", btn.dataset.radio);
    });
  });

  log("ADMIN画面 起動完了");
});
