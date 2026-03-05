// GitInsight – File Change Heatmap Visualization
// D3-based treemap showing file modification intensity

const HeatmapViz = {
    render(container, fileChanges) {
        container.innerHTML = '';

        if (!fileChanges || fileChanges.length === 0) {
            container.innerHTML = '<div class="gi-empty-state">No file change data available. Detailed file data requires fetching individual commits.</div>';
            return;
        }

        // Controls
        const controls = document.createElement('div');
        controls.className = 'gi-viz-controls';
        controls.innerHTML = `
      <div class="gi-control-group">
        <label>Color by:</label>
        <select id="gi-heatmap-metric" class="gi-select">
          <option value="commits" selected>Commit Count</option>
          <option value="changes">Total Changes</option>
          <option value="additions">Additions</option>
          <option value="deletions">Deletions</option>
        </select>
      </div>
      <div class="gi-control-group">
        <label>Show top:</label>
        <select id="gi-heatmap-count" class="gi-select">
          <option value="20">20 files</option>
          <option value="50" selected>50 files</option>
          <option value="100">100 files</option>
        </select>
      </div>
    `;
        container.appendChild(controls);

        // Chart container
        const chartDiv = document.createElement('div');
        chartDiv.id = 'gi-heatmap-chart';
        chartDiv.style.width = '100%';
        chartDiv.style.height = '500px';
        container.appendChild(chartDiv);

        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'gi-tooltip';
        tooltip.style.display = 'none';
        container.appendChild(tooltip);

        this.drawTreemap(chartDiv, tooltip, fileChanges.slice(0, 50), 'commits');

        // Event listeners
        controls.querySelector('#gi-heatmap-metric').addEventListener('change', (e) => {
            const count = parseInt(controls.querySelector('#gi-heatmap-count').value);
            this.drawTreemap(chartDiv, tooltip, fileChanges.slice(0, count), e.target.value);
        });
        controls.querySelector('#gi-heatmap-count').addEventListener('change', (e) => {
            const metric = controls.querySelector('#gi-heatmap-metric').value;
            this.drawTreemap(chartDiv, tooltip, fileChanges.slice(0, parseInt(e.target.value)), metric);
        });
    },

    drawTreemap(container, tooltip, files, metric) {
        container.innerHTML = '';
        // Robust dimension detection
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 500;

        // Build hierarchy
        const root = this.buildHierarchy(files, metric);

        const colorScale = d3.scaleSequential()
            .domain([0, d3.max(files, f => f[metric]) || 1])
            .interpolator(d3.interpolateRgbBasis(['#1e293b', '#6366f1', '#a855f7', '#f43f5e']));

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const treemap = d3.treemap()
            .size([width, height])
            .padding(2)
            .round(true);

        const hierarchy = d3.hierarchy(root)
            .sum(d => d.value || 0)
            .sort((a, b) => b.value - a.value);

        treemap(hierarchy);

        const cell = svg.selectAll('g')
            .data(hierarchy.leaves())
            .join('g')
            .attr('transform', d => `translate(${d.x0},${d.y0})`);

        cell.append('rect')
            .attr('width', d => Math.max(0, d.x1 - d.x0))
            .attr('height', d => Math.max(0, d.y1 - d.y0))
            .attr('fill', d => colorScale(d.data.rawValue || 0))
            .attr('rx', 3)
            .attr('stroke', '#0d1117')
            .attr('stroke-width', 1)
            .style('cursor', 'pointer')
            .style('transition', 'opacity 0.2s')
            .on('mouseover', function (event, d) {
                d3.select(this).style('opacity', 0.8);
                tooltip.style.display = 'block';
                tooltip.innerHTML = `
          <strong>${d.data.name}</strong><br/>
          Commits: ${d.data.fileData?.commits || 0}<br/>
          Changes: ${d.data.fileData?.changes || 0}<br/>
          +${d.data.fileData?.additions || 0} / -${d.data.fileData?.deletions || 0}
        `;
                tooltip.style.left = (event.pageX + 10) + 'px';
                tooltip.style.top = (event.pageY - 10) + 'px';
            })
            .on('mousemove', function (event) {
                tooltip.style.left = (event.offsetX + 10) + 'px';
                tooltip.style.top = (event.offsetY - 10) + 'px';
            })
            .on('mouseout', function () {
                d3.select(this).style('opacity', 1);
                tooltip.style.display = 'none';
            });

        // Draw file labels that fit
        cell.append('text')
            .attr('x', 4)
            .attr('y', 14)
            .text(d => {
                const w = d.x1 - d.x0;
                const name = d.data.name.split('/').pop();
                return w > 60 ? name : '';
            })
            .attr('fill', '#e2e8f0')
            .attr('font-size', '11px')
            .attr('font-family', '-apple-system, BlinkMacSystemFont, sans-serif')
            .style('pointer-events', 'none');

        cell.append('text')
            .attr('x', 4)
            .attr('y', 28)
            .text(d => {
                const w = d.x1 - d.x0;
                const h = d.y1 - d.y0;
                return w > 60 && h > 35 ? `${d.data.rawValue} ${metric}` : '';
            })
            .attr('fill', '#94a3b8')
            .attr('font-size', '10px')
            .attr('font-family', '-apple-system, BlinkMacSystemFont, sans-serif')
            .style('pointer-events', 'none');
    },

    buildHierarchy(files, metric) {
        const root = { name: 'root', children: [] };
        const dirs = {};

        files.forEach(f => {
            const parts = f.filename.split('/');
            const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
            const name = parts[parts.length - 1];

            if (!dirs[dir]) {
                dirs[dir] = { name: dir, children: [] };
                root.children.push(dirs[dir]);
            }

            dirs[dir].children.push({
                name: f.filename,
                value: f[metric] || 0,
                rawValue: f[metric] || 0,
                fileData: f
            });
        });

        return root;
    },

    destroy() {
        // D3 SVG gets removed when container is cleared
    }
};

if (typeof window !== 'undefined') window.HeatmapViz = HeatmapViz;
