// GitInsight – Content Script
// Injects the GitInsight dashboard into GitHub repository pages

(function () {
    'use strict';

    let dashboardIframe = null;
    let toggleButton = null;
    let isOpen = false;

    function getRepoInfo() {
        const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)/);
        if (match) {
            return { owner: match[1], repo: match[2] };
        }
        return null;
    }

    function createToggleButton() {
        if (document.getElementById('gitinsight-toggle')) return;

        toggleButton = document.createElement('button');
        toggleButton.id = 'gitinsight-toggle';
        toggleButton.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
      </svg>
      <span>GitInsight</span>
    `;

        Object.assign(toggleButton.style, {
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: '99999',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '50px',
            fontSize: '14px',
            fontWeight: '600',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4), 0 0 40px rgba(139, 92, 246, 0.15)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            letterSpacing: '0.3px'
        });

        toggleButton.addEventListener('mouseenter', () => {
            toggleButton.style.transform = 'translateY(-2px) scale(1.02)';
            toggleButton.style.boxShadow = '0 6px 30px rgba(99, 102, 241, 0.5), 0 0 60px rgba(139, 92, 246, 0.2)';
        });
        toggleButton.addEventListener('mouseleave', () => {
            toggleButton.style.transform = 'translateY(0) scale(1)';
            toggleButton.style.boxShadow = '0 4px 20px rgba(99, 102, 241, 0.4), 0 0 40px rgba(139, 92, 246, 0.15)';
        });

        toggleButton.addEventListener('click', toggleDashboard);
        document.body.appendChild(toggleButton);
    }

    function createDashboard() {
        if (dashboardIframe) return;

        const repoInfo = getRepoInfo();
        if (!repoInfo) return;

        dashboardIframe = document.createElement('iframe');
        dashboardIframe.id = 'gitinsight-dashboard';
        const dashboardUrl = chrome.runtime.getURL('dashboard.html') +
            `?owner=${encodeURIComponent(repoInfo.owner)}&repo=${encodeURIComponent(repoInfo.repo)}`;
        dashboardIframe.src = dashboardUrl;

        Object.assign(dashboardIframe.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            zIndex: '99998',
            border: 'none',
            background: '#0d1117',
            opacity: '0',
            transition: 'opacity 0.4s ease-in-out',
            display: 'none'
        });

        document.body.appendChild(dashboardIframe);
    }

    function toggleDashboard() {
        if (!dashboardIframe) {
            createDashboard();
        }

        isOpen = !isOpen;

        if (isOpen) {
            dashboardIframe.style.display = 'block';
            requestAnimationFrame(() => {
                dashboardIframe.style.opacity = '1';
            });
            toggleButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        <span>Close</span>
      `;
        } else {
            dashboardIframe.style.opacity = '0';
            setTimeout(() => {
                dashboardIframe.style.display = 'none';
            }, 400);
            toggleButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
        <span>GitInsight</span>
      `;
        }
    }

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'REPO_DETECTED') {
            createToggleButton();
        } else if (message.type === 'TOGGLE_DASHBOARD') {
            if (!toggleButton) createToggleButton();
            toggleDashboard();
        }
    });

    // Listen for close message from dashboard iframe
    window.addEventListener('message', (e) => {
        if (e.data?.type === 'GITINSIGHT_CLOSE') {
            if (isOpen) toggleDashboard();
        }
    });

    // Initialize on page load if already on a repo page
    const repoInfo = getRepoInfo();
    if (repoInfo) {
        // Exclude non-repo pages like settings, pulls, issues etc with deep paths
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts.length <= 2 || ['tree', 'blob', 'commits', 'branches'].includes(pathParts[2])) {
            createToggleButton();
        }
    }
})();
