// GitInsight – Popup Settings Script
// Manages GitHub Personal Access Token storage

(function () {
    'use strict';

    const tokenInput = document.getElementById('token-input');
    const saveBtn = document.getElementById('save-btn');
    const clearBtn = document.getElementById('clear-btn');
    const statusEl = document.getElementById('status');
    const rateStatus = document.getElementById('rate-status');

    // Load existing token
    chrome.storage.local.get(['githubToken'], (result) => {
        if (result.githubToken) {
            tokenInput.value = result.githubToken;
            showStatus('Token is saved and active.', 'success');
            checkRateLimit(result.githubToken);
        } else {
            rateStatus.textContent = 'No token (60 req/hr)';
            rateStatus.className = 'bad';
        }
    });

    // Save token
    saveBtn.addEventListener('click', async () => {
        const token = tokenInput.value.trim();
        if (!token) {
            showStatus('Please enter a token.', 'error');
            return;
        }

        // Validate token by making a test request
        saveBtn.textContent = 'Validating...';
        saveBtn.disabled = true;

        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const user = await response.json();
                const remaining = response.headers.get('X-RateLimit-Remaining');

                chrome.storage.local.set({ githubToken: token }, () => {
                    showStatus(`✓ Authenticated as ${user.login}. Rate limit: ${remaining} remaining.`, 'success');
                    rateStatus.textContent = `${remaining} remaining`;
                    rateStatus.className = 'good';
                });
            } else if (response.status === 401) {
                showStatus('Invalid token. Please check and try again.', 'error');
            } else {
                showStatus(`GitHub API returned status ${response.status}.`, 'error');
            }
        } catch (err) {
            showStatus(`Network error: ${err.message}`, 'error');
        }

        saveBtn.textContent = 'Save Token';
        saveBtn.disabled = false;
    });

    // Clear token
    clearBtn.addEventListener('click', () => {
        chrome.storage.local.remove('githubToken', () => {
            tokenInput.value = '';
            showStatus('Token cleared.', 'success');
            rateStatus.textContent = 'No token (60 req/hr)';
            rateStatus.className = 'bad';
        });
    });

    function showStatus(message, type) {
        statusEl.textContent = message;
        statusEl.className = `status ${type}`;
    }

    async function checkRateLimit(token) {
        try {
            const response = await fetch('https://api.github.com/rate_limit', {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            const data = await response.json();
            const remaining = data.rate?.remaining || 0;
            const limit = data.rate?.limit || 0;
            rateStatus.textContent = `${remaining}/${limit} remaining`;
            rateStatus.className = remaining > 1000 ? 'good' : remaining > 100 ? 'warn' : 'bad';
        } catch {
            rateStatus.textContent = 'Unable to check';
        }
    }
})();
