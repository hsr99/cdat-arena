// ═══════════════════════════════════════════════════════════════════════
// ── GROQ RATE LIMITER — serialized queue, 2.2s gap between calls ──
// Groq free tier: ~30 RPM = ~0.5 RPS → enforce 1 call per 2.2s (safety margin)
// ═══════════════════════════════════════════════════════════════════════
const GROQ_RL = {
  INTERVAL_MS: 2200,          // 2.2s between each Groq call
  _queue: [],                 // pending { fn, label, resolve, reject }
  _running: false,
  _lastCallTime: 0,
  _totalSent: 0,
  _countdownTimer: null,

  // Enqueue a Groq call — returns a Promise that resolves with the API result
  enqueue(fn, label = 'groq call') {
    return new Promise((resolve, reject) => {
      this._queue.push({ fn, label, resolve, reject });
      this._updateUI();
      if (!this._running) this._processNext();
    });
  },

  async _processNext() {
    if (this._queue.length === 0) {
      this._running = false;
      this._updateUI();
      this._stopCountdown();
      return;
    }
    this._running = true;

    // Calculate how long we need to wait before this call is safe
    const now = Date.now();
    const elapsed = now - this._lastCallTime;
    const waitMs = Math.max(0, this.INTERVAL_MS - elapsed);

    if (waitMs > 0) {
      this._startCountdown(waitMs);
      await new Promise(r => setTimeout(r, waitMs));
    }

    const item = this._queue.shift();
    this._lastCallTime = Date.now();
    this._totalSent++;
    this._updateUI();
    this._stopCountdown();

    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (err) {
      item.reject(err);
    }

    // Schedule next — immediate recursion keeps the queue draining
    setTimeout(() => this._processNext(), 0);
  },

  _startCountdown(waitMs) {
    const bar = document.getElementById('rlCountdownBar');
    const nextEl = document.getElementById('rlSbNext');
    if (!bar) return;
    const start = Date.now();
    this._stopCountdown();
    const tick = () => {
      const remaining = Math.max(0, waitMs - (Date.now() - start));
      const pct = ((waitMs - remaining) / waitMs * 100).toFixed(1);
      if (bar) bar.style.width = pct + '%';
      if (nextEl) nextEl.textContent = (remaining / 1000).toFixed(1) + 's';
      if (remaining > 0) this._countdownTimer = requestAnimationFrame(tick);
      else { if (bar) bar.style.width = '100%'; if (nextEl) nextEl.textContent = '—'; }
    };
    this._countdownTimer = requestAnimationFrame(tick);
  },

  _stopCountdown() {
    if (this._countdownTimer) { cancelAnimationFrame(this._countdownTimer); this._countdownTimer = null; }
    const bar = document.getElementById('rlCountdownBar');
    const nextEl = document.getElementById('rlSbNext');
    if (bar) bar.style.width = '0%';
    if (nextEl) nextEl.textContent = '—';
  },

  _updateUI() {
    const qLen = this._queue.length;
    const isActive = this._running || qLen > 0;

    // Topbar badge
    const badge = document.getElementById('rlBadge');
    const qNum  = document.getElementById('rlQueueNum');
    if (badge) { badge.className = 'rl-badge ' + (isActive ? 'rl-active' : 'rl-idle'); }
    if (qNum)  { qNum.textContent = qLen; }

    // Sidebar box
    const box     = document.getElementById('rlSidebarBox');
    const sbQ     = document.getElementById('rlSbQueued');
    const sbTotal = document.getElementById('rlSbTotal');
    const waitList= document.getElementById('rlWaitingList');
    if (box)     { box.className = 'rl-sidebar-box' + (isActive ? ' visible' : ''); }
    if (sbQ)     { sbQ.textContent = qLen; }
    if (sbTotal) { sbTotal.textContent = this._totalSent; }
    if (waitList) {
      waitList.innerHTML = this._queue.slice(0, 5).map(item =>
        `<div class="rl-waiting-item"><div class="rl-waiting-dot"></div>${item.label}</div>`
      ).join('') + (qLen > 5 ? `<div class="rl-waiting-item" style="color:var(--text3);font-style:italic">…+${qLen-5} more</div>` : '');
    }
  },
};
