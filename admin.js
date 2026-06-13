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

function setText(id, text){
  const el = $(id);
  if(el) el.textContent = text;
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

function adminV39Status(text){
  const el = $("adminV39Status");
  if(el) el.textContent = text;
  console.log("ADMIN CONTROL:", text);
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
  if(!firebaseDb){
    log("参加者監視失敗: firebaseDbなし");
    return;
  }

  firebaseDb.ref("streetSurvival/players").on("value", snap => {
    const players = snap.val() || {};
    updatePlayerStats(players);
  });

  log("参加者監視開始 v45");
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
    type: type,
    message: message || "",
    at: new Date().toISOString(),
    from: "admin-v45"
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

async function adminHealAll(){
  try{
    if(!firebaseDb){
      adminV39Status("Firebase未接続");
      return;
    }

    const snap = await firebaseDb.ref("streetSurvival/players").get();
    const players = snap.val() || {};
    const updates = {};

    Object.entries(players).forEach(([key, p]) => {
      if(!p) return;
      updates[key + "/hp"] = 300;
      updates[key + "/lastAdminAction"] = "HEAL_ALL";
      updates[key + "/lastSeen"] = Date.now();
    });

    await firebaseDb.ref("streetSurvival/players").update(updates);
    await sendCommand("ADMIN_HEAL_ALL", "❤️ 全員HP回復");

    adminV39Status("全員HP回復OK");
    log("全員HP回復OK");
  }catch(e){
    console.error(e);
    adminV39Status("HP回復エラー: " + e.message);
    log("HP回復エラー: " + e.message);
  }
}

async function adminAllRunner(){
  try{
    if(!firebaseDb){
      adminV39Status("Firebase未接続");
      return;
    }

    const snap = await firebaseDb.ref("streetSurvival/players").get();
    const players = snap.val() || {};
    const updates = {};
    const now = Date.now();

    Object.entries(players).forEach(([key, p]) => {
      if(!p) return;
      updates[key + "/role"] = "RUNNER";
      updates[key + "/hunterEndsAt"] = null;
      updates[key + "/invincibleUntil"] = now + 5000;
      updates[key + "/lastAdminAction"] = "ALL_RUNNER";
      updates[key + "/lastSeen"] = now;
    });

    await firebaseDb.ref("streetSurvival/players").update(updates);
    await sendCommand("ADMIN_ALL_RUNNER", "🔵 全員RUNNERに戻しました");

    adminV39Status("全員RUNNER OK");
    log("全員RUNNER OK");
  }catch(e){
    console.error(e);
    adminV39Status("全員RUNNERエラー: " + e.message);
    log("全員RUNNERエラー: " + e.message);
  }
}

async function adminRandomHunters(){
  try{
    log("🎲 ランダムHUNTERボタン押しました");

    if(!firebaseDb){
      adminV39Status("Firebase未接続");
      log("ランダムHUNTER失敗: Firebase未接続");
      return;
    }

    const snap = await firebaseDb.ref("streetSurvival/players").get();
    const players = snap.val() || {};

    const entries = Object.entries(players).filter(([key, p]) => p);

    if(entries.length === 0){
      adminV39Status("参加者がいません");
      log("ランダムHUNTER失敗: 参加者0人");
      return;
    }

    const shuffled = entries.sort(() => Math.random() - 0.5);
    const hunterCount = Math.min(3, shuffled.length);
    const hunterKeys = new Set(shuffled.slice(0, hunterCount).map(([key]) => key));

    const updates = {};
    const now = Date.now();

    entries.forEach(([key, p]) => {
      const isHunter = hunterKeys.has(key);

      updates[key + "/role"] = isHunter ? "HUNTER" : "RUNNER";
      updates[key + "/hunterEndsAt"] = isHunter ? now + 10 * 60 * 1000 : null;
      updates[key + "/lastAdminAction"] = "RANDOM_HUNTERS";
      updates[key + "/lastSeen"] = now;
    });

    await firebaseDb.ref("streetSurvival/players").update(updates);

    await sendCommand(
      "RADIO",
      "🎲 ランダムHUNTER発生！" + hunterCount + "人がHUNTERになりました！"
    );

    adminV39Status("ランダムHUNTER OK: " + hunterCount + "人");
    log("ランダムHUNTER OK: " + hunterCount + "人");
  }catch(e){
    console.error(e);
    adminV39Status("ランダムHUNTERエラー: " + e.message);
    log("ランダムHUNTERエラー: " + e.message);
  }
}

async function adminResetAll(){
  try{
    if(!firebaseDb){
      adminV39Status("Firebase未接続");
      return;
    }

    const snap = await firebaseDb.ref("streetSurvival/players").get();
    const players = snap.val() || {};
    const updates = {};
    const now = Date.now();

    Object.entries(players).forEach(([key, p]) => {
      if(!p) return;
      updates[key + "/hp"] = 100;
      updates[key + "/points"] = 0;
      updates[key + "/role"] = "RUNNER";
      updates[key + "/hunterEndsAt"] = null;
      updates[key + "/invincibleUntil"] = now + 5000;
      updates[key + "/lastAdminAction"] = "RESET_ALL";
      updates[key + "/lastSeen"] = now;
    });

    await firebaseDb.ref("streetSurvival/players").update(updates);
    await sendCommand("ADMIN_RESET_ALL", "🔄 全員リセット");

    adminV39Status("全員リセットOK");
    log("全員リセットOK");
  }catch(e){
    console.error(e);
    adminV39Status("全員リセットエラー: " + e.message);
    log("全員リセットエラー: " + e.message);
  }
}

async function adminCleanupPlayers(){
  try{
    if(!firebaseDb){
      adminV39Status("Firebase未接続");
      return;
    }

    const snap = await firebaseDb.ref("streetSurvival/players").get();
    const players = snap.val() || {};
    const updates = {};
    const now = Date.now();
    let count = 0;

    Object.entries(players).forEach(([key, p]) => {
      if(!p) return;

      const lastSeen = Number(p.lastSeen || 0);

      if(!lastSeen || now - lastSeen > 1000 * 60 * 3){
        updates[key] = null;
        count++;
      }
    });

    await firebaseDb.ref("streetSurvival/players").update(updates);
    await sendCommand("ADMIN_CLEANUP_PLAYERS", "🧹 古い参加者削除: " + count + "件");

    adminV39Status("古い参加者削除OK: " + count + "件");
    log("古い参加者削除OK: " + count + "件");
  }catch(e){
    console.error(e);
    adminV39Status("削除エラー: " + e.message);
    log("削除エラー: " + e.message);
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

  const healBtn = $("adminHealAllBtn");
  const runnerBtn = $("adminAllRunnerBtn");
  const randomHuntersBtn = $("adminRandomHuntersBtn");
  const resetBtn = $("adminResetAllBtn");
  const cleanupBtn = $("adminCleanupPlayersBtn");

  if(healBtn) healBtn.addEventListener("click", adminHealAll);
  if(runnerBtn) runnerBtn.addEventListener("click", adminAllRunner);

  if(randomHuntersBtn){
    randomHuntersBtn.addEventListener("click", adminRandomHunters);
    log("🎲 ランダムHUNTERボタン接続OK");
  }else{
    log("⚠️ adminRandomHuntersBtn が見つかりません");
  }

  if(resetBtn) resetBtn.addEventListener("click", adminResetAll);
  if(cleanupBtn) cleanupBtn.addEventListener("click", adminCleanupPlayers);

  adminV39Status("v46 起動OK");
log("ADMIN画面 起動完了 v46");
});
