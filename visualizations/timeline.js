// GitInsight – Commit Timeline Visualization
// Interactive commit frequency chart using Chart.js

const TimelineViz = {
    chart: null,

    render(container, frequencyData, options = {}) {
        container.innerHTML = '';

        // Controls
        const controls = document.createElement('div');
        controls.className = 'gi-viz-controls';
        controls.innerHTML = `
      <div class="gi-control-group">
        <label>Group by:</label>
        <select id="gi-timeline-grouping" class="gi-select">
          <option value="day">Day</option>
          <option value="week" selected>Week</option>
          <option value="month">Month</option>
        </select>
      </div>
      <div class="gi-control-group">
        <label>Chart type:</label>
        <select id="gi-timeline-type" class="gi-select">
          <option value="bar" selected>Bar</option>
          <option value="line">Line</option>
        </select>
      </div>
    `;
        container.appendChild(controls);

        const canvas = document.createElement('canvas');
        canvas.id = 'gi-timeline-chart';
        canvas.style.width = '100%';
        canvas.style.height = '320px';
        container.appendChild(canvas);

        // Stats
        const stats = this.computeStats(frequencyData);
        const statsDiv = document.createElement('div');
        statsDiv.className = 'gi-stats-bar';
        statsDiv.innerHTML = `
      <div class="gi-stat">
        <span class="gi-stat-value">${stats.total}</span>
        <span class="gi-stat-label">Total Commits</span>
      </div>
      <div class="gi-stat">
        <span class="gi-stat-value">${stats.avg}</span>
        <span class="gi-stat-label">Avg/Period</span>
      </div>
      <div class="gi-stat">
        <span class="gi-stat-value">${stats.peak}</span>
        <span class="gi-stat-label">Peak</span>
      </div>
      <div class="gi-stat">
        <span class="gi-stat-value">${stats.peakDate}</span>
        <span class="gi-stat-label">Most Active</span>
      </div>
    `;
        container.appendChild(statsDiv);

        this.drawChart(canvas, frequencyData, 'bar');

        // Event listeners
        controls.querySelector('#gi-timeline-grouping').addEventListener('change', (e) => {
            if (options.onGroupChange) options.onGroupChange(e.target.value);
        });
        controls.querySelector('#gi-timeline-type').addEventListener('change', (e) => {
            this.drawChart(canvas, frequencyData, e.target.value);
        });
    },

    drawChart(canvas, data, chartType) {
        if (this.chart) this.chart.destroy();

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.6)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.05)');

        this.chart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: data.map(d => d.date),
                datasets: [{
                    label: 'Commits',
                    data: data.map(d => d.count),
                    backgroundColor: chartType === 'bar' ? 'rgba(99, 102, 241, 0.7)' : gradient,
                    borderColor: '#6366f1',
                    borderWidth: chartType === 'line' ? 2 : 0,
                    fill: chartType === 'line',
                    tension: 0.1, // Reduced tension for better performance
                    pointRadius: chartType === 'line' ? 2 : 0,
                    pointHoverRadius: 5,
                    barPercentage: 0.9,
                    borderRadius: chartType === 'bar' ? 2 : 0
                }]
            },
            options: {
                animation: false, // Disable animations for smoothness
                responsive: true,
                maintainAspectRatio: false,
                normalized: true, // Performance optimization
                parsing: false, // Performance optimization (data is already parsed)
                spanGaps: true,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: '#1e293b',
                        titleColor: '#e2e8f0',
                        bodyColor: '#94a3b8',
                        cornerRadius: 8,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            title: (items) => items[0].label,
                            label: (item) => `${item.raw} commit${item.raw !== 1 ? 's' : ''}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: {
                            color: '#64748b',
                            maxTicksLimit: 15,
                            maxRotation: 0 // Keep labels horizontal for cleanliness
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#64748b' }
                    }
                }
            }
        });
    },

    computeStats(data) {
        const counts = data.map(d => d.count);
        const total = counts.reduce((a, b) => a + b, 0);
        const avg = (total / counts.length).toFixed(1);
        const peakIdx = counts.indexOf(Math.max(...counts));
        return {
            total,
            avg,
            peak: counts[peakIdx],
            peakDate: data[peakIdx]?.date || 'N/A'
        };
    },

    updateData(data) {
        if (!this.chart) return;
        this.chart.data.labels = data.map(d => d.date);
        this.chart.data.datasets[0].data = data.map(d => d.count);
        this.chart.update('active');
    },

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
};

if (typeof window !== 'undefined') window.TimelineViz = TimelineViz;
