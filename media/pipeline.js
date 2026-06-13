// Pipeline Panel — webview-side script
// Communicates with the extension host via acquireVsCodeApi().postMessage / window.addEventListener('message')

(function () {
  "use strict";

  const vscode = acquireVsCodeApi();

  // ---------------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------------

  const stageBtns = {
    runExtract: document.getElementById("btn-run-extract"),
    runGaps: document.getElementById("btn-run-gaps"),
    openGapQueue: document.getElementById("btn-open-gap-queue"),
  };

  const logEl = document.getElementById("log-output");
  const statusEl = document.getElementById("status-area");

  // ---------------------------------------------------------------------------
  // Button handlers
  // ---------------------------------------------------------------------------

  if (stageBtns.runExtract) {
    stageBtns.runExtract.addEventListener("click", () => {
      vscode.postMessage({ type: "runExtract" });
    });
  }

  if (stageBtns.runGaps) {
    stageBtns.runGaps.addEventListener("click", () => {
      vscode.postMessage({ type: "runGaps" });
    });
  }

  if (stageBtns.openGapQueue) {
    stageBtns.openGapQueue.addEventListener("click", () => {
      vscode.postMessage({ type: "openGapQueue" });
    });
  }

  // ---------------------------------------------------------------------------
  // Message handler — receive updates from the extension host
  // ---------------------------------------------------------------------------

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case "update":
        renderState(msg.state);
        break;
      case "log":
        appendLog(msg.text);
        break;
      case "running":
        setRunning(msg.command, true);
        break;
      case "done":
        setRunning(msg.command, false);
        break;
      case "error":
        showError(msg.text);
        break;
    }
  });

  // ---------------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------------

  function renderState(state) {
    if (!state) return;

    // Stage bar
    const stageBar = document.getElementById("stage-bar");
    if (stageBar) {
      const stages = ["Intake", "Extraction", "GapAnalysis", "Resolution", "PRDDraft", "Review", "Handoff"];
      const stageOrder = stages.reduce((acc, s, i) => { acc[s] = i; return acc; }, {});
      const currentIdx = stageOrder[state.currentStage] ?? 0;

      stageBar.innerHTML = stages.map((s, i) => {
        const isActive = s === state.currentStage;
        const isCompleted = i < currentIdx;
        const cls = isActive ? "stage-pill active" : isCompleted ? "stage-pill completed" : "stage-pill";
        return (i > 0 ? '<span class="stage-arrow">›</span>' : "") +
               `<span class="${cls}">${s}</span>`;
      }).join("");
    }

    // Gate statuses
    const gates = state.gates || {};
    ["Extraction", "GapAnalysis", "Resolution", "Review"].forEach((g) => {
      const el = document.getElementById("gate-" + g);
      if (el) {
        const status = gates[g] || "pending";
        el.className = "gate-badge " + status;
        el.textContent = status;
      }
    });

    // Stats
    const claimCount = document.getElementById("claim-count");
    const gapCount = document.getElementById("gap-count");
    if (claimCount) claimCount.textContent = String(state.claimCount ?? "-");
    if (gapCount) gapCount.textContent = String(state.gapCount ?? "-");

    // Stage-aware button visibility
    updateButtonStates(state.currentStage, state.gates || {});
  }

  function updateButtonStates(currentStage, gates) {
    // Run extraction: available at Intake or Extraction
    const canExtract = currentStage === "Intake" || currentStage === "Extraction";
    // Run gap analysis: available at Extraction or GapAnalysis (after claims exist)
    const canGaps = currentStage === "Extraction" || currentStage === "GapAnalysis";
    // Open gap queue: available once we're at GapAnalysis or beyond
    const stages = ["Intake", "Extraction", "GapAnalysis", "Resolution", "PRDDraft", "Review", "Handoff"];
    const currentIdx = stages.indexOf(currentStage);
    const canQueue = currentIdx >= stages.indexOf("GapAnalysis");

    if (stageBtns.runExtract) stageBtns.runExtract.disabled = !canExtract;
    if (stageBtns.runGaps) stageBtns.runGaps.disabled = !canGaps;
    if (stageBtns.openGapQueue) stageBtns.openGapQueue.disabled = !canQueue;
  }

  function appendLog(text) {
    if (!logEl) return;
    const ts = new Date().toLocaleTimeString();
    logEl.textContent += `[${ts}] ${text}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setRunning(command, isRunning) {
    if (!statusEl) return;
    if (isRunning) {
      statusEl.innerHTML = `<span class="spinner"></span> Running <code>${command}</code>…`;
      // Disable all action buttons while running
      document.querySelectorAll("button").forEach((b) => (b.disabled = true));
    } else {
      statusEl.innerHTML = "";
      // Re-request state to re-enable buttons correctly
      vscode.postMessage({ type: "requestState" });
    }
  }

  function showError(text) {
    if (!statusEl) return;
    const div = document.createElement("div");
    div.className = "error-msg";
    div.textContent = text;
    statusEl.appendChild(div);
  }

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------

  vscode.postMessage({ type: "requestState" });
})();
