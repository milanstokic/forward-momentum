// Resolution / Waiver Form — webview-side script

(function () {
  "use strict";

  const vscode = acquireVsCodeApi();

  // ---------------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------------

  const reasonInput = document.getElementById("reason");
  const ackCommunicated = document.getElementById("ack-communicated");
  const ackRisk = document.getElementById("ack-risk");
  const ackRevisit = document.getElementById("ack-revisit");
  const validationArea = document.getElementById("validation-area");
  const submitBtn = document.getElementById("btn-submit");
  const cancelBtn = document.getElementById("btn-cancel");

  // ---------------------------------------------------------------------------
  // Message handler
  // ---------------------------------------------------------------------------

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case "init":
        // Populate gap context
        const gapIdEl = document.getElementById("gap-id");
        const gapSummaryEl = document.getElementById("gap-summary");
        if (gapIdEl) gapIdEl.textContent = msg.gap.id;
        if (gapSummaryEl) gapSummaryEl.textContent = msg.gap.summary;
        break;

      case "validationErrors":
        showErrors(msg.errors);
        break;

      case "success":
        showSuccess(msg.text);
        disableForm();
        break;

      case "error":
        showErrors([msg.text]);
        break;
    }
  });

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      const errors = validateLocally();
      if (errors.length > 0) {
        showErrors(errors);
        return;
      }

      showErrors([]); // clear

      vscode.postMessage({
        type: "submitWaiver",
        reason: reasonInput ? reasonInput.value.trim() : "",
        acknowledgements: {
          communicatedToClient: ackCommunicated ? ackCommunicated.checked : false,
          riskAccepted: ackRisk ? ackRisk.checked : false,
          revisitScheduled: ackRevisit ? ackRevisit.checked : false,
        },
      });
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      vscode.postMessage({ type: "cancel" });
    });
  }

  // ---------------------------------------------------------------------------
  // Local validation (mirrors server-side validateWaiver for fast feedback)
  // ---------------------------------------------------------------------------

  function validateLocally() {
    const errors = [];

    const reason = reasonInput ? reasonInput.value.trim() : "";
    if (!reason) {
      errors.push("Reason must be a non-empty string.");
    }

    if (ackCommunicated && !ackCommunicated.checked) {
      errors.push("You must acknowledge that the client has been communicated.");
    }
    if (ackRisk && !ackRisk.checked) {
      errors.push("You must acknowledge that the risk has been accepted.");
    }
    if (ackRevisit && !ackRevisit.checked) {
      errors.push("You must acknowledge that a revisit/follow-up is scheduled.");
    }

    return errors;
  }

  // ---------------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------------

  function showErrors(errors) {
    if (!validationArea) return;
    if (!errors || errors.length === 0) {
      validationArea.innerHTML = "";
      return;
    }
    const items = errors.map((e) => `<li>${escHtml(e)}</li>`).join("");
    validationArea.innerHTML = `
      <div class="validation-errors">
        <ul>${items}</ul>
      </div>`;
  }

  function showSuccess(text) {
    if (!validationArea) return;
    validationArea.innerHTML = `<div class="success-msg">${escHtml(text)}</div>`;
  }

  function disableForm() {
    [reasonInput, ackCommunicated, ackRisk, ackRevisit, submitBtn].forEach((el) => {
      if (el) el.disabled = true;
    });
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

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------

  vscode.postMessage({ type: "ready" });
})();
