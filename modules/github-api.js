// GitInsight – GitHub API Integration Module
// Fetches commit history, file stats, and contributor data

const GitHubAPI = {
    BASE_URL: 'https://api.github.com',

    /**
     * Make an API request through the background service worker to avoid CORS
     */
    async request(url, token = null) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { type: 'FETCH_API', url, token },
                (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (response.error) {
                        reject(new Error(response.error));
                        return;
                    }
                    resolve(response);
                }
            );
        });
    },

    /**
     * Parse Link header for pagination
     */
    parseLinkHeader(linkHeader) {
        if (!linkHeader) return {};
        const links = {};
        linkHeader.split(',').forEach(part => {
            const match = part.match(/<([^>]+)>;\s*rel="(\w+)"/);
            if (match) links[match[2]] = match[1];
        });
        return links;
    },

    /**
     * Fetch all commits with pagination (up to maxPages)
     */
    async fetchCommits(owner, repo, options = {}) {
        const { maxPages = 10, perPage = 100, onProgress = null } = options;
        let allCommits = [];
        let url = `${this.BASE_URL}/repos/${owner}/${repo}/commits?per_page=${perPage}`;
        let page = 0;

        while (url && page < maxPages) {
            const response = await this.request(url);

            if (response.status === 403) {
                const resetTime = response.rateLimitReset;
                throw new Error(`Rate limit exceeded. Resets at ${new Date(resetTime * 1000).toLocaleTimeString()}`);
            }

            if (Array.isArray(response.data)) {
                allCommits = allCommits.concat(response.data);
            } else {
                break;
            }

            page++;
            if (onProgress) onProgress(allCommits.length, page);

            const links = this.parseLinkHeader(response.linkHeader);
            url = links.next || null;

            // Small delay to be respectful of rate limits
            if (url) await new Promise(r => setTimeout(r, 100));
        }

        return allCommits;
    },

    /**
     * Fetch detailed commit info (files changed) for a single commit
     */
    async fetchCommitDetail(owner, repo, sha) {
        const url = `${this.BASE_URL}/repos/${owner}/${repo}/commits/${sha}`;
        const response = await this.request(url);
        if (response.status === 403) {
            throw new Error('Rate limit exceeded. Add a GitHub token via the extension popup.');
        }
        return response.data;
    },

    /**
     * Fetch commit details in batches
     */
    async fetchCommitDetails(owner, repo, shas, options = {}) {
        const { batchSize = 5, onProgress = null } = options;
        const results = [];

        for (let i = 0; i < shas.length; i += batchSize) {
            const batch = shas.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(sha => this.fetchCommitDetail(owner, repo, sha).catch(() => null))
            );
            results.push(...batchResults.filter(Boolean));

            if (onProgress) onProgress(results.length, shas.length);
            if (i + batchSize < shas.length) await new Promise(r => setTimeout(r, 200));
        }

        return results;
    },

    /**
     * Fetch repository info
     */
    async fetchRepoInfo(owner, repo) {
        const url = `${this.BASE_URL}/repos/${owner}/${repo}`;
        const response = await this.request(url);
        return response.data;
    },

    /**
     * Fetch contributors
     */
    async fetchContributors(owner, repo) {
        const url = `${this.BASE_URL}/repos/${owner}/${repo}/contributors?per_page=100`;
        const response = await this.request(url);
        return response.data;
    },

    /**
     * Fetch file tree (latest)
     */
    async fetchTree(owner, repo, sha = 'HEAD') {
        const url = `${this.BASE_URL}/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`;
        const response = await this.request(url);
        return response.data;
    }
};

// Export for use in dashboard
if (typeof window !== 'undefined') window.GitHubAPI = GitHubAPI;
