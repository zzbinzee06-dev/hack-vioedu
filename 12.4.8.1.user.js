// ==UserScript==
// @name        Toolkit VioEdu Violympic by Từ Hưng 8A2 pro vip (v12.4.8 Full + Cập nhật từ xa + Quét đề OCR ảnh + Chụp không trắng + Kết nối ổn định)
// @namespace   local.gemini.vio.redesigned.ultra
// @version     12.4.8
// @description big update
// @match       https://vio.edu.vn/*
// @match       https://www.vio.edu.vn/*
// @match       https://violympic.vn/*
// @match       https://www.violympic.vn/*
// @require     https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
// @grant       GM_xmlhttpRequest
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_info
// @grant       GM_openInTab
// Khi đã host file script (GitHub raw / Greasy Fork), bỏ 1 dấu // ở 2 dòng dưới để Tampermonkey tự cập nhật:
// // @updateURL    https://DOMAIN/ten-file.user.js
// // @downloadURL  https://DOMAIN/ten-file.user.js
// @connect     generativelanguage.googleapis.com
// @connect     firebasedatabase.app
// @connect     *
// @run-at      document-idle
// ==/UserScript==

(function () {
    "use strict";

    if (window.top !== window.self) return;
    if (document.getElementById("gvh-button")) return;

    const FIREBASE_URL = "https://cheat-enginer-default-rtdb.asia-southeast1.firebasedatabase.app";
    // Master key admin: chỉ lưu mã băm SHA-256, không để mật khẩu dạng chữ trong script
    const MASTER_HASH = "112da6872bacd59423b535f3a1e55c7530330cfdcdb16745ed6a7a5b12c95cf4";

    // ===== PHIÊN BẢN & CẬP NHẬT TỪ XA =====
    const FALLBACK_VERSION = "12.4.8";
    const CURRENT_VERSION = (typeof GM_info !== "undefined" && GM_info.script && GM_info.script.version) || FALLBACK_VERSION;
    // Link tải bản mới (đặt cố định trong script, KHÔNG lấy từ Firebase để tránh bị kẻ xấu đổi link).
    // Điền link file .user.js đã host, ví dụ: "https://raw.githubusercontent.com/ten/repo/main/vio-toolkit.user.js"
    const UPDATE_URL = "";
    const VER_RE = /^\d+(\.\d+){0,3}$/;
    function parseVer(v) { return String(v || "0").replace(/^v/i, "").split(".").map(n => parseInt(n, 10) || 0); }
    function cmpVer(a, b) {
        const x = parseVer(a), y = parseVer(b);
        for (let i = 0; i < Math.max(x.length, y.length); i++) {
            const d = (x[i] || 0) - (y[i] || 0);
            if (d) return d < 0 ? -1 : 1;
        }
        return 0;
    }

    // Lưu trữ bền vững: GM_* dùng chung cho cả 4 tên miền (vio.edu.vn, violympic.vn...), dự phòng localStorage
    const store = {
        get(k, d) {
            try {
                if (typeof GM_getValue === "function") { const v = GM_getValue(k); return v === undefined ? d : v; }
                const v = localStorage.getItem(k); return v === null ? d : v;
            } catch (e) { return d; }
        },
        set(k, v) {
            try { if (typeof GM_setValue === "function") GM_setValue(k, v); else localStorage.setItem(k, v); } catch (e) {}
        },
        del(k) {
            try { if (typeof GM_deleteValue === "function") GM_deleteValue(k); else localStorage.removeItem(k); } catch (e) {}
        }
    };

    // JSON.parse an toàn: dữ liệu localStorage hỏng sẽ không làm sập cả script
    function safeJSON(key) {
        try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
    }

    function readSession() {
        try {
            const x = JSON.parse(store.get("gvh_session", "null"));
            if (x && (x.type === "admin" || (x.type === "key" && x.key))) return x;
        } catch (e) {}
        return null;
    }
    const SESSION = readSession();
    let UNLOCKED = !!SESSION;

    let API_KEY = store.get("gvh_api_key", "");
    let MODEL = store.get("gvh_model", "gemini-3.5-flash-lite");

    // Cấu hình giao diện
    let savedAppearance = safeJSON("gvh_appearance_settings") || {
        theme: "blue",
        customColor: "#2563eb",
        effect: "none",
        fontSize: "13.5",
        opacity: "0.85",
        radius: "28",
        scale: "1"
    };

    let CURRENT_THEME = savedAppearance.theme;
    let CUSTOM_COLOR = savedAppearance.customColor;
    let CURRENT_EFFECT = savedAppearance.effect;
    let FONT_SIZE = savedAppearance.fontSize;
    let BG_OPACITY = savedAppearance.opacity;
    let BORDER_RADIUS = savedAppearance.radius;
    let PANEL_SCALE = savedAppearance.scale || "1";

    let savedShortcut = safeJSON("gvh_shortcut_obj") || { code: "Space", display: "Ctrl + Space" };
    let TOGGLE_SHORTCUT = savedShortcut;

    const PINNED_LINK = "https://raw.githubusercontent.com/zzbinzee06-dev/hack-violypic/main/12.4.8.1.user.js";
    const PINNED_NOTE = { text: "📌 Link script:\n" + PINNED_LINK, time: "Đã ghim", pinned: true };
    let defaultNotes = [PINNED_NOTE];
    let savedNotes = safeJSON("gvh_notes");
    let NOTES = (savedNotes && savedNotes.length > 0) ? savedNotes : defaultNotes;
    // Xóa ghi chú API mặc định cũ (nếu còn lưu từ bản trước)
    NOTES = NOTES.filter(n => !(n && n.time === "Hệ thống" && String(n.text).startsWith("⚡ CÁCH LẤY GEMINI API RIÊNG")));
    // Luôn có ghi chú ghim và luôn nằm trên cùng
    if (!NOTES.some(n => n && n.pinned)) NOTES.unshift(PINNED_NOTE);
    NOTES = [...NOTES.filter(n => n && n.pinned), ...NOTES.filter(n => n && !n.pinned)];
    localStorage.setItem("gvh_notes", JSON.stringify(NOTES));

    const THEMES = {
        blue: { primary: "#2563eb", light: "#60a5fa", grad1: "#3b82f6", grad2: "#1d4ed8", glow: "rgba(59, 130, 246, 0.35)", bgCard: "rgba(30, 41, 59, 0.6)" },
        red: { primary: "#dc2626", light: "#f87171", grad1: "#ef4444", grad2: "#b91c1c", glow: "rgba(239, 68, 68, 0.35)", bgCard: "rgba(45, 30, 30, 0.6)" },
        green: { primary: "#059669", light: "#34d399", grad1: "#10b981", grad2: "#047857", glow: "rgba(16, 185, 129, 0.35)", bgCard: "rgba(30, 45, 35, 0.6)" },
        purple: { primary: "#7c3aed", light: "#a78bfa", grad1: "#8b5cf6", grad2: "#5b21b6", glow: "rgba(139, 92, 246, 0.35)", bgCard: "rgba(38, 30, 48, 0.6)" }
    };

    function getThemeColors() {
        if (CURRENT_THEME === "custom" && CUSTOM_COLOR) {
            return {
                primary: CUSTOM_COLOR,
                light: CUSTOM_COLOR,
                grad1: CUSTOM_COLOR,
                grad2: CUSTOM_COLOR,
                glow: CUSTOM_COLOR + "66",
                bgCard: "rgba(30, 41, 59, 0.6)"
            };
        }
        return THEMES[CURRENT_THEME] || THEMES.blue;
    }

    const style = document.createElement("style");
    style.id = "gvh-dynamic-style";

    function updateThemeStyles() {
        const t = getThemeColors();
        style.textContent = `
            @keyframes gvhPulse {
                0% { box-shadow: 0 0 0 0 ${t.glow}; }
                70% { box-shadow: 0 0 0 14px rgba(0, 0, 0, 0); }
                100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); }
            }
            @keyframes gvhFadeInUp {
                from { opacity: 0; transform: translateY(12px) scale(${PANEL_SCALE * 0.98}); }
                to { opacity: 1; transform: translateY(0) scale(${PANEL_SCALE}); }
            }
            @keyframes gvhFadeOutDown {
                from { opacity: 1; transform: translateY(0) scale(${PANEL_SCALE}); }
                to { opacity: 0; transform: translateY(12px) scale(${PANEL_SCALE * 0.98}); }
            }
            @keyframes gvhMsgAppear {
                from { opacity: 0; transform: translateY(6px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes rgbRainbow {
                0% { border-color: #ff0000; box-shadow: 0 0 25px rgba(255,0,0,0.5); }
                33% { border-color: #00ff00; box-shadow: 0 0 25px rgba(0,255,0,0.5); }
                66% { border-color: #0000ff; box-shadow: 0 0 25px rgba(0,0,255,0.5); }
                100% { border-color: #ff0000; box-shadow: 0 0 25px rgba(255,0,0,0.5); }
            }
            @keyframes neonPulse {
                0%, 100% { border-color: ${t.light}; box-shadow: 0 0 20px ${t.primary}, inset 0 0 10px ${t.primary}; }
                50% { border-color: #ffffff; box-shadow: 0 0 35px ${t.light}, inset 0 0 20px ${t.light}; }
            }

            .effect-fire.gvh-show { animation: gvhFadeInUp 0.3s ease forwards, rgbRainbow 4s infinite linear !important; }
            .effect-fire.gvh-hide { animation: gvhFadeOutDown 0.25s ease forwards, rgbRainbow 4s infinite linear !important; }
            .effect-neon.gvh-show { animation: gvhFadeInUp 0.3s ease forwards, neonPulse 2s infinite ease-in-out !important; }
            .effect-neon.gvh-hide { animation: gvhFadeOutDown 0.25s ease forwards, neonPulse 2s infinite ease-in-out !important; }

            #gvh-button {
                position: fixed; right: 24px; bottom: 24px; width: 58px; height: 58px; z-index: 2147483647;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 22px;
                background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95)); color: ${t.light};
                font-size: 26px; cursor: grab; animation: gvhPulse 2.5s infinite;
                display: flex; align-items: center; justify-content: center; user-select: none;
                backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                box-shadow: 0 12px 30px -5px rgba(0, 0, 0, 0.6);
                transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s, border-color 0.3s;
            }
            #gvh-button:active { cursor: grabbing; transform: scale(0.9); }
            #gvh-button:hover {
                background: linear-gradient(135deg, ${t.grad1}, ${t.grad2});
                color: #ffffff; border-color: rgba(255, 255, 255, 0.5); transform: scale(1.1);
                box-shadow: 0 18px 35px -5px ${t.glow};
            }

            #gvh-lock-screen {
                display: none; position: fixed; inset: 0; background: rgba(11, 17, 32, 0.75);
                backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
                z-index: 2147483647; justify-content: center; align-items: center;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            #gvh-lock-box {
                background: rgba(30, 41, 59, 0.75); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: ${BORDER_RADIUS}px;
                padding: 40px 32px; width: 380px; text-align: center; box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
                animation: gvhFadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            #gvh-lock-title { font-size: 20px; font-weight: 800; color: #f8fafc; letter-spacing: 0.5px; margin-bottom: 8px; }
            #gvh-lock-sub { font-size: 13px; color: #94a3b8; margin-bottom: 26px; }
            #gvh-lock-input {
                width: 100%; box-sizing: border-box; padding: 14px 45px 14px 18px; border-radius: 16px;
                border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(15, 23, 42, 0.5); color: #f8fafc; outline: none;
                font-size: 14px; text-align: center; transition: all 0.25s;
            }
            #gvh-lock-input:focus { border-color: ${t.light}; box-shadow: 0 0 0 4px ${t.glow}; background: rgba(15, 23, 42, 0.8); }
            #gvh-lock-btn {
                width: 100%; padding: 13px; border: none; border-radius: 16px;
                background: linear-gradient(135deg, ${t.grad1}, ${t.grad2}); color: white; cursor: pointer;
                font-weight: 700; font-size: 14px; letter-spacing: 0.5px; box-shadow: 0 6px 20px ${t.glow}; transition: 0.25s;
            }
            #gvh-lock-btn:hover { opacity: 0.95; transform: translateY(-2px); box-shadow: 0 8px 25px ${t.glow}; }
            #gvh-lock-error { color: #f87171; font-size: 12px; margin-top: 14px; min-height: 18px; font-weight: 600; }

            #gvh-panel {
                display: none; position: fixed; right: 24px; bottom: 98px; width: 470px; height: 720px;
                max-width: calc(100vw - 32px); max-height: calc(100vh - 120px);
                background: rgba(13, 20, 36, ${BG_OPACITY}); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
                color: #f1f5f9; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: ${BORDER_RADIUS}px; overflow: hidden;
                box-shadow: 0 30px 70px -15px rgba(0, 0, 0, 0.8), 0 0 40px ${t.glow};
                flex-direction: column; z-index: 2147483647; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                opacity: 0; pointer-events: none; transition: box-shadow 0.3s ease, border-radius 0.3s ease;
                transform: scale(${PANEL_SCALE});
            }
            #gvh-panel.gvh-show { display: flex; animation: gvhFadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; pointer-events: auto; }
            #gvh-panel.gvh-hide { animation: gvhFadeOutDown 0.25s cubic-bezier(0.4, 0, 1, 1) forwards; pointer-events: none; }

            #gvh-header {
                display: flex; align-items: center; padding: 18px 22px;
                background: rgba(30, 41, 59, 0.4); border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                cursor: move; user-select: none;
            }
            #gvh-title { font-size: 16px; font-weight: 800; color: #f8fafc; letter-spacing: 0.4px; }
            #gvh-sub { color: ${t.light}; font-size: 11px; margin-top: 3px; font-weight: 600; opacity: 0.95; }
            .gvh-space { flex: 1; }
            .gvh-icon {
                background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); color: #cbd5e1;
                width: 34px; height: 34px; border-radius: 12px; font-size: 14px; cursor: pointer; margin-left: 6px;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .gvh-icon:hover { background: rgba(255, 255, 255, 0.18); color: #fff; border-color: rgba(255, 255, 255, 0.3); transform: scale(1.08); }
            .gvh-icon:active { transform: scale(0.92); }

            #gvh-nav-tabs {
                display: flex; background: rgba(15, 23, 42, 0.3); border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                padding: 10px 14px; gap: 6px; overflow-x: auto;
            }
            .gvh-tab-btn {
                flex: 1; background: transparent; border: 1px solid transparent;
                color: #94a3b8; padding: 8px 4px; border-radius: 14px; font-size: 11.5px; font-weight: 600;
                cursor: pointer; text-align: center; white-space: nowrap; transition: all 0.25s ease;
            }
            .gvh-tab-btn:hover { background: rgba(255, 255, 255, 0.06); color: #e2e8f0; }
            .gvh-tab-btn.active {
                background: linear-gradient(135deg, ${t.grad1}, ${t.grad2}); color: #fff;
                font-weight: 700; box-shadow: 0 4px 15px ${t.glow}; border-color: rgba(255, 255, 255, 0.2);
            }

            .gvh-tab-content { display: none; flex: 1; flex-direction: column; overflow: hidden; }
            .gvh-tab-content.active { display: flex; }

            #gvh-messages { flex: 1; overflow-y: auto; padding: 18px; scroll-behavior: smooth; }
            #gvh-messages::-webkit-scrollbar { width: 5px; }
            #gvh-messages::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 6px; }

            .gvh-msg {
                padding: 14px 18px; margin-bottom: 14px; border-radius: 18px;
                line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; font-size: ${FONT_SIZE}px;
                animation: gvhMsgAppear 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            .gvh-user { background: linear-gradient(135deg, ${t.grad1}, ${t.grad2}); color: white; margin-left: 32px; border-bottom-right-radius: 6px; box-shadow: 0 4px 18px ${t.glow}; }
            .gvh-ai { background: ${t.bgCard}; margin-right: 32px; border-left: 3.5px solid ${t.light}; border-bottom-left-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.08); backdrop-filter: blur(10px); }
            .gvh-error { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); color: #fca5a5; margin-right: 32px; }

            #gvh-input-area { padding: 16px; background: rgba(30, 41, 59, 0.4); border-top: 1px solid rgba(255, 255, 255, 0.08); }
            #gvh-question {
                width: 100%; height: 68px; box-sizing: border-box; resize: none;
                background: rgba(15, 23, 42, 0.6); color: #f1f5f9; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 16px; padding: 12px 14px; outline: none;
                font-size: ${FONT_SIZE}px; transition: all 0.25s;
            }
            #gvh-question:focus { border-color: ${t.light}; box-shadow: 0 0 0 3px ${t.glow}; background: rgba(15, 23, 42, 0.85); }

            #gvh-image-preview {
                display: none; position: relative; margin-bottom: 10px; padding: 10px;
                background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px;
            }
            #gvh-image-preview img { display: block; max-width: 100%; max-height: 170px; border-radius: 10px; margin: 0 auto; object-fit: contain; cursor: zoom-in; }
            #gvh-image-name { color: #94a3b8; font-size: 11.5px; margin-top: 6px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            #gvh-remove-image {
                position: absolute; right: 10px; top: 10px; width: 24px; height: 24px;
                border: none; border-radius: 50%; background: rgba(0, 0, 0, 0.7); color: white; cursor: pointer;
                display: flex; align-items: center; justify-content: center; font-size: 11px; transition: 0.2s;
            }
            #gvh-remove-image:hover { background: #ef4444; transform: scale(1.15); }

            #gvh-actions { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
            #gvh-actions button { border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 10px 10px; cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.2s; }
            #gvh-ask { flex: 1.2; background: linear-gradient(135deg, ${t.grad1}, ${t.grad2}); color: white; border: none !important; box-shadow: 0 4px 15px ${t.glow}; font-weight: 700; }
            #gvh-ask:hover { opacity: 0.94; transform: translateY(-1px); box-shadow: 0 6px 20px ${t.glow}; }
            #gvh-ask:active { transform: translateY(1px); }

            .gvh-secondary { background: rgba(255, 255, 255, 0.06); color: #cbd5e1; }
            .gvh-secondary:hover { background: rgba(255, 255, 255, 0.12); color: #fff; border-color: rgba(255, 255, 255, 0.2); transform: translateY(-1px); }
            .gvh-secondary:active { transform: translateY(1px); }

            #gvh-status { color: ${t.light}; font-size: 11.5px; margin-top: 8px; min-height: 16px; font-weight: 500; text-align: center; }

            #gvh-notes-container { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
            #gvh-notes-container::-webkit-scrollbar { width: 5px; }
            #gvh-notes-container::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 6px; }

            .gvh-note-card {
                background: ${t.bgCard}; border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 16px; padding: 14px 16px; transition: 0.25s; position: relative; backdrop-filter: blur(10px);
            }
            .gvh-note-card:hover { border-color: rgba(255, 255, 255, 0.2); box-shadow: 0 6px 20px rgba(0,0,0,0.3); }
            .gvh-note-text { font-size: ${FONT_SIZE}px; color: #f1f5f9; white-space: pre-wrap; word-break: break-word; line-height: 1.5; margin-bottom: 10px; }
            .gvh-note-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px; }
            .gvh-note-time { font-size: 11px; color: #94a3b8; }
            .gvh-note-actions button {
                background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1;
                padding: 5px 10px; border-radius: 10px; font-size: 11.5px; cursor: pointer; margin-left: 6px; transition: 0.2s;
            }
            .gvh-note-actions button:hover { background: rgba(255,255,255,0.18); color: #fff; border-color: rgba(255,255,255,0.25); }

            #gvh-note-input-box { padding: 16px; background: rgba(30, 41, 59, 0.4); border-top: 1px solid rgba(255, 255, 255, 0.08); }
            #gvh-new-note {
                width: 100%; height: 75px; box-sizing: border-box; resize: none;
                background: rgba(15, 23, 42, 0.6); color: #f1f5f9; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 16px; padding: 12px; outline: none;
                font-size: ${FONT_SIZE}px; margin-bottom: 10px; transition: 0.25s;
            }
            #gvh-new-note:focus { border-color: ${t.light}; box-shadow: 0 0 0 3px ${t.glow}; background: rgba(15, 23, 42, 0.85); }
            #gvh-add-note-btn {
                width: 100%; padding: 12px; border: none; border-radius: 14px;
                background: linear-gradient(135deg, ${t.grad1}, ${t.grad2}); color: white; cursor: pointer; font-weight: 700; font-size: 13px;
                letter-spacing: 0.5px; box-shadow: 0 4px 15px ${t.glow}; transition: 0.25s;
            }
            #gvh-add-note-btn:hover { opacity: 0.95; transform: translateY(-1px); box-shadow: 0 6px 20px ${t.glow}; }

            .gvh-tab-pane { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 14px; }
            .gvh-setting-group { background: ${t.bgCard}; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 16px; backdrop-filter: blur(10px); }
            .gvh-label { font-size: 11.5px; font-weight: 700; color: ${t.light}; margin-bottom: 10px; text-transform: uppercase; display: block; letter-spacing: 0.5px; }
            #gvh-key, #gvh-model, #gvh-theme-select, #gvh-effect-select, #gvh-fontsize-select, #gvh-radius-select, .gvh-input-field {
                width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 14px;
                border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(15, 23, 42, 0.6); color: #f1f5f9; outline: none;
                font-size: 13px; transition: all 0.25s; cursor: pointer;
            }
            #gvh-key:focus, #gvh-model:focus, #gvh-theme-select:focus, #gvh-effect-select:focus, #gvh-fontsize-select:focus, #gvh-radius-select:focus, .gvh-input-field:focus { border-color: ${t.light}; box-shadow: 0 0 0 3px ${t.glow}; background: rgba(15, 23, 42, 0.85); }

            .gvh-color-picker-container { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
            #gvh-custom-color { width: 42px; height: 38px; border: none; border-radius: 8px; cursor: pointer; background: transparent; }

            .gvh-slider-container { display: flex; align-items: center; gap: 12px; }
            #gvh-opacity-range, #gvh-scale-range { flex: 1; accent-color: ${t.light}; cursor: pointer; }
            #gvh-opacity-val, #gvh-scale-val { font-size: 12px; font-weight: 700; color: #cbd5e1; width: 40px; text-align: right; }

            #gvh-shortcut-recorder {
                width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 14px;
                border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(15, 23, 42, 0.6); color: #38bdf8; outline: none;
                font-size: 13.5px; font-weight: 700; text-align: center; cursor: pointer; transition: all 0.25s;
            }
            #gvh-shortcut-recorder:hover { border-color: ${t.light}; background: rgba(15, 23, 42, 0.8); }
            #gvh-shortcut-recorder.recording { border-color: #f87171 !important; color: #fca5a5; background: rgba(239, 68, 68, 0.15); box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.25); animation: gvhPulse 1.5s infinite; }

            .gvh-action-btn {
                width: 100%; padding: 13px; border: none; border-radius: 14px;
                background: linear-gradient(135deg, ${t.grad1}, ${t.grad2}); color: white; cursor: pointer; font-weight: 700; font-size: 13px;
                letter-spacing: 0.5px; transition: all 0.25s; box-shadow: 0 4px 15px ${t.glow}; margin-top: 4px;
            }
            .gvh-action-btn:hover { opacity: 0.95; transform: translateY(-1px); box-shadow: 0 6px 20px ${t.glow}; }
            .gvh-settings-status { font-size: 12.5px; font-weight: 600; text-align: center; margin-top: 10px; min-height: 20px; }
        `;
    }

    updateThemeStyles();
    document.head.appendChild(style);

    const lockScreen = document.createElement("div");
    lockScreen.id = "gvh-lock-screen";
    lockScreen.innerHTML = `
        <div id="gvh-lock-box">
            <div id="gvh-lock-title">⚡ cheat engine ⚡</div>
            <div id="gvh-lock-sub">Nhập mã kích hoạt để sử dụng</div>
            <div style="position: relative; margin-bottom: 16px;">
                <input id="gvh-lock-input" type="password" placeholder="Mật khẩu hoặc Key VIP...">
                <button id="gvh-toggle-pass" type="button" title="Hiện/Ẩn mật khẩu" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 18px; padding: 0; display: flex; align-items: center; justify-content: center; outline: none;">👁️</button>
            </div>
            <button id="gvh-lock-btn">🔓 Mở Khóa</button>
            <div id="gvh-lock-error"></div>
        </div>
    `;
    document.body.appendChild(lockScreen);

    const btn = document.createElement("button");
    btn.id = "gvh-button";
    btn.title = "Kéo để di chuyển hoặc bấm mở";
    btn.textContent = "⚡";
    document.body.appendChild(btn);

    const isAdmin = !!SESSION && SESSION.type === "admin";

    const panel = document.createElement("div");
    panel.id = "gvh-panel";
    if (CURRENT_EFFECT !== "none") panel.classList.add(CURRENT_EFFECT);

    panel.innerHTML = `
        <div id="gvh-header">
            <div>
                <div id="gvh-title">⚡ cheat engine </div>
                <div id="gvh-sub">by Từ Hưng 8A2 • Pro VIP v${CURRENT_VERSION} • ${SESSION && SESSION.type === "admin" ? "👑 Admin" : "🔑 " + String(SESSION && SESSION.key || "").replace(/[&<>\"']/g, "")}</div>
            </div>
            <div class="gvh-space"></div>
            <button class="gvh-icon" id="gvh-logout-head" title="Đăng xuất">🚪</button>
            <button class="gvh-icon" id="gvh-minimize-btn" title="Thu gọn">🗕</button>
            <button class="gvh-icon" id="gvh-close" title="Đóng">✕</button>
        </div>

        <div id="gvh-update-banner" style="display:none; margin:8px 14px 0; padding:8px 10px; border-radius:10px; background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.5); color:#fbbf24; font-size:12px; align-items:center; gap:8px;">
            <span id="gvh-update-banner-text" style="flex:1;"></span>
            <button id="gvh-update-banner-btn" style="background:#f59e0b; border:none; color:#fff; padding:4px 10px; border-radius:8px; cursor:pointer; font-weight:700; font-size:11px;">Cập nhật</button>
        </div>

        <div id="gvh-nav-tabs">
            <button class="gvh-tab-btn active" data-tab="tab-chat">🤖 Hack</button>
            ${isAdmin ? `<button class="gvh-tab-btn" data-tab="tab-admin" style="color:#f59e0b; font-weight:800;">👑 Admin</button>` : ''}
            <button class="gvh-tab-btn" data-tab="tab-notes">📝 Ghi Chú</button>
            <button class="gvh-tab-btn" data-tab="tab-apikey">🔑 API Key</button>
            <button class="gvh-tab-btn" data-tab="tab-appearance">🎨 Giao Diện</button>
            <button class="gvh-tab-btn" data-tab="tab-settings">⚙ Setting</button>
        </div>

        <div id="tab-chat" class="gvh-tab-content active">
            <div id="gvh-messages">
                <div class="gvh-msg gvh-ai">
⚡ THÔNG TIN PHIÊN BẢN (v12.4.8) ⚡<br><br>
• Thêm <b>kiểm tra cập nhật từ xa</b>: tự báo khi có bản mới, xem phiên bản đang dùng ở Setting.<br>
• Thêm nút <b>🔍 Quét đề</b> để bóc tách chữ trực tiếp từ VioEdu, khắc phục triệt để lỗi ảnh chụp trắng.<br>
• Ctrl + nút chụp bài để chụp toàn trang</b>.<br>
• Mỗi Key có <b>giới hạn số thiết bị</b> riêng (Setting → xem thiết bị, nút <b>📵 Đăng xuất tất cả thiết bị khác</b>).
                </div>
            </div>
            <div id="gvh-input-area">
                <div id="gvh-image-preview">
                    <button id="gvh-remove-image" title="Xóa ảnh">✕</button>
                    <img id="gvh-image" alt="Ảnh tải lên">
                    <div id="gvh-image-name"></div>
                </div>
                <textarea id="gvh-question" placeholder="Nhập câu hỏi, bấm Quét đề hoặc Ctrl+V dán ảnh..."></textarea>
                <div id="gvh-actions">
                    <button id="gvh-ask">🤖 Giải bài</button>
                    <button id="gvh-ocr" class="gvh-secondary" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-weight:700;" title="Quét chữ + OCR ảnh trong đề (Shift+bấm: ép OCR, Alt+bấm: chỉ quét chữ)">🔍 Quét đề</button>
                    <button id="gvh-capture" class="gvh-secondary" style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-weight:700;" title="Chụp vùng đề, tự sửa ảnh trắng / chữ trắng (Shift+bấm: chụp thẳng tab)">📸 Chụp bài</button>
                    <button id="gvh-search" class="gvh-secondary">🔎 Web</button>
                    <button id="gvh-clear" class="gvh-secondary" title="Xóa lịch sử">🗑</button>
                </div>
                <div id="gvh-status"></div>
            </div>
        </div>

        ${isAdmin ? `
        <div id="tab-admin" class="gvh-tab-content">
            <div class="gvh-tab-pane">
                <div class="gvh-setting-group">
                    <span class="gvh-label">🔑 QUẢN LÝ & TẠO KEY MỚI</span>
                    <input id="gvh-admin-keyname" class="gvh-input-field" type="text" placeholder="Tên Key (VD: HS_HOANG_30N)...">
                    <input id="gvh-admin-days" class="gvh-input-field" type="number" placeholder="Số ngày sử dụng (VD: 30)..." value="30">
                    <input id="gvh-admin-maxdev" class="gvh-input-field" type="number" min="1" placeholder="Số thiết bị tối đa (VD: 1)..." value="1">
                    <button id="gvh-admin-create-btn" class="gvh-action-btn">➕ Tạo Key Mới Vào Firebase</button>
                </div>
                <div class="gvh-setting-group">
                    <span class="gvh-label">🚀 PHÁT HÀNH BẢN CẬP NHẬT</span>
                    <input id="gvh-admin-latest" class="gvh-input-field" type="text" placeholder="Phiên bản mới nhất (VD: 12.4.9)...">
                    <input id="gvh-admin-minver" class="gvh-input-field" type="text" placeholder="Phiên bản tối thiểu bắt buộc (bỏ trống = không ép)...">
                    <input id="gvh-admin-notes" class="gvh-input-field" type="text" placeholder="Nội dung cập nhật (ngắn gọn)...">
                    <button id="gvh-admin-pub-btn" class="gvh-action-btn">📢 Đăng thông báo cập nhật</button>
                    <div style="margin-top:8px; font-size:11px; color:#94a3b8;">📊 Phiên bản đang được dùng:</div>
                    <div id="gvh-admin-version-stats" style="font-size:11.5px; color:#cbd5e1;">Bấm "Tải lại danh sách Key" để thống kê.</div>
                </div>
                <div class="gvh-setting-group">
                    <span class="gvh-label">📋 DANH SÁCH KEY ĐÃ TẠO</span>
                    <button id="gvh-admin-refresh-btn" class="gvh-secondary" style="width:100%; padding:8px; border-radius:10px; cursor:pointer;">🔄 Tải lại danh sách Key</button>
                    <div id="gvh-admin-key-list" style="margin-top:10px; max-height:220px; overflow-y:auto; font-size:12px;"></div>
                </div>
                <div id="gvh-admin-status" class="gvh-settings-status"></div>
            </div>
        </div>
        ` : ''}

        <div id="tab-notes" class="gvh-tab-content">
            <div id="gvh-notes-container"></div>
            <div id="gvh-note-input-box">
                <textarea id="gvh-new-note" placeholder="Nhập ghi chú, công thức toán, đáp án cần nhớ nhanh..."></textarea>
                <button id="gvh-add-note-btn">💾 Thêm Ghi Chú</button>
            </div>
        </div>

        <div id="tab-apikey" class="gvh-tab-content">
            <div class="gvh-tab-pane">
                <div class="gvh-setting-group">
                    <span class="gvh-label">🔑 Nhập Gemini API Key</span>
                    <input id="gvh-key" type="password" placeholder="Dán API key của bạn vào đây...">
                </div>
                <div class="gvh-setting-group">
                    <span class="gvh-label">🧠 Model / Giới hạn số lần dùng mỗi ngày</span>
                    <select id="gvh-model">
                        <option value="gemini-3.8-flash">Gemini 3.8 Flash (20 lần/ngày)</option>
                        <option value="gemini-3.7-flash">Gemini 3.7 Flash (20 lần/ngày)</option>
                        <option value="gemini-3.6-flash">Gemini 3.6 Flash (20 lần/ngày)</option>
                        <option value="gemini-3.5-flash">Gemini 3.5 Flash (5 lần/ngày)</option>
                        <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (500 lần/ngày - Khuyên dùng)</option>
                        <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (500 lần/ngày)</option>
                    </select>
                </div>
                <button id="gvh-save-api" class="gvh-action-btn">💾 Lưu & Kiểm Tra Kết Nối API</button>
                <div id="gvh-api-status" class="gvh-settings-status"></div>
            </div>
        </div>

        <div id="tab-appearance" class="gvh-tab-content">
            <div class="gvh-tab-pane">
                <div class="gvh-setting-group">
                    <span class="gvh-label">🎨 Chọn màu chủ đạo</span>
                    <select id="gvh-theme-select">
                        <option value="blue">Xanh Dương Huyền Bí (Mặc định)</option>
                        <option value="red">Đỏ Rực Rỡ Chiến Thắng</option>
                        <option value="green">Xanh Lá Cây Tươi Mát</option>
                        <option value="purple">Tím Mộng Mơ VIP</option>
                        <option value="custom">🌈 Màu Tùy Chỉnh (Custom Color)</option>
                    </select>
                    <div class="gvh-color-picker-container" id="gvh-custom-color-box" style="display: none;">
                        <span style="font-size: 12px; color: #cbd5e1;">Bảng chọn màu:</span>
                        <input type="color" id="gvh-custom-color" value="${CUSTOM_COLOR}">
                    </div>
                </div>

                <div class="gvh-setting-group">
                    <span class="gvh-label">✨ Hiệu ứng viền Panel</span>
                    <select id="gvh-effect-select">
                        <option value="none">Mặc định (Không hiệu ứng)</option>
                        <option value="effect-fire">🔥 Viền Lửa RGB Bùng Cháy</option>
                        <option value="effect-neon">⚡ Viền Lập Lòe Neon VIP</option>
                    </select>
                </div>

                <div class="gvh-setting-group">
                    <span class="gvh-label">🔤 Kích thước phông chữ</span>
                    <select id="gvh-fontsize-select">
                        <option value="12">Nhỏ (12px)</option>
                        <option value="13.5">Vừa (13.5px - Mặc định)</option>
                        <option value="15">Lớn (15px)</option>
                    </select>
                </div>

                <div class="gvh-setting-group">
                    <span class="gvh-label">👁️ Độ trong suốt (Opacity)</span>
                    <div class="gvh-slider-container">
                        <input type="range" id="gvh-opacity-range" min="0.5" max="1" step="0.05" value="${BG_OPACITY}">
                        <span id="gvh-opacity-val">${Math.round(BG_OPACITY * 100)}%</span>
                    </div>
                </div>

                <div class="gvh-setting-group">
                    <span class="gvh-label">🔍 Tỉ lệ độ to Panel (Scale GUI)</span>
                    <div class="gvh-slider-container">
                        <input type="range" id="gvh-scale-range" min="0.7" max="1.5" step="0.05" value="${PANEL_SCALE}">
                        <span id="gvh-scale-val">${Math.round(PANEL_SCALE * 100)}%</span>
                    </div>
                </div>

                <div class="gvh-setting-group">
                    <span class="gvh-label">📐 Độ bo tròn góc (Border Radius)</span>
                    <select id="gvh-radius-select">
                        <option value="12">Vuông Hiện Đại (12px)</option>
                        <option value="20">Bo Vừa (20px)</option>
                        <option value="28">Bo Tròn VIP (28px - Mặc định)</option>
                    </select>
                </div>

                <button id="gvh-save-appearance" class="gvh-action-btn">💾 Lưu Giao Diện</button>
            </div>
        </div>

        <div id="tab-settings" class="gvh-tab-content">
            <div class="gvh-tab-pane">
                <div class="gvh-setting-group" id="gvh-version-box">
                    <span class="gvh-label">🔄 Phiên bản & Cập nhật</span>
                    <div style="font-size:12.5px; line-height:1.7; color:#cbd5e1;">
                        Đang dùng: <b id="gvh-ver-current" style="color:#38bdf8;"></b><br>
                        Mới nhất: <b id="gvh-ver-latest" style="color:#34d399;">chưa kiểm tra</b>
                    </div>
                    <div id="gvh-ver-notes" style="font-size:11px; color:#94a3b8; margin-top:4px; white-space:pre-wrap;"></div>
                    <button id="gvh-ver-check-btn" class="gvh-action-btn">🔍 Kiểm tra cập nhật</button>
                    <button id="gvh-ver-update-btn" class="gvh-action-btn" style="display:none; background:linear-gradient(135deg,#10b981,#047857);">⬇ Cập nhật ngay</button>
                    <div id="gvh-update-status" class="gvh-settings-status"></div>
                </div>
                <div class="gvh-setting-group">
                    <span class="gvh-label">⌨️ Phím tắt ẩn/hiện Panel</span>
                    <div id="gvh-shortcut-recorder" title="Bấm vào đây rồi nhấn phím bất kỳ trên bàn phím để đổi">${TOGGLE_SHORTCUT.display}</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 6px; text-align: center;">Bấm vào ô trên, sau đó nhấn phím tùy ý để đặt làm phím tắt.</div>
                </div>
                <button id="gvh-save-system" class="gvh-action-btn">💾 Lưu Cài Đặt Hệ Thống</button>
                <div id="gvh-system-status" class="gvh-settings-status"></div>
                <div id="gvh-devices-info" style="font-size:12px; color:#cbd5e1; margin-top:10px;"></div>
                <button id="gvh-logout-others" class="gvh-action-btn" style="background:linear-gradient(135deg,#f59e0b,#b45309); box-shadow:0 4px 15px rgba(245,158,11,0.35);">📵 Đăng xuất tất cả thiết bị khác</button>
                <button id="gvh-logout" class="gvh-action-btn" style="background:linear-gradient(135deg,#ef4444,#b91c1c); box-shadow:0 4px 15px rgba(239,68,68,0.35);">🚪 Đăng xuất khỏi thiết bị này</button>
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    const $ = id => document.getElementById(id);

    $("gvh-theme-select").value = CURRENT_THEME;
    $("gvh-model").value = MODEL;
    if (!$("gvh-model").value) { MODEL = "gemini-3.5-flash-lite"; $("gvh-model").value = MODEL; }
    if (API_KEY) $("gvh-key").value = API_KEY;
    $("gvh-effect-select").value = CURRENT_EFFECT;
    $("gvh-fontsize-select").value = FONT_SIZE;
    $("gvh-radius-select").value = BORDER_RADIUS;

    if (CURRENT_THEME === "custom") {
        $("gvh-custom-color-box").style.display = "flex";
    }

    $("gvh-theme-select").onchange = (e) => {
        if (e.target.value === "custom") {
            $("gvh-custom-color-box").style.display = "flex";
        } else {
            $("gvh-custom-color-box").style.display = "none";
        }
    };

    $("gvh-opacity-range").oninput = (e) => {
        $("gvh-opacity-val").textContent = `${Math.round(e.target.value * 100)}%`;
    };

    $("gvh-scale-range").oninput = (e) => {
        $("gvh-scale-val").textContent = `${Math.round(e.target.value * 100)}%`;
    };

    let tempShortcut = TOGGLE_SHORTCUT;
    const recorder = $("gvh-shortcut-recorder");

    recorder.onclick = () => {
        recorder.classList.add("recording");
        recorder.textContent = "⌨️ Đang chờ nhấn phím mới...";

        const captureKey = (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

            let code = e.code;
            let keyLabel = e.key.toUpperCase();
            if (code.startsWith("Key")) keyLabel = code.replace("Key", "");
            else if (code.startsWith("Digit")) keyLabel = code.replace("Digit", "");
            else if (code === "Space") keyLabel = "Space";

            let displayStr = (e.ctrlKey ? "Ctrl + " : "") + (e.altKey ? "Alt + " : "") + (e.shiftKey ? "Shift + " : "") + keyLabel;

            tempShortcut = { code: code, display: displayStr, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey };
            recorder.textContent = displayStr;
            recorder.classList.remove("recording");
            window.removeEventListener("keydown", captureKey, true);
        };

        window.addEventListener("keydown", captureKey, true);
    };

    // NÚT ẩn/hiện mật khẩu
    $("gvh-toggle-pass").onclick = () => {
        const passInput = $("gvh-lock-input");
        const toggleBtn = $("gvh-toggle-pass");
        if (passInput.type === "password") {
            passInput.type = "text";
            toggleBtn.textContent = "🙈";
        } else {
            passInput.type = "password";
            toggleBtn.textContent = "👁️";
        }
    };

    // ===== XÁC THỰC KEY (đăng nhập được trên nhiều thiết bị, nhớ đăng nhập lâu dài) =====
    async function sha256(text) {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    }

    function sanitizeKeyName(str) {
        return String(str).trim().replace(/[.#$\[\]\/]/g, "_");
    }

    // ===== LỚP KẾT NỐI ỔN ĐỊNH: tự thử lại khi mạng chập chờn / server quá tải =====
    // Dùng y hệt GM_xmlhttpRequest (onload / onerror / ontimeout) nhưng có retry + backoff + jitter.
    // Chỉ retry khi: lỗi mạng, timeout, hoặc HTTP 0/408/500/502/503/504. Lỗi 4xx (sai key, hết quota...) trả về ngay.
    const RETRY_STATUS = [0, 408, 500, 502, 503, 504];
    function gmx(details, opt = {}) {
        const retries = opt.retries === undefined ? 2 : opt.retries;
        const base = opt.baseDelay || 700;
        let attempt = 0;
        const run = () => {
            attempt++;
            let settled = false;
            const settle = (kind, res) => {
                if (settled) return;
                settled = true;
                const offline = typeof navigator !== "undefined" && navigator.onLine === false;
                const retriable = kind !== "load" || RETRY_STATUS.includes(res && res.status);
                if (retriable && !offline && attempt <= retries) {
                    const delay = base * Math.pow(2, attempt - 1) + Math.random() * 400;
                    if (opt.onRetry) { try { opt.onRetry(attempt, retries, kind, res); } catch (e) {} }
                    setTimeout(run, delay);
                    return;
                }
                const cb = kind === "load" ? details.onload : kind === "timeout" ? details.ontimeout : details.onerror;
                if (cb) cb(res);
            };
            try {
                GM_xmlhttpRequest(Object.assign({}, details, {
                    timeout: details.timeout || opt.timeout || 10000,
                    onload: (res) => settle("load", res),
                    onerror: (res) => settle("error", res),
                    ontimeout: (res) => settle("timeout", res),
                    onabort: (res) => settle("error", res)
                }));
            } catch (e) { settle("error", {}); }
        };
        run();
    }

    function fetchKeyData(keyName) {
        return new Promise((resolve, reject) => {
            gmx({
                method: "GET",
                url: `${FIREBASE_URL}/keys/${encodeURIComponent(keyName)}.json`,
                timeout: 8000,
                onload: (res) => {
                    if (res.status < 200 || res.status >= 300) { reject(new Error("HTTP " + res.status)); return; }
                    try { resolve(JSON.parse(res.responseText)); } catch (e) { reject(e); }
                },
                onerror: () => reject(new Error("network")),
                ontimeout: () => reject(new Error("timeout"))
            }, { retries: 2, baseDelay: 600 });
        });
    }

    // ===== GIỚI HẠN THIẾT BỊ CHO TỪNG KEY =====
    const DEFAULT_MAX_DEVICES = 1;                    // Key cũ chưa có trường max_devices
    const FORCED_DEVICE_LIMITS = { "thung8a2": 3 };   // Key đặc biệt: luôn cố định, bỏ qua giá trị trên Firebase

    function getDeviceLimit(keyName, data) {
        const forced = FORCED_DEVICE_LIMITS[String(keyName).toLowerCase()];
        if (forced) return forced;
        const n = parseInt(data && data.max_devices);
        return n > 0 ? n : DEFAULT_MAX_DEVICES;
    }

    function getDeviceId() {
        let id = store.get("gvh_device_id", "");
        if (!id) {
            id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
                : Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
            store.set("gvh_device_id", id);
        }
        return id;
    }
    const DEVICE_ID = getDeviceId();

    function deviceLabel() {
        const ua = navigator.userAgent;
        let os = "Thiết bị";
        if (/Windows/i.test(ua)) os = "Windows";
        else if (/Android/i.test(ua)) os = "Android";
        else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
        else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
        else if (/CrOS/i.test(ua)) os = "ChromeOS";
        else if (/Linux/i.test(ua)) os = "Linux";
        let br = "Trình duyệt";
        if (/Edg\//.test(ua)) br = "Edge";
        else if (/OPR\//.test(ua)) br = "Opera";
        else if (/Firefox\//.test(ua)) br = "Firefox";
        else if (/Chrome\//.test(ua)) br = "Chrome";
        else if (/Safari\//.test(ua)) br = "Safari";
        return os + " • " + br;
    }

    // Gọi Firebase REST dạng Promise (path không có đuôi .json)
    function fbRequest(method, path, body) {
        return new Promise((resolve, reject) => {
            // Ghi dữ liệu: print=silent để Firebase không trả body về => nhẹ & nhanh hơn
            const q = (method === "PATCH" || method === "PUT" || method === "DELETE") ? "?print=silent" : "";
            gmx({
                method,
                url: `${FIREBASE_URL}/${path}.json${q}`,
                headers: { "Content-Type": "application/json" },
                data: body === undefined ? undefined : JSON.stringify(body),
                timeout: 8000,
                onload: (res) => {
                    if (res.status < 200 || res.status >= 300) { reject(new Error("HTTP " + res.status)); return; }
                    try { resolve(JSON.parse(res.responseText)); } catch (e) { resolve(null); }
                },
                onerror: () => reject(new Error("network")),
                ontimeout: () => reject(new Error("timeout"))
            }, { retries: 2, baseDelay: 600 });
        });
    }

    const ADMIN_MAX_DEVICES = 3; // "thung8a2" là mật khẩu master (admin) => cố định tối đa 3 thiết bị

    function sessionDevicesPath(s) {
        return s.type === "admin" ? "admin_devices" : `keys/${encodeURIComponent(s.key)}/devices`;
    }

    // Đăng ký thiết bị này vào một danh sách thiết bị (path). Trả về { ok, limit }
    async function claimDeviceAt(path, limit, devices) {
        const now = new Date().toISOString();
        if (devices[DEVICE_ID]) {
            fbRequest("PATCH", `${path}/${DEVICE_ID}`, { last_seen: now, version: CURRENT_VERSION }).catch(() => {});
            return { ok: true, limit };
        }
        if (Object.keys(devices).length >= limit) return { ok: false, limit };

        await fbRequest("PUT", `${path}/${DEVICE_ID}`, { name: deviceLabel(), login_at: now, last_seen: now, version: CURRENT_VERSION });

        // Kiểm tra lại: nếu nhiều máy đăng nhập cùng lúc làm vượt giới hạn thì máy này rút lui
        const after = (await fbRequest("GET", path)) || {};
        if (Object.keys(after).length > limit) {
            await fbRequest("DELETE", `${path}/${DEVICE_ID}`).catch(() => {});
            return { ok: false, limit };
        }
        return { ok: true, limit };
    }

    function claimDevice(keyName, data) {
        return claimDeviceAt(`keys/${encodeURIComponent(keyName)}/devices`, getDeviceLimit(keyName, data), (data && data.devices) || {});
    }

    async function claimAdminDevice() {
        const devs = (await fbRequest("GET", "admin_devices")) || {};
        return claimDeviceAt("admin_devices", ADMIN_MAX_DEVICES, devs);
    }

    // removeRemote=true: gỡ thiết bị này khỏi danh sách trên Firebase để nhường chỗ
    async function logout(removeRemote = true) {
        const s = readSession();
        if (removeRemote && s) {
            try { await fbRequest("DELETE", `${sessionDevicesPath(s)}/${DEVICE_ID}`); } catch (e) {}
        }
        store.del("gvh_session");
        location.reload();
    }

    // Kiểm tra định kỳ: Key bị xóa / hết hạn / thiết bị bị đăng xuất từ xa
    let sessionWatchTimer = null, sessionChecking = false;
    async function checkKeySession() {
        const s = readSession();
        if (sessionChecking || !s) return;
        if (document.hidden || navigator.onLine === false) return; // tab ẩn / mất mạng: bỏ qua, đỡ tốn request
        sessionChecking = true;
        try {
            const path = sessionDevicesPath(s);
            let d = null, devs;
            try {
                if (s.type === "admin") {
                    devs = (await fbRequest("GET", "admin_devices")) || {};
                } else {
                    d = await fetchKeyData(s.key);
                    const exp = d && d.expire_date ? new Date(d.expire_date) : null;
                    if (!exp || isNaN(exp.getTime()) || new Date() >= exp) { logout(false); return; }
                    devs = d.devices || {};
                }
            } catch (e) { return; } // mất mạng thì vẫn cho dùng tiếp

            if (devs[DEVICE_ID]) {
                const last = devs[DEVICE_ID].last_seen ? new Date(devs[DEVICE_ID].last_seen).getTime() : 0;
                if (Date.now() - last > 5 * 60 * 1000 || devs[DEVICE_ID].version !== CURRENT_VERSION) {
                    fbRequest("PATCH", `${path}/${DEVICE_ID}`, { last_seen: new Date().toISOString(), version: CURRENT_VERSION }).catch(() => {});
                }
                return;
            }

            if (s.dev) {
                // Đã từng đăng ký nhưng giờ không còn trong danh sách => bị đăng xuất từ xa
                alert("⚠️ Thiết bị này đã bị đăng xuất (từ thiết bị khác hoặc do admin). Vui lòng đăng nhập lại.");
                logout(false);
                return;
            }

            // Phiên cũ từ bản trước (chưa đăng ký thiết bị): đăng ký ngầm, hết chỗ thì đăng xuất
            try {
                const r = s.type === "admin" ? await claimDeviceAt(path, ADMIN_MAX_DEVICES, devs) : await claimDevice(s.key, d);
                if (r.ok) {
                    s.dev = true;
                    store.set("gvh_session", JSON.stringify(s));
                } else {
                    alert(`⚠️ Đã đủ ${r.limit} thiết bị nên thiết bị này bị đăng xuất. Hãy dùng nút "Đăng xuất tất cả thiết bị khác" ở máy đang dùng, hoặc liên hệ admin.`);
                    logout(false);
                }
            } catch (e) {}
        } finally {
            sessionChecking = false;
        }
    }

    function startSessionWatch() {
        const s = readSession();
        if (!s || sessionWatchTimer) return;
        checkKeySession();
        sessionWatchTimer = setInterval(checkKeySession, 60000);
        // Quay lại tab / có mạng lại thì kiểm tra ngay
        document.addEventListener("visibilitychange", () => { if (!document.hidden) checkKeySession(); });
        window.addEventListener("online", () => checkKeySession());
    }

    // Danh sách thiết bị đang đăng nhập (tab Setting)
    async function loadDevicesInfo() {
        const el = $("gvh-devices-info");
        if (!el) return;
        const s = readSession();
        if (!s) { el.innerHTML = ""; return; }
        el.textContent = "Đang tải danh sách thiết bị...";
        try {
            let devs, limit;
            if (s.type === "admin") {
                devs = (await fbRequest("GET", "admin_devices")) || {};
                limit = ADMIN_MAX_DEVICES;
            } else {
                const d = (await fetchKeyData(s.key)) || {};
                devs = d.devices || {};
                limit = getDeviceLimit(s.key, d);
            }
            const ids = Object.keys(devs);
            let html = `<div style="font-weight:700; margin-bottom:6px;">📱 Thiết bị đang đăng nhập: ${ids.length}/${limit}</div>`;
            ids.forEach(id => {
                const dv = devs[id] || {};
                const t = dv.last_seen ? new Date(dv.last_seen) : null;
                const timeStr = t && !isNaN(t.getTime()) ? t.toLocaleString("vi-VN") : "?";
                html += `<div style="padding:5px 0; border-top:1px solid rgba(255,255,255,0.08);">${escapeHtml(dv.name || "Thiết bị")} <span style='color:#64748b;'>• v${escapeHtml(dv.version || "cũ")}</span>${id === DEVICE_ID ? " <b style='color:#34d399;'>(thiết bị này)</b>" : ""}<br><span style="color:#94a3b8; font-size:10px;">Hoạt động gần nhất: ${escapeHtml(timeStr)}</span></div>`;
            });
            el.innerHTML = html;
        } catch (e) {
            el.textContent = "❌ Không tải được danh sách thiết bị.";
        }
    }

    // Nút: đăng xuất tất cả thiết bị khác, giữ lại thiết bị này
    async function logoutOtherDevices() {
        const s = readSession();
        const st = $("gvh-system-status");
        if (!s) {
            st.style.color = "#f87171";
            st.textContent = "⚠️ Bạn chưa đăng nhập.";
            return;
        }
        if (!confirm("Đăng xuất khỏi TẤT CẢ thiết bị khác?\nThiết bị này vẫn giữ đăng nhập. Các máy kia sẽ bị đăng xuất trong tối đa ~1 phút.")) return;
        st.style.color = "#38bdf8";
        st.textContent = "🔄 Đang đăng xuất các thiết bị khác...";
        try {
            let cur;
            if (s.type === "admin") {
                cur = (await fbRequest("GET", "admin_devices")) || {};
            } else {
                const d = await fetchKeyData(s.key);
                if (!d || !d.expire_date) throw new Error("Key không còn hợp lệ");
                cur = d.devices || {};
            }
            const now = new Date().toISOString();
            const mine = Object.assign({ login_at: now }, cur[DEVICE_ID] || {}, { name: deviceLabel(), last_seen: now, version: CURRENT_VERSION });
            await fbRequest("PUT", sessionDevicesPath(s), { [DEVICE_ID]: mine });
            s.dev = true;
            store.set("gvh_session", JSON.stringify(s));
            st.style.color = "#34d399";
            st.textContent = "✓ Đã đăng xuất tất cả thiết bị khác!";
            loadDevicesInfo();
        } catch (e) {
            st.style.color = "#f87171";
            st.textContent = "❌ Lỗi: " + e.message;
        }
    }

    function unlockUI() {
        UNLOCKED = true;
        lockScreen.style.display = "none";
        btn.style.display = "flex";
    }

    async function verifyKey() {
        const rawKey = $("gvh-lock-input").value.trim();
        const errorEl = $("gvh-lock-error");

        if (!rawKey) {
            errorEl.style.color = "#f87171";
            errorEl.textContent = "⚠️ Vui lòng nhập mã Key!";
            return;
        }

        errorEl.style.color = "#38bdf8";
        errorEl.textContent = "🔄 Đang kiểm tra Key trực tuyến...";

        // Master key admin (thung8a2): tối đa 3 thiết bị
        try {
            if (await sha256(rawKey) === MASTER_HASH) {
                try {
                    errorEl.textContent = "🔄 Đang kiểm tra thiết bị...";
                    const claim = await claimAdminDevice();
                    if (!claim.ok) {
                        errorEl.style.color = "#f87171";
                        errorEl.textContent = `❌ Mật khẩu này đã đủ ${claim.limit}/${claim.limit} thiết bị! Hãy đăng xuất ở thiết bị khác.`;
                        return;
                    }
                } catch (e) {
                    errorEl.style.color = "#f87171";
                    errorEl.textContent = "❌ Lỗi Firebase khi kiểm tra thiết bị (kiểm tra Rules cho nhánh admin_devices)!";
                    return;
                }
                store.set("gvh_session", JSON.stringify({ type: "admin", dev: true }));
                location.reload();
                return;
            }
        } catch (e) {}

        const keyName = sanitizeKeyName(rawKey);
        try {
            const data = await fetchKeyData(keyName);
            if (!data || !data.expire_date) {
                errorEl.style.color = "#f87171";
                errorEl.textContent = "❌ Key không tồn tại hoặc không hợp lệ!";
                return;
            }

            const expireDate = new Date(data.expire_date);
            if (isNaN(expireDate.getTime())) {
                errorEl.style.color = "#f87171";
                errorEl.textContent = "❌ Key bị lỗi dữ liệu ngày hết hạn!";
                return;
            }

            if (new Date() >= expireDate) {
                errorEl.style.color = "#f87171";
                errorEl.textContent = `❌ Key này đã HẾT HẠN vào ngày ${expireDate.toLocaleDateString('vi-VN')}!`;
                return;
            }

            errorEl.style.color = "#38bdf8";
            errorEl.textContent = "🔄 Đang kiểm tra thiết bị...";
            const claim = await claimDevice(keyName, data);
            if (!claim.ok) {
                errorEl.style.color = "#f87171";
                errorEl.textContent = `❌ Key này đã đủ ${claim.limit}/${claim.limit} thiết bị! Hãy đăng xuất ở thiết bị khác hoặc liên hệ admin.`;
                return;
            }

            store.set("gvh_session", JSON.stringify({ type: "key", key: keyName, dev: true }));
            unlockUI();
            startSessionWatch();
            alert(`🔓 Mở khóa thành công!\nHạn sử dụng Key của bạn đến: ${expireDate.toLocaleDateString('vi-VN')} ${expireDate.toLocaleTimeString('vi-VN')}`);
        } catch (e) {
            errorEl.style.color = "#f87171";
            errorEl.textContent = "❌ Lỗi kết nối đến Firebase, thử lại sau!";
        }
    }

    if (UNLOCKED) {
        lockScreen.style.display = "none";
        btn.style.display = "flex";
        // Key thường: kiểm tra ngầm (xóa/hết hạn/bị đăng xuất từ xa), lặp lại mỗi 60 giây
        startSessionWatch();
    } else {
        lockScreen.style.display = "flex";
        btn.style.display = "none";
    }

    $("gvh-lock-btn").onclick = verifyKey;
    $("gvh-lock-input").addEventListener("keydown", e => { if (e.key === "Enter") verifyKey(); });
    const confirmLogout = () => {
        if (confirm("Đăng xuất khỏi thiết bị này? Bạn sẽ cần nhập lại Key.")) logout();
    };
    $("gvh-logout").onclick = confirmLogout;
    $("gvh-logout-others").onclick = logoutOtherDevices;
    $("gvh-logout-head").onclick = confirmLogout;

    // CÁC HÀM XỬ LÝ ADMIN KEY FIREBASE
    if (isAdmin) {
        $("gvh-admin-create-btn").onclick = () => {
            const keyName = sanitizeKeyName($("gvh-admin-keyname").value);
            const days = parseInt($("gvh-admin-days").value) || 30;
            const maxDev = getDeviceLimit(keyName, { max_devices: parseInt($("gvh-admin-maxdev").value) || DEFAULT_MAX_DEVICES });
            const statusEl = $("gvh-admin-status");

            if (!keyName) {
                statusEl.style.color = "#f87171";
                statusEl.textContent = "⚠️ Vui lòng nhập Tên Key!";
                return;
            }

            const expireDate = new Date();
            expireDate.setDate(expireDate.getDate() + days);

            gmx({
                method: "PUT",
                url: `${FIREBASE_URL}/keys/${encodeURIComponent(keyName)}.json`,
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify({
                    expire_date: expireDate.toISOString(),
                    created_at: new Date().toISOString(),
                    days_valid: days,
                    max_devices: maxDev
                }),
                onerror: function () {
                    statusEl.style.color = "#f87171";
                    statusEl.textContent = "❌ Lỗi mạng khi tạo Key!";
                },
                onload: function (res) {
                    if (res.status < 200 || res.status >= 300) {
                        statusEl.style.color = "#f87171";
                        statusEl.textContent = "❌ Không tạo được Key (kiểm tra Firebase Rules)!";
                        return;
                    }
                    statusEl.style.color = "#34d399";
                    statusEl.textContent = `✓ Đã tạo Key [${keyName}] thành công (${days} ngày, tối đa ${maxDev} thiết bị)!`;
                    $("gvh-admin-keyname").value = "";
                    loadKeyList();
                }
            });
        };

        function loadKeyList() {
            const container = $("gvh-admin-key-list");
            container.innerHTML = "Đang tải danh sách...";

            gmx({
                method: "GET",
                url: `${FIREBASE_URL}/keys.json`,
                onerror: function () { container.innerHTML = "<div style='color:#f87171;'>❌ Lỗi mạng, bấm Làm mới để thử lại.</div>"; },
                ontimeout: function () { container.innerHTML = "<div style='color:#f87171;'>❌ Quá thời gian chờ, bấm Làm mới để thử lại.</div>"; },
                onload: function (res) {
                    let data;
                    try { data = JSON.parse(res.responseText); } catch (e) { container.innerHTML = "<div style='color:#f87171;'>❌ Dữ liệu lỗi, thử lại.</div>"; return; }
                    if (!data) {
                        container.innerHTML = "<div style='color:#94a3b8;'>Chưa có Key nào được tạo.</div>";
                        return;
                    }

                    let html = "";
                    const now = new Date();

                    for (let k in data) {
                        const rec = data[k] || {};
                        const exp = new Date(rec.expire_date);
                        const isExpired = isNaN(exp.getTime()) || now > exp;
                        const used = rec.devices ? Object.keys(rec.devices).length : 0;
                        const limit = getDeviceLimit(k, rec);
                        const forced = !!FORCED_DEVICE_LIMITS[String(k).toLowerCase()];
                        html += `
                            <div style="background:rgba(15,23,42,0.6); padding:8px; border-radius:8px; margin-bottom:6px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                                    <div>
                                        <b style="color:${isExpired ? '#f87171' : '#38bdf8'};">${escapeHtml(k)}</b><br>
                                        <span style="color:#94a3b8; font-size:10px;">Hạn: ${isNaN(exp.getTime()) ? 'Lỗi ngày' : exp.toLocaleDateString('vi-VN')} (${isExpired ? 'Hết hạn' : 'Đang chạy'}) • 📱 ${used}/${limit}${forced ? ' 🔒' : ''} • 🏷 ${escapeHtml(keyVersions(rec))}</span>
                                    </div>
                                    <button class="gvh-del-key-btn" data-key="${escapeHtml(k)}" style="background:#ef4444; border:none; color:white; padding:4px 8px; border-radius:6px; cursor:pointer;">Xóa</button>
                                </div>
                                <div style="display:flex; gap:6px; margin-top:6px;">
                                    <button class="gvh-lim-key-btn" data-key="${escapeHtml(k)}" data-limit="${limit}" style="flex:1; background:#2563eb; border:none; color:white; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:11px;">⚙ Sửa giới hạn</button>
                                    <button class="gvh-kick-key-btn" data-key="${escapeHtml(k)}" style="flex:1; background:#f59e0b; border:none; color:white; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:11px;">📵 Đăng xuất hết</button>
                                </div>
                            </div>
                        `;
                    }
                    container.innerHTML = html;
                    renderVersionStats(data);

                    container.querySelectorAll(".gvh-del-key-btn").forEach(btnDel => {
                        btnDel.onclick = (e) => {
                            const keyToDelete = e.currentTarget.getAttribute("data-key");
                            if (confirm(`Bạn có chắc muốn xóa Key: ${keyToDelete}?`)) {
                                gmx({
                                    method: "DELETE",
                                    url: `${FIREBASE_URL}/keys/${encodeURIComponent(keyToDelete)}.json`,
                                    onload: function () { loadKeyList(); }
                                });
                            }
                        };
                    });

                    container.querySelectorAll(".gvh-lim-key-btn").forEach(btnLim => {
                        btnLim.onclick = (e) => {
                            const k = e.currentTarget.getAttribute("data-key");
                            const cur = e.currentTarget.getAttribute("data-limit");
                            const fixed = FORCED_DEVICE_LIMITS[String(k).toLowerCase()];
                            if (fixed) { alert(`Key ${k} luôn cố định tối đa ${fixed} thiết bị, không thể sửa.`); return; }
                            const v = prompt(`Số thiết bị tối đa cho Key "${k}":`, cur);
                            if (v === null) return;
                            const n = parseInt(v);
                            if (!(n >= 1 && n <= 100)) { alert("Số thiết bị phải từ 1 đến 100!"); return; }
                            fbRequest("PUT", `keys/${encodeURIComponent(k)}/max_devices`, n)
                                .then(loadKeyList)
                                .catch(() => alert("❌ Lỗi mạng khi sửa giới hạn!"));
                        };
                    });

                    container.querySelectorAll(".gvh-kick-key-btn").forEach(btnKick => {
                        btnKick.onclick = (e) => {
                            const k = e.currentTarget.getAttribute("data-key");
                            if (!confirm(`Đăng xuất TẤT CẢ thiết bị đang dùng Key "${k}"?`)) return;
                            fbRequest("DELETE", `keys/${encodeURIComponent(k)}/devices`)
                                .then(loadKeyList)
                                .catch(() => alert("❌ Lỗi mạng khi đăng xuất thiết bị!"));
                        };
                    });
                }
            });
        }

        $("gvh-admin-refresh-btn").onclick = loadKeyList;
    }

    // CHUYỂN TAB CƠ BẢN
    document.querySelectorAll(".gvh-tab-btn").forEach(btnTab => {
        btnTab.onclick = () => {
            document.querySelectorAll(".gvh-tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".gvh-tab-content").forEach(c => c.classList.remove("active"));
            btnTab.classList.add("active");
            const target = $(btnTab.dataset.tab);
            if (target) target.classList.add("active");
            if (btnTab.dataset.tab === "tab-notes") renderNotes();
            if (btnTab.dataset.tab === "tab-settings") loadDevicesInfo();
            if (btnTab.dataset.tab === "tab-admin" && isAdmin) loadKeyList();
        };
    });

    function renderNotes() {
        const container = $("gvh-notes-container");
        if (NOTES.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:#94a3b8; margin-top:50px; font-size:13.5px;">Chưa có ghi chú nào.<br>Hãy thêm công thức hoặc đáp án ở khung bên dưới nhé!</div>`;
            return;
        }

        container.innerHTML = NOTES.map((note, index) => `
            <div class="gvh-note-card" data-index="${index}">
                <div class="gvh-note-text">${note.pinned
                    ? escapeHtml(note.text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">$1</a>')
                    : escapeHtml(note.text)}</div>
                <div class="gvh-note-footer">
                    <span class="gvh-note-time">${escapeHtml(String(note.time))}</span>
                    <div class="gvh-note-actions">
                        <button class="gvh-copy-btn" data-index="${index}" title="Sao chép">📋 Copy</button>
                        ${note.pinned ? "" : `<button class="gvh-del-btn" data-index="${index}" title="Xóa">🗑 Xóa</button>`}
                    </div>
                </div>
            </div>
        `).join("");

        container.querySelectorAll(".gvh-copy-btn").forEach(btnCopy => {
            btnCopy.onclick = (e) => {
                const idx = e.currentTarget.getAttribute("data-index");
                navigator.clipboard.writeText(NOTES[idx].text);
                const status = $("gvh-status");
                status.textContent = "✓ Đã copy ghi chú vào clipboard!";
                setTimeout(() => status.textContent = "", 2000);
            };
        });

        container.querySelectorAll(".gvh-del-btn").forEach(btnDel => {
            btnDel.onclick = (e) => {
                const idx = e.currentTarget.getAttribute("data-index");
                NOTES.splice(idx, 1);
                localStorage.setItem("gvh_notes", JSON.stringify(NOTES));
                renderNotes();
                const status = $("gvh-status");
                status.textContent = "🗑 Đã xóa ghi chú!";
                setTimeout(() => status.textContent = "", 2000);
            };
        });
    }

    $("gvh-add-note-btn").onclick = () => {
        const text = $("gvh-new-note").value.trim();
        if (!text) return;
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')} - ${now.getDate()}/${now.getMonth()+1}`;
        const pinnedCount = NOTES.filter(n => n && n.pinned).length;
        NOTES.splice(pinnedCount, 0, { text, time: timeStr });
        localStorage.setItem("gvh_notes", JSON.stringify(NOTES));
        $("gvh-new-note").value = "";
        renderNotes();
    };

    function makeDraggable(element, handle) {
        let isDragging = false, hasMoved = false;
        let startX, startY, initialX, initialY;
        handle.style.touchAction = "none";

        handle.addEventListener("pointerdown", (e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            if (e.target.closest('button, select, input, textarea, #gvh-shortcut-recorder, .gvh-tab-btn, .gvh-tab-content')) return;

            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;

            const rect = element.getBoundingClientRect();
            const unscaledLeft = rect.left + (rect.width - element.offsetWidth) / 2;
            const unscaledTop = rect.top + (rect.height - element.offsetHeight) / 2;

            element.style.right = "auto";
            element.style.bottom = "auto";
            element.style.left = unscaledLeft + "px";
            element.style.top = unscaledTop + "px";

            initialX = unscaledLeft;
            initialY = unscaledTop;

            try { handle.setPointerCapture(e.pointerId); } catch (err) {}
        });

        handle.addEventListener("pointermove", (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
            element.style.left = (initialX + dx) + "px";
            element.style.top = (initialY + dy) + "px";
        });

        const endDrag = (e) => {
            isDragging = false;
            try { handle.releasePointerCapture(e.pointerId); } catch (err) {}
        };
        handle.addEventListener("pointerup", endDrag);
        handle.addEventListener("pointercancel", endDrag);

        return () => hasMoved;
    }

    const checkBtnMoved = makeDraggable(btn, btn);
    makeDraggable(panel, $("gvh-header"));

    function togglePanel() {
        if (!UNLOCKED) return;
        if (panel.classList.contains("gvh-show")) {
            panel.classList.remove("gvh-show");
            panel.classList.add("gvh-hide");
            setTimeout(() => {
                if (panel.classList.contains("gvh-hide")) panel.style.display = "none";
            }, 250);
        } else {
            const btnRect = btn.getBoundingClientRect();
            panel.style.display = "flex";
            const pw = panel.offsetWidth, ph = panel.offsetHeight;
            let targetLeft = btnRect.right - pw;
            let targetTop = btnRect.top - ph - 12;
            targetLeft = Math.max(8, Math.min(targetLeft, window.innerWidth - pw - 8));
            targetTop = Math.max(8, Math.min(targetTop, window.innerHeight - ph - 8));

            panel.style.left = targetLeft + "px";
            panel.style.top = targetTop + "px";
            panel.style.bottom = "auto";
            panel.style.right = "auto";

            panel.classList.remove("gvh-hide");
            void panel.offsetWidth;
            panel.classList.add("gvh-show");
        }
    }

    btn.onclick = () => {
        if (checkBtnMoved()) return;
        togglePanel();
    };

    document.addEventListener("keydown", (e) => {
        if (!UNLOCKED) return;
        if (recorder.classList.contains("recording")) return;

        let sc = TOGGLE_SHORTCUT;
        let matchCode = sc.code || "Space";
        let needCtrl = sc.ctrl !== undefined ? sc.ctrl : true;
        let needAlt = sc.alt || false;
        let needShift = sc.shift || false;

        if (e.code === matchCode && e.ctrlKey === needCtrl && e.altKey === needAlt && e.shiftKey === needShift) {
            e.preventDefault();
            togglePanel();
        }
    });

    function escapeHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    // ===== Chuyển LaTeX -> chữ dễ đọc (Unicode) để hiển thị đẹp trong khung chat =====
    const LATEX_SYMBOLS = {
        times: "×", cdot: "·", div: "÷", pm: "±", mp: "∓", le: "≤", leq: "≤", leqslant: "≤", ge: "≥", geq: "≥", geqslant: "≥",
        ne: "≠", neq: "≠", approx: "≈", equiv: "≡", sim: "∼", cong: "≅", propto: "∝", ll: "≪", gg: "≫",
        to: "→", rightarrow: "→", leftarrow: "←", longrightarrow: "⟶", longleftarrow: "⟵", mapsto: "↦",
        Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔", leftrightarrow: "↔", implies: "⇒", iff: "⇔",
        Longrightarrow: "⟹", Longleftrightarrow: "⟺", uparrow: "↑", downarrow: "↓",
        pi: "π", alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η",
        theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", rho: "ρ",
        sigma: "σ", tau: "τ", upsilon: "υ", varphi: "φ", phi: "φ", chi: "χ", psi: "ψ", omega: "ω",
        Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
        infty: "∞", circ: "°", degree: "°", angle: "góc ", measuredangle: "góc ", sphericalangle: "góc ",
        triangle: "△", square: "□", perp: "⊥", parallel: "∥", bot: "⊥",
        in: "∈", notin: "∉", ni: "∋", cup: "∪", cap: "∩", subset: "⊂", subseteq: "⊆", supset: "⊃", supseteq: "⊇",
        setminus: "∖", emptyset: "∅", varnothing: "∅", forall: "∀", exists: "∃", neg: "¬", lnot: "¬", land: "∧", lor: "∨",
        wedge: "∧", vee: "∨", because: "∵", therefore: "∴", partial: "∂", nabla: "∇", star: "★",
        sum: "∑", prod: "∏", int: "∫", oint: "∮", dots: "…", ldots: "…", cdots: "⋯", vdots: "⋮", ddots: "⋱",
        lt: "<", gt: ">", mid: "|", vert: "|", lvert: "|", rvert: "|", Vert: "‖", lVert: "‖", rVert: "‖",
        lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉", langle: "⟨", rangle: "⟩",
        quad: " ", qquad: "  ", newline: "\n", ell: "ℓ", hbar: "ħ", prime: "′",
        bmod: " mod ", mod: " mod "
    };
    const LATEX_REMOVE = /^(?:displaystyle|textstyle|scriptstyle|scriptscriptstyle|limits|nolimits|nonumber|notag|hline|noindent|centering|hfill|vfill|smallskip|medskip|bigskip|allowbreak|relax|strut|mathstrut|protect|middle)$/;
    const BB_MAP = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ", P: "ℙ", H: "ℍ" };
    const SUP_MAP = { "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","+":"⁺","-":"⁻","(":"⁽",")":"⁾","=":"⁼","n":"ⁿ","i":"ⁱ" };
    const SUB_MAP = { "0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉","+":"₊","-":"₋","(":"₍",")":"₎","=":"₌","a":"ₐ","e":"ₑ","h":"ₕ","i":"ᵢ","j":"ⱼ","k":"ₖ","l":"ₗ","m":"ₘ","n":"ₙ","o":"ₒ","p":"ₚ","r":"ᵣ","s":"ₛ","t":"ₜ","u":"ᵤ","v":"ᵥ","x":"ₓ" };
    // Ký tự { } thật do script tự sinh ra (cases, \{ \}) được giữ bằng mã tạm để không bị xóa nhầm
    const OB = "\u0007", CB = "\u0008", CELL_SEP = "\u2003";

    function mapScript(str, map, fallback) {
        let out = "";
        for (const ch of str) {
            if (!(ch in map)) return fallback + (str.length > 1 ? "(" + str + ")" : str);
            out += map[ch];
        }
        return out;
    }

    function readBraceGroup(s, i) {
        let depth = 0;
        for (let j = i; j < s.length; j++) {
            if (s[j] === "{") depth++;
            else if (s[j] === "}") { depth--; if (depth === 0) return [s.slice(i + 1, j), j + 1]; }
        }
        return null;
    }

    // Đọc 1 đối số LaTeX: {nhóm}, \lệnh, hoặc 1 ký tự (vd \frac12, \sqrt2)
    function readArg(s, i) {
        while (i < s.length && /\s/.test(s[i])) i++;
        if (i >= s.length) return null;
        if (s[i] === "{") return readBraceGroup(s, i);
        if (s[i] === "\\") { const m = /^\\(?:[A-Za-z]+|.)/.exec(s.slice(i)); return m ? [m[0], i + m[0].length] : null; }
        return [s[i], i + 1];
    }

    // Thay \tên[opt]{a}{b}... bằng fn(args, opt). Chịu được ngoặc lồng nhau, thiếu đối số thì bỏ lệnh.
    function replaceCmd(s, names, n, fn, allowOpt) {
        const re = new RegExp("\\\\(?:" + names + ")(?![A-Za-z])");
        for (let g = 0; g < 80; g++) {
            const m = re.exec(s);
            if (!m) break;
            let i = m.index + m[0].length, opt = null;
            if (allowOpt) {
                let k = i; while (k < s.length && /[ \t]/.test(s[k])) k++;
                if (s[k] === "[") { const j = s.indexOf("]", k); if (j > 0) { opt = s.slice(k + 1, j); i = j + 1; } }
            }
            const args = [];
            for (let a = 0; a < n; a++) {
                const r = readArg(s, i);
                if (!r) break;
                args.push(r[0]); i = r[1];
            }
            if (args.length < n) { s = s.slice(0, m.index) + s.slice(m.index + m[0].length); continue; }
            s = s.slice(0, m.index) + fn(args, opt) + s.slice(i);
        }
        return s;
    }

    // \begin{cases|matrix|aligned|array...}...\end{...} -> nhiều dòng chữ
    function envToText(name, body) {
        const base = name.replace(/\*$/, "");
        if (/^(?:array|tabular|tabularx)$/.test(base)) body = body.replace(/^\s*\{[^{}]*\}/, "");
        body = body.replace(/\\(?:hline|midrule|toprule|bottomrule)/g, "");
        const rows = body.split(/\\\\(?:\s*\[[^\]]*\])?/).map(r => r.trim()).filter(Boolean)
            .map(r => r.split("&").map(c => L(c, true).trim()));
        const brackets = { pmatrix: ["(", ")"], bmatrix: ["[", "]"], Bmatrix: [OB, CB], vmatrix: ["|", "|"], Vmatrix: ["‖", "‖"] };
        if (base === "cases" || base === "dcases") return rows.map(r => OB + " " + r.join(CELL_SEP)).join("\n");
        if (brackets[base]) return rows.map(r => brackets[base][0] + " " + r.join(CELL_SEP) + " " + brackets[base][1]).join("\n");
        if (/^(?:matrix|smallmatrix)$/.test(base)) return rows.map(r => r.join(CELL_SEP)).join("\n");
        if (/^(?:array|tabular|tabularx)$/.test(base)) return rows.map(r => r.join(" | ")).join("\n");
        return rows.map(r => r.join(" ")).join("\n"); // aligned, align, gather, split, equation...
    }

    function convertEnvs(s) {
        // Xử lý môi trường trong cùng trước (cases lồng trong aligned...)
        const re = /\\begin\{([A-Za-z]+\*?)\}((?:(?!\\begin\{)[\s\S])*?)\\end\{\1\}/;
        for (let g = 0; g < 40; g++) {
            const m = re.exec(s);
            if (!m) break;
            s = s.slice(0, m.index) + envToText(m[1], m[2]) + s.slice(m.index + m[0].length);
        }
        return s.replace(/\\(?:begin|end)\s*\{[^{}]*\}(?:\s*\{[^{}]*\})?/g, "");
    }

    function L(s, math) {
        // --- dọn lệnh co giãn ngoặc ---
        s = s.replace(/\\(?:left|right)\s*\./g, "");
        s = s.replace(/\\(?:left|right|bigl|bigr|Bigl|Bigr|biggl|biggr|Biggl|Biggr|bigg|Bigg|big|Big)(?![A-Za-z])\s*/g, "");
        s = convertEnvs(s);

        // --- màu, khoảng trắng, nhãn: bỏ hẳn ---
        s = s.replace(/\\(?:textcolor|colorbox)\s*\{[^{}]*\}\s*/g, "\\text");
        s = s.replace(/\\(?:color|hspace\*?|vspace\*?|phantom|hphantom|vphantom|label|tag|ref|eqref)\s*\{[^{}]*\}/g, "");
        s = s.replace(/\\not\s*=/g, "≠").replace(/\\not\s*\\in(?![A-Za-z])/g, "∉").replace(/\\not(?![A-Za-z])/g, "");
        s = s.replace(/\\pmod\s*\{([^{}]*)\}/g, " (mod $1)");

        // --- kiểu chữ: bỏ lệnh, giữ nội dung ---
        s = replaceCmd(s, "mathbb", 1, a => { const t = a[0].trim(); return BB_MAP[t] || L(t, false); });
        s = replaceCmd(s, "text|textbf|textit|textrm|textsf|texttt|textnormal|mathbf|mathrm|mathit|mathsf|mathtt|mathcal|mathscr|mathfrak|operatorname|mbox|boldsymbol|bm|pmb|emph|overline|underline|bar|cancel|bcancel|xcancel|sout|underbrace|overbrace", 1, a => L(a[0], false));
        s = replaceCmd(s, "boxed", 1, a => "[" + L(a[0], false) + "]");

        // --- hình học ---
        s = s.replace(/\\(?:widehat|hat)\s*\{([^{}]*)\}/g, (m, c, off, str) => (/[Gg]óc\s*\$?\s*$/.test(str.slice(Math.max(0, off - 8), off)) ? c : "góc " + c));
        s = s.replace(/\\(?:overrightarrow|overleftrightarrow|vec)\s*\{([^{}]*)\}/g, "vectơ $1");

        // --- phân số, tổ hợp, căn ---
        const wrap = x => /^[\p{L}\p{N}.,°×₀-₉⁰-⁹]+$/u.test(x) ? x : "(" + x + ")";
        s = replaceCmd(s, "dfrac|tfrac|cfrac|frac", 2, a => wrap(L(a[0], math)) + "/" + wrap(L(a[1], math)));
        s = replaceCmd(s, "dbinom|tbinom|binom", 2, a => "C(" + L(a[0], math) + ", " + L(a[1], math) + ")");
        s = replaceCmd(s, "overset|underset|stackrel", 2, a => L(a[1], false));
        s = replaceCmd(s, "xrightarrow|xleftarrow", 1, a => "→(" + L(a[0], false) + ")");
        s = replaceCmd(s, "sqrt", 1, (a, opt) => {
            const t = L(a[0], math);
            return (opt ? mapScript(opt.trim(), SUP_MAP, "^") : "") + "√" + (/^[\p{L}\p{N}.]+$/u.test(t) ? t : "(" + t + ")");
        }, true);

        // --- ký hiệu còn lại ---
        s = s.replace(/\\\\(?=\S)/g, math ? "\n" : "\\\\");
        s = s.replace(/\\([A-Za-z]+)/g, (m, w) => (w in LATEX_SYMBOLS) ? LATEX_SYMBOLS[w] : (LATEX_REMOVE.test(w) ? "" : w));
        s = s.replace(/\\\|/g, "‖").replace(/\\[,;:! ]/g, " ").replace(/\\([{}%_&#$])/g, (m, c) => c === "{" ? OB : c === "}" ? CB : c);

        if (math) {
            s = s.replace(/\^\s*\{?\s*°\s*\}?/g, "°");
            s = s.replace(/\^\s*\{([^{}]*)\}|\^\s*([A-Za-z0-9+\-])/g, (m, a, b) => mapScript(a !== undefined ? a : b, SUP_MAP, "^"));
            s = s.replace(/_\s*\{([^{}]*)\}|_\s*([A-Za-z0-9])/g, (m, a, b) => mapScript(a !== undefined ? a : b, SUB_MAP, "_"));
            s = s.replace(/\\\\/g, "\n").replace(/&/g, " ").replace(/[{}]/g, "");
            s = s.replace(/[ \t]{2,}/g, " ").replace(/ *\n */g, "\n").trim();
        }
        return s;
    }

    function latexToText(s, math) {
        // \{ và \} (dấu ngoặc nhọn thật) cần giữ lại, khác với { } của nhóm LaTeX
        s = s.replace(/\\\{/g, OB).replace(/\\\}/g, CB);
        return L(s, math).split(OB).join("{").split(CB).join("}");
    }

    function formatMessageTextCore(text) {
        let raw = String(text);
        const stash = [];
        const keep = html => { stash.push(html); return "\u0001" + (stash.length - 1) + "\u0002"; };
        const keepBlock = html => { stash.push(html); return "\u0001B" + (stash.length - 1) + "\u0002"; };
        const blockStyle = "background:rgba(15,23,42,0.7); padding:10px; margin:8px 0; border-radius:10px; color:#7dd3fc; border:1px solid rgba(255,255,255,0.08); overflow-x:auto; max-width:100%; box-sizing:border-box;";
        const inlineStyle = "background:rgba(15,23,42,0.7); padding:2px 6px; border-radius:6px; color:#7dd3fc; border:1px solid rgba(255,255,255,0.08);";
        const mathBlockHtml = c => `<div style="${blockStyle}">${escapeHtml(latexToText(c, true).replace(/^\n+|\n+$/g, ""))}</div>`;
        const block = (m, c) => keepBlock(mathBlockHtml(c));
        const inline = (m, c) => keep(`<span style="${inlineStyle}">${escapeHtml(latexToText(c, true))}</span>`);

        raw = raw.replace(/\\\$/g, "\u0004"); // \$ = ký tự đô la thật

        // Khối code ```...``` (giữ nguyên, cuộn ngang; chỉ đổi LaTeX khi gắn nhãn latex/tex/math)
        raw = raw.replace(/```([A-Za-z0-9_+-]*)[ \t]*\n?([\s\S]*?)```/g, (m, lang, code) => {
            code = code.replace(/\n$/, "");
            if (/^(?:latex|tex|math)$/i.test(lang)) code = latexToText(code, true);
            return keepBlock(`<pre style="${blockStyle} white-space:pre; font-family:monospace;">${escapeHtml(code)}</pre>`);
        });

        raw = raw.replace(/\$\$([\s\S]*?)\$\$/g, block);
        raw = raw.replace(/\\\[([\s\S]*?)\\\]/g, block);
        raw = raw.replace(/\\\(([\s\S]*?)\\\)/g, inline);
        raw = raw.replace(/\$([^\$\n]+?)\$/g, (m, c) => (/^\s|\s$/.test(c) ? m : inline(m, c))); // "5$ và 6$" không bị coi là công thức
        raw = raw.replace(/\\begin\{([A-Za-z]+\*?)\}[\s\S]*?\\end\{\1\}/g, m => keepBlock(mathBlockHtml(m))); // cases/ma trận không có $$
        raw = raw.replace(/`([^`\n]+)`/g, (m, c) => keep(`<span style="font-family:monospace; ${inlineStyle}">${escapeHtml(latexToText(c, /\\/.test(c)))}</span>`));

        // Bảng markdown | a | b |
        const cellsOf = line => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
        const fmtCell = c => escapeHtml(c).replace(/&lt;br\s*\/?&gt;/gi, " ").replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
        const lines = raw.split("\n"), outLines = [];
        for (let i = 0; i < lines.length;) {
            if (/^\s*\|.*\|\s*$/.test(lines[i]) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
                const head = cellsOf(lines[i]); i += 2;
                const body = [];
                while (i < lines.length && lines[i].includes("|") && lines[i].trim()) body.push(cellsOf(lines[i++]));
                const th = "border:1px solid rgba(255,255,255,0.18); padding:5px 9px; background:rgba(255,255,255,0.08); color:#fff; text-align:left;";
                const td = "border:1px solid rgba(255,255,255,0.12); padding:5px 9px;";
                outLines.push(keepBlock(`<div style="overflow-x:auto; max-width:100%; margin:8px 0;"><table style="border-collapse:collapse; white-space:normal; font-size:0.95em;"><tr>${head.map(c => `<th style="${th}">${fmtCell(c)}</th>`).join("")}</tr>${body.map(r => `<tr>${r.map(c => `<td style="${td}">${fmtCell(c)}</td>`).join("")}</tr>`).join("")}</table></div>`));
            } else outLines.push(lines[i++]);
        }
        raw = outLines.join("\n");

        raw = latexToText(raw, false); // LaTeX lẻ nằm ngoài $...$

        let clean = escapeHtml(raw);
        clean = clean.replace(/&lt;br\s*\/?&gt;/gi, "\n");
        clean = clean.replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '<span style="display:block; border-top:1px solid rgba(255,255,255,0.18); margin:8px 0;"></span>');
        clean = clean.replace(/^&gt;\s?(.*)$/gm, '<span style="display:block; border-left:3px solid rgba(255,255,255,0.28); padding-left:10px; color:#cbd5e1;">$1</span>');
        clean = clean.replace(/^(\s*)[*\-]\s+/gm, "$1• ");
        clean = clean.replace(/^#{1,6}\s+(.*)$/gm, '<b style="color:#fff;">$1</b>');
        clean = clean.replace(/\*\*(.*?)\*\*/g, '<b style="color: #fff; font-weight: 700;">$1</b>');
        clean = clean.replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?![*\w])/g, "$1<i>$2</i>");
        clean = clean.replace(/\n?(\u0001B\d+\u0002)\n?/g, "$1"); // khối riêng: bỏ dòng trống thừa xung quanh
        for (let k = 0; k < 4 && /\u0001B?\d+\u0002/.test(clean); k++) {
            clean = clean.replace(/\u0001B?(\d+)\u0002/g, (m, i) => stash[+i]);
        }
        clean = clean.replace(/([Gg]óc\s*(?:<span[^>]*>)?\s*)góc\s/g, "$1"); // tránh "góc góc"
        return clean.replace(/\u0004/g, "$");
    }

    // Luôn hiển thị được: nếu bộ chuyển đổi gặp lỗi bất ngờ thì in nguyên văn bản gốc
    function formatMessageText(text) {
        try { return formatMessageTextCore(text); }
        catch (e) { console.error("[gvh] render error:", e); return escapeHtml(String(text)); }
    }

    function addMessage(text, type = "ai") {
        const div = document.createElement("div");
        div.className = "gvh-msg " + (type === "user" ? "gvh-user" : type === "error" ? "gvh-error" : "gvh-ai");
        if (type === "user" || type === "error") div.textContent = text;
        else div.innerHTML = formatMessageText(text);
        $("gvh-messages").appendChild(div);
        $("gvh-messages").scrollTop = $("gvh-messages").scrollHeight;
        return div;
    }

    function requestGemini(prompt, useSearch, image = null, model = MODEL, onRetry = null, opts = {}) {
        return new Promise((resolve, reject) => {
            const systemInstruction = "Bạn là một trợ lý thông minh chuyên giải toán VioEdu và Violympic. QUY TẮC BẮT BUỘC: KHÔNG BAO GIỜ sử dụng các lệnh LaTeX phức tạp như \\mathbf, \\widehat hay \\left/\\right trong câu trả lời. Đối với hình học, hãy viết dạng văn bản đơn giản (ví dụ: góc C2, góc A, góc B). Trình bày ngắn gọn, rõ ràng, luôn in đậm kết quả cuối cùng để học sinh điền ngay. Viết công thức bằng chữ thường/ký hiệu Unicode, KHÔNG dùng LaTeX và KHÔNG dùng dấu $ (ví dụ viết S/72, 5 × 3, x², √2 thay vì \\frac, \\times, ^2, \\sqrt).";

            let parts = [
                { text: prompt }
            ];

            const imgList = opts.images || (image ? [image] : []);
            imgList.forEach(im => {
                if (im?.data && im?.mime_type) parts.push({ inline_data: { mime_type: im.mime_type, data: im.data } });
            });

            const body = {
                systemInstruction: { parts: [{ text: opts.system || systemInstruction }] },
                contents: [
                    { role: "user", parts: parts }
                ]
            };
            if (opts.temperature !== undefined) body.generationConfig = { temperature: opts.temperature };
            if (useSearch) body.tools = [{ google_search: {} }];

            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

            gmx({
                method: "POST",
                url: API_URL,
                headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
                data: JSON.stringify(body),
                timeout: 60000,
                onload(response) {
                    let data;
                    try {
                        data = JSON.parse(response.responseText);
                    } catch {
                        reject(new Error("Phản hồi JSON lỗi từ hệ thống."));
                        return;
                    }

                    if (response.status < 200 || response.status >= 300) {
                        let errMessage = data?.error?.message || `Lỗi HTTP: ${response.status}`;
                        let err;
                        if (errMessage.toLowerCase().includes("rate limit") || errMessage.toLowerCase().includes("quota") || response.status === 429) {
                            err = new Error("API Key đã hết hạn mức hoặc vượt quá số lần sử dụng hàng ngày! Hãy đổi sang Flash Lite nhé.");
                        } else if (response.status === 503 || response.status === 500) {
                            err = new Error("Máy chủ Gemini đang quá tải, hãy thử lại sau ít giây.");
                            err.overloaded = true;
                        } else {
                            err = new Error(errMessage);
                        }
                        reject(err);
                        return;
                    }
                    resolve(data);
                },
                onerror() { const e = new Error("Lỗi mạng kết nối Gemini API."); e.overloaded = true; reject(e); },
                ontimeout() { const e = new Error("Quá thời gian chờ phản hồi từ hệ thống."); e.overloaded = true; reject(e); }
            }, { retries: 2, baseDelay: 1500, timeout: 60000, onRetry });
        });
    }

    const FALLBACK_MODEL = "gemini-3.5-flash-lite";

    function extractOutput(data) {
        try {
            if (data?.candidates?.[0]?.content?.parts) {
                let text = "";
                for (const part of data.candidates[0].content.parts) {
                    if (part.text) text += part.text;
                }
                return text.trim();
            }
        } catch (e) {
            console.error(e);
        }
        return "";
    }

    async function testAPI() {
        if (!API_KEY) throw new Error("Chưa nhập API key.");
        const statusEl = $("gvh-api-status");
        statusEl.style.color = "#38bdf8";
        statusEl.textContent = "🔄 Đang kiểm tra kết nối với Gemini...";
        const data = await requestGemini("Trả lời từ: OK", false);
        const text = extractOutput(data);
        if (!text) throw new Error("API không hợp lệ hoặc sai Key.");
        return text;
    }

    function selectedText() { return window.getSelection().toString().trim(); }

    let pastedImage = null;
    function clearPastedImage() {
        pastedImage = null;
        const preview = $("gvh-image-preview"), image = $("gvh-image"), name = $("gvh-image-name");
        if (preview) preview.style.display = "none";
        if (image) image.removeAttribute("src");
        if (name) name.textContent = "";
    }

    function setPastedImage(file) {
        if (!file || !file.type.startsWith("image/")) return false;
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || ""), comma = result.indexOf(",");
            if (comma < 0) return;
            pastedImage = { data: result.slice(comma + 1), mime_type: file.type, name: file.name || "Ảnh tải lên" };
            $("gvh-image").src = result;
            $("gvh-image-name").textContent = "🖼️ " + pastedImage.name;
            $("gvh-image-preview").style.display = "block";
            $("gvh-status").textContent = "🖼️ Đã đính kèm ảnh — Bấm 🤖 Giải bài";
        };
        reader.readAsDataURL(file);
        return true;
    }

    $("gvh-question").addEventListener("paste", event => {
        const items = event.clipboardData?.items;
        if (!items) return;
        for (const item of items) { if (item.kind === "file" && item.type.startsWith("image/")) { event.preventDefault(); setPastedImage(item.getAsFile()); } }
    });

    $("gvh-remove-image").onclick = () => clearPastedImage();
    // Bấm vào ảnh xem trước để mở ảnh thật trong tab mới (kiểm tra ảnh chụp có đúng không)
    $("gvh-image").onclick = async () => {
        try {
            const src = $("gvh-image").src;
            if (!src) return;
            const blob = await (await fetch(src)).blob();
            window.open(URL.createObjectURL(blob), "_blank");
        } catch (e) {}
    };

    async function ask(prompt, useSearch = false, image = null) {
        if (!API_KEY) { addMessage("❌ Vui lòng nhập API Key trong phần tab '🔑 API Key'.", "error"); return; }
        addMessage(prompt, "user");
        const loading = addMessage(useSearch ? "🔎 Đang tìm kiếm thông tin web..." : "✨ Đang phân tích...");
        $("gvh-status").textContent = "Đang xử lý...";
        const setLoading = (t) => { try { loading.textContent = t; } catch (e) {} };
        const onRetry = (n, max) => setLoading(`⏳ Kết nối chậm, đang thử lại (${n}/${max})...`);
        try {
            let data;
            try {
                data = await requestGemini(prompt, useSearch, image, MODEL, onRetry);
            } catch (e1) {
                // Model đang chọn bị quá tải/lag liên tục => tự chuyển sang model dự phòng (nhẹ, ít bị nghẽn)
                if (e1.overloaded && MODEL !== FALLBACK_MODEL) {
                    setLoading(`🔁 ${MODEL} đang bận, chuyển sang ${FALLBACK_MODEL}...`);
                    data = await requestGemini(prompt, useSearch, image, FALLBACK_MODEL, onRetry);
                } else throw e1;
            }
            const answer = extractOutput(data);
            loading.remove();
            if (!answer) addMessage("❌ Phản hồi trống.", "error");
            else addMessage(answer, "ai");
            $("gvh-status").textContent = "✓ Hoàn tất";
        } catch (error) {
            loading.remove();
            addMessage("❌ " + error.message, "error");
            $("gvh-status").textContent = "Lỗi kết nối";
        }
    }

    // ===== OCR: đọc chữ + công thức trong ảnh bằng Gemini Vision =====
    // Luồng: quét chữ trong trang (miễn phí) -> nếu đề có ảnh / công thức dạng ảnh / không có chữ => chụp vùng đề (hoặc lấy từng ảnh) -> Gemini chép lại.
    const OCR_SYSTEM = "Bạn là công cụ OCR chính xác cho đề toán và bài tập tiếng Việt. Chỉ chép lại nội dung nhìn thấy trong ảnh. Tuyệt đối không giải bài, không bình luận, không thêm lời dẫn hay kết luận.";
    const OCR_PROMPT = "Hãy chép lại CHÍNH XÁC toàn bộ đề bài trong ảnh, đúng thứ tự từ trên xuống dưới: đề, số liệu, công thức và các phương án A, B, C, D (nếu có). Công thức viết dạng chữ dễ đọc (a/b, x², √x, ×, ≤, ≥, π). Với bảng thì chép theo từng hàng; với hình vẽ thì mô tả rất ngắn trong dấu [ ] (ví dụ: [hình tam giác ABC, góc A = 90°]). Bỏ qua menu, nút bấm, đồng hồ, điểm số. KHÔNG giải bài.";
    const OCR_CACHE = new Map();
    const IMG_SKIP = /icon|logo|avatar|sprite|emoji|button|loading|spinner|badge|banner|star|medal|coin|crown/i;
    let ocrBusy = false;

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // Canvas -> JPEG base64 (nền trắng, thu nhỏ còn tối đa maxSide để gửi nhanh, đỡ lag)
    function canvasToImage(canvas, maxSide = 1800, bg = [255, 255, 255, 1]) {
        const m = Math.max(canvas.width, canvas.height) || 1;
        const k = m > maxSide ? maxSide / m : 1;
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(canvas.width * k));
        c.height = Math.max(1, Math.round(canvas.height * k));
        const g = c.getContext("2d");
        g.fillStyle = `rgb(${Math.round(bg[0])},${Math.round(bg[1])},${Math.round(bg[2])})`; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(canvas, 0, 0, c.width, c.height);
        const url = c.toDataURL("image/jpeg", 0.92);
        return { data: url.split(",")[1], mime_type: "image/jpeg" };
    }

    function drawableToCanvas(el, w, h) {
        const c = document.createElement("canvas");
        c.width = w || 300; c.height = h || 150;
        const g = c.getContext("2d");
        g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(el, 0, 0, c.width, c.height);
        c.getContext("2d").getImageData(0, 0, 1, 1); // ném lỗi nếu canvas bị "tainted" (ảnh khác nguồn)
        return c;
    }

    function blobToCanvas(blob) {
        return new Promise((resolve, reject) => {
            const u = URL.createObjectURL(blob), im = new Image();
            im.onload = () => { try { resolve(drawableToCanvas(im, im.naturalWidth || 400, im.naturalHeight || 200)); } catch (e) { reject(e); } finally { URL.revokeObjectURL(u); } };
            im.onerror = () => { URL.revokeObjectURL(u); reject(new Error("decode")); };
            im.src = u;
        });
    }

    function fetchBlobGM(url) {
        return new Promise((resolve, reject) => {
            gmx({
                method: "GET", url, responseType: "blob", timeout: 15000,
                onload: r => (r.status >= 200 && r.status < 300 && r.response) ? resolve(r.response) : reject(new Error("HTTP " + r.status)),
                onerror: () => reject(new Error("net")),
                ontimeout: () => reject(new Error("timeout"))
            }, { retries: 1 });
        });
    }

    // Lấy 1 thẻ <img> thành canvas: thử vẽ trực tiếp -> fetch -> GM_xmlhttpRequest (vượt CORS)
    async function imageElementToCanvas(img) {
        try { if (img.complete && img.naturalWidth) return drawableToCanvas(img, img.naturalWidth, img.naturalHeight); } catch (e) {}
        const src = img.currentSrc || img.src;
        if (!src) throw new Error("no src");
        let blob;
        try { blob = await (await fetch(src)).blob(); }
        catch (e) { blob = await fetchBlobGM(src); }
        return blobToCanvas(blob);
    }

    // ===== CHỤP MÀN HÌNH THÔNG MINH: hết ảnh trắng / chữ trắng trên nền trắng =====
    // Nguyên nhân thường gặp: vùng đề trong suốt (nền thật nằm ở thẻ cha hoặc ảnh nền) nên chữ trắng biến mất,
    // chữ gradient (background-clip:text), hiệu ứng mờ dần chưa xong, hoặc đề nằm trong iframe khác nguồn.
    const GVH_DARK = [15, 23, 42, 1], GVH_LIGHT = [255, 255, 255, 1];

    function parseColor(str) {
        str = String(str || "");
        let m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/.exec(str);
        let k = 1;
        if (!m) { m = /color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/.exec(str); k = 255; }
        if (!m) return null;
        const a = m[4] === undefined ? 1 : (String(m[4]).endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
        return [m[1] * k, m[2] * k, m[3] * k, a];
    }
    const colorLum = c => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
    const colorCss = c => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

    // Màu nền thật: đi ngược lên các thẻ cha tìm nền đặc đầu tiên
    function effectiveBackground(node) {
        let hasImage = false;
        for (let el = node; el && el.nodeType === 1; el = el.parentElement) {
            const cs = getComputedStyle(el);
            if (cs.backgroundImage && cs.backgroundImage !== "none") hasImage = true;
            const c = parseColor(cs.backgroundColor);
            if (c && c[3] >= 0.9) return { color: c, hasImage };
        }
        return { color: null, hasImage };
    }

    // Độ sáng trung bình của chữ trong vùng đề (0 = đen, 1 = trắng)
    function avgTextLuminance(node) {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
            acceptNode: n => (n.nodeValue || "").trim().length > 1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        });
        let sum = 0, n = 0, t;
        while ((t = walker.nextNode()) && n < 80) {
            const el = t.parentElement;
            if (!el || el.closest("#gvh-panel, #gvh-button")) continue;
            const cs = getComputedStyle(el);
            const fill = parseColor(cs.webkitTextFillColor);
            const c = (fill && fill[3] > 0.1) ? fill : parseColor(cs.color);
            if (!c || c[3] < 0.1) continue;
            sum += colorLum(c); n++;
        }
        return n ? sum / n : null;
    }

    // Trả về [nền ưu tiên, nền dự phòng (tương phản ngược lại)]
    function planBackgrounds(node) {
        const { color, hasImage } = effectiveBackground(node);
        const t = avgTextLuminance(node);
        let primary;
        if (color && !(hasImage && t !== null && Math.abs(colorLum(color) - t) < 0.35)) primary = color;
        else if (t !== null) primary = t > 0.6 ? GVH_DARK : GVH_LIGHT;
        else primary = color || GVH_LIGHT;
        return [primary, colorLum(primary) > 0.5 ? GVH_DARK : GVH_LIGHT];
    }

    // Ảnh gần như 1 màu (trắng xóa / đen xì) => coi là chụp hỏng
    function canvasLooksBlank(canvas) {
        try {
            const k = Math.min(1, 400 / Math.max(canvas.width, canvas.height, 1));
            const w = Math.max(8, Math.round(canvas.width * k)), h = Math.max(8, Math.round(canvas.height * k));
            const s = document.createElement("canvas"); s.width = w; s.height = h;
            const g = s.getContext("2d", { willReadFrequently: true });
            g.imageSmoothingEnabled = false;
            g.drawImage(canvas, 0, 0, w, h);
            const d = g.getImageData(0, 0, w, h).data;
            const freq = new Map();
            for (let i = 0; i < d.length; i += 28) {
                const key = (d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4);
                freq.set(key, (freq.get(key) || 0) + 1);
            }
            let best = 0, bestKey = 0;
            freq.forEach((v, key) => { if (v > best) { best = v; bestKey = key; } });
            const br = (bestKey >> 8) << 4, bg = ((bestKey >> 4) & 15) << 4, bb = (bestKey & 15) << 4;
            let diff = 0;
            for (let i = 0; i < d.length; i += 4) {
                if (Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg) + Math.abs(d[i + 2] - bb) > 70) diff++;
            }
            return diff / (w * h) < 0.0015;
        } catch (e) { return false; }
    }

    // Sửa bản sao trang trước khi vẽ: tắt hiệu ứng, chữ gradient/trong suốt => chữ đặc dễ đọc
    function fixClonedDoc(clonedDoc, bg) {
        const st = clonedDoc.createElement("style");
        st.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;mix-blend-mode:normal!important;caret-color:transparent!important;}";
        (clonedDoc.head || clonedDoc.documentElement).appendChild(st);
        const win = clonedDoc.defaultView;
        if (!win) return;
        const fallbackText = colorLum(bg) > 0.5 ? "#111827" : "#f8fafc";
        const els = clonedDoc.querySelectorAll("body *");
        for (let i = 0; i < els.length && i < 3000; i++) {
            const el = els[i], cs = win.getComputedStyle(el);
            const clip = cs.webkitBackgroundClip || cs.backgroundClip;
            const fill = parseColor(cs.webkitTextFillColor);
            if (clip === "text" || (fill && fill[3] === 0 && (el.textContent || "").trim())) {
                el.style.setProperty("background", "none", "important");
                el.style.setProperty("-webkit-text-fill-color", fallbackText, "important");
                el.style.setProperty("color", fallbackText, "important");
            }
        }
    }

    // Đề nằm trong iframe khác nguồn thì html2canvas không thấy được => phải chụp thẳng màn hình
    function needsScreenCapture(node) {
        const root = node === document.body || node === document.documentElement;
        const nr = node.getBoundingClientRect();
        const area = root ? window.innerWidth * window.innerHeight : Math.max(1, nr.width * nr.height);
        const frames = node.tagName === "IFRAME" ? [node] : [...node.querySelectorAll("iframe")];
        for (const f of frames) {
            let ok = true;
            try { ok = !!(f.contentDocument && f.contentDocument.body); } catch (e) { ok = false; }
            if (ok) continue;
            const r = f.getBoundingClientRect();
            const w = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
            const h = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
            if (w > 0 && h > 0 && (w * h) / area > 0.25) return true;
        }
        return false;
    }

    // Cách 1: html2canvas (thử nhiều chế độ, tự kiểm tra ảnh trắng)
        // Cách 1: html2canvas (thử nhiều chế độ, tự kiểm tra ảnh trắng)
    async function html2canvasSmart(node, onStatus) {
        if (typeof html2canvas === "undefined") throw new Error("Thư viện html2canvas chưa tải xong");
        const root = node === document.documentElement || node === document.body;
        const sx = window.scrollX || window.pageXOffset || 0, sy = window.scrollY || window.pageYOffset || 0;
        let rx, ry, rw, rh;
        if (root) { rx = sx; ry = sy; rw = window.innerWidth; rh = window.innerHeight; }
        else {
            const r = node.getBoundingClientRect();
            rx = Math.max(0, Math.floor(r.left + sx)); ry = Math.max(0, Math.floor(r.top + sy));
            rw = Math.max(60, Math.ceil(r.width)); rh = Math.max(60, Math.ceil(r.height));
        }
        const [bgA, bgB] = planBackgrounds(root ? document.body : node);
        const attempts = [
            { fo: false, bg: bgA, label: "html2canvas" },
            { fo: true, bg: bgA, label: "foreignObject" },
            { fo: false, bg: bgB, label: "nền đảo màu" }
        ];
        if (document.fonts && document.fonts.ready) { try { await Promise.race([document.fonts.ready, sleep(1500)]); } catch (e) {} }
        await sleep(250);
        const scale = Math.max(0.5, Math.min(2, 2000 / Math.max(rw, rh), 4000 / rw, 8000 / rh));
        let lastErr = null;
        for (const at of attempts) {
            try {
                const canvas = await html2canvas(document.documentElement, {
                    useCORS: true, allowTaint: false, logging: false,
                    backgroundColor: colorCss(at.bg), foreignObjectRendering: at.fo,
                    scale, x: rx, y: ry, width: rw, height: rh,
                    ignoreElements: el => el.id === "gvh-panel" || el.id === "gvh-button" || el.id === "gvh-lock-screen",
                    onclone: d => { try { fixClonedDoc(d, at.bg); } catch (e) {} }
                });
                if (!canvasLooksBlank(canvas)) return { canvas, bg: at.bg, method: at.label };
                lastErr = new Error("Ảnh chụp bị trắng");
            } catch (e) {
                lastErr = e;
                console.warn("[gvh] chụp (" + at.label + ") lỗi:", e);
            }
            if (onStatus) onStatus("🔁 Ảnh chụp chưa đạt, đang thử cách khác...");
        }
        throw lastErr || new Error("Không chụp được vùng đề");
    }

    // ===== TỰ ĐỘNG TÌM VÙNG NỘI DUNG BÀI TẬP LỚN NHẤT =====
    function findMainContentArea() {
        const selectors = [
            "main", "[role='main']",
            ".question-content", ".exam-content", ".test-content", ".lesson-content",
            ".content-wrapper", ".main-content", ".page-content", ".exercise-content",
            "#content", "#main", "#question-content", ".question-wrapper", ".exam-wrapper"
        ];
        let best = null, bestArea = 0;
        for (const sel of selectors) {
            let els;
            try { els = document.querySelectorAll(sel); } catch (e) { continue; }
            els.forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.width < 250 || r.height < 150) return;
                const cs = getComputedStyle(el);
                if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05) return;
                if (el.closest("#gvh-panel, #gvh-button, #gvh-lock-screen")) return;
                const area = r.width * r.height;
                if (area > bestArea) { best = el; bestArea = area; }
            });
        }
        return best;
    }

    // ===== CHỤP TOÀN TRANG (bao quát hết bài tập) =====
    async function captureFullPage(onStatus) {
        if (typeof html2canvas === "undefined") throw new Error("Thư viện html2canvas chưa tải xong");
        const fullW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth);
        const fullH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight);
        const [bgA, bgB] = planBackgrounds(document.body);
        const attempts = [
            { fo: false, bg: bgA, label: "html2canvas" },
            { fo: true, bg: bgA, label: "foreignObject" },
            { fo: false, bg: bgB, label: "nền đảo màu" }
        ];
        if (document.fonts && document.fonts.ready) {
            try { await Promise.race([document.fonts.ready, sleep(1500)]); } catch (e) {}
        }
        await sleep(300);
        const scale = Math.max(0.3, Math.min(1.5, 4000 / fullW, 8000 / fullH));
        let lastErr = null;
        for (const at of attempts) {
            try {
                const canvas = await html2canvas(document.documentElement, {
                    useCORS: true, allowTaint: false, logging: false,
                    backgroundColor: colorCss(at.bg), foreignObjectRendering: at.fo,
                    scale, scrollX: 0, scrollY: 0,
                    windowWidth: fullW, windowHeight: fullH,
                    width: fullW, height: fullH, x: 0, y: 0,
                    ignoreElements: el => el.id === "gvh-panel" || el.id === "gvh-button" || el.id === "gvh-lock-screen",
                    onclone: d => { try { fixClonedDoc(d, at.bg); } catch (e) {} }
                });
                if (!canvasLooksBlank(canvas)) return { canvas, bg: at.bg, method: at.label };
                lastErr = new Error("Ảnh toàn trang bị trắng");
            } catch (e) {
                lastErr = e;
                if (onStatus) onStatus("🔁 Chụp toàn trang lỗi, đang thử cách khác...");
            }
        }
        throw lastErr || new Error("Không chụp được toàn trang");
    }

    // ===== TRÍCH XUẤT TEXT THUẦN TỪ TRANG (dùng cho OCR chữ) =====
    function extractPageText(node) {
        if (!node) return "";
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
            acceptNode: n => {
                if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                const p = n.parentElement;
                if (!p) return NodeFilter.FILTER_REJECT;
                if (p.closest("#gvh-panel, #gvh-button, #gvh-lock-screen, .gvh-msg, nav, header, footer, aside, .menu, .sidebar")) return NodeFilter.FILTER_REJECT;
                const cs = getComputedStyle(p);
                if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05) return NodeFilter.FILTER_REJECT;
                const tag = p.tagName;
                if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        const parts = [];
        let t;
        while ((t = walker.nextNode())) {
            const s = t.nodeValue.trim();
            if (s.length > 1 && !/^[\s\d:.\-–—|/\\]+$/.test(s)) parts.push(s);
        }
        return parts.join(" ").replace(/[ \t]{2,}/g, " ").trim();
    }

    // ===== CHỤP MÀN HÌNH NATIVE (getDisplayMedia) — dùng khi Shift+bấm 📸 =====
    async function captureScreenNative() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            throw new Error("Trình duyệt không hỗ trợ chụp màn hình native");
        }
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: "browser" }, audio: false
        });
        return new Promise((resolve, reject) => {
            const video = document.createElement("video");
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                video.play();
                setTimeout(() => {
                    try {
                        const canvas = document.createElement("canvas");
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        canvas.getContext("2d").drawImage(video, 0, 0);
                        stream.getTracks().forEach(t => t.stop());
                        resolve(canvas);
                    } catch (e) {
                        stream.getTracks().forEach(t => t.stop());
                        reject(e);
                    }
                }, 300);
            };
            video.onerror = (e) => { stream.getTracks().forEach(t => t.stop()); reject(e); };
        });
    }

    // ===== HÀM CHỤP TỔNG HỢP: tự chọn cách phù hợp =====
    async function captureElementSmart(node, onStatus, forceFullPage = false) {
        if (forceFullPage) return captureFullPage(onStatus);
        if (needsScreenCapture(node)) {
            if (onStatus) onStatus("🖼️ Đề nằm trong iframe khác nguồn — chụp màn hình native...");
            const canvas = await captureScreenNative();
            return { canvas, method: "native" };
        }
        try {
            return await html2canvasSmart(node, onStatus);
        } catch (e) {
            if (onStatus) onStatus("🔁 html2canvas lỗi — thử chụp toàn trang...");
            return await captureFullPage(onStatus);
        }
    }

    // ===== HELPER: đính kèm ảnh vào preview =====
    function attachCapturedImage(imgBase64, label, width, height) {
        pastedImage = { data: imgBase64.data, mime_type: imgBase64.mime_type, name: label };
        $("gvh-image").src = "data:" + imgBase64.mime_type + ";base64," + imgBase64.data;
        $("gvh-image-name").textContent = `🖼️ ${label}${width ? ` (${width}×${height})` : ""}`;
        $("gvh-image-preview").style.display = "block";
    }

    // ===== HANDLER: NÚT 📸 CHỤP BÀI =====
    // Click thường: chụp vùng đề (tự phát hiện)
    // Ctrl/Cmd + Click: chụp TOÀN TRANG
    // Shift + Click: chụp thẳng tab (native getDisplayMedia)
    $("gvh-capture").onclick = async (e) => {
        if (ocrBusy) { alert("Đang xử lý, vui lòng đợi..."); return; }
        const fullPage = e.ctrlKey || e.metaKey;
        const nativeCapture = e.shiftKey;
        try {
            ocrBusy = true;
            $("gvh-status").textContent = nativeCapture
                ? "📸 Đang mở hộp thoại chụp màn hình..."
                : fullPage
                    ? "📸 Đang chụp TOÀN TRANG bao quát hết bài..."
                    : "📸 Đang chụp vùng đề...";
            const onStatus = (t) => { try { $("gvh-status").textContent = t; } catch (err) {} };

            let canvas, label;
            if (nativeCapture) {
                canvas = await captureScreenNative();
                label = "Chụp tab";
            } else if (fullPage) {
                const r = await captureFullPage(onStatus);
                canvas = r.canvas;
                label = "Toàn trang";
            } else {
                const target = findMainContentArea() || document.body;
                const r = await captureElementSmart(target, onStatus);
                canvas = r.canvas;
                label = "Vùng đề";
            }

            const img = canvasToImage(canvas, fullPage || nativeCapture ? 2200 : 1800);
            clearPastedImage();
            attachCapturedImage(img, label, canvas.width, canvas.height);
            $("gvh-status").textContent = "✓ Đã chụp — Bấm 🔍 Quét đề hoặc 🤖 Giải bài";
        } catch (err) {
            addMessage("❌ Lỗi chụp màn hình: " + err.message, "error");
            $("gvh-status").textContent = "";
        } finally {
            ocrBusy = false;
        }
    };

    // ===== HANDLER: NÚT 🔍 QUÉT ĐỀ =====
    // Click: quét chữ trang, tự OCR ảnh khi cần
    // Shift: ép OCR ảnh
    // Alt: chỉ quét chữ, không OCR
    $("gvh-ocr").onclick = async (e) => {
        if (ocrBusy) { alert("Đang xử lý, vui lòng đợi..."); return; }
        const forceOCR = e.shiftKey;
        const textOnly = e.altKey;
        try {
            ocrBusy = true;
            $("gvh-status").textContent = "🔍 Đang quét đề...";
            const onStatus = (t) => { try { $("gvh-status").textContent = t; } catch (err) {} };

            const target = findMainContentArea() || document.body;
            const pageText = extractPageText(target);

            let combined = pageText || "";
            if (pageText && pageText.length >= 20) {
                $("gvh-question").value = pageText;
                onStatus(`📄 Đã quét được ${pageText.length} ký tự chữ`);
            }

            const shouldOCR = !textOnly && API_KEY && (forceOCR || !pageText || pageText.length < 50);
            if (shouldOCR) {
                onStatus("🖼️ Đang chụp vùng đề + OCR bằng Gemini Vision...");
                let result;
                try { result = await html2canvasSmart(target, onStatus); }
                catch (capErr) {
                    onStatus("🔁 Chụp vùng lỗi — thử chụp toàn trang...");
                    result = await captureFullPage(onStatus);
                }
                const img = canvasToImage(result.canvas, 1800);
                onStatus("✨ Gemini đang đọc chữ trong ảnh...");
                const data = await requestGemini(OCR_PROMPT, false, img, MODEL, null, { system: OCR_SYSTEM });
                const ocrText = extractOutput(data);
                if (ocrText) {
                    combined = combined ? combined + "\n\n[Phần bổ sung từ OCR ảnh]\n" + ocrText : ocrText;
                    $("gvh-question").value = combined;
                }
            }

            if (!combined) {
                $("gvh-status").textContent = "⚠️ Không tìm thấy nội dung — thử Shift+bấm hoặc Ctrl+bấm 📸 Chụp bài";
            } else {
                $("gvh-status").textContent = "✓ Đã quét xong — Bấm 🤖 Giải bài";
            }
        } catch (err) {
            addMessage("❌ Lỗi quét đề: " + err.message, "error");
            $("gvh-status").textContent = "";
        } finally {
            ocrBusy = false;
        }
    };

    // ===== HANDLER: NÚT 🤖 GIẢI BÀI =====
    $("gvh-ask").onclick = async () => {
        const text = $("gvh-question").value.trim();
        const img = pastedImage;
        if (!text && !img) {
            addMessage("❌ Vui lòng nhập câu hỏi hoặc đính kèm ảnh!", "error");
            return;
        }
        $("gvh-question").value = "";
        clearPastedImage();
        await ask(text || "(Hãy đọc đề trong ảnh và giải chi tiết)", false, img);
    };

    // ===== HANDLER: NÚT 🔎 WEB =====
    $("gvh-search").onclick = async () => {
        const text = $("gvh-question").value.trim() || selectedText();
        if (!text) { addMessage("❌ Vui lòng nhập câu hỏi hoặc bôi đen văn bản trên trang!", "error"); return; }
        $("gvh-question").value = "";
        await ask(text, true);
    };

    // ===== HANDLER: NÚT 🗑 XÓA LỊCH SỬ =====
    $("gvh-clear").onclick = () => {
        if (!confirm("Xóa toàn bộ lịch sử chat?")) return;
        $("gvh-messages").innerHTML = "";
        addMessage("🗑 Đã xóa lịch sử chat. Sẵn sàng giải bài mới!", "ai");
    };

    // ===== HANDLER: NÚT 💾 LƯU API =====
    $("gvh-save-api").onclick = async () => {
        const key = $("gvh-key").value.trim();
        const model = $("gvh-model").value;
        const st = $("gvh-api-status");
        if (!key) {
            st.style.color = "#f87171";
            st.textContent = "⚠️ Vui lòng nhập API Key!";
            return;
        }
        API_KEY = key;
        MODEL = model;
        store.set("gvh_api_key", key);
        store.set("gvh_model", model);
        try {
            await testAPI();
            st.style.color = "#34d399";
            st.textContent = "✓ Kết nối thành công với Gemini!";
        } catch (e) {
            st.style.color = "#f87171";
            st.textContent = "❌ " + e.message;
        }
    };

    // ===== HANDLER: NÚT 💾 LƯU GIAO DIỆN =====
    $("gvh-save-appearance").onclick = () => {
        const settings = {
            theme: $("gvh-theme-select").value,
            customColor: $("gvh-custom-color").value,
            effect: $("gvh-effect-select").value,
            fontSize: $("gvh-fontsize-select").value,
            opacity: $("gvh-opacity-range").value,
            radius: $("gvh-radius-select").value,
            scale: $("gvh-scale-range").value
        };
        localStorage.setItem("gvh_appearance_settings", JSON.stringify(settings));
        alert("✓ Đã lưu giao diện! Tải lại trang để áp dụng.");
        location.reload();
    };

    // ===== HANDLER: NÚT 💾 LƯU HỆ THỐNG (phím tắt) =====
    $("gvh-save-system").onclick = () => {
        if (tempShortcut) {
            TOGGLE_SHORTCUT = tempShortcut;
            localStorage.setItem("gvh_shortcut_obj", JSON.stringify(tempShortcut));
            const st = $("gvh-system-status");
            st.style.color = "#34d399";
            st.textContent = "✓ Đã lưu phím tắt: " + tempShortcut.display;
            setTimeout(() => st.textContent = "", 3000);
        }
    };

    // ===== HANDLER: NÚT 🗕 THU GỌN & ✕ ĐÓNG =====
    const hidePanel = () => {
        panel.classList.remove("gvh-show");
        panel.classList.add("gvh-hide");
        setTimeout(() => { if (panel.classList.contains("gvh-hide")) panel.style.display = "none"; }, 250);
    };
    $("gvh-minimize-btn").onclick = hidePanel;
    $("gvh-close").onclick = hidePanel;

    // ===== KHỞI ĐỘNG: bind Enter để gửi nhanh =====
    $("gvh-question").addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            $("gvh-ask").click();
        }
    });
    // ============================================================
    // 🔥 CHỤP TOÀN TRANG — 1 HÀM DUY NHẤT, ĐƠN GIẢN, CHẠY ĐƯỢC
    // Ctrl + Click nút 📸 = chụp full hết trang
    // ============================================================
    async function captureFullPageSimple() {
        if (typeof html2canvas === "undefined") throw new Error("html2canvas chưa tải");

        // 1. Cuộn hết trang để lazy-load ảnh
        const y0 = window.scrollY;
        for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
            window.scrollTo(0, y);
            await new Promise(r => setTimeout(r, 100));
        }
        window.scrollTo(0, y0);
        await new Promise(r => setTimeout(r, 400));

        // 2. Đo kích thước THẬT (bao gồm cả scroll container con nếu có)
        let W = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth);
        let H = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight);

        // Nếu có div scroll con cao hơn body thì lấy div đó
        document.querySelectorAll('div, main').forEach(el => {
            if (el.closest('#gvh-panel, #gvh-button, #gvh-lock-screen')) return;
            const cs = getComputedStyle(el);
            if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > H) {
                H = el.scrollHeight;
                W = Math.max(W, el.scrollWidth);
            }
        });

        // 3. Chụp với scale vừa đủ để chữ đọc được mà không vỡ canvas
        const scale = Math.min(2, 8000 / H, 4000 / W);
        const canvas = await html2canvas(document.body, {
            useCORS: true,
            allowTaint: false,
            logging: false,
            backgroundColor: "#ffffff",
            scale: Math.max(0.5, scale),
            scrollX: 0,
            scrollY: 0,
            windowWidth: W,
            windowHeight: H,
            width: W,
            height: H,
            x: 0,
            y: 0,
            ignoreElements: el => ['gvh-panel', 'gvh-button', 'gvh-lock-screen'].includes(el.id)
        });
        return canvas;
    }

    // GHI ĐÈ handler nút 📸 (cũ sẽ bị thay thế hoàn toàn)
    $("gvh-capture").onclick = async (e) => {
        if (ocrBusy) { alert("Đang xử lý, đợi chút..."); return; }
        ocrBusy = true;
        const fullPage = e.ctrlKey || e.metaKey;
        const st = $("gvh-status");
        try {
            st.textContent = fullPage ? "📸 Đang chụp TOÀN TRANG..." : "📸 Đang chụp vùng đề...";

            let canvas;
            if (fullPage) {
                canvas = await captureFullPageSimple();
            } else {
                // Chụp vùng đề: dùng html2canvasSmart có sẵn
                const target = document.querySelector('main, .question-content, .exam-content, #content') || document.body;
                const r = await html2canvasSmart(target, t => st.textContent = t);
                canvas = r.canvas;
            }

            // Chuyển sang JPEG, giới hạn cạnh dài 3000px để Gemini đọc được
            const maxSide = 3000;
            const k = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
            const c2 = document.createElement("canvas");
            c2.width = Math.round(canvas.width * k);
            c2.height = Math.round(canvas.height * k);
            const g = c2.getContext("2d");
            g.fillStyle = "#ffffff";
            g.fillRect(0, 0, c2.width, c2.height);
            g.drawImage(canvas, 0, 0, c2.width, c2.height);
            const dataUrl = c2.toDataURL("image/jpeg", 0.9);

            // Đính kèm vào preview
            clearPastedImage();
            pastedImage = {
                data: dataUrl.split(",")[1],
                mime_type: "image/jpeg",
                name: fullPage ? "Toàn trang" : "Vùng đề"
            };
            $("gvh-image").src = dataUrl;
            $("gvh-image-name").textContent = `🖼️ ${pastedImage.name} (${canvas.width}×${canvas.height})`;
            $("gvh-image-preview").style.display = "block";

            st.textContent = `✓ Đã chụp ${canvas.width}×${canvas.height} — Bấm 🤖 Giải bài`;
        } catch (err) {
            addMessage("❌ Lỗi chụp: " + err.message, "error");
            st.textContent = "";
        } finally {
            ocrBusy = false;
        }
    };

    // Cập nhật tooltip
    $("gvh-capture").title = "Click: chụp vùng đề • Ctrl+Click: chụp TOÀN TRANG";

    // ============================================================
    // 🔄 CẬP NHẬT TỪ XA & KIỂM TRA PHIÊN BẢN ĐANG DÙNG
    // Firebase: nhánh "app_config" = { latest, min_version, notes }
    //  - latest      : bản mới nhất  -> hiện banner "Có bản mới"
    //  - min_version : bản tối thiểu -> bản cũ hơn bị khóa cho tới khi cập nhật (admin không bị khóa)
    // Link tải nằm cố định trong script (UPDATE_URL), không đọc từ Firebase.
    // ============================================================
    const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;
    let updateInfo = (() => { try { return JSON.parse(store.get("gvh_update_cache", "null")); } catch (e) { return null; } })();

    function keyVersions(rec) {
        const devs = (rec && rec.devices) || {};
        const set = new Set(Object.keys(devs).map(id => (devs[id] && devs[id].version) || "cũ"));
        return set.size ? Array.from(set).map(v => v === "cũ" ? v : "v" + v).join(", ") : "—";
    }

    function renderVersionStats(data) {
        const el = $("gvh-admin-version-stats");
        if (!el) return;
        const count = {};
        let total = 0;
        for (const k in data) {
            const devs = (data[k] && data[k].devices) || {};
            for (const id in devs) {
                const v = (devs[id] && devs[id].version) || "cũ";
                count[v] = (count[v] || 0) + 1;
                total++;
            }
        }
        const vs = Object.keys(count).sort((a, b) => a === "cũ" ? 1 : b === "cũ" ? -1 : cmpVer(b, a));
        el.innerHTML = total
            ? vs.map(v => `<div>• <b>${escapeHtml(v === "cũ" ? "Bản cũ (chưa báo phiên bản)" : "v" + v)}</b>: ${count[v]} thiết bị</div>`).join("")
            : "Chưa có thiết bị nào.";
    }

    function updateState() {
        const u = updateInfo || {};
        return {
            latest: u.latest || null,
            notes: u.notes || "",
            hasNew: !!u.latest && cmpVer(u.latest, CURRENT_VERSION) > 0,
            forced: !!u.min && cmpVer(CURRENT_VERSION, u.min) < 0 && !isAdmin
        };
    }

    function openUpdatePage() {
        if (!UPDATE_URL) { alert("Chưa cấu hình link cập nhật. Hãy liên hệ admin để lấy bản mới."); return; }
        try {
            if (typeof GM_openInTab === "function") GM_openInTab(UPDATE_URL, { active: true });
            else window.open(UPDATE_URL, "_blank");
        } catch (e) { window.open(UPDATE_URL, "_blank"); }
    }

    function showForcedOverlay(on, s) {
        let ov = $("gvh-force-update");
        if (!on) { if (ov) ov.remove(); return; }
        if (ov) return;
        ov = document.createElement("div");
        ov.id = "gvh-force-update";
        ov.style.cssText = "position:fixed; inset:0; z-index:2147483647; display:flex; align-items:center; justify-content:center; background:rgba(11,17,32,0.92); font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;";
        const box = document.createElement("div");
        box.style.cssText = "background:#1e293b; color:#e2e8f0; padding:26px; border-radius:20px; max-width:360px; text-align:center; border:1px solid rgba(255,255,255,0.15);";
        const h = document.createElement("div");
        h.style.cssText = "font-size:18px; font-weight:800; margin-bottom:8px;";
        h.textContent = "🔄 Cần cập nhật phiên bản";
        const p = document.createElement("div");
        p.style.cssText = "font-size:13px; line-height:1.6; color:#cbd5e1; margin-bottom:16px; white-space:pre-wrap;";
        p.textContent = `Bạn đang dùng v${CURRENT_VERSION}, bản này không còn được hỗ trợ.\nHãy cập nhật lên v${s.latest || updateInfo.min} để tiếp tục.` + (s.notes ? `\n\n📝 ${s.notes}` : "");
        const b1 = document.createElement("button");
        b1.textContent = "⬇ Cập nhật ngay";
        b1.style.cssText = "background:linear-gradient(135deg,#10b981,#047857); color:#fff; border:none; padding:10px 16px; border-radius:12px; font-weight:700; cursor:pointer; margin-right:8px;";
        b1.onclick = openUpdatePage;
        const b2 = document.createElement("button");
        b2.textContent = "🔁 Tôi đã cập nhật, tải lại";
        b2.style.cssText = "background:rgba(255,255,255,0.1); color:#e2e8f0; border:none; padding:10px 16px; border-radius:12px; cursor:pointer;";
        b2.onclick = () => location.reload();
        box.append(h, p, b1, b2);
        ov.appendChild(box);
        document.body.appendChild(ov);
    }

    function renderUpdateUI() {
        const s = updateState();
        const banner = $("gvh-update-banner");
        if (banner) {
            banner.style.display = s.hasNew ? "flex" : "none";
            $("gvh-update-banner-text").textContent = `🚀 Có bản mới v${s.latest} (đang dùng v${CURRENT_VERSION})`;
        }
        $("gvh-ver-current").textContent = "v" + CURRENT_VERSION;
        $("gvh-ver-latest").textContent = s.latest ? "v" + s.latest : "chưa rõ";
        $("gvh-ver-update-btn").style.display = s.hasNew ? "block" : "none";
        $("gvh-ver-notes").textContent = s.hasNew && s.notes ? "📝 " + s.notes : "";
        showForcedOverlay(s.forced, s);
    }

    async function checkForUpdate(manual) {
        const st = $("gvh-update-status");
        if (manual) { st.style.color = "#38bdf8"; st.textContent = "🔄 Đang kiểm tra phiên bản mới..."; }
        try {
            const cfg = (await fbRequest("GET", "app_config")) || {};
            const latest = VER_RE.test(String(cfg.latest || "")) ? String(cfg.latest) : null;
            const min = VER_RE.test(String(cfg.min_version || "")) ? String(cfg.min_version) : null;
            const notes = typeof cfg.notes === "string" ? cfg.notes.slice(0, 500) : "";
            updateInfo = { latest, min, notes };
            store.set("gvh_update_cache", JSON.stringify(updateInfo));
            store.set("gvh_update_checked", String(Date.now()));
            renderUpdateUI();
            if (manual) {
                const s = updateState();
                st.style.color = s.hasNew ? "#fbbf24" : "#34d399";
                st.textContent = s.hasNew ? `🚀 Có bản mới v${s.latest}!` : "✓ Bạn đang dùng bản mới nhất.";
                setTimeout(() => { st.textContent = ""; }, 5000);
            }
        } catch (e) {
            if (manual) { st.style.color = "#f87171"; st.textContent = "❌ Không kiểm tra được (lỗi mạng), thử lại sau."; }
        }
    }

    function maybeAutoCheck() {
        if (document.hidden || navigator.onLine === false) return;
        const last = parseInt(store.get("gvh_update_checked", "0")) || 0;
        if (Date.now() - last >= UPDATE_CHECK_INTERVAL) checkForUpdate(false);
    }

    $("gvh-ver-check-btn").onclick = () => checkForUpdate(true);
    $("gvh-ver-update-btn").onclick = openUpdatePage;
    $("gvh-update-banner-btn").onclick = openUpdatePage;

    // Admin: đăng thông báo cập nhật lên Firebase
    if (isAdmin) {
        $("gvh-admin-latest").value = (updateInfo && updateInfo.latest) || CURRENT_VERSION;
        $("gvh-admin-minver").value = (updateInfo && updateInfo.min) || "";
        $("gvh-admin-notes").value = (updateInfo && updateInfo.notes) || "";
        $("gvh-admin-pub-btn").onclick = async () => {
            const st = $("gvh-admin-status");
            const latest = $("gvh-admin-latest").value.trim();
            const min = $("gvh-admin-minver").value.trim();
            const notes = $("gvh-admin-notes").value.trim().slice(0, 500);
            if (!VER_RE.test(latest) || (min && !VER_RE.test(min))) {
                st.style.color = "#f87171";
                st.textContent = "⚠️ Phiên bản phải dạng số, ví dụ 12.4.9";
                return;
            }
            if (min && cmpVer(min, latest) > 0) {
                st.style.color = "#f87171";
                st.textContent = "⚠️ Phiên bản tối thiểu không được lớn hơn phiên bản mới nhất.";
                return;
            }
            if (min && !confirm(`Mọi thiết bị đang dùng bản thấp hơn v${min} sẽ bị KHÓA tới khi cập nhật. Tiếp tục?`)) return;
            try {
                await fbRequest("PUT", "app_config", { latest, min_version: min, notes, updated_at: new Date().toISOString() });
                st.style.color = "#34d399";
                st.textContent = `✓ Đã đăng bản v${latest}. Người dùng sẽ thấy thông báo trong tối đa ~30 phút.`;
                checkForUpdate(false);
            } catch (e) {
                st.style.color = "#f87171";
                st.textContent = "❌ Lỗi khi đăng (kiểm tra Rules Firebase cho nhánh app_config).";
            }
        };
    }

    renderUpdateUI();
    setTimeout(maybeAutoCheck, 2500);
    setInterval(maybeAutoCheck, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) maybeAutoCheck(); });

})();
