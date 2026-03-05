// GitInsight – Dashboard Controller
// Orchestrates data fetching, tab switching, and visualization rendering

(function () {
    'use strict';

    // Parse URL params
    const params = new URLSearchParams(window.location.search);
    const owner = params.get('owner');
    const repo = params.get('repo');

    if (!owner || !repo) {
        showError('Invalid Parameters', 'Repository owner and name are required.');
        return;
    }

    // State
    let state = {
        commits: [],
        detailedCommits: [],
        frequency: { day: [], week: [], month: [] },
        fileChanges: [],
        contributorStats: [],
        collaborationEdges: [],
        codeChurn: [],
        fileEvolution: [],
        insights: [],
        currentTab: 'timeline',
        currentGrouping: 'week',
        isLoading: false,
        hasDetailedData: false
    };

    // DOM elements
    const repoNameEl = document.getElementById('gi-repo-name');
    const loadingEl = document.getElementById('gi-loading-indicator');
    const loadingTextEl = document.getElementById('gi-loading-text');
    const progressBar = document.getElementById('gi-progress-bar');
    const progressFill = document.getElementById('gi-progress-fill');
    const errorEl = document.getElementById('gi-error');

    // Init
    repoNameEl.textContent = `${owner}/${repo}`;
    setupTabs();
    setupButtons();
    loadData();

    // ====== Tab Management ======

    function setupTabs() {
        document.querySelectorAll('.gi-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                switchTab(tabName);
            });
        });
    }

    function switchTab(tabName) {
        state.currentTab = tabName;

        document.querySelectorAll('.gi-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.gi-tab[data-tab="${tabName}"]`).classList.add('active');

        document.querySelectorAll('.gi-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`gi-panel-${tabName}`).classList.add('active');

        renderCurrentTab();
    }

    // ====== Button Handlers ======

    function setupButtons() {
        document.getElementById('gi-close-btn').addEventListener('click', () => {
            window.parent.postMessage({ type: 'GITINSIGHT_CLOSE' }, '*');
        });

        document.getElementById('gi-refresh-btn').addEventListener('click', () => {
            Cache.clear(`${owner}/${repo}`).then(() => loadData());
        });

        document.getElementById('gi-error-retry').addEventListener('click', () => {
            errorEl.style.display = 'none';
            loadData();
        });
    }

    // ====== Data Loading ======

    async function loadData() {
        if (state.isLoading) return;
        state.isLoading = true;
        showLoading('Checking cache...');

        try {
            // Check cache first
            const cacheKey = `${owner}/${repo}`;
            const cached = await Cache.get(cacheKey);

            if (cached) {
                state = { ...state, ...cached };
                hideLoading();
                renderCurrentTab();
                // Fetch detailed data in background if not cached
                if (!cached.hasDetailedData) {
                    fetchDetailedData();
                }
                state.isLoading = false;
                return;
            }

            // Fetch commits
            showLoading('Fetching commits...');
            showProgress(0);

            const rawCommits = await GitHubAPI.fetchCommits(owner, repo, {
                maxPages: 10,
                perPage: 100,
                onProgress: (count, page) => {
                    showLoading(`Fetching commits... (${count} loaded)`);
                    showProgress(page * 10);
                }
            });

            if (!rawCommits || rawCommits.length === 0) {
                throw new Error('No commits found. The repository may be empty or private.');
            }

            showLoading(`Processing ${rawCommits.length} commits...`);
            showProgress(60);

            // Parse commits
            state.commits = CommitParser.parseCommits(rawCommits);
            state.frequency.day = CommitParser.computeFrequencyByDay(state.commits);
            state.frequency.week = CommitParser.computeFrequencyByWeek(state.commits);
            state.frequency.month = CommitParser.computeFrequencyByMonth(state.commits);
            state.contributorStats = CommitParser.computeContributorStats(state.commits);

            showProgress(80);

            // Generate initial insights
            state.insights = InsightEngine.generateInsights({
                commits: state.commits,
                frequency: state.frequency.week,
                contributorStats: state.contributorStats,
                fileChanges: [],
                codeChurn: []
            });

            showProgress(100);

            // Cache basic data
            await Cache.set(cacheKey, {
                commits: state.commits,
                frequency: state.frequency,
                contributorStats: state.contributorStats,
                insights: state.insights,
                hasDetailedData: false
            });

            hideLoading();
            hideProgress();
            renderCurrentTab();

            // Fetch detailed data in background
            fetchDetailedData();

        } catch (err) {
            hideLoading();
            hideProgress();
            const isRateLimit = err.message?.includes('Rate limit') || err.message?.includes('rate limit') || err.message?.includes('403');
            if (isRateLimit) {
                showError(
                    'API Rate Limit Exceeded',
                    'GitHub limits unauthenticated requests to 60/hour. Click the GitInsight icon in your toolbar and add a GitHub Personal Access Token to get 5,000 requests/hour. Generate one at github.com/settings/tokens (no scopes needed for public repos).'
                );
            } else {
                showError('Failed to Load Data', err.message);
            }
        }

        state.isLoading = false;
    }

    async function fetchDetailedData() {
        try {
            showLoading('Fetching file details...');

            // Sample commits for detailed data (fetch details for up to 100 commits)
            const sampleSize = Math.min(state.commits.length, 100);
            const step = Math.max(1, Math.floor(state.commits.length / sampleSize));
            const sampledShas = state.commits
                .filter((_, i) => i % step === 0)
                .slice(0, sampleSize)
                .map(c => c.sha);

            const detailed = await GitHubAPI.fetchCommitDetails(owner, repo, sampledShas, {
                batchSize: 5,
                onProgress: (done, total) => {
                    showLoading(`Fetching file details... (${done}/${total})`);
                }
            });

            state.detailedCommits = detailed;
            state.fileChanges = CommitParser.computeFileChanges(detailed);
            state.collaborationEdges = CommitParser.computeCollaborationEdges(detailed);
            state.codeChurn = CommitParser.computeCodeChurn(detailed);
            state.fileEvolution = CommitParser.buildFileEvolution(detailed);
            state.hasDetailedData = true;

            // Regenerate insights with full data
            state.insights = InsightEngine.generateInsights({
                commits: state.commits,
                frequency: state.frequency.week,
                contributorStats: state.contributorStats,
                fileChanges: state.fileChanges,
                codeChurn: state.codeChurn
            });

            // Update cache
            const cacheKey = `${owner}/${repo}`;
            await Cache.set(cacheKey, {
                commits: state.commits,
                frequency: state.frequency,
                contributorStats: state.contributorStats,
                fileChanges: state.fileChanges,
                collaborationEdges: state.collaborationEdges,
                codeChurn: state.codeChurn,
                fileEvolution: state.fileEvolution,
                insights: state.insights,
                hasDetailedData: true
            });

            hideLoading();
            renderCurrentTab();

        } catch (err) {
            console.warn('Failed to fetch detailed data:', err);
            hideLoading();
        }
    }

    // ====== Rendering ======

    function renderCurrentTab() {
        requestAnimationFrame(() => {
            switch (state.currentTab) {
                case 'timeline': renderTimeline(); break;
                case 'heatmap': renderHeatmap(); break;
                case 'contributors': renderContributors(); break;
                case 'evolution': renderEvolution(); break;
                case 'replay': renderReplay(); break;
                case 'insights': renderInsights(); break;
            }
        });
    }

    function renderTimeline() {
        const panel = document.getElementById('gi-panel-timeline');
        const data = state.frequency[state.currentGrouping];
        TimelineViz.render(panel, data, {
            onGroupChange: (grouping) => {
                state.currentGrouping = grouping;
                TimelineViz.updateData(state.frequency[grouping]);
            }
        });
    }

    function renderHeatmap() {
        const panel = document.getElementById('gi-panel-heatmap');
        if (!state.hasDetailedData) {
            panel.innerHTML = `
        <div class="gi-empty-state">
          <div class="gi-spinner"></div>
          <p>Loading file change data...</p>
          <p class="gi-text-muted">This requires fetching individual commit details.</p>
        </div>
      `;
            return;
        }
        HeatmapViz.render(panel, state.fileChanges);
    }

    function renderContributors() {
        const panel = document.getElementById('gi-panel-contributors');
        ContributorsViz.render(panel, state.contributorStats, state.collaborationEdges);
    }

    function renderEvolution() {
        const panel = document.getElementById('gi-panel-evolution');
        if (!state.hasDetailedData) {
            panel.innerHTML = `
        <div class="gi-empty-state">
          <div class="gi-spinner"></div>
          <p>Loading file evolution data...</p>
        </div>
      `;
            return;
        }
        EvolutionViz.render(panel, state.fileChanges, state.commits);
    }

    function renderReplay() {
        const panel = document.getElementById('gi-panel-replay');
        if (!state.hasDetailedData || state.fileEvolution.length === 0) {
            panel.innerHTML = `
        <div class="gi-empty-state">
          <div class="gi-spinner"></div>
          <p>Loading replay data...</p>
          <p class="gi-text-muted">This requires detailed commit analysis.</p>
        </div>
      `;
            return;
        }
        ReplayViz.render(panel, state.fileEvolution);
    }

    function renderInsights() {
        const panel = document.getElementById('gi-panel-insights');
        panel.innerHTML = '';

        if (state.insights.length === 0) {
            panel.innerHTML = '<div class="gi-empty-state">No insights generated yet. Data is still loading...</div>';
            return;
        }

        const header = document.createElement('div');
        header.className = 'gi-insights-header';
        header.innerHTML = `
      <h2>Repository Insights</h2>
      <p class="gi-text-muted">${state.insights.length} insight(s) generated from ${state.commits.length} commits</p>
    `;
        panel.appendChild(header);

        state.insights.forEach(insight => {
            const card = document.createElement('div');
            card.className = `gi-insight-card gi-insight-${insight.type}`;
            card.innerHTML = `
        <div class="gi-insight-header">
          <span class="gi-insight-icon">${insight.icon}</span>
          <div>
            <h3>${insight.title}</h3>
            <span class="gi-insight-category">${insight.category}</span>
          </div>
          <span class="gi-insight-severity" title="Severity: ${insight.severity}/10">
            ${'●'.repeat(Math.min(insight.severity, 10))}${'○'.repeat(Math.max(0, 10 - insight.severity))}
          </span>
        </div>
        <p class="gi-insight-desc">${insight.description}</p>
        ${insight.details?.length ? `
          <ul class="gi-insight-details">
            ${insight.details.map(d => `<li>${d}</li>`).join('')}
          </ul>
        ` : ''}
      `;
            panel.appendChild(card);
        });
    }

    // ====== UI Helpers ======

    function showLoading(text) {
        loadingEl.style.display = 'flex';
        loadingTextEl.textContent = text;
    }

    function hideLoading() {
        loadingEl.style.display = 'none';
    }

    function showProgress(pct) {
        progressBar.style.display = 'block';
        progressFill.style.width = `${Math.min(100, pct)}%`;
    }

    function hideProgress() {
        progressBar.style.display = 'none';
        progressFill.style.width = '0%';
    }

    function showError(title, message) {
        errorEl.style.display = 'flex';
        document.getElementById('gi-error-title').textContent = title;
        document.getElementById('gi-error-message').textContent = message;
    }

    // Listen for close message from parent
    window.addEventListener('message', (e) => {
        if (e.data?.type === 'GITINSIGHT_CLOSE') {
            window.parent.postMessage({ type: 'GITINSIGHT_CLOSE' }, '*');
        }
    });

})();
