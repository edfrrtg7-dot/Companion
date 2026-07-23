/**
 * EPIC-005 Runtime Acceptance Test Script
 *
 * Paste this into the browser console on the CRM page after loading the extension.
 * It will test each scenario and report VERIFIED / FAILED for each.
 *
 * Prerequisites:
 *   1. Extension loaded as unpacked in chrome://extensions
 *   2. On the CRM page with an active chat-sender-* profile in localStorage
 */

(async function epic005Test() {
    const results = [];
    let passed = 0;
    let failed = 0;

    function log(label, status, detail = "") {
        const icon = status === "VERIFIED" ? "\u2705" : status === "FAILED" ? "\u274C" : "\u26A0\uFE0F";
        console.log(`${icon} ${label}: ${status}${detail ? " — " + detail : ""}`);
        results.push({ label, status, detail });
        if (status === "VERIFIED") passed++;
        if (status === "FAILED") failed++;
    }

    // =========================================================================
    // 1. CONSOLE — Check for existing errors
    // =========================================================================
    log("Console clean (no pre-existing errors)", "OBSERVED", "Check console above for any red errors before this test ran");

    // =========================================================================
    // 2. LAUNCHER
    // =========================================================================
    const launchers = document.querySelectorAll(".ab-launcher");
    log("Launcher exists", launchers.length > 0 ? "VERIFIED" : "FAILED", `Found ${launchers.length} launcher(s)`);
    log("No duplicate launchers", launchers.length === 1 ? "VERIFIED" : "FAILED", `Count: ${launchers.length}`);

    // =========================================================================
    // 3. COMPANION MODAL — Open
    // =========================================================================
    // Click the launcher to open the companion
    const launcher = document.querySelector(".ab-launcher");
    if (launcher) {
        launcher.click();
        await new Promise(r => setTimeout(r, 400));
    }

    const overlay = document.getElementById("ab-overlay");
    const modal = overlay ? overlay.querySelector(".ab-modal") : null;
    log("Companion opens on launcher click", overlay && modal ? "VERIFIED" : "FAILED");

    // =========================================================================
    // 4. COMPANION — Tab switching
    // =========================================================================
    const tabs = overlay ? overlay.querySelectorAll(".ab-tab") : [];
    const tabNames = Array.from(tabs).map(t => t.getAttribute("data-target"));
    log("Three tabs present", tabs.length === 3 ? "VERIFIED" : "FAILED", tabNames.join(", "));

    // Click Manager tab
    const managerTab = Array.from(tabs).find(t => t.getAttribute("data-target") === "manager");
    if (managerTab) managerTab.click();
    await new Promise(r => setTimeout(r, 200));
    const managerView = document.getElementById("ab-view-manager");
    const managerVisible = managerView && managerView.style.display !== "none";
    log("Manager tab switches", managerVisible ? "VERIFIED" : "FAILED");

    // Click Diagnostics tab
    const diagTab = Array.from(tabs).find(t => t.getAttribute("data-target") === "diagnostics");
    if (diagTab) diagTab.click();
    await new Promise(r => setTimeout(r, 200));
    const diagView = document.getElementById("ab-view-diagnostics");
    const diagVisible = diagView && diagView.style.display !== "none";
    log("Diagnostics tab switches", diagVisible ? "VERIFIED" : "FAILED");

    // Click Dashboard tab
    const dashTab = Array.from(tabs).find(t => t.getAttribute("data-target") === "dashboard");
    if (dashTab) dashTab.click();
    await new Promise(r => setTimeout(r, 200));
    const dashView = document.getElementById("ab-view-dashboard");
    const dashVisible = dashView && dashView.style.display !== "none";
    log("Dashboard tab switches", dashVisible ? "VERIFIED" : "FAILED");

    // =========================================================================
    // 5. COMPANION — Close via ESC
    // =========================================================================
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    const overlayAfterEsc = document.getElementById("ab-overlay");
    log("ESC closes companion", !overlayAfterEsc ? "VERIFIED" : "FAILED");

    // =========================================================================
    // 6. COMPANION — Open again, close via overlay click
    // =========================================================================
    if (launcher) launcher.click();
    await new Promise(r => setTimeout(r, 400));
    const overlay2 = document.getElementById("ab-overlay");
    if (overlay2) {
        // Click on the overlay background (not the modal)
        overlay2.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }
    await new Promise(r => setTimeout(r, 400));
    const overlayAfterClick = document.getElementById("ab-overlay");
    log("Overlay click closes companion", !overlayAfterClick ? "VERIFIED" : "FAILED");

    // =========================================================================
    // 7. DASHBOARD — Verify fields against localStorage
    // =========================================================================
    // Find the CRM profile
    const crmKey = Object.keys(localStorage).find(k => k.startsWith("chat-sender-") && k !== "chat-sender-" && !k.includes("backup"));
    if (!crmKey) {
        log("Dashboard — CRM profile found in localStorage", "FAILED", "No chat-sender-* key found");
    } else {
        log("Dashboard — CRM profile found in localStorage", "VERIFIED", crmKey);
        const profile = JSON.parse(localStorage.getItem(crmKey));

        // Open companion on dashboard tab
        if (launcher) launcher.click();
        await new Promise(r => setTimeout(r, 400));

        const dashView2 = document.getElementById("ab-view-dashboard");
        if (dashView2) {
            const cards = dashView2.querySelectorAll(".ab-card");
            const cardMap = {};
            cards.forEach(card => {
                const title = card.querySelector(".ab-card-title")?.textContent || "";
                const value = card.querySelector(".ab-card-value")?.textContent || "";
                cardMap[title] = value;
            });

            // IceBreaker Status
            const ibStatus = String(profile.status ?? "Unknown");
            const ibCardValue = cardMap["IceBreaker Status"] || "MISSING";
            log("Dashboard — IceBreaker Status",
                ibCardValue === ibStatus ? "VERIFIED" : "FAILED",
                `Card: "${ibCardValue}" | Profile: "${ibStatus}"`);

            // Broadcast Status
            const brStatus = String(profile.broadcast?.status ?? "Unknown");
            const brCardValue = cardMap["Broadcast Status"] || "MISSING";
            log("Dashboard — Broadcast Status",
                brCardValue === brStatus ? "VERIFIED" : "FAILED",
                `Card: "${brCardValue}" | Profile: "${brStatus}"`);

            // Progress (chainProgress count)
            const cpCount = profile.chainProgress && typeof profile.chainProgress === "object"
                ? String(Object.keys(profile.chainProgress).length) : "0";
            const cpCardValue = cardMap["IceBreaker In Progress"] || "MISSING";
            log("Dashboard — Progress",
                cpCardValue === cpCount ? "VERIFIED" : "FAILED",
                `Card: "${cpCardValue}" | Profile: "${cpCount}"`);

            // Completed (sended count)
            const sendedCount = typeof profile.sended === "string"
                ? String(profile.sended.split(";").filter(Boolean).length) : "0";
            const sendedCardValue = cardMap["IceBreaker Completed"] || "MISSING";
            log("Dashboard — Completed",
                sendedCardValue === sendedCount ? "VERIFIED" : "FAILED",
                `Card: "${sendedCardValue}" | Profile: "${sendedCount}"`);

            // Private Delay
            const privMsgs = profile.messages;
            let privDelay = "N/A";
            if (privMsgs && typeof privMsgs === "object") {
                const first = Object.values(privMsgs)[0];
                if (first && first.intervalSeconds != null) privDelay = first.intervalSeconds + " sec";
            }
            const privCardValue = cardMap["Private Delay"] || "MISSING";
            log("Dashboard — Private Delay",
                privCardValue === privDelay ? "VERIFIED" : "FAILED",
                `Card: "${privCardValue}" | Profile: "${privDelay}"`);

            // Broadcast Delay
            const broadMsgs = profile.broadcast?.messages;
            let broadDelay = "N/A";
            if (broadMsgs && typeof broadMsgs === "object") {
                const first = Object.values(broadMsgs)[0];
                if (first && first.intervalSeconds != null) broadDelay = first.intervalSeconds + " sec";
            }
            const broadCardValue = cardMap["Broadcast Delay"] || "MISSING";
            log("Dashboard — Broadcast Delay",
                broadCardValue === broadDelay ? "VERIFIED" : "FAILED",
                `Card: "${broadCardValue}" | Profile: "${broadDelay}"`);
        }

        // Close companion
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await new Promise(r => setTimeout(r, 400));
    }

    // =========================================================================
    // 8. DIAGNOSTICS — Verify PROFILE fields
    // =========================================================================
    if (crmKey) {
        const profile = JSON.parse(localStorage.getItem(crmKey));

        // Open companion on diagnostics tab
        if (launcher) launcher.click();
        await new Promise(r => setTimeout(r, 400));
        const diagTab2 = Array.from(document.querySelectorAll(".ab-tab")).find(t => t.getAttribute("data-target") === "diagnostics");
        if (diagTab2) diagTab2.click();
        await new Promise(r => setTimeout(r, 200));

        const diagView2 = document.getElementById("ab-view-diagnostics");
        if (diagView2) {
            const diagRows = diagView2.querySelectorAll("tr");
            const diagMap = {};
            diagRows.forEach(row => {
                const cells = row.querySelectorAll("td");
                if (cells.length >= 2) {
                    diagMap[cells[0].textContent] = cells[1].textContent;
                }
            });

            // Profile Key
            log("Diagnostics — Profile Key",
                diagMap["Profile Key"] === crmKey ? "VERIFIED" : "FAILED",
                `Got: "${diagMap["Profile Key"]}" | Expected: "${crmKey}"`);

            // Status (raw)
            const rawStatus = String(profile.status ?? "Unknown");
            log("Diagnostics — Status (raw)",
                diagMap["Status (raw)"] === rawStatus ? "VERIFIED" : "FAILED",
                `Got: "${diagMap["Status (raw)"]}" | Expected: "${rawStatus}"`);

            // Broadcast Status (raw)
            const rawBrStatus = String(profile.broadcast?.status ?? "Unknown");
            log("Diagnostics — Broadcast Status (raw)",
                diagMap["Broadcast Status (raw)"] === rawBrStatus ? "VERIFIED" : "FAILED",
                `Got: "${diagMap["Broadcast Status (raw)"]}" | Expected: "${rawBrStatus}"`);

            // Chain Progress Entries
            const cpEntries = profile.chainProgress && typeof profile.chainProgress === "object"
                ? String(Object.keys(profile.chainProgress).length) : "0";
            log("Diagnostics — Chain Progress Entries",
                diagMap["Chain Progress Entries"] === cpEntries ? "VERIFIED" : "FAILED",
                `Got: "${diagMap["Chain Progress Entries"]}" | Expected: "${cpEntries}"`);

            // Profile Valid
            const isValid = "status" in profile && "chainProgress" in profile;
            log("Diagnostics — Valid",
                diagMap["Valid"] === (isValid ? "Yes" : "No") ? "VERIFIED" : "FAILED",
                `Got: "${diagMap["Valid"]}" | Expected: "${isValid ? "Yes" : "No"}"`);
        }

        // Close companion
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await new Promise(r => setTimeout(r, 400));
    }

    // =========================================================================
    // 9. MANAGER — Verify buttons exist and are wired
    // =========================================================================
    if (launcher) launcher.click();
    await new Promise(r => setTimeout(r, 400));
    const managerTab2 = Array.from(document.querySelectorAll(".ab-tab")).find(t => t.getAttribute("data-target") === "manager");
    if (managerTab2) managerTab2.click();
    await new Promise(r => setTimeout(r, 200));

    const managerView2 = document.getElementById("ab-view-manager");
    if (managerView2) {
        const buttons = managerView2.querySelectorAll("button.ab-btn");
        const btnTexts = Array.from(buttons).map(b => b.textContent.trim());
        log("Manager — Reset IceBreaker button exists",
            btnTexts.some(t => t.includes("Reset IceBreaker")) ? "VERIFIED" : "FAILED");
        log("Manager — New Shift button exists",
            btnTexts.some(t => t.includes("New Shift")) ? "VERIFIED" : "FAILED");
        log("Manager — Change Delays button exists",
            btnTexts.some(t => t.includes("Change Delays")) ? "VERIFIED" : "FAILED");
        log("Manager — Finance Widget button exists",
            btnTexts.some(t => t.includes("Finance Widget")) ? "VERIFIED" : "FAILED");
    }

    // Close companion
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise(r => setTimeout(r, 400));

    // =========================================================================
    // 10. WINDOW BEHAVIOR — Check FinanceWidget existence
    // =========================================================================
    const financeWidget = document.querySelector(".ab-finance");
    log("Finance widget exists (independent window)",
        financeWidget ? "VERIFIED" : "OBSERVED", financeWidget ? "Found" : "Not found — may need Finance to be opened first");

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log("\n" + "=".repeat(60));
    console.log(`EPIC-005 Acceptance Test: ${passed} passed, ${failed} failed, ${results.length} total`);
    console.log("=".repeat(60));
    console.table(results);

    return { passed, failed, total: results.length, results };
})();
