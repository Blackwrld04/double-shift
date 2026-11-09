import { createToolkitAuthPlugin } from "@agent-native/toolkit/app/auth/server";
import { signInJourneyInlineScript } from "@agent-native/core/shared";

const journeyScript = signInJourneyInlineScript();

const loginPageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
  <meta http-equiv="Pragma" content="no-cache" />
  <meta http-equiv="Expires" content="0" />
  <title>Double Shift — Restaurant Operations Twin & Service Simulation</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="apple-touch-icon" href="/icon-180.svg" />
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      height: 100%;
      min-height: 100vh;
      background: #09090b;
      color: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }

    /* Full-screen Split Layout (Reference Match: 50/50 split) */
    .auth-split-wrapper {
      width: 100vw;
      min-height: 100vh;
      display: flex;
      flex-direction: row;
      align-items: stretch;
    }

    /* Left Side: Form Panel (clean, centered, matching reference) */
    .auth-form-side {
      flex: 1 1 50%;
      width: 50%;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: clamp(2rem, 5vw, 4rem) clamp(1.5rem, 4vw, 3.5rem);
      background: #09090b;
      position: relative;
      z-index: 2;
    }

    .auth-form-container {
      width: 100%;
      max-width: 440px;
      display: flex;
      flex-direction: column;
    }

    /* Brand Header with Double Shift Logo (no badges) */
    .auth-brand {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      margin-bottom: 2rem;
    }

    .ds-logo-mark {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #ffffff;
      position: relative;
      flex-shrink: 0;
      box-shadow: 0 4px 14px rgba(255, 255, 255, 0.16);
    }

    .ds-logo-mark span {
      position: absolute;
      top: 8px;
      bottom: 8px;
      width: 7px;
      border-radius: 2.5px;
      background: #09090b;
    }

    .ds-logo-mark span:first-child {
      left: 8px;
    }

    .ds-logo-mark span:last-child {
      left: 20px;
      background: rgba(9, 9, 11, 0.55);
    }

    .auth-brand-title {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #ffffff;
    }

    .auth-headings {
      margin-bottom: 1.75rem;
    }

    .auth-headings h1 {
      font-size: 1.625rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: #ffffff;
      margin-bottom: 0.45rem;
      line-height: 1.2;
    }

    .auth-headings p {
      font-size: 0.9rem;
      color: #8e8e93;
      line-height: 1.45;
    }

    /* Segmented Tabs */
    .auth-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.25rem;
      background: rgba(255, 255, 255, 0.05);
      padding: 0.25rem;
      border-radius: 10px;
      margin-bottom: 1.5rem;
      border: 1px solid rgba(255, 255, 255, 0.07);
    }

    .auth-tab {
      height: 2.2rem;
      background: transparent;
      border: none;
      border-radius: 8px;
      font-family: inherit;
      font-size: 0.85rem;
      font-weight: 500;
      color: #a1a1aa;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .auth-tab.active {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
      font-weight: 600;
    }

    /* Form Fields */
    .form-group {
      margin-bottom: 1.15rem;
    }

    .form-label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #a1a1aa;
      margin-bottom: 0.45rem;
    }

    .form-input {
      width: 100%;
      height: 2.65rem;
      background: rgba(18, 18, 22, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 9px;
      padding: 0 0.95rem;
      font-family: inherit;
      font-size: 0.875rem;
      color: #ffffff;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }

    .form-input:focus {
      border-color: rgba(255, 255, 255, 0.38);
      background: rgba(24, 24, 28, 0.85);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25);
    }

    .form-input::placeholder {
      color: #52525b;
    }

    .btn-submit {
      width: 100%;
      height: 2.75rem;
      margin-top: 0.75rem;
      background: #ffffff;
      color: #09090b;
      font-family: inherit;
      font-size: 0.9rem;
      font-weight: 600;
      border: none;
      border-radius: 9px;
      cursor: pointer;
      transition: all 0.15s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    }

    .btn-submit:hover {
      background: #e4e4e7;
      transform: translateY(-1px);
    }

    .btn-submit:active {
      transform: translateY(0);
    }

    .btn-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .auth-notice {
      display: none;
      padding: 0.7rem 0.9rem;
      border-radius: 8px;
      font-size: 0.8rem;
      line-height: 1.4;
      margin-bottom: 1.25rem;
    }

    .auth-notice.error {
      display: block;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
    }

    .auth-notice.success {
      display: block;
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #86efac;
    }

    .auth-footer-toggle {
      margin-top: 1.75rem;
      text-align: center;
      font-size: 0.825rem;
      color: #71717a;
    }

    .auth-footer-toggle button {
      background: transparent;
      border: none;
      color: #ffffff;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      margin-left: 0.35rem;
      text-decoration: underline;
      font-size: inherit;
      font-family: inherit;
    }

    /* Right Side: Full Bleed Restaurant Visual (Reference Match) */
    .auth-visual-side {
      flex: 1 1 50%;
      width: 50%;
      min-height: 100vh;
      position: relative;
      overflow: hidden;
      background: #111114;
    }

    .visual-bg-img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      z-index: 1;
    }

    .visual-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        180deg,
        rgba(9, 9, 11, 0.12) 0%,
        rgba(9, 9, 11, 0.28) 45%,
        rgba(9, 9, 11, 0.85) 80%,
        rgba(9, 9, 11, 0.98) 100%
      );
      z-index: 2;
    }

    .visual-content {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 3;
      padding: clamp(2rem, 4vw, 3.75rem);
      display: flex;
      flex-direction: column;
      gap: 1.35rem;
    }

    /* Frosted Glass Quote Card (Reference Match) */
    .frosted-quote-card {
      background: rgba(18, 18, 24, 0.68);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 16px;
      padding: 1.35rem 1.6rem;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);
    }

    .quote-text {
      font-size: 0.925rem;
      line-height: 1.55;
      color: #f4f4f5;
      font-style: italic;
      margin-bottom: 0.65rem;
    }

    .quote-author {
      font-size: 0.8rem;
      color: #fbbf24;
      font-weight: 500;
      letter-spacing: -0.01em;
      display: block;
    }

    .visual-meta {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .visual-meta-title {
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #ffffff;
    }

    .visual-meta-subtitle {
      font-size: 0.85rem;
      color: #a1a1aa;
      line-height: 1.45;
    }

    /* Responsive Stacking (< 960px) */
    @media (max-width: 960px) {
      .auth-split-wrapper {
        flex-direction: column;
      }

      .auth-form-side {
        width: 100%;
        flex: none;
        min-height: auto;
        padding: 3rem 1.5rem 2.5rem;
      }

      .auth-visual-side {
        width: 100%;
        flex: none;
        min-height: 420px;
        height: 420px;
      }

      .visual-content {
        padding: 1.75rem 1.5rem;
      }
    }
  </style>
</head>
<body>
  <script>${journeyScript}</script>
  <script>
    var journey = __anCreateSignInJourney("", "/home");
    var resumeHref = journey.journeyForLocation(window.location).resumeHref;
  </script>

  <div class="auth-split-wrapper">
    <!-- Left Side: Form Panel (Clean, Centered, Matching Reference) -->
    <main class="auth-form-side">
      <div class="auth-form-container">
        <!-- Double Shift Logo -->
        <div class="auth-brand">
          <span class="ds-logo-mark" aria-hidden="true">
            <span></span>
            <span></span>
          </span>
          <span class="auth-brand-title">Double Shift</span>
        </div>

        <div class="auth-headings">
          <h1 id="heading-auth-title">Welcome to Double Shift</h1>
          <p id="heading-auth-subtitle">Just a few details to get started.</p>
        </div>

        <div id="auth-notice" class="auth-notice" role="alert"></div>

        <!-- Tabs: Sign in vs Create account -->
        <div class="auth-tabs" role="tablist">
          <button type="button" class="auth-tab active" id="tab-login" role="tab" aria-selected="true">Sign in</button>
          <button type="button" class="auth-tab" id="tab-signup" role="tab" aria-selected="false">Create account</button>
        </div>

        <!-- Sign in form -->
        <form id="form-login">
          <div class="form-group">
            <label class="form-label" for="login-email">Email</label>
            <input class="form-input" id="login-email" type="email" placeholder="you@restaurant.com" required autocomplete="username" />
          </div>
          <div class="form-group">
            <label class="form-label" for="login-password">Password</label>
            <input class="form-input" id="login-password" type="password" placeholder="••••••••" required autocomplete="current-password" />
          </div>
          <button type="submit" class="btn-submit" id="btn-login-submit">Sign in</button>
        </form>

        <!-- Create account form -->
        <form id="form-signup" style="display: none;">
          <div class="form-group">
            <label class="form-label" for="signup-name">Full name</label>
            <input class="form-input" id="signup-name" type="text" placeholder="General Manager" autocomplete="name" />
          </div>
          <div class="form-group">
            <label class="form-label" for="signup-email">Email</label>
            <input class="form-input" id="signup-email" type="email" placeholder="you@restaurant.com" required autocomplete="username" />
          </div>
          <div class="form-group">
            <label class="form-label" for="signup-password">Password</label>
            <input class="form-input" id="signup-password" type="password" placeholder="At least 8 characters" required minlength="8" autocomplete="new-password" />
          </div>
          <button type="submit" class="btn-submit" id="btn-signup-submit">Create account</button>
        </form>

        <div class="auth-footer-toggle">
          <span id="footer-toggle-text">Don't have an account?</span>
          <button type="button" id="footer-toggle-btn">Create account</button>
        </div>
      </div>
    </main>

    <!-- Right Side: Full Bleed Restaurant Visual (Reference Match) -->
    <aside class="auth-visual-side" aria-label="Restaurant Dining Room Atmosphere">
      <img class="visual-bg-img" src="/restaurant-interior.jpg" alt="Double Shift Restaurant Dining Room Atmosphere" />
      <div class="visual-overlay" aria-hidden="true"></div>
      <div class="visual-content">
        <div class="frosted-quote-card">
          <p class="quote-text">“The dining floor is a live system in motion — turn velocity, table pacing, and kitchen pass queues must stay in equilibrium.”</p>
          <span class="quote-author">— Double Shift Service Engine</span>
        </div>
        <div class="visual-meta">
          <h2 class="visual-meta-title">Double Shift Operations</h2>
          <p class="visual-meta-subtitle">Spatial Dining Floor Twin • Live Turn Simulation • Kitchen Queue Modeling</p>
        </div>
      </div>
    </aside>
  </div>

  <script>
    (function() {
      var tabLogin = document.getElementById("tab-login");
      var tabSignup = document.getElementById("tab-signup");
      var formLogin = document.getElementById("form-login");
      var formSignup = document.getElementById("form-signup");
      var headingTitle = document.getElementById("heading-auth-title");
      var headingSubtitle = document.getElementById("heading-auth-subtitle");
      var footerToggleText = document.getElementById("footer-toggle-text");
      var footerToggleBtn = document.getElementById("footer-toggle-btn");
      var notice = document.getElementById("auth-notice");
      var btnLoginSubmit = document.getElementById("btn-login-submit");
      var btnSignupSubmit = document.getElementById("btn-signup-submit");

      function showNotice(msg, type) {
        if (!notice) return;
        notice.textContent = msg;
        notice.className = "auth-notice " + (type || "error");
        notice.style.display = "block";
      }

      function hideNotice() {
        if (!notice) return;
        notice.style.display = "none";
        notice.textContent = "";
        notice.className = "auth-notice";
      }

      function switchTab(tab) {
        hideNotice();
        if (tab === "login") {
          tabLogin.classList.add("active");
          tabLogin.setAttribute("aria-selected", "true");
          tabSignup.classList.remove("active");
          tabSignup.setAttribute("aria-selected", "false");
          formLogin.style.display = "block";
          formSignup.style.display = "none";
          if (headingTitle) headingTitle.textContent = "Welcome to Double Shift";
          if (headingSubtitle) headingSubtitle.textContent = "Just a few details to get started.";
          if (footerToggleText) footerToggleText.textContent = "Don't have an account?";
          if (footerToggleBtn) footerToggleBtn.textContent = "Create account";
        } else {
          tabSignup.classList.add("active");
          tabSignup.setAttribute("aria-selected", "true");
          tabLogin.classList.remove("active");
          tabLogin.setAttribute("aria-selected", "false");
          formSignup.style.display = "block";
          formLogin.style.display = "none";
          if (headingTitle) headingTitle.textContent = "Create an account";
          if (headingSubtitle) headingSubtitle.textContent = "Set up your operator profile to begin simulation.";
          if (footerToggleText) footerToggleText.textContent = "Already have an account?";
          if (footerToggleBtn) footerToggleBtn.textContent = "Sign in";
        }
      }

      tabLogin.addEventListener("click", function() { switchTab("login"); });
      tabSignup.addEventListener("click", function() { switchTab("signup"); });
      if (footerToggleBtn) {
        footerToggleBtn.addEventListener("click", function() {
          var isLogin = tabLogin.classList.contains("active");
          switchTab(isLogin ? "signup" : "login");
        });
      }

      function postJson(url, payload) {
        return fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(payload)
        }).then(function(res) {
          return res.text().then(function(text) {
            var data = {};
            try {
              data = text ? JSON.parse(text) : {};
            } catch (err) {
              data = { error: text || "Unexpected server response" };
            }
            return { ok: res.ok, status: res.status, data: data };
          });
        });
      }

      // Email/Password Login
      formLogin.addEventListener("submit", function(e) {
        e.preventDefault();
        hideNotice();

        var emailInput = document.getElementById("login-email");
        var passwordInput = document.getElementById("login-password");
        var email = (emailInput.value || "").trim();
        var password = passwordInput.value || "";

        if (!email || !password) {
          showNotice("Please enter your email and password.", "error");
          return;
        }

        btnLoginSubmit.disabled = true;
        btnLoginSubmit.textContent = "Signing in...";

        postJson("/_agent-native/auth/login", { email: email, password: password })
          .then(function(res) {
            if (res.ok && res.data && res.data.ok) {
              showNotice("Signed in successfully. Redirecting...", "success");
              var dest = (typeof resumeHref === "string" && resumeHref) ? resumeHref : "/home";
              window.location.href = dest;
            } else {
              btnLoginSubmit.disabled = false;
              btnLoginSubmit.textContent = "Sign in";
              var msg = (res.data && res.data.error) ? res.data.error : "The email or password is incorrect.";
              showNotice(msg, "error");
            }
          })
          .catch(function(err) {
            btnLoginSubmit.disabled = false;
            btnLoginSubmit.textContent = "Sign in";
            showNotice(err.message || "Sign in failed. Please try again.", "error");
          });
      });

      // Create Account (Sign-up chains register -> login as required by framework)
      formSignup.addEventListener("submit", function(e) {
        e.preventDefault();
        hideNotice();

        var name = (document.getElementById("signup-name").value || "").trim();
        var email = (document.getElementById("signup-email").value || "").trim();
        var password = document.getElementById("signup-password").value || "";

        if (!email) {
          showNotice("Please enter an email address.", "error");
          return;
        }
        if (!password || password.length < 8) {
          showNotice("Password must be at least 8 characters long.", "error");
          return;
        }

        btnSignupSubmit.disabled = true;
        btnSignupSubmit.textContent = "Creating account...";

        postJson("/_agent-native/auth/register", { name: name || undefined, email: email, password: password })
          .then(function(res) {
            if (!(res.ok && res.data && res.data.ok)) {
              var errMsg = (res.data && res.data.error) ? res.data.error : "Could not create account.";
              throw new Error(errMsg);
            }
            return postJson("/_agent-native/auth/login", { email: email, password: password });
          })
          .then(function(loginRes) {
            if (loginRes.ok && loginRes.data && loginRes.data.ok) {
              showNotice("Account created! Redirecting...", "success");
              var dest = (typeof resumeHref === "string" && resumeHref) ? resumeHref : "/home";
              window.location.href = dest;
            } else {
              throw new Error((loginRes.data && loginRes.data.error) ? loginRes.data.error : "Account created but sign-in failed.");
            }
          })
          .catch(function(err) {
            btnSignupSubmit.disabled = false;
            btnSignupSubmit.textContent = "Create account";
            showNotice(err.message || "Failed to create account.", "error");
          });
      });
    })();
  </script>
</body>
</html>`;

const toolkitAuth = createToolkitAuthPlugin({
  workspaceAppPublicPaths: ["/"],
  rootAuth: false,
  marketing: {
    appName: "Double Shift",
    tagline: "Restaurant operations twin & service simulation",
    description:
      "Simulate dining service, optimize table turns, and model kitchen bottlenecks deterministically before the night begins.",
  },
  loginHtml: loginPageHtml,
});

export default function doubleShiftAuthPlugin(nitroApp: any) {
  toolkitAuth(nitroApp);

  nitroApp.hooks?.hook?.("request", (event: any) => {
    const rawUrl = event.node?.req?.url || event.path || "";
    const p = rawUrl.split("?")[0];
    if (p === "/sign-in" || p === "/" || p === "/login" || p === "/signup") {
      event.node?.res?.setHeader?.(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
      );
      event.node?.res?.setHeader?.("Pragma", "no-cache");
      event.node?.res?.setHeader?.("Expires", "0");
      event.node?.res?.setHeader?.("Surrogate-Control", "no-store");
    }
  });

  nitroApp.hooks?.hook?.("response", (res: any, event: any) => {
    const rawUrl = event?.node?.req?.url || event?.path || "";
    const p = rawUrl.split("?")[0];
    if (p === "/sign-in" || p === "/" || p === "/login" || p === "/signup") {
      if (res?.headers) {
        if (typeof res.headers.set === "function") {
          res.headers.set(
            "cache-control",
            "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
          );
        } else {
          res.headers["cache-control"] =
            "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
        }
      }
    }
  });
}
