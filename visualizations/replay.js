// GitInsight – Repo Replay ("Git Time Machine")
// Commit-by-commit animated replay of repository evolution

const ReplayViz = {
    currentFrame: 0,
    isPlaying: false,
    playInterval: null,
    snapshots: [],
    speed: 800, // ms per frame

    render(container, snapshots) {
        container.innerHTML = '';
        this.snapshots = snapshots || [];
        this.currentFrame = 0;
        this.isPlaying = false;

        if (!snapshots || snapshots.length === 0) {
            container.innerHTML = '<div class="gi-empty-state">No replay data available. Detailed commit data is required for replay.</div>';
            return;
        }

        // Transport controls
        const transport = document.createElement('div');
        transport.className = 'gi-replay-transport';
        transport.innerHTML = `
      <div class="gi-replay-controls">
        <button id="gi-replay-start" class="gi-btn gi-btn-icon" title="Jump to start">⏮</button>
        <button id="gi-replay-prev" class="gi-btn gi-btn-icon" title="Previous commit">⏪</button>
        <button id="gi-replay-play" class="gi-btn gi-btn-primary gi-btn-icon" title="Play/Pause">▶️</button>
        <button id="gi-replay-next" class="gi-btn gi-btn-icon" title="Next commit">⏩</button>
        <button id="gi-replay-end" class="gi-btn gi-btn-icon" title="Jump to end">⏭</button>
      </div>
      <div class="gi-replay-scrubber">
        <input type="range" id="gi-replay-slider" min="0" max="${snapshots.length - 1}" value="0" class="gi-slider"/>
        <span id="gi-replay-counter" class="gi-replay-counter">1 / ${snapshots.length}</span>
      </div>
      <div class="gi-replay-speed">
        <label>Speed:</label>
        <select id="gi-replay-speed" class="gi-select">
          <option value="1500">0.5x</option>
          <option value="800" selected>1x</option>
          <option value="400">2x</option>
          <option value="200">4x</option>
        </select>
      </div>
    `;
        container.appendChild(transport);

        // Commit info panel
        const commitInfo = document.createElement('div');
        commitInfo.id = 'gi-replay-commit-info';
        commitInfo.className = 'gi-replay-info';
        container.appendChild(commitInfo);

        // Visualization area
        const vizArea = document.createElement('div');
        vizArea.id = 'gi-replay-viz';
        vizArea.style.width = '100%';
        vizArea.style.height = '420px';
        vizArea.style.position = 'relative';
        container.appendChild(vizArea);

        // File list
        const fileList = document.createElement('div');
        fileList.id = 'gi-replay-files';
        fileList.className = 'gi-replay-files';
        container.appendChild(fileList);

        // Bind events
        this.bindEvents(container);
        this.showFrame(0);
    },

    bindEvents(container) {
        const playBtn = container.querySelector('#gi-replay-play');
        const prevBtn = container.querySelector('#gi-replay-prev');
        const nextBtn = container.querySelector('#gi-replay-next');
        const startBtn = container.querySelector('#gi-replay-start');
        const endBtn = container.querySelector('#gi-replay-end');
        const slider = container.querySelector('#gi-replay-slider');
        const speedSelect = container.querySelector('#gi-replay-speed');

        playBtn.addEventListener('click', () => this.togglePlay(playBtn));
        prevBtn.addEventListener('click', () => this.stepFrame(-1));
        nextBtn.addEventListener('click', () => this.stepFrame(1));
        startBtn.addEventListener('click', () => { this.currentFrame = 0; this.showFrame(0); this.updateSlider(slider); });
        endBtn.addEventListener('click', () => { this.currentFrame = this.snapshots.length - 1; this.showFrame(this.currentFrame); this.updateSlider(slider); });

        slider.addEventListener('input', (e) => {
            this.currentFrame = parseInt(e.target.value);
            this.showFrame(this.currentFrame);
        });

        speedSelect.addEventListener('change', (e) => {
            this.speed = parseInt(e.target.value);
            if (this.isPlaying) {
                clearInterval(this.playInterval);
                this.startAutoPlay(document.querySelector('#gi-replay-play'), slider);
            }
        });
    },

    togglePlay(btn) {
        const slider = document.querySelector('#gi-replay-slider');
        if (this.isPlaying) {
            this.pause(btn);
        } else {
            this.startAutoPlay(btn, slider);
        }
    },

    startAutoPlay(btn, slider) {
        this.isPlaying = true;
        btn.textContent = '⏸️';
        this.playInterval = setInterval(() => {
            if (this.currentFrame >= this.snapshots.length - 1) {
                this.pause(btn);
                return;
            }
            this.currentFrame++;
            this.showFrame(this.currentFrame);
            this.updateSlider(slider);
        }, this.speed);
    },

    pause(btn) {
        this.isPlaying = false;
        btn.textContent = '▶️';
        clearInterval(this.playInterval);
    },

    stepFrame(delta) {
        const newFrame = Math.max(0, Math.min(this.snapshots.length - 1, this.currentFrame + delta));
        this.currentFrame = newFrame;
        this.showFrame(newFrame);
        const slider = document.querySelector('#gi-replay-slider');
        if (slider) this.updateSlider(slider);
    },

    updateSlider(slider) {
        if (slider) slider.value = this.currentFrame;
        const counter = document.querySelector('#gi-replay-counter');
        if (counter) counter.textContent = `${this.currentFrame + 1} / ${this.snapshots.length}`;
    },

    showFrame(index) {
        const snap = this.snapshots[index];
        if (!snap) return;

        // Update commit info
        const infoEl = document.querySelector('#gi-replay-commit-info');
        if (infoEl) {
            const date = snap.date ? new Date(snap.date).toLocaleDateString() : '';
            infoEl.innerHTML = `
        <div class="gi-replay-meta">
          <span class="gi-replay-sha">${snap.sha?.slice(0, 7) || ''}</span>
          <span class="gi-replay-author">${snap.author}</span>
          <span class="gi-replay-date">${date}</span>
        </div>
        <div class="gi-replay-message">${this.escapeHtml(snap.message?.split('\n')[0] || '')}</div>
        <div class="gi-replay-stats">
          <span class="gi-added">+${snap.added?.length || 0} added</span>
          <span class="gi-modified">~${snap.modified?.length || 0} modified</span>
          <span class="gi-deleted">-${snap.deleted?.length || 0} deleted</span>
          <span class="gi-total">${snap.totalFiles || 0} total files</span>
        </div>
      `;
        }

        // Update counter
        const counter = document.querySelector('#gi-replay-counter');
        if (counter) counter.textContent = `${index + 1} / ${this.snapshots.length}`;

        // Draw file visualization
        this.drawFileViz(snap);

        // Update file list
        this.drawFileList(snap);
    },

    drawFileViz(snap) {
        const vizArea = document.querySelector('#gi-replay-viz');
        if (!vizArea) return;

        const width = vizArea.clientWidth;
        const height = vizArea.clientHeight || 420;

        // Limit files for performance
        const files = (snap.fileSnapshot || []).slice(0, 200);
        if (files.length === 0) {
            vizArea.innerHTML = '<div class="gi-empty-state" style="padding-top:100px;">No files yet</div>';
            return;
        }

        vizArea.innerHTML = '';

        const svg = d3.select(vizArea)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const addedSet = new Set(snap.added || []);
        const modifiedSet = new Set(snap.modified || []);
        const deletedSet = new Set(snap.deleted || []);

        // Build a simple hierarchy
        const root = { name: 'repo', children: [] };
        const dirMap = {};

        files.forEach(f => {
            const parts = f.split('/');
            let current = root;
            for (let i = 0; i < parts.length - 1; i++) {
                const key = parts.slice(0, i + 1).join('/');
                if (!dirMap[key]) {
                    const node = { name: parts[i], children: [] };
                    current.children.push(node);
                    dirMap[key] = node;
                }
                current = dirMap[key];
            }
            current.children.push({ name: parts[parts.length - 1], fullPath: f, value: 1 });
        });

        const pack = d3.pack()
            .size([width - 4, height - 4])
            .padding(2);

        const hierarchy = d3.hierarchy(root).sum(d => d.value || 0);
        pack(hierarchy);

        const node = svg.selectAll('circle')
            .data(hierarchy.leaves())
            .join('circle')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', 0)
            .attr('fill', d => {
                const fp = d.data.fullPath;
                if (addedSet.has(fp)) return '#22c55e';
                if (modifiedSet.has(fp)) return '#6366f1';
                if (deletedSet.has(fp)) return '#ef4444';
                return '#334155';
            })
            .attr('fill-opacity', d => {
                const fp = d.data.fullPath;
                if (addedSet.has(fp) || modifiedSet.has(fp)) return 0.9;
                return 0.5;
            })
            .attr('stroke', d => {
                const fp = d.data.fullPath;
                if (addedSet.has(fp)) return '#4ade80';
                if (modifiedSet.has(fp)) return '#818cf8';
                return 'none';
            })
            .attr('stroke-width', d => {
                const fp = d.data.fullPath;
                if (addedSet.has(fp) || modifiedSet.has(fp)) return 2;
                return 0;
            });

        // Animate in
        node.transition()
            .duration(300)
            .attr('r', d => d.r);

        // Pulse effect for modified files
        node.filter(d => modifiedSet.has(d.data.fullPath))
            .append('animate')
            .attr('attributeName', 'r')
            .attr('values', d => `${d.r};${d.r + 3};${d.r}`)
            .attr('dur', '1s')
            .attr('repeatCount', '3');

        // Labels
        svg.selectAll('text')
            .data(hierarchy.leaves().filter(d => d.r > 12))
            .join('text')
            .attr('x', d => d.x)
            .attr('y', d => d.y + 3)
            .attr('text-anchor', 'middle')
            .attr('fill', '#e2e8f0')
            .attr('font-size', '8px')
            .attr('font-family', 'monospace')
            .text(d => {
                const n = d.data.name;
                const maxLen = Math.floor(d.r / 3);
                return n.length > maxLen ? n.slice(0, maxLen) : n;
            })
            .style('pointer-events', 'none');
    },

    drawFileList(snap) {
        const fileList = document.querySelector('#gi-replay-files');
        if (!fileList) return;

        const items = [];
        (snap.added || []).forEach(f => items.push(`<div class="gi-file-item gi-file-added">+ ${f}</div>`));
        (snap.modified || []).forEach(f => items.push(`<div class="gi-file-item gi-file-modified">~ ${f}</div>`));
        (snap.deleted || []).forEach(f => items.push(`<div class="gi-file-item gi-file-deleted">- ${f}</div>`));

        fileList.innerHTML = items.length > 0
            ? `<h4>Changed Files</h4>${items.join('')}`
            : '<div class="gi-empty-state" style="padding:10px;">No file changes in this commit</div>';
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    destroy() {
        if (this.playInterval) clearInterval(this.playInterval);
        this.isPlaying = false;
        this.snapshots = [];
    }
};

if (typeof window !== 'undefined') window.ReplayViz = ReplayViz;
