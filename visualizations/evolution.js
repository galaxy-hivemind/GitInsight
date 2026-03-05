// GitInsight – Repository Evolution Visualization
// Animated tree/pack layout showing file structure changes over time

const EvolutionViz = {
    render(container, fileChanges, commits) {
        container.innerHTML = '';

        if (!fileChanges || fileChanges.length === 0) {
            container.innerHTML = '<div class="gi-empty-state">No file evolution data available.</div>';
            return;
        }

        // Stats
        const statsDiv = document.createElement('div');
        statsDiv.className = 'gi-stats-bar';
        const dirs = new Set(fileChanges.map(f => f.filename.split('/').slice(0, -1).join('/') || '.'));
        statsDiv.innerHTML = `
      <div class="gi-stat">
        <span class="gi-stat-value">${fileChanges.length}</span>
        <span class="gi-stat-label">Files Tracked</span>
      </div>
      <div class="gi-stat">
        <span class="gi-stat-value">${dirs.size}</span>
        <span class="gi-stat-label">Directories</span>
      </div>
      <div class="gi-stat">
        <span class="gi-stat-value">${fileChanges.reduce((s, f) => s + f.changes, 0).toLocaleString()}</span>
        <span class="gi-stat-label">Total Changes</span>
      </div>
    `;
        container.appendChild(statsDiv);

        // Chart container
        const chartDiv = document.createElement('div');
        chartDiv.id = 'gi-evolution-chart';
        chartDiv.style.width = '100%';
        chartDiv.style.height = '550px';
        container.appendChild(chartDiv);

        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'gi-tooltip';
        tooltip.style.display = 'none';
        container.appendChild(tooltip);

        this.drawBubbleChart(chartDiv, tooltip, fileChanges.slice(0, 200));
    },

    drawBubbleChart(container, tooltip, files) {
        // Robust dimension detection
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 550;

        // Build hierarchy from file paths
        const root = { name: 'repo', children: [] };
        const dirMap = {};

        files.forEach(f => {
            const parts = f.filename.split('/');
            let current = root;

            // Navigate/create directory structure
            for (let i = 0; i < parts.length - 1; i++) {
                const dirName = parts.slice(0, i + 1).join('/');
                if (!dirMap[dirName]) {
                    const node = { name: parts[i], children: [] };
                    current.children.push(node);
                    dirMap[dirName] = node;
                }
                current = dirMap[dirName];
            }

            // Add file leaf
            current.children.push({
                name: parts[parts.length - 1],
                fullPath: f.filename,
                value: f.changes || 1,
                commits: f.commits,
                additions: f.additions,
                deletions: f.deletions
            });
        });

        // Color scale for activity
        const maxChanges = d3.max(files, f => f.changes) || 1;
        const colorScale = d3.scaleSequential()
            .domain([0, maxChanges])
            .interpolator(d3.interpolateRgbBasis(['#22d3ee', '#6366f1', '#a855f7', '#f43f5e']));

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const pack = d3.pack()
            .size([width - 4, height - 4])
            .padding(3);

        const hierarchy = d3.hierarchy(root)
            .sum(d => d.value || 0)
            .sort((a, b) => b.value - a.value);

        pack(hierarchy);

        // Draw circles
        const node = svg.selectAll('g')
            .data(hierarchy.descendants())
            .join('g')
            .attr('transform', d => `translate(${d.x},${d.y})`);

        node.append('circle')
            .attr('r', d => d.r)
            .attr('fill', d => {
                if (d.children) return 'rgba(30, 41, 59, 0.5)'; // Directory
                return colorScale(d.data.value || 0);
            })
            .attr('fill-opacity', d => d.children ? 0.3 : 0.75)
            .attr('stroke', d => d.children ? '#334155' : colorScale(d.data.value || 0))
            .attr('stroke-width', d => d.children ? 1 : 0.5)
            .style('cursor', d => d.children ? 'default' : 'pointer')
            .on('mouseover', (event, d) => {
                if (d.children) return;
                tooltip.style.display = 'block';
                tooltip.innerHTML = `
          <strong>${d.data.fullPath || d.data.name}</strong><br/>
          Changes: ${d.data.value || 0}<br/>
          Commits: ${d.data.commits || 0}<br/>
          +${d.data.additions || 0} / -${d.data.deletions || 0}
        `;
            })
            .on('mousemove', (event) => {
                tooltip.style.left = (event.offsetX + 10) + 'px';
                tooltip.style.top = (event.offsetY - 10) + 'px';
            })
            .on('mouseout', () => { tooltip.style.display = 'none'; });

        // Labels for directories and large files
        node.filter(d => d.r > 20)
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', d => d.children ? -d.r + 14 : 4)
            .attr('fill', d => d.children ? '#64748b' : '#e2e8f0')
            .attr('font-size', d => d.children ? '12px' : '10px')
            .attr('font-weight', d => d.children ? '600' : '400')
            .attr('font-family', '-apple-system, BlinkMacSystemFont, sans-serif')
            .text(d => {
                const name = d.data.name;
                const maxLen = Math.floor(d.r / 4);
                return name.length > maxLen ? name.slice(0, maxLen) + '…' : name;
            })
            .style('pointer-events', 'none');
    },

    destroy() { }
};

if (typeof window !== 'undefined') window.EvolutionViz = EvolutionViz;
