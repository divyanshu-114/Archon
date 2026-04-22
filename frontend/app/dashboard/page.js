'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './dashboard.module.css';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const STAGES = ['manager', 'researcher', 'content_creator', 'critic', 'scheduler'];
const STAGE_LABELS = {
    manager: 'Manager',
    researcher: 'Researcher',
    content_creator: 'Content Creator',
    critic: 'Critic',
    scheduler: 'Scheduler',
};

export default function DashboardPage() {
    const [task, setTask] = useState('');
    const [runId, setRunId] = useState(null);
    const [pipelineData, setPipelineData] = useState(null);
    const [history, setHistory] = useState([]);
    const [posting, setPosting] = useState(false);
    const pollRef = useRef(null);

    // Load history on mount
    useEffect(() => {
        fetchHistory();
    }, []);

    // Poll pipeline status
    useEffect(() => {
        if (!runId) return;

        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${API}/api/status/${runId}`);
                const data = await res.json();
                setPipelineData(data);

                if (data.status !== 'running') {
                    clearInterval(pollRef.current);
                }
            } catch (e) {
                console.error('Poll error:', e);
            }
        }, 800);

        return () => clearInterval(pollRef.current);
    }, [runId]);

    async function fetchHistory() {
        try {
            const res = await fetch(`${API}/api/history`);
            const data = await res.json();
            setHistory(data);
        } catch (e) {
            console.error('History fetch error:', e);
        }
    }

    async function handleGenerate() {
        if (!task.trim()) return;

        const res = await fetch(`${API}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task }),
        });
        const data = await res.json();
        setRunId(data.run_id);
        setPipelineData(null);
    }

    async function handleApprove() {
        if (!runId) return;
        setPosting(true);
        try {
            const res = await fetch(`${API}/api/approve/${runId}`, { method: 'POST' });
            const data = await res.json();
            setPipelineData(prev => ({ ...prev, status: 'posted', posted_ids: data.posted_ids }));
            fetchHistory();
        } catch (e) {
            console.error('Approve error:', e);
        }
        setPosting(false);
    }

    async function handleReject() {
        if (!runId) return;
        await fetch(`${API}/api/reject/${runId}`, { method: 'POST' });
        setPipelineData(prev => ({ ...prev, status: 'rejected' }));
    }

    async function handleRegenerate() {
        if (!runId) return;
        const res = await fetch(`${API}/api/regenerate/${runId}`, { method: 'POST' });
        const data = await res.json();
        setRunId(data.new_run_id);
        setPipelineData(null);
    }

    const isRunning = pipelineData?.status === 'running';
    const isAwaiting = pipelineData?.status === 'awaiting_approval';
    const isPosted = pipelineData?.status === 'posted';
    const isError = pipelineData?.status === 'error';

    return (
        <div className={styles.wrapper}>
            {/* Background effects */}
            <div className={styles.bgGrid} />

            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <a href="/" className={styles.headerLogo}>
                        <div className={styles.logoMark}>U</div>
                        <span className={styles.logoLabel}>ARCHON</span>
                        <span className={styles.headerTag}>DASHBOARD</span>
                    </a>
                    <div className={styles.headerStatus}>
                        <span className={styles.statusDot} />
                        System Online
                    </div>
                </div>
            </header>

            <main className={styles.main}>
                {/* Left Panel — Task Input */}
                <div className={styles.leftPanel}>
                    <div className={styles.panel}>
                        <h2 className={styles.panelTitle}>New Task</h2>
                        <textarea
                            className={styles.textarea}
                            value={task}
                            onChange={e => setTask(e.target.value)}
                            placeholder="Describe what content you need..."
                            rows={5}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate();
                            }}
                        />
                        <button
                            className={styles.generateBtn}
                            onClick={handleGenerate}
                            disabled={isRunning || !task.trim()}
                        >
                            {isRunning ? 'Pipeline Running...' : 'Generate Content'}
                        </button>

                        {/* Pipeline Visualization */}
                        {pipelineData && (
                            <div className={styles.pipeline}>
                                <h3 className={styles.pipelineTitle}>Pipeline Status</h3>
                                {STAGES.map(stage => {
                                    const status = pipelineData.stages?.[stage] || 'pending';
                                    return (
                                        <div key={stage} className={`${styles.stage} ${styles[`stage_${status}`]}`}>
                                            <div className={styles.stageIndicator}>
                                                {status === 'running' && <div className={styles.spinnerSmall} />}
                                                {status === 'done' && <span className={styles.checkMark}>&#10003;</span>}
                                                {status === 'error' && <span className={styles.errorMark}>&#10007;</span>}
                                                {status === 'pending' && <span className={styles.pendingMark}>&#8226;</span>}
                                            </div>
                                            <span className={styles.stageName}>{STAGE_LABELS[stage]}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel — Messages & History */}
                <div className={styles.rightPanel}>
                    {/* Message Preview */}
                    {isAwaiting && pipelineData.messages?.length > 0 && (
                        <div className={styles.panel}>
                            <h2 className={styles.panelTitle}>Generated Content</h2>
                            {pipelineData.messages.map((msg, i) => {
                                const clean = msg
                                    .replace(/---MESSAGE START---/g, '')
                                    .replace(/---MESSAGE END---/g, '')
                                    .trim();
                                return (
                                    <div key={i} className={styles.messageCard}>
                                        <div className={styles.messageHeader}>
                                            <span>Message {i + 1}</span>
                                            <span className={styles.charCount}>{clean.length} chars</span>
                                        </div>
                                        <pre className={styles.messageBody}>{clean}</pre>
                                    </div>
                                );
                            })}
                            <div className={styles.actions}>
                                <button className={styles.approveBtn} onClick={handleApprove} disabled={posting}>
                                    {posting ? 'Publishing...' : 'Approve & Post'}
                                </button>
                                <button className={styles.rejectBtn} onClick={handleReject}>Reject</button>
                                <button className={styles.regenBtn} onClick={handleRegenerate}>Regenerate</button>
                            </div>
                        </div>
                    )}

                    {/* Posted confirmation */}
                    {isPosted && (
                        <div className={styles.panel}>
                            <div className={styles.postedBanner}>
                                <span className={styles.checkLarge}>&#10003;</span>
                                <span>Content published successfully</span>
                            </div>
                        </div>
                    )}

                    {/* Error state */}
                    {isError && (
                        <div className={styles.panel}>
                            <div className={styles.errorBanner}>
                                <span>Pipeline Error: {pipelineData.error}</span>
                            </div>
                        </div>
                    )}

                    {/* Post History */}
                    <div className={styles.panel}>
                        <h2 className={styles.panelTitle}>Post History</h2>
                        {history.length === 0 ? (
                            <p className={styles.emptyText}>No posts yet. Generate your first content above.</p>
                        ) : (
                            history.map((entry, i) => (
                                <div key={i} className={styles.historyItem}>
                                    <div className={styles.historyMeta}>
                                        <span className={styles.historyTime}>{entry.posted_at}</span>
                                        <span className={styles.historyCount}>{entry.messages?.length || 0} messages</span>
                                    </div>
                                    <p className={styles.historyTask}>{entry.task}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
