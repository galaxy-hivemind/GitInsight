// GitInsight – Contributor Network Graph
// D3 force-directed graph showing contributor collaboration

const ContributorsViz = {
    simulation: null,

    render(container, contributorStats, edges) {
        container.innerHTML = '';

        if (!contributorStats || contributorStats.length === 0) {
            container.innerHTML = '<div class="gi-empty-state">No contributor data available.</div>';
            return;
        }

        // Stats bar
        const statsDiv = document.createElement('div');
        statsDiv.className = 'gi-stats-bar';
        const totalCommits = contributorStats.reduce((s, c) => s + c.commits, 0);
        statsDiv.innerHTML = `
      <div class="gi-stat">
        <span class="gi-stat-value">${contributorStats.length}</span>
        <span class="gi-stat-label">Contributors</span>
      </div>
      <div class="gi-stat">
        <span class="gi-stat-value">${totalCommits}</span>
        <span class="gi-stat-label">Total Commits</span>
      </div>
      <div class="gi-stat">
        <span class="gi-stat-value">${edges?.length || 0}</span>
        <span class="gi-stat-label">Collaborations</span>
      </div>
    `;
        container.appendChild(statsDiv);

        // Chart container
        const chartDiv = document.createElement('div');
        chartDiv.id = 'gi-contributors-chart';
        chartDiv.style.width = '100%';
        chartDiv.style.height = '500px';
        container.appendChild(chartDiv);

        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'gi-tooltip';
        tooltip.style.display = 'none';
        container.appendChild(tooltip);

        this.drawGraph(chartDiv, tooltip, contributorStats, edges || []);

        // Contributor list
        const listDiv = document.createElement('div');
        listDiv.className = 'gi-contributor-list';
        listDiv.innerHTML = '<h3>Contributors</h3>' +
            contributorStats.slice(0, 20).map((c, i) => `
        <div class="gi-contributor-item">
          <span class="gi-contributor-rank">#${i + 1}</span>
          ${c.avatar ? `<img src="${c.avatar}" class="gi-contributor-avatar" alt="${c.login}"/>` : ''}
          <div class="gi-contributor-info">
            <strong>${c.name || c.login}</strong>
            <span>${c.commits} commits</span>
          </div>
          <div class="gi-contributor-bar">
            <div class="gi-contributor-bar-fill" style="width: ${(c.commits / totalCommits * 100)}%"></div>
          </div>
        </div>
      `).join('');
        container.appendChild(listDiv);
    },

    drawGraph(container, tooltip, nodes, edges) {
        const width = container.clientWidth;
        const height = container.clientHeight || 500;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const maxCommits = d3.max(nodes, n => n.commits) || 1;
        const radiusScale = d3.scaleSqrt().domain([1, maxCommits]).range([8, 40]);
        const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

        // Filter edges to only include existing nodes
        const nodeLogins = new Set(nodes.map(n => n.login));
        const validEdges = edges.filter(e => nodeLogins.has(e.source) && nodeLogins.has(e.target));

        // Links
        const link = svg.append('g')
            .selectAll('line')
            .data(validEdges)
            .join('line')
            .attr('stroke', '#334155')
            .attr('stroke-width', d => Math.min(d.weight, 5))
            .attr('stroke-opacity', 0.4);

        // Nodes
        const node = svg.append('g')
            .selectAll('g')
            .data(nodes.slice(0, 50)) // Limit to top 50
            .join('g')
            .style('cursor', 'pointer');

        node.append('circle')
            .attr('r', d => radiusScale(d.commits))
            .attr('fill', (d, i) => colorScale(i))
            .attr('fill-opacity', 0.8)
            .attr('stroke', (d, i) => colorScale(i))
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.4);

        // Labels for larger nodes
        node.append('text')
            .text(d => d.login.length > 10 ? d.login.slice(0, 8) + '..' : d.login)
            .attr('text-anchor', 'middle')
            .attr('dy', d => radiusScale(d.commits) + 14)
            .attr('fill', '#94a3b8')
            .attr('font-size', '11px')
            .attr('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');

        // Tooltip
        node.on('mouseover', (event, d) => {
            tooltip.style.display = 'block';
            tooltip.innerHTML = `
        <strong>${d.name || d.login}</strong><br/>
        Commits: ${d.commits}<br/>
        First: ${new Date(d.firstCommit).toLocaleDateString()}<br/>
        Last: ${new Date(d.lastCommit).toLocaleDateString()}
      `;
        })
            .on('mousemove', (event) => {
                tooltip.style.left = (event.offsetX + 15) + 'px';
                tooltip.style.top = (event.offsetY - 10) + 'px';
            })
            .on('mouseout', () => { tooltip.style.display = 'none'; });

        // Simulation with dynamic forces
        const nodeCount = nodes.slice(0, 50).length;
        const chargeStrength = Math.min(-300, -10 * nodeCount); // Scale repulsion with density

        this.simulation = d3.forceSimulation(nodes.slice(0, 50))
            .force('charge', d3.forceManyBody().strength(chargeStrength).distanceMax(500))
            .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05)) // Weaker center force to allow spread
            .force('collision', d3.forceCollide().radius(d => radiusScale(d.commits) + 12).iterations(2))
            .force('link', d3.forceLink(validEdges).id(d => d.login).distance(150).strength(0.1))
            .force('x', d3.forceX(width / 2).strength(0.02))
            .force('y', d3.forceY(height / 2).strength(0.02))
            .on('tick', () => {
                link
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);

                node.attr('transform', d => {
                    // Stricter bounding box with padding
                    d.x = Math.max(50, Math.min(width - 50, d.x));
                    d.y = Math.max(50, Math.min(height - 50, d.y));
                    return `translate(${d.x}, ${d.y})`;
                });
            });

        // Drag behavior
        node.call(d3.drag()
            .on('start', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0.3).restart();
                d.fx = d.x; d.fy = d.y;
            })
            .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
            .on('end', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0);
                d.fx = null; d.fy = null;
            })
        );
    },

    destroy() {
        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
        }
    }
};

if (typeof window !== 'undefined') window.ContributorsViz = ContributorsViz;
