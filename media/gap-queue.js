// Gap Queue Panel — webview-side script

(function () {
  "use strict";

  const vscode = acquireVsCodeApi();

  // ---------------------------------------------------------------------------
  // Message handler
  // ---------------------------------------------------------------------------

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case "update":
        renderGaps(msg.gaps, msg.gateResult, msg.prototypeScreens);
        break;
      case "error":
        showError(msg.text);
        break;
      case "rerunning":
        setRerunning(true);
        break;
      case "rerunDone":
        setRerunning(false);
        break;
      case "prototypeRunning":
        setPrototyping(true);
        break;
      case "prototypeDone":
        setPrototyping(false);
        break;
    }
  });

  function setRerunning(running) {
    const btn = document.getElementById("btn-rerun");
    const status = document.getElementById("rerun-status");
    if (btn) btn.disabled = running;
    if (status) status.textContent = running ? "Running /fm-gaps…" : "";
  }

  function setPrototyping(running) {
    const btn = document.getElementById("btn-prototype");
    const status = document.getElementById("proto-status");
    if (btn) btn.disabled = running;
    if (status) status.textContent = running ? "Running /fm-prototype…" : "";
  }

  function selectedGapIds() {
    return Array.from(
      document.querySelectorAll(".gap-select:checked")
    ).map((cb) => cb.getAttribute("data-gap-id"));
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function renderGaps(gaps, gateResult, prototypeScreens) {
    const listEl = document.getElementById("gaps-list");
    const bannerEl = document.getElementById("gate-banner");
    const advBtn = document.getElementById("btn-advance");
    const errorArea = document.getElementById("error-area");

    if (errorArea) errorArea.innerHTML = "";

    // Gate banner
    if (bannerEl && advBtn) {
      if (gateResult && gateResult.ok) {
        bannerEl.className = "gate-banner clear";
        bannerEl.querySelector(".gate-label").textContent = "Resolution gate: CLEAR";
        bannerEl.querySelector(".gate-detail").textContent =
          "All blocking gaps resolved/deferred/waived. Ready to advance.";
        advBtn.disabled = false;
      } else {
        const reason = (gateResult && gateResult.reason) || "Blocking gaps remain open.";
        bannerEl.className = "gate-banner blocked";
        bannerEl.querySelector(".gate-label").textContent = "Resolution gate: BLOCKED";
        bannerEl.querySelector(".gate-detail").textContent = reason;
        advBtn.disabled = true;
      }
    }

    if (!listEl) return;

    if (!gaps || gaps.length === 0) {
      listEl.innerHTML = '<li class="empty-state"><p>No gaps found in analysis/gaps.json</p><p>Run gap analysis first.</p></li>';
      return;
    }

    listEl.innerHTML = gaps.map((gap) => buildGapHtml(gap, prototypeScreens)).join("");

    // Bind per-gap action buttons
    listEl.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action");
        const gapId = btn.getAttribute("data-gap-id");
        if (action === "resolve") {
          vscode.postMessage({ type: "resolveGap", gapId });
        } else if (action === "defer") {
          vscode.postMessage({ type: "deferGap", gapId });
        } else if (action === "waive") {
          vscode.postMessage({ type: "openWaiveForm", gapId });
        }
      });
    });
  }

  // Prototype-reaction provenance: locators shaped "prototype@<screen-id>".
  function protoAnchors(gap) {
    return (gap.evidence || [])
      .map((e) => e.locator)
      .filter((loc) => typeof loc === "string" && loc.indexOf("prototype@") === 0)
      .map((loc) => loc.slice("prototype@".length));
  }

  function buildGapHtml(gap, prototypeScreens) {
    const isDone = gap.status !== "open";
    const evidenceHtml = (gap.evidence || []).map((e) => {
      const isProto =
        typeof e.locator === "string" && e.locator.indexOf("prototype@") === 0;
      return `
      <div class="evidence-quote${isProto ? " from-prototype" : ""}"><strong>${escHtml(e.sourceFile)} ${escHtml(e.locator)}</strong><br/>"${escHtml(e.quote)}"</div>
    `;
    }).join("");

    // Provenance badges for reaction-derived evidence + stale-anchor flagging.
    const anchors = protoAnchors(gap);
    const protoBadges = anchors.map((screen) => {
      const stale =
        Array.isArray(prototypeScreens) && prototypeScreens.indexOf(screen) === -1;
      return `<span class="proto-badge${stale ? " stale" : ""}" title="${
        stale
          ? "Anchored screen is absent from the current prototype (stale-anchor)"
          : "Surfaced via a prototype reaction"
      }">prototype@${escHtml(screen)}${stale ? " · stale-anchor" : ""}</span>`;
    }).join("");

    const actionsHtml = isDone
      ? `<em style="font-size:0.8em;color:#888;">Gap is ${escHtml(gap.status)}.</em>`
      : `
        <button data-action="resolve" data-gap-id="${escHtml(gap.id)}">Resolve</button>
        <button data-action="defer"   data-gap-id="${escHtml(gap.id)}">Defer</button>
        <button data-action="waive" class="btn-waive" data-gap-id="${escHtml(gap.id)}">Waive…</button>
      `;

    return `
      <li class="gap-item" data-severity="${escHtml(gap.severity)}" data-status="${escHtml(gap.status)}">
        <div class="gap-header">
          <input type="checkbox" class="gap-select" data-gap-id="${escHtml(gap.id)}" title="Select to include in a prototype" />
          <span class="gap-id">${escHtml(gap.id)}</span>
          <span class="gap-kind-badge ${escHtml(gap.kind)}">${escHtml(gap.kind)}</span>
          <span class="severity-badge ${escHtml(gap.severity)}">${escHtml(gap.severity)}</span>
          <span class="status-badge ${escHtml(gap.status)}">${escHtml(gap.status)}</span>
          ${protoBadges}
        </div>
        <div class="gap-summary">${escHtml(gap.summary)}</div>
        ${evidenceHtml ? `
          <div class="gap-evidence">
            <details><summary>Evidence (${(gap.evidence || []).length})</summary>
              ${evidenceHtml}
            </details>
          </div>` : ""}
        <div class="gap-actions">${actionsHtml}</div>
      </li>
    `;
  }

  function escHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showError(text) {
    const el = document.getElementById("error-area");
    if (!el) return;
    const div = document.createElement("div");
    div.className = "error-msg";
    div.textContent = text;
    el.appendChild(div);
  }

  // ---------------------------------------------------------------------------
  // Advance button
  // ---------------------------------------------------------------------------

  const advBtn = document.getElementById("btn-advance");
  if (advBtn) {
    advBtn.addEventListener("click", () => {
      vscode.postMessage({ type: "advanceStage" });
    });
  }

  const rerunBtn = document.getElementById("btn-rerun");
  if (rerunBtn) {
    rerunBtn.addEventListener("click", () => {
      vscode.postMessage({ type: "rerunGaps" });
    });
  }

  const protoBtn = document.getElementById("btn-prototype");
  if (protoBtn) {
    protoBtn.addEventListener("click", () => {
      vscode.postMessage({ type: "generatePrototype", gapIds: selectedGapIds() });
    });
  }

  const markReviewedBtn = document.getElementById("btn-mark-reviewed");
  if (markReviewedBtn) {
    markReviewedBtn.addEventListener("click", () => {
      vscode.postMessage({ type: "markPrototypeReviewed" });
    });
  }

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------

  vscode.postMessage({ type: "requestState" });
})();
