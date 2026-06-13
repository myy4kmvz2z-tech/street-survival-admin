let firebaseDb = null;

const $ = id => document.getElementById(id);

function log(msg){
  const el = $("log");
  if(!el) return;
  const t = new Date().toLocaleTimeString();
  el.textContent = `[${t}] ${msg}\n` + el.textContent;
}

function setText(id, text){
  const el = $(id);
  if(el) el.textContent = text;
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

function setFirebaseStatus(text){
  setText("firebaseStatus", text);
  setText("connectionStatus", text.replace("🔥 Firebase: ", ""));
}

function createCommand(type, message){
  return {
    id: "cmd_" + Date.now() + "_" + Math.random().toString(36).slice(2),
    type: type,
    message: message,
    createdAt: Date.now()
  };
}

function sendCommand(type, message){
  const cmd = createCommand(type, message);

  console.log("ADMIN SEND:", cmd);

  if(window.STREET_SURVIVAL_FIREBASE_ENABLED && firebaseDb){
    firebaseDb.ref("streetSurvival/currentCommand").set(cmd)
      .then(() => {
        log("送信成功: " + type + " / " + message);
        setText("lastCommand", type);
      })
      .catch(err => {
        log("送信失敗: " + err.message);
      });
  }else{
    localStorage.setItem("street_survival_admin_command", JSON.stringify(cmd));
    log("ローカル送信: " + type + " / " + message);
    setText("lastCommand", type);
  }
}

async function initFirebaseAdmin(){
  try{
    if(!window.STREET_SURVIVAL_FIREBASE_ENABLED){
      setFirebaseStatus("🔥 Firebase: OFF / DEMO");
      log("Firebase OFF。ローカル送信モード。");
      return;
    }

    if(!window.STREET_SURVIVAL_FIREBASE_CONFIG){
      setFirebaseStatus("🔥 Firebase: 設定なし");
      log("firebase-config-live.js の設定が見つかりません。");
      return;
    }

    setFirebaseStatus("🔥 Firebase: 接続準備中");

    await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js");

    if(!firebase.apps.length){
      firebase.initializeApp(window.STREET_SURVIVAL_FIREBASE_CONFIG);
    }

    firebaseDb = firebase.database();

    watchPlayers();

    setFirebaseStatus("🔥 Firebase: 接続OK");
    log("ADMIN Firebase 接続OK");
  }catch(e){
    console.error(e);
    setFirebaseStatus("🔥 Firebase: エラー");
    log("Firebaseエラー: " + e.message);
  }
}

function bindButton(id, type, message){
  const btn = $(id);
  if(!btn) return;

  btn.addEventListener("click", () => {
    sendCommand(type, message);
  });
}

function updatePlayerStats(players){
  const list = players || {};
  const values = Object.values(list);

  const onlinePlayers = values.filter(p => p.status === "ONLINE");

  const total = onlinePlayers.length;
  const hunters = onlinePlayers.filter(p => p.role === "HUNTER").length;
  const runners = onlinePlayers.filter(p => p.role === "RUNNER").length;
  const bosses = onlinePlayers.filter(p => p.role === "BOSS").length;
  const missions = onlinePlayers.filter(p => p.mission === true || p.status === "MISSION").length;
  const safes = onlinePlayers.filter(p => p.area === "SAFE" || p.status === "SAFE").length;

  setText("playerCount", String(total));
  setText("hunterCount", String(hunters));
  setText("runnerCount", String(runners));
  setText("bossCount", String(bosses));
  setText("missionCount", String(missions));
  setText("safeCount", String(safes));

  log("参加者更新: " + total + "人");
}

function watchPlayers(){
  if(!firebaseDb) return;

  firebaseDb.ref("streetSurvival/players").on("value", snap => {
    const players = snap.val() || {};
    updatePlayerStats(players);
  });

  log("参加者監視開始");
}
function initAdminButtons(){
  bindButton("radioBtn", "RADIO", "📻 運営テスト：参加者画面への通知成功！");
  bindButton("alertBtn", "ALERT", "⚠️ 緊急速報！周囲に注意してください。");
  bindButton("bossBtn", "BOSS", "👹 BOSS出現！新町エリアに注意！");
  bindButton("missionBtn", "MISSION", "🎯 MISSION発生！本町エリアへ集合！");
  bindButton("safeBtn", "SAFE", "🛡 SAFE ZONE発動！安全地帯に入っています。");
  bindButton("liveBtn", "LIVE", "🎵 LIVE SAFE開始！Onn前は安全地帯です！");
  bindButton("finalBtn", "FINAL", "🔥 FINAL BATTLE開始！ポイント2倍！");
  bindButton("endBtn", "END", "🏆 GAME END！おつかれさまでした！");
  bindButton("normalBtn", "NORMAL", "🌆 通常モードに戻りました。");

  const customBtn = $("customRadioBtn");
  if(customBtn){
    customBtn.addEventListener("click", () => {
      const input = $("customRadioText");
      const message = input && input.value ? input.value : "📻 運営からのお知らせ";
      sendCommand("RADIO", message);
    });
  }

  log("ADMINボタン設定OK");
}

document.addEventListener("DOMContentLoaded", () => {
  initAdminButtons();
  initFirebaseAdmin();
  log("ADMIN画面 起動完了");
});
