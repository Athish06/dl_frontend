/**
 * SentimentLens — Frontend Application Logic
 * Handles API communication, UI state, and interactions.
 */

// ─── Configuration ──────────────────────────────────────────
const API_BASE = ENV.API_BASE;
console.log('API_BASE loaded:', API_BASE);
console.log('ENV object:', ENV);

// ─── Sample Texts ───────────────────────────────────────────
const SAMPLES = {
    positive:
        "This movie was absolutely incredible! The cinematography was breathtaking, the performances were outstanding, and the storyline kept me on the edge of my seat from start to finish. I laughed, I cried, and I left the theater feeling truly inspired. One of the best films I've seen in years. Highly recommend it to anyone looking for a genuinely moving experience.",
    negative:
        "What a terrible waste of time. The plot made no sense, the acting was wooden, and the dialogue felt like it was written by someone who has never had a real conversation. I kept checking my watch hoping it would end soon. The special effects were laughably bad and the ending was so predictable I called it within the first 10 minutes. Save your money and skip this one.",
    mixed:
        "The film had some genuinely beautiful moments and the lead actor gave a compelling performance, but sadly it was let down by a weak third act and some painfully slow pacing in the middle. The score was haunting and memorable, though the editing choices were questionable at best. It's not a bad movie, but it could have been so much more with tighter direction.",
};

// ─── State ──────────────────────────────────────────────────
let history = JSON.parse(localStorage.getItem("sentimentHistory") || "[]");
let isAnalyzing = false;

// ─── DOM Elements ───────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const textInput = $("#text-input");
const charCount = $("#char-count");
const analyzeBtn = $("#analyze-btn");
const emptyState = $("#empty-state");
const loadingState = $("#loading-state");
const resultsState = $("#results-state");
const errorState = $("#error-state");
const errorText = $("#error-text");
const retryBtn = $("#retry-btn");
const serverStatus = $("#server-status");
const historyList = $("#history-list");
const clearHistoryBtn = $("#clear-history-btn");

// ─── Initialize ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    initInput();
    initSampleButtons();
    initAnalyze();
    initHistory();
    checkServerHealth();
    loadModelInfo();

    // Periodic health check
    setInterval(checkServerHealth, ENV.REQUEST_TIMEOUT);
});

// ─── Tab Navigation ─────────────────────────────────────────
function initTabs() {
    $$(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const tabId = btn.dataset.tab;

            // Buttons
            $$(".tab-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");

            // Panels
            $$(".tab-panel").forEach((p) => p.classList.remove("active"));
            $(`#panel-${tabId}`).classList.add("active");
        });
    });
}

// ─── Text Input ─────────────────────────────────────────────
function initInput() {
    textInput.addEventListener("input", () => {
        const len = textInput.value.length;
        charCount.textContent = `${len.toLocaleString()} chars`;
    });
}

// ─── Sample Buttons ─────────────────────────────────────────
function initSampleButtons() {
    $$(".sample-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const key = btn.dataset.sample;
            textInput.value = SAMPLES[key] || "";
            textInput.dispatchEvent(new Event("input"));
            textInput.focus();
        });
    });
}

// ─── Analyze ────────────────────────────────────────────────
function initAnalyze() {
    analyzeBtn.addEventListener("click", analyze);
    retryBtn.addEventListener("click", analyze);

    // Ctrl+Enter shortcut
    document.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.key === "Enter") {
            e.preventDefault();
            analyze();
        }
    });
}

async function analyze() {
    const text = textInput.value.trim();
    if (!text || isAnalyzing) return;

    isAnalyzing = true;
    analyzeBtn.disabled = true;
    showState("loading");

    const startTime = performance.now();

    try {
        console.log('Making API call to:', `${API_BASE}/predict`);
        console.log('Sending text:', text);

        const res = await fetch(`${API_BASE}/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });

        console.log('API response status:', res.status);
        console.log('API response ok:', res.ok);

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Server error (${res.status})`);
        }

        const data = await res.json();
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

        renderResults(data, elapsed);
        addToHistory(text, data);
        showState("results");
    } catch (err) {
        console.error("Prediction failed:", err);
        console.error("Error details:", err.message);
        console.error("Error stack:", err.stack);
        errorText.textContent = err.message || "Failed to connect to server";
        showState("error");
    } finally {
        isAnalyzing = false;
        analyzeBtn.disabled = false;
    }
}

function showState(state) {
    emptyState.classList.add("hidden");
    loadingState.classList.add("hidden");
    resultsState.classList.add("hidden");
    errorState.classList.add("hidden");

    const el = {
        empty: emptyState,
        loading: loadingState,
        results: resultsState,
        error: errorState,
    }[state];

    if (el) el.classList.remove("hidden");
}

// ─── Render Results ─────────────────────────────────────────
function renderResults(data, elapsed) {
    const isPositive = data.label === "Positive";
    const emoji = isPositive ? "😊" : "😞";
    const confPercent = Math.round(data.confidence * 100);

    // Badge
    const badge = $("#sentiment-badge");
    badge.className = `sentiment-badge ${isPositive ? "positive" : "negative"}`;
    $("#sentiment-emoji").textContent = emoji;
    $("#sentiment-label").textContent = data.label;

    // Confidence ring
    const circumference = 2 * Math.PI * 52; // r=52
    const offset = circumference * (1 - data.confidence);
    const ringFill = $("#ring-fill");
    ringFill.style.stroke = isPositive
        ? "var(--positive)"
        : "var(--negative)";
    // Reset then animate
    ringFill.style.transition = "none";
    ringFill.style.strokeDashoffset = circumference;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            ringFill.style.transition =
                "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)";
            ringFill.style.strokeDashoffset = offset;
        });
    });

    // Animate counter
    animateCounter($("#confidence-value"), 0, confPercent, 800, "%");

    // Probability bars
    const probBars = $("#prob-bars");
    probBars.innerHTML = "";
    Object.entries(data.probabilities).forEach(([label, prob]) => {
        const pct = Math.round(prob * 100);
        const fillClass = label === "Positive" ? "positive-fill" : "negative-fill";

        const row = document.createElement("div");
        row.className = "prob-row";
        row.innerHTML = `
            <span class="prob-label">${label}</span>
            <div class="prob-bar-track">
                <div class="prob-bar-fill ${fillClass}" style="width: 0%"></div>
            </div>
            <span class="prob-value">${pct}%</span>
        `;
        probBars.appendChild(row);

        // Animate bar
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                row.querySelector(".prob-bar-fill").style.width = `${pct}%`;
            });
        });
    });

    // Meta
    $("#meta-words").textContent = data.input_length;
    $("#meta-time").textContent = `${elapsed}s`;
}

function animateCounter(el, from, to, duration, suffix = "") {
    const start = performance.now();
    function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const val = Math.round(from + (to - from) * eased);
        el.textContent = val + suffix;
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// ─── History ────────────────────────────────────────────────
function initHistory() {
    clearHistoryBtn.addEventListener("click", () => {
        history = [];
        localStorage.setItem("sentimentHistory", "[]");
        renderHistory();
    });
    renderHistory();
}

function addToHistory(text, data) {
    history.unshift({
        text: text.slice(0, 120),
        label: data.label,
        confidence: data.confidence,
        timestamp: Date.now(),
    });

    // Keep max 20
    if (history.length > 20) history = history.slice(0, 20);
    localStorage.setItem("sentimentHistory", JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    if (history.length === 0) {
        historyList.innerHTML =
            '<p class="history-empty">No analyses yet. Results will appear here.</p>';
        return;
    }

    historyList.innerHTML = history
        .map(
            (item) => `
        <div class="history-item" title="${escapeHtml(item.text)}">
            <span class="history-sentiment">${item.label === "Positive" ? "😊" : "😞"}</span>
            <span class="history-text">${escapeHtml(item.text)}</span>
            <span class="history-conf">${Math.round(item.confidence * 100)}%</span>
            <span class="history-label ${item.label === "Positive" ? "pos" : "neg"}">${item.label}</span>
        </div>
    `
        )
        .join("");

    // Click to load
    $$(".history-item").forEach((el, i) => {
        el.addEventListener("click", () => {
            textInput.value = history[i].text;
            textInput.dispatchEvent(new Event("input"));
            // Switch to analyze tab
            $('[data-tab="analyze"]').click();
        });
    });
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// ─── Server Health ──────────────────────────────────────────
async function checkServerHealth() {
    const dot = serverStatus.querySelector(".status-dot");
    const text = serverStatus.querySelector(".status-text");

    dot.className = "status-dot checking";
    text.textContent = "Checking...";

    try {
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(ENV.HEALTH_CHECK_TIMEOUT) });
        const data = await res.json();

        if (data.model_loaded) {
            dot.className = "status-dot online";
            text.textContent = "Model Ready";
        } else {
            dot.className = "status-dot offline";
            text.textContent = "Model Not Loaded";
        }
    } catch {
        dot.className = "status-dot offline";
        text.textContent = "Server Offline";
    }
}

// ─── Model Info ─────────────────────────────────────────────
async function loadModelInfo() {
    try {
        const res = await fetch(`${API_BASE}/model-info`);
        if (!res.ok) throw new Error("Not available");
        const data = await res.json();
        renderModelInfo(data);
    } catch {
        // Model info not available yet — that's fine
        console.log("Model info not available yet.");
    }
}

function renderModelInfo(data) {
    // Layers table
    const tbody = $("#layers-tbody");
    if (data.layers && data.layers.length > 0) {
        tbody.innerHTML = data.layers
            .map(
                (l) => `
            <tr>
                <td>${l.name}</td>
                <td>${l.type}</td>
                <td>${l.output_shape}</td>
                <td>${l.params.toLocaleString()}</td>
            </tr>
        `
            )
            .join("");
    }

    // Metrics
    if (data.training) {
        const t = data.training;
        const acc = t.test_accuracy;
        $("#metric-accuracy").textContent =
            acc !== undefined ? `${(acc * 100).toFixed(1)}%` : "—";
        $("#metric-loss").textContent =
            t.test_loss !== undefined ? t.test_loss.toFixed(4) : "—";
        $("#metric-epochs").textContent = t.epochs_trained || "—";
        $("#metric-params").textContent = data.total_params
            ? formatNumber(data.total_params)
            : "—";
        $("#metric-dataset").textContent = t.dataset || "—";
        $("#metric-vocab").textContent = t.vocab_size
            ? t.vocab_size.toLocaleString()
            : "—";

        // Draw chart
        if (t.training_history) {
            drawTrainingChart(t.training_history);
        }
    }
}

function formatNumber(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toString();
}

// ─── Training Chart (Canvas) ────────────────────────────────
function drawTrainingChart(history) {
    const canvas = $("#history-chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // High-DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const pad = { top: 30, right: 20, bottom: 40, left: 50 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    const acc = history.accuracy || [];
    const valAcc = history.val_accuracy || [];
    const epochs = Math.max(acc.length, valAcc.length);
    if (epochs === 0) return;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "#21262d";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = pad.top + (plotH / 5) * i;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(W - pad.right, y);
        ctx.stroke();

        // Y labels
        const val = (1 - i / 5).toFixed(1);
        ctx.fillStyle = "#484f58";
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = "right";
        ctx.fillText(val, pad.left - 8, y + 4);
    }

    // X labels
    ctx.textAlign = "center";
    ctx.fillStyle = "#484f58";
    for (let i = 0; i < epochs; i++) {
        const x = pad.left + (plotW / (epochs - 1 || 1)) * i;
        ctx.fillText(`${i + 1}`, x, H - pad.bottom + 18);
    }

    // Axis labels
    ctx.fillStyle = "#8b949e";
    ctx.font = '12px "Inter", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("Epoch", W / 2, H - 4);

    ctx.save();
    ctx.translate(14, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Accuracy", 0, 0);
    ctx.restore();

    // Draw lines
    function drawLine(data, color, dashed = false) {
        if (data.length === 0) return;

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        if (dashed) ctx.setLineDash([6, 4]);
        else ctx.setLineDash([]);

        data.forEach((v, i) => {
            const x = pad.left + (plotW / (epochs - 1 || 1)) * i;
            const y = pad.top + plotH * (1 - v);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Dots
        data.forEach((v, i) => {
            const x = pad.left + (plotW / (epochs - 1 || 1)) * i;
            const y = pad.top + plotH * (1 - v);
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        });
    }

    drawLine(acc, "#58a6ff", false);
    drawLine(valAcc, "#3fb950", true);

    // Legend
    const legendY = pad.top - 12;
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(pad.left + 12, legendY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#58a6ff";
    ctx.fill();
    ctx.fillStyle = "#8b949e";
    ctx.font = '11px "Inter", sans-serif';
    ctx.textAlign = "left";
    ctx.fillText("Train Acc", pad.left + 22, legendY + 3);

    ctx.beginPath();
    ctx.arc(pad.left + 100, legendY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#3fb950";
    ctx.fill();
    ctx.fillStyle = "#8b949e";
    ctx.fillText("Val Acc", pad.left + 110, legendY + 3);
}

// Redraw chart on resize
window.addEventListener("resize", () => {
    loadModelInfo();
});
