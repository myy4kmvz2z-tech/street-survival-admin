let firebaseDb = null;
let lastCommandId = null;
let cityMode = "NORMAL";
let hp = 100;
let points = 0;
let mapMode = 0;

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

function showEffect(type, icon, text){
  const overlay = $("effectOverlay");
  const effectIcon = $("effectIcon");
  const effectText = $("effectText");
  const toast = $("fxToast");

  if(effectIcon) effectIcon.textContent = icon || "⚡";
  if(effectText) effectText.textContent = text || "EFFECT";

  if(overlay){
    overlay.classList.remove("hidden");
    setTimeout(() => overlay.classList.add("hidden"), 1200);
  }

  if(toast){
    toast.textContent = `${icon || "⚡"} ${text || "EFFECT"}`;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 1600);
  }
}

window.showEffect = showEffect;

function showRadio(message){
  const popup = $("radioPopup");
  const text = $("radioPopupText");
  const ticker = $("radioTicker");

  if(text) text.textContent = message || "運営速報";
  if(ticker) ticker.textContent = "📻 " + (message || "運営速報");

  if(popup){
    popup.classList.remove("hidden");
    setTimeout(() => popup.classList.add("hidden"), 5000);
  }

  log("RADIO: " + (message || ""));
}

function showFullEvent(type, message){
  const full = $("fullScreenEvent");
  const icon = $("fullEventIcon");
  const title = $("fullEventTitle");
  const sub = $("fullEventSub");

  const iconMap = {
    NORMAL: "🌆",
    ALERT: "⚠️",
    BOSS: "👹",
    MISSION: "🎯",
    LIVE: "🎵",
    SAFE: "🛡",
    FINAL: "🔥",
    END: "🏆",
    RADIO: "📻"
  };

  if(icon) icon.textContent = iconMap[type] || "📡";
  if(title) title.textContent = type || "EVENT";
  if(sub) sub.textContent = message || "";

  if(full){
    full.classList.remove("hidden");
    setTimeout(() => full.classList.add("hidden"), 3500);
  }
}

function setFirebaseStatus(text){
  setText("firebaseStatus", text);
  setText("connectionStatus", text.replace("🔥 Firebase: ", ""));
}

function applyMode(type, message){
  cityMode = type || "NORMAL";
  setText("cityModeMini", cityMode);

  const bossVisible = type === "BOSS" || type === "FINAL";
  const missionVisible = type === "MISSION" || type === "FINAL";
  const safeVisible = type === "SAFE" || type === "LIVE";

  ["radarBoss", "gameBoss"].forEach(id => {
    const el = $(id);
    if(el) el.classList.toggle("hidden", !bossVisible);
  });

  ["radarMission", "gameMission"].forEach(id => {
    const el = $(id);
    if(el) el.classList.toggle("hidden", !missionVisible);
  });

  const warning = $("radarWarning");
  if(warning){
    warning.classList.toggle("hidden", !(type === "ALERT" || type === "BOSS" || type === "FINAL"));
  }

  const safePulse = $("safePulse");
  if(safePulse){
    safePulse.classList.toggle("hidden", !safeVisible);
  }

  if(type === "NORMAL"){
    setText("bossCount", "0");
    setText("missionCount", "0");
    showEffect("normal", "🌆", "NORMAL");
  }

  if(type === "ALERT"){
    showEffect("alert", "⚠️", "ALERT");
  }

  if(type === "BOSS"){
    setText("bossCount", "1");
    showEffect("boss", "👹", "BOSS出現");
  }

  if(type === "MISSION"){
    setText("missionCount", "1");
    showEffect("mission", "🎯", "MISSION開始");
  }

  if(type === "SAFE"){
    showEffect("safe", "🛡", "SAFE ZONE");
  }

  if(type === "LIVE"){
    showEffect("live", "🎵", "LIVE START");
  }

  if(type === "FINAL"){
    setText("bossCount", "1");
    setText("missionCount", "1");
    showEffect("final", "🔥", "FINAL BATTLE");
  }

  if(type === "END"){
    showEffect("end", "🏆", "GAME END");
  }

  showFullEvent(type, message);
  showRadio(message || type);
}

function handleCommand(cmd){
  if(!cmd || !cmd.id) return;
  if(cmd.id === lastCommandId) return;

  lastCommandId = cmd.id;

  const type = cmd.type || "RADIO";
  const message = cmd.message || "";

  console.log("PLAYER COMMAND:", cmd);
  log("受信: " + type + (message ? " / " + message : ""));

  if(type === "RADIO"){
    showRadio(message);
    return;
  }

  applyMode(type, message);
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

async function initFirebasePlayer(){
  try{
    if(!window.STREET_SURVIVAL_FIREBASE_ENABLED){
      setFirebaseStatus("🔥 Firebase: OFF / DEMO");
      log("Firebase OFF。ローカル受信モード。");

      window.addEventListener("storage", e => {
        if(e.key === "street_survival_admin_command" && e.newValue){
          handleCommand(JSON.parse(e.newValue));
        }
      });

      const localCmd = localStorage.getItem("street_survival_admin_command");
      if(localCmd){
        handleCommand(JSON.parse(localCmd));
      }

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

    firebaseDb.ref("streetSurvival/currentCommand").on("value", snap => {
      const cmd = snap.val();
      handleCommand(cmd);
    });

    setFirebaseStatus("🔥 Firebase: 接続OK");
    log("PLAYER Firebase 接続OK");
  }catch(e){
    console.error(e);
    setFirebaseStatus("🔥 Firebase: エラー");
    log("Firebaseエラー: " + e.message);
    showRadio("通信エラー: " + e.message);
  }
}

function initButtons(){
  const resetBtn = $("resetBtn");
  if(resetBtn){
    resetBtn.addEventListener("click", () => {
      hp = 100;
      points = 0;
      cityMode = "NORMAL";

      setText("hpText", "100/300");
      setText("points", "0");
      setText("cityModeMini", "NORMAL");
      setText("bossCount", "0");
      setText("missionCount", "0");

      const hpBar = $("hpBar");
      if(hpBar) hpBar.style.width = "33%";

      showEffect("reset", "♻️", "RESET");
      log("RESET");
    });
  }

  const roleBtn = $("roleBtn");
  if(roleBtn){
    roleBtn.addEventListener("click", () => {
      points += cityMode === "FINAL" ? 20 : 10;
      hp = Math.min(300, hp + 2);

      setText("points", String(points));
      setText("hpText", `${hp}/300`);

      const hpBar = $("hpBar");
      if(hpBar) hpBar.style.width = Math.min(100, hp / 3) + "%";

      const charge = $("chargeFloat");
      if(charge){
        charge.classList.remove("hidden");
        setTimeout(() => charge.classList.add("hidden"), 800);
      }

      showEffect("action", "⚡", "+POINT");
      log("ACTION: +" + (cityMode === "FINAL" ? 20 : 10));
    });
  }

  const menuBtn = $("menuBtn");
  if(menuBtn){
    menuBtn.addEventListener("click", () => {
      const menu = $("menuPanel");
      if(menu) menu.open = !menu.open;
    });
  }

  const gpsBtn = $("gpsBtn");
  if(gpsBtn){
    gpsBtn.addEventListener("click", () => {
      if(!navigator.geolocation){
        setText("gpsStatus", "GPS非対応です。");
        return;
      }

      setText("gpsStatus", "GPS取得中...");

      navigator.geolocation.getCurrentPosition(
        pos => {
          setText("gpsStatus", `GPS取得OK: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
          showEffect("gps", "📍", "GPS OK");
        },
        err => {
          setText("gpsStatus", "GPS取得失敗: " + err.message);
          showEffect("gps", "⚠️", "GPS ERROR");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  const mapModeBtn = $("mapModeBtn");
  if(mapModeBtn){
    mapModeBtn.addEventListener("click", () => {
      mapMode = (mapMode + 1) % 3;

      const radar = $("radar");
      const gameMap = $("gameMap");
      const realMap = $("realMap");

      if(radar) radar.classList.toggle("hidden", mapMode !== 0);
      if(gameMap) gameMap.classList.toggle("hidden", mapMode !== 1);
      if(realMap) realMap.classList.toggle("hidden", mapMode !== 2);

      setText("radarHint", mapMode === 0 ? "RADAR MODE" : mapMode === 1 ? "GAME MAP" : "REAL MAP");
    });
  }

  const notifyBtn = $("notifyBtn");
  if(notifyBtn){
    notifyBtn.addEventListener("click", async () => {
      if(!("Notification" in window)){
        setText("notifyStatus", "通知: 非対応");
        return;
      }

      const result = await Notification.requestPermission();
      setText("notifyStatus", "通知: " + result);
    });
  }

  document.querySelectorAll("[data-move]").forEach(btn => {
    btn.addEventListener("click", () => {
      showEffect("move", "🛰", "MOVE " + btn.dataset.move.toUpperCase());
      log("MOVE: " + btn.dataset.move);
    });
  });

  const vibeBtn = $("vibeBtn");
  if(vibeBtn){
    vibeBtn.addEventListener("click", () => showEffect("vibe", "🔊", "演出テスト"));
  }

  const soundButtons = [
    ["safeSoundBtn", "🛡", "SAFE音"],
    ["bossSoundBtn", "👹", "BOSS音"],
    ["missionSoundBtn", "🎯", "MISSION音"],
    ["liveSoundBtn", "🎵", "LIVE音"],
    ["finalSoundBtn", "🔥", "FINAL音"],
    ["endSoundBtn", "🏆", "END音"]
  ];

  soundButtons.forEach(([id, icon, text]) => {
    const btn = $(id);
    if(btn) btn.addEventListener("click", () => showEffect("sound", icon, text));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initButtons();
  initFirebasePlayer();
  log("PLAYER画面 起動完了");
});
