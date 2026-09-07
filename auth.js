(() => {
  const AUTH_API = "https://gaggu-auth.xognsking69.workers.dev";
  const CODE_KEY = "gaggu_license_code_v1";
  const DEVICE_KEY = "gaggu_device_id_v1";

  const gate = document.getElementById("authGate");
  const form = document.getElementById("authForm");
  const input = document.getElementById("authCode");
  const submit = document.getElementById("authSubmit");
  const message = document.getElementById("authMessage");

  function deviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function setMessage(text, type = "") {
    if (!message) return;
    message.textContent = text || "";
    message.className = `auth-message ${type}`.trim();
  }

  function unlock() {
    gate?.classList.add("hidden");
    document.body.classList.remove("auth-pending");
  }

  function lock() {
    document.body.classList.add("auth-pending");
    gate?.classList.remove("hidden");
  }

  async function verify(code) {
    const clean = String(code || "").trim().toUpperCase();
    if (!clean) throw new Error("인증코드를 입력해 주세요.");
    const res = await fetch(`${AUTH_API}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: clean, deviceId: deviceId() })
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok || !data.ok) throw new Error(data.message || "인증에 실패했습니다.");
    localStorage.setItem(CODE_KEY, clean);
    return data;
  }

  async function autoVerify() {
    const saved = localStorage.getItem(CODE_KEY);
    if (!saved) { lock(); return; }
    input.value = saved;
    setMessage("인증 상태를 확인하고 있어요…");
    try {
      await verify(saved);
      setMessage("인증 완료", "ok");
      unlock();
    } catch (e) {
      localStorage.removeItem(CODE_KEY);
      setMessage(e?.message || "인증을 확인할 수 없습니다.", "error");
      lock();
    }
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    submit.disabled = true;
    setMessage("인증 중이에요…");
    try {
      await verify(input.value);
      setMessage("인증이 완료되었습니다 ♡", "ok");
      setTimeout(unlock, 300);
    } catch (err) {
      setMessage(err?.message || "인증에 실패했습니다.", "error");
    } finally {
      submit.disabled = false;
    }
  });

  document.getElementById("authManageBtn")?.addEventListener("click", async () => {
    const code = localStorage.getItem(CODE_KEY);
    if (!code) { lock(); return; }
    if (!confirm("이 기기의 가꾸 인증을 해제할까요?\n해제 후 다시 인증코드를 입력해야 합니다.")) return;
    try {
      const res = await fetch(`${AUTH_API}/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, deviceId: deviceId() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.message || "인증 해제에 실패했습니다.");
      localStorage.removeItem(CODE_KEY);
      alert("이 기기의 인증을 해제했습니다.");
      location.reload();
    } catch (e) {
      alert(e?.message || "서버 연결을 확인해 주세요.");
    }
  });

  window.GAGGU_AUTH = { api: AUTH_API, autoVerify };
  autoVerify();
})();
