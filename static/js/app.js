// ─── State ───
let currentRunId = null;
let pollInterval = null;
let lastLogIndex = 0;

// ─── Generate Content ───
async function startGeneration() {
    const taskInput = document.getElementById('taskInput');
    const task = taskInput.value.trim();

    if (!task) {
        taskInput.focus();
        taskInput.style.borderColor = '#f87171';
        setTimeout(() => taskInput.style.borderColor = '', 1500);
        return;
    }

    // disable button, show loader
    const btn = document.getElementById('generateBtn');
    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Generating...';
    const loader = btn.querySelector('.btn-loader');
    if (loader) loader.style.display = 'inline-block';

    // show pipeline card, reset stages
    const pipelineCard = document.getElementById('pipelineCard');
    pipelineCard.style.display = 'block';
    resetPipelineStages();
    resetActivityFeed();

    // hide previous results
    document.getElementById('messagesCard').style.display = 'none';
    document.getElementById('postResult').style.display = 'none';

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task }),
        });

        const data = await res.json();

        if (data.error) {
            showError(data.error);
            resetButton();
            return;
        }

        currentRunId = data.run_id;
        document.getElementById('runIdBadge').textContent = `#${currentRunId}`;

        // start polling for progress
        startPolling();

    } catch (err) {
        showError('Failed to connect to server: ' + err.message);
        resetButton();
    }
}

// ─── Pipeline Progress Polling ───
function startPolling() {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/status/${currentRunId}`);
            const data = await res.json();

            updatePipelineUI(data);
            fetchActivityLogs();

            if (data.status === 'awaiting_approval') {
                clearInterval(pollInterval);
                pollInterval = null;
                showMessages(data.messages);
                resetButton();
                // one final fetch to get any remaining logs
                fetchActivityLogs();
                const liveIndicator = document.getElementById('activityLiveIndicator');
                if (liveIndicator) liveIndicator.style.display = 'none';
            } else if (data.status === 'error') {
                clearInterval(pollInterval);
                pollInterval = null;
                showError(data.error || 'Pipeline failed');
                resetButton();
                fetchActivityLogs();
            }

        } catch (err) {
            console.error('Polling error:', err);
        }
    }, 800);
}

function updatePipelineUI(data) {
    const stages = ['manager', 'researcher', 'content_creator', 'critic', 'scheduler'];
    const connectors = document.querySelectorAll('.pipeline-connector');

    stages.forEach((stage, i) => {
        const el = document.getElementById(`stage-${stage}`);
        const status = data.stages[stage];

        el.className = 'pipeline-stage';
        if (status === 'running') el.classList.add('running');
        else if (status === 'done') el.classList.add('done');
        else if (status === 'error') el.classList.add('error');

        // activate connector if this stage is done
        if (status === 'done' && i < connectors.length) {
            connectors[i].classList.add('active');
        }
    });
}

function resetPipelineStages() {
    const stages = ['manager', 'researcher', 'content_creator', 'critic', 'scheduler'];
    stages.forEach(stage => {
        const el = document.getElementById(`stage-${stage}`);
        el.className = 'pipeline-stage';
    });
    document.querySelectorAll('.pipeline-connector').forEach(c => c.classList.remove('active'));
}

// ─── Activity Feed ───
async function fetchActivityLogs() {
    if (!currentRunId) return;

    try {
        const res = await fetch(`/api/logs/${currentRunId}?after=${lastLogIndex}`);
        const data = await res.json();

        if (data.logs && data.logs.length > 0) {
            const feed = document.getElementById('activityFeed');

            // clear placeholder on first entry
            const empty = feed.querySelector('.activity-empty');
            if (empty) empty.remove();

            data.logs.forEach(entry => {
                const row = document.createElement('div');
                row.className = `activity-entry type-${entry.type}`;
                row.style.animationDelay = '0s';

                const icon = {
                    'llm_call': '🧠',
                    'web_search': '🔍',
                    'tool_use': '🔧',
                    'decision': '⚖️',
                    'handoff': '➡️',
                    'info': '📋',
                }[entry.type] || '📋';

                row.innerHTML = `
                    <span class="activity-time">[${entry.timestamp}]</span>
                    <span class="activity-icon">${icon}</span>
                    <span class="activity-agent">${escapeHtml(entry.agent)}</span>
                    <span class="activity-arrow">→</span>
                    <span class="activity-action">${escapeHtml(entry.action)}</span>
                `;

                feed.appendChild(row);
            });

            lastLogIndex = data.total;

            // auto-scroll to bottom
            feed.scrollTop = feed.scrollHeight;
        }
    } catch (err) {
        console.error('Activity log fetch error:', err);
    }
}

function resetActivityFeed() {
    lastLogIndex = 0;
    const feed = document.getElementById('activityFeed');
    feed.innerHTML = '<div class="activity-empty">Waiting for pipeline to start...</div>';
    feed.scrollTop = 0;
    const liveIndicator = document.getElementById('activityLiveIndicator');
    if (liveIndicator) liveIndicator.style.display = 'flex';
}

// ─── Show Generated Messages ───
function showMessages(messages) {
    const card = document.getElementById('messagesCard');
    const container = document.getElementById('messagesContainer');
    const countEl = document.getElementById('messageCount');
    const approvalBar = document.getElementById('approvalBar');
    const postResult = document.getElementById('postResult');

    card.style.display = 'block';
    approvalBar.style.display = 'flex';
    postResult.style.display = 'none';
    countEl.textContent = `${messages.length} messages`;

    container.innerHTML = '';

    messages.forEach((msg, i) => {
        const msgCard = document.createElement('div');
        msgCard.className = 'message-card';
        msgCard.style.animationDelay = `${i * 0.1}s`;
        msgCard.innerHTML = `
            <div class="message-header">
                <span class="message-label">Message ${i + 1}</span>
                <span class="message-chars">${msg.length} / 4096</span>
            </div>
            <div class="message-content">${escapeHtml(msg)}</div>
        `;
        container.appendChild(msgCard);
    });

    // scroll to messages
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Approve Messages ───
async function approveMessages() {
    if (!currentRunId) return;

    const approvalBar = document.getElementById('approvalBar');
    const postResult = document.getElementById('postResult');

    // disable buttons
    approvalBar.querySelectorAll('.btn').forEach(b => b.disabled = true);

    try {
        const res = await fetch(`/api/approve/${currentRunId}`, { method: 'POST' });
        const data = await res.json();

        approvalBar.style.display = 'none';
        postResult.style.display = 'block';

        if (data.posted_ids && data.posted_ids.length > 0) {
            postResult.className = 'post-result success';
            const ids = data.posted_ids.map(id => `Message ID: ${id}`).join('<br>');
            postResult.innerHTML = `
                <strong>Successfully posted ${data.count} messages to Telegram.</strong><br><br>
                ${ids}<br><br>
                Check your Telegram channel to see them live.
            `;
            loadHistory();
        } else {
            postResult.className = 'post-result error';
            postResult.innerHTML = `Failed to post messages. ${data.errors?.join(', ') || ''}`;
        }

    } catch (err) {
        postResult.style.display = 'block';
        postResult.className = 'post-result error';
        postResult.innerHTML = `Error: ${err.message}`;
    }
}

// ─── Reject Messages ───
async function rejectMessages() {
    if (!currentRunId) return;

    const approvalBar = document.getElementById('approvalBar');
    const postResult = document.getElementById('postResult');

    await fetch(`/api/reject/${currentRunId}`, { method: 'POST' });

    approvalBar.style.display = 'none';
    postResult.style.display = 'block';
    postResult.className = 'post-result error';
    postResult.innerHTML = 'Messages rejected and discarded. Generate new ones above.';
}

// ─── Regenerate Messages ───
async function regenerateMessages() {
    if (!currentRunId) return;

    document.getElementById('approvalBar').querySelectorAll('.btn').forEach(b => b.disabled = true);
    document.getElementById('messagesCard').style.display = 'none';
    document.getElementById('postResult').style.display = 'none';
    resetPipelineStages();
    resetActivityFeed();

    try {
        const res = await fetch(`/api/regenerate/${currentRunId}`, { method: 'POST' });
        const data = await res.json();

        currentRunId = data.new_run_id;
        document.getElementById('runIdBadge').textContent = `#${currentRunId}`;

        startPolling();
    } catch (err) {
        showError('Regeneration failed: ' + err.message);
    }
}

// ─── Post History ───
async function loadHistory() {
    try {
        const res = await fetch('/api/history');
        const history = await res.json();

        const container = document.getElementById('historyContainer');

        if (!history.length) {
            container.innerHTML = '<div class="history-empty">No posts yet. Generate your first content above.</div>';
            return;
        }

        container.innerHTML = '';

        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-icon">P</div>
                <div class="history-info">
                    <div class="history-task">${escapeHtml(item.task)}</div>
                    <div class="history-meta">${item.posted_at} • ${item.messages.length} messages</div>
                </div>
                <div class="history-badge">${item.posted_ids.length} posted</div>
            `;
            container.appendChild(div);
        });

    } catch (err) {
        console.error('Failed to load history:', err);
    }
}

// ─── Helpers ───
function resetButton() {
    const btn = document.getElementById('generateBtn');
    btn.disabled = false;
    btn.querySelector('.btn-text').textContent = 'Generate Content';
    const loader = btn.querySelector('.btn-loader');
    if (loader) loader.style.display = 'none';
}

function showError(message) {
    const postResult = document.getElementById('postResult');
    const messagesCard = document.getElementById('messagesCard');

    messagesCard.style.display = 'block';
    document.getElementById('approvalBar').style.display = 'none';
    postResult.style.display = 'block';
    postResult.className = 'post-result error';
    postResult.innerHTML = `${escapeHtml(message)}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// keyboard shortcut: Ctrl+Enter to generate
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const taskInput = document.getElementById('taskInput');
        if (document.activeElement === taskInput) {
            startGeneration();
        }
    }
});

// load history on page load
window.addEventListener('DOMContentLoaded', loadHistory);
