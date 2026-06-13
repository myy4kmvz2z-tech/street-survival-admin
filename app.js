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

  // まずは全登録を参加者として数える
  // status判定がズレても人数が見えるようにする
  const activePlayers = values;

  const total = activePlayers.length;
  const hunters = activePlayers.filter(p => p.role === "HUNTER").length;
  const runners = activePlayers.filter(p => !p.role || p.role === "RUNNER").length;
  const bosses = activePlayers.filter(p => p.role === "BOSS").length;
  const missions = activePlayers.filter(p => p.mission === true || p.status === "MISSION").length;
  const safes = activePlayers.filter(p => p.area === "SAFE" || p.status === "SAFE").length;

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
/* =====================================================
  STREET SURVIVAL PLAYER ROLE SYNC v33
  Firebaseの自分データを画面に反映 / HUNTER表示修正
===================================================== */

(function(){
  let ssRoleSyncStarted = false;
  let ssRoleSyncPlayerRef = null;
  let ssRoleSyncLatestPlayer = null;

  function ssRoleLog(msg){
    if(typeof addLog === "function"){
      addLog(msg);
    }else{
      console.log(msg);
    }
  }

  function ssRoleGetDb(){
    try{
      if(typeof SS_FINAL_DB !== "undefined" && SS_FINAL_DB){
        return SS_FINAL_DB;
      }
    }catch(e){}

    try{
      if(typeof ssFirebasePlayerDb !== "undefined" && ssFirebasePlayerDb){
        return ssFirebasePlayerDb;
      }
    }catch(e){}

    try{
      if(typeof firebaseDb !== "undefined" && firebaseDb){
        return firebaseDb;
      }
    }catch(e){}

    try{
      if(window.firebase && firebase.apps && firebase.apps.length){
        return firebase.database();
      }
    }catch(e){}

    return null;
  }

  function ssRoleGetPlayerId(){
    return localStorage.getItem("street_survival_player_id");
  }

  function ssRoleSetText(id, text){
    const el = document.getElementById(id);
    if(el) el.textContent = text;
  }

  function ssRoleFormatTime(ms){
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min + ":" + String(sec).padStart(2, "0");
  }

  function ssRoleEnsureHud(){
    let hud = document.getElementById("ssHunterTimerHud");

    if(hud) return hud;

    hud = document.createElement("div");
    hud.id = "ssHunterTimerHud";
    hud.style.position = "fixed";
    hud.style.left = "12px";
    hud.style.right = "12px";
    hud.style.bottom = "14px";
    hud.style.zIndex = "99999";
    hud.style.padding = "14px";
    hud.style.borderRadius = "16px";
    hud.style.background = "rgba(120, 0, 0, 0.94)";
    hud.style.color = "#fff";
    hud.style.fontWeight = "900";
    hud.style.textAlign = "center";
    hud.style.fontSize = "18px";
    hud.style.boxShadow = "0 0 24px rgba(255,0,0,.45)";
    hud.style.border = "2px solid rgba(255,255,255,.35)";
    hud.style.display = "none";

    document.body.appendChild(hud);
    return hud;
  }

  function ssRoleApplyToLocalState(player){
    if(!player) return;

    const role = String(player.role || "RUNNER").toUpperCase();
    const localRole = role === "HUNTER" ? "hunter" : "runner";

    try{
      if(typeof state !== "undefined" && state.me){
        state.me.role = localRole;
        state.me.hunterEndsAt = player.hunterEndsAt || null;

        if(typeof player.hp === "number") state.me.hp = player.hp;
        if(typeof player.points === "number") state.me.points = player.points;
      }
    }catch(e){}

    const badge = document.getElementById("roleBadge");
    if(badge){
      badge.textContent = role;
      badge.className = "badge " + (role === "HUNTER" ? "hunter" : "runner");
    }

    ssRoleSetText("statusTitle", role);

    const statusIcon = document.getElementById("statusIcon");
    if(statusIcon) statusIcon.textContent = role === "HUNTER" ? "🟢" : "🔵";

    const statusSub = document.getElementById("statusSub");
    if(statusSub) statusSub.textContent = role === "HUNTER" ? "🎯 追跡中" : "🏃 生存中";

    if(typeof render === "function"){
      render();
    }
  }

  async function ssRoleReturnRunner(){
    if(!ssRoleSyncPlayerRef) return;

    try{
      await ssRoleSyncPlayerRef.update({
        role: "RUNNER",
        hunterEndsAt: null,
        lastAdminAction: "HUNTER_TIME_UP",
        lastSeen: Date.now()
      });

      ssRoleLog("⏰ HUNTER時間終了 → RUNNERへ戻りました");
    }catch(e){
      console.error(e);
      ssRoleLog("HUNTER自動復帰エラー: " + e.message);
    }
  }

  function ssRoleRenderHunterTimer(){
    const hud = ssRoleEnsureHud();
    const player = ssRoleSyncLatestPlayer || {};
    const role = String(player.role || "RUNNER").toUpperCase();

    if(role !== "HUNTER"){
      hud.style.display = "none";
      ssRoleSetText("hunterTimer", "-");
      return;
    }

    const endsAt = Number(player.hunterEndsAt || 0);

    if(!endsAt){
      hud.style.display = "block";
      hud.textContent = "🟢 HUNTER MODE";
      ssRoleSetText("hunterTimer", "HUNTER");
      return;
    }

    const remain = endsAt - Date.now();

    if(remain <= 0){
      hud.style.display = "block";
      hud.textContent = "🔵 RUNNERへ戻ります...";
      ssRoleSetText("hunterTimer", "0:00");
      ssRoleReturnRunner();
      return;
    }

    const time = ssRoleFormatTime(remain);
    hud.style.display = "block";
    hud.textContent = "🟢 HUNTER 残り " + time;
    ssRoleSetText("hunterTimer", time);
  }

  function ssRoleStart(){
    if(ssRoleSyncStarted) return;

    const db = ssRoleGetDb();

    if(!db){
      setTimeout(ssRoleStart, 1000);
      return;
    }

    const playerId = ssRoleGetPlayerId();

    if(!playerId){
      ssRoleLog("⚠️ PLAYER IDなし。再読み込みしてください");
      setTimeout(ssRoleStart, 1000);
      return;
    }

    ssRoleSyncStarted = true;
    ssRoleSyncPlayerRef = db.ref("streetSurvival/players/" + playerId);

    ssRoleSyncPlayerRef.on("value", snap => {
      const player = snap.val();

      if(!player){
        ssRoleLog("⚠️ 自分のFirebaseデータなし: " + playerId);
        return;
      }

      ssRoleSyncLatestPlayer = player;
      ssRoleApplyToLocalState(player);
      ssRoleRenderHunterTimer();
    });

    setInterval(ssRoleRenderHunterTimer, 1000);

    ssRoleLog("✅ ROLE同期開始 v33: " + playerId);
  }

  window.addEventListener("load", () => {
    setTimeout(ssRoleStart, 2200);
  });
})();
