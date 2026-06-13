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
        renderGaps(msg.gaps, msg.gateResult);
        break;
      case "error":
        showError(msg.text);
        break;
    }
  });

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function renderGaps(gaps, gateResult) {
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

    listEl.innerHTML = gaps.map((gap) => buildGapHtml(gap)).join("");

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

  function buildGapHtml(gap) {
    const isDone = gap.status !== "open";
    const evidenceHtml = (gap.evidence || []).map((e) => `
      <div class="evidence-quote"><strong>${escHtml(e.sourceFile)} ${escHtml(e.locator)}</strong><br/>"${escHtml(e.quote)}"</div>
    `).join("");

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
          <span class="gap-id">${escHtml(gap.id)}</span>
          <span class="gap-kind-badge ${escHtml(gap.kind)}">${escHtml(gap.kind)}</span>
          <span class="severity-badge ${escHtml(gap.severity)}">${escHtml(gap.severity)}</span>
          <span class="status-badge ${escHtml(gap.status)}">${escHtml(gap.status)}</span>
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

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------

  vscode.postMessage({ type: "requestState" });
})();
