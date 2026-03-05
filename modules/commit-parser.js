// GitInsight – Commit Parsing Engine
// Processes raw GitHub API commit data into aggregated datasets

const CommitParser = {
    /**
     * Parse raw commits into structured data
     */
    parseCommits(rawCommits) {
        return rawCommits.map(c => ({
            sha: c.sha,
            message: c.commit?.message || '',
            date: new Date(c.commit?.author?.date || c.commit?.committer?.date),
            author: {
                name: c.commit?.author?.name || 'Unknown',
                email: c.commit?.author?.email || '',
                login: c.author?.login || c.commit?.author?.name || 'unknown',
                avatar: c.author?.avatar_url || ''
            },
            files: c.files || []
        }));
    },

    /**
     * Compute commit frequency by day
     */
    computeFrequencyByDay(commits) {
        const freq = {};
        commits.forEach(c => {
            const day = c.date.toISOString().split('T')[0];
            freq[day] = (freq[day] || 0) + 1;
        });

        // Sort by date
        return Object.entries(freq)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({ date, count }));
    },

    /**
     * Compute commit frequency by week
     */
    computeFrequencyByWeek(commits) {
        const freq = {};
        commits.forEach(c => {
            const d = c.date;
            const startOfWeek = new Date(d);
            startOfWeek.setDate(d.getDate() - d.getDay());
            const key = startOfWeek.toISOString().split('T')[0];
            freq[key] = (freq[key] || 0) + 1;
        });

        return Object.entries(freq)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({ date, count }));
    },

    /**
     * Compute commit frequency by month
     */
    computeFrequencyByMonth(commits) {
        const freq = {};
        commits.forEach(c => {
            const key = `${c.date.getFullYear()}-${String(c.date.getMonth() + 1).padStart(2, '0')}`;
            freq[key] = (freq[key] || 0) + 1;
        });

        return Object.entries(freq)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({ date, count }));
    },

    /**
     * Compute file modification counts
     */
    computeFileChanges(detailedCommits) {
        const files = {};
        detailedCommits.forEach(c => {
            (c.files || []).forEach(f => {
                if (!files[f.filename]) {
                    files[f.filename] = { filename: f.filename, changes: 0, additions: 0, deletions: 0, commits: 0 };
                }
                files[f.filename].changes += (f.changes || 0);
                files[f.filename].additions += (f.additions || 0);
                files[f.filename].deletions += (f.deletions || 0);
                files[f.filename].commits += 1;
            });
        });

        return Object.values(files).sort((a, b) => b.commits - a.commits);
    },

    /**
     * Compute contributor statistics
     */
    computeContributorStats(commits) {
        const contributors = {};
        commits.forEach(c => {
            const login = c.author.login;
            if (!contributors[login]) {
                contributors[login] = {
                    login,
                    name: c.author.name,
                    avatar: c.author.avatar,
                    commits: 0,
                    firstCommit: c.date,
                    lastCommit: c.date,
                    files: new Set()
                };
            }
            contributors[login].commits += 1;
            if (c.date < contributors[login].firstCommit) contributors[login].firstCommit = c.date;
            if (c.date > contributors[login].lastCommit) contributors[login].lastCommit = c.date;
        });

        return Object.values(contributors)
            .map(c => ({ ...c, files: [...c.files] }))
            .sort((a, b) => b.commits - a.commits);
    },

    /**
     * Compute contributor collaboration edges (shared file modifications)
     */
    computeCollaborationEdges(detailedCommits) {
        // Map each file to the set of contributors who modified it
        const fileContributors = {};
        detailedCommits.forEach(c => {
            const author = c.author?.login || c.commit?.author?.name || 'unknown';
            (c.files || []).forEach(f => {
                if (!fileContributors[f.filename]) fileContributors[f.filename] = new Set();
                fileContributors[f.filename].add(author);
            });
        });

        // Build edges between contributors who share files
        const edges = {};
        Object.values(fileContributors).forEach(contribs => {
            const arr = [...contribs];
            for (let i = 0; i < arr.length; i++) {
                for (let j = i + 1; j < arr.length; j++) {
                    const key = [arr[i], arr[j]].sort().join('::');
                    edges[key] = (edges[key] || 0) + 1;
                }
            }
        });

        return Object.entries(edges).map(([key, weight]) => {
            const [source, target] = key.split('::');
            return { source, target, weight };
        });
    },

    /**
     * Compute code churn (additions + deletions per time period)
     */
    computeCodeChurn(detailedCommits) {
        const churn = {};
        detailedCommits.forEach(c => {
            const date = new Date(c.commit?.author?.date).toISOString().split('T')[0];
            if (!churn[date]) churn[date] = { additions: 0, deletions: 0 };
            (c.files || []).forEach(f => {
                churn[date].additions += (f.additions || 0);
                churn[date].deletions += (f.deletions || 0);
            });
        });

        return Object.entries(churn)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, data]) => ({ date, ...data }));
    },

    /**
     * Build file evolution timeline for replay
     */
    buildFileEvolution(detailedCommits) {
        const sorted = [...detailedCommits].sort((a, b) =>
            new Date(a.commit?.author?.date) - new Date(b.commit?.author?.date)
        );

        const snapshots = [];
        const currentFiles = new Set();

        sorted.forEach((c, index) => {
            const added = [];
            const modified = [];
            const deleted = [];

            (c.files || []).forEach(f => {
                if (f.status === 'added') {
                    currentFiles.add(f.filename);
                    added.push(f.filename);
                } else if (f.status === 'removed') {
                    currentFiles.delete(f.filename);
                    deleted.push(f.filename);
                } else {
                    modified.push(f.filename);
                }
            });

            snapshots.push({
                index,
                sha: c.sha,
                message: c.commit?.message || '',
                date: c.commit?.author?.date,
                author: c.commit?.author?.name || 'Unknown',
                authorLogin: c.author?.login || 'unknown',
                added,
                modified,
                deleted,
                totalFiles: currentFiles.size,
                fileSnapshot: [...currentFiles]
            });
        });

        return snapshots;
    }
};

if (typeof window !== 'undefined') window.CommitParser = CommitParser;
