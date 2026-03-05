// GitInsight – AI Insight Engine
// Heuristic analysis to generate actionable repository insights

const InsightEngine = {
    /**
     * Generate all insights from parsed data
     */
    generateInsights(data) {
        const insights = [];

        if (data.fileChanges?.length) {
            insights.push(...this.analyzeHighChurnFiles(data.fileChanges));
            insights.push(...this.analyzeFileComplexity(data.fileChanges));
        }
        if (data.contributorStats?.length) {
            insights.push(...this.analyzeOwnership(data.contributorStats, data.commits));
            insights.push(...this.analyzeContributorActivity(data.contributorStats));
        }
        if (data.frequency?.length) {
            insights.push(...this.analyzeActivityPatterns(data.frequency));
        }
        if (data.codeChurn?.length) {
            insights.push(...this.analyzeChurn(data.codeChurn));
        }

        return insights.sort((a, b) => b.severity - a.severity);
    },

    /**
     * Identify high-churn files (potential tech debt)
     */
    analyzeHighChurnFiles(fileChanges) {
        const insights = [];
        const avgCommits = fileChanges.reduce((s, f) => s + f.commits, 0) / fileChanges.length;
        const highChurn = fileChanges.filter(f => f.commits > avgCommits * 3);

        if (highChurn.length > 0) {
            insights.push({
                type: 'warning',
                icon: '🔥',
                title: 'High-Churn Files Detected',
                description: `${highChurn.length} file(s) have significantly more modifications than average, suggesting potential technical debt or instability.`,
                details: highChurn.slice(0, 8).map(f => `**${f.filename}** — ${f.commits} commits, ${f.changes} changes`),
                severity: 8,
                category: 'Technical Debt'
            });
        }

        // Files with high deletions relative to additions
        const unstable = fileChanges.filter(f => f.deletions > f.additions * 0.8 && f.commits > 3);
        if (unstable.length > 0) {
            insights.push({
                type: 'info',
                icon: '♻️',
                title: 'Frequently Refactored Files',
                description: `${unstable.length} file(s) show high deletion-to-addition ratios, indicating ongoing refactoring.`,
                details: unstable.slice(0, 5).map(f => `**${f.filename}** — +${f.additions}/-${f.deletions}`),
                severity: 5,
                category: 'Refactoring'
            });
        }

        return insights;
    },

    /**
     * Analyze file complexity based on change volume
     */
    analyzeFileComplexity(fileChanges) {
        const insights = [];
        const largeFiles = fileChanges.filter(f => f.changes > 1000);

        if (largeFiles.length > 0) {
            insights.push({
                type: 'warning',
                icon: '📊',
                title: 'High-Complexity Files',
                description: `${largeFiles.length} file(s) have over 1000 total line changes, suggesting high complexity.`,
                details: largeFiles.slice(0, 5).map(f => `**${f.filename}** — ${f.changes} total changes`),
                severity: 7,
                category: 'Complexity'
            });
        }

        return insights;
    },

    /**
     * Analyze code ownership concentration
     */
    analyzeOwnership(contributorStats, commits) {
        const insights = [];
        const totalCommits = commits.length;

        if (contributorStats.length > 0) {
            const topContributor = contributorStats[0];
            const percentage = ((topContributor.commits / totalCommits) * 100).toFixed(1);

            if (percentage > 60) {
                insights.push({
                    type: 'warning',
                    icon: '👤',
                    title: 'Bus Factor Risk',
                    description: `**${topContributor.name || topContributor.login}** owns ${percentage}% of all commits. This is a single point of failure risk.`,
                    details: [`${topContributor.commits} out of ${totalCommits} commits`],
                    severity: 9,
                    category: 'Team'
                });
            }

            // Show top contributors
            if (contributorStats.length >= 3) {
                insights.push({
                    type: 'info',
                    icon: '👥',
                    title: 'Top Contributors',
                    description: `The repository has ${contributorStats.length} contributor(s).`,
                    details: contributorStats.slice(0, 5).map(c =>
                        `**${c.name || c.login}** — ${c.commits} commits (${((c.commits / totalCommits) * 100).toFixed(1)}%)`
                    ),
                    severity: 3,
                    category: 'Team'
                });
            }
        }

        return insights;
    },

    /**
     * Analyze contributor activity patterns
     */
    analyzeContributorActivity(contributorStats) {
        const insights = [];
        const now = new Date();
        const inactive = contributorStats.filter(c => {
            const lastActive = new Date(c.lastCommit);
            return (now - lastActive) > 90 * 24 * 60 * 60 * 1000; // 90 days
        });

        if (inactive.length > 0 && contributorStats.length > 3) {
            insights.push({
                type: 'info',
                icon: '💤',
                title: 'Inactive Contributors',
                description: `${inactive.length} contributor(s) haven't committed in 90+ days.`,
                details: inactive.slice(0, 5).map(c =>
                    `**${c.name || c.login}** — last active ${new Date(c.lastCommit).toLocaleDateString()}`
                ),
                severity: 4,
                category: 'Team'
            });
        }

        return insights;
    },

    /**
     * Analyze activity patterns for spikes
     */
    analyzeActivityPatterns(frequency) {
        const insights = [];
        if (frequency.length < 7) return insights;

        const counts = frequency.map(f => f.count);
        const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
        const stdDev = Math.sqrt(counts.reduce((s, c) => s + Math.pow(c - avg, 2), 0) / counts.length);

        const spikes = frequency.filter(f => f.count > avg + 2 * stdDev);
        if (spikes.length > 0) {
            insights.push({
                type: 'info',
                icon: '📈',
                title: 'Activity Spikes Detected',
                description: `${spikes.length} period(s) of unusually high activity found.`,
                details: spikes.slice(0, 5).map(s => `**${s.date}** — ${s.count} commits`),
                severity: 4,
                category: 'Activity'
            });
        }

        return insights;
    },

    /**
     * Analyze code churn patterns
     */
    analyzeChurn(codeChurn) {
        const insights = [];
        const totalAdditions = codeChurn.reduce((s, c) => s + c.additions, 0);
        const totalDeletions = codeChurn.reduce((s, c) => s + c.deletions, 0);
        const churnRatio = totalDeletions / (totalAdditions || 1);

        if (churnRatio > 0.7) {
            insights.push({
                type: 'info',
                icon: '🔄',
                title: 'High Code Churn',
                description: `The deletion-to-addition ratio is ${(churnRatio * 100).toFixed(0)}%, indicating significant code rewriting.`,
                details: [`Total additions: ${totalAdditions.toLocaleString()}`, `Total deletions: ${totalDeletions.toLocaleString()}`],
                severity: 6,
                category: 'Churn'
            });
        }

        return insights;
    }
};

if (typeof window !== 'undefined') window.InsightEngine = InsightEngine;
