// Inline signup-verification widget — the v1 differentiator.
// Drop-in, dependency-free. Attaches to an <input type="email">, debounces,
// calls the verify API as the user types, and surfaces a verdict + typo nudge.
//
// Usage:
//   <input id="email" type="email" />
//   <script src="/widget/email-verify-widget.js"></script>
//   <script>
//     EmailVerifyWidget.attach(document.getElementById("email"), {
//       baseUrl: "https://your-app.vercel.app",
//       apiKey: "pk_live_...",            // a publishable key
//       onVerdict: (r) => console.log(r), // optional
//     });
//   </script>

(function (global) {
  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function ensureHint(input) {
    let hint = input.nextElementSibling;
    if (!hint || !hint.classList || !hint.classList.contains("evw-hint")) {
      hint = document.createElement("div");
      hint.className = "evw-hint";
      hint.style.cssText = "font:12px/1.5 system-ui,sans-serif;margin-top:4px;min-height:16px;";
      input.insertAdjacentElement("afterend", hint);
    }
    return hint;
  }

  const COLORS = {
    deliverable: "#1a7f37",
    risky: "#9a6700",
    undeliverable: "#cf222e",
    unknown: "#57606a",
  };

  function attach(input, opts) {
    if (!input) throw new Error("EmailVerifyWidget.attach: input element required");
    const baseUrl = (opts.baseUrl || "").replace(/\/$/, "");
    const hint = ensureHint(input);

    const run = debounce(async () => {
      const email = input.value.trim();
      if (!email || !email.includes("@")) {
        hint.textContent = "";
        return;
      }
      hint.style.color = COLORS.unknown;
      hint.textContent = "Checking…";
      try {
        const res = await fetch(baseUrl + "/api/verify", {
          method: "POST",
          headers: Object.assign(
            { "content-type": "application/json" },
            opts.apiKey ? { "x-api-key": opts.apiKey } : {},
          ),
          body: JSON.stringify({ email }),
        });
        const r = await res.json();
        if (!res.ok) {
          hint.style.color = COLORS.unknown;
          hint.textContent = (r && r.error && r.error.message) || "Could not check.";
          return;
        }
        hint.style.color = COLORS[r.verdict] || COLORS.unknown;
        hint.textContent = r.reason;
        if (r.suggestion) {
          hint.textContent = "Did you mean " + r.suggestion + "?";
          hint.style.cursor = "pointer";
          hint.onclick = () => {
            input.value = r.suggestion;
            hint.onclick = null;
            run();
          };
        } else {
          hint.style.cursor = "default";
          hint.onclick = null;
        }
        if (typeof opts.onVerdict === "function") opts.onVerdict(r);
      } catch (e) {
        hint.style.color = COLORS.unknown;
        hint.textContent = "Could not check right now.";
      }
    }, opts.debounceMs || 500);

    input.addEventListener("input", run);
    input.addEventListener("blur", run);
    return () => {
      input.removeEventListener("input", run);
      input.removeEventListener("blur", run);
    };
  }

  global.EmailVerifyWidget = { attach };
})(typeof window !== "undefined" ? window : this);
