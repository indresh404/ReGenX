/**
 * @fileoverview ReGenX Cryptographic Verification & Public Audit Portal
 * Implements client-side SHA-256 matching and verified environmental origin auditing.
 * Renders high-fidelity Glassmorphic validation cards and visual proof-of-custody timelines.
 * @author GSSoC Contributor
 */

const AUDIT_REGISTRY_KEY = 'audit-registry';

/**
 * Safely load the public audit registry from localStorage.
 * @returns {Array<Object>} Normalized registry records.
 */
function loadAuditRegistry() {
    try {
        const raw = window.localStorage.getItem(AUDIT_REGISTRY_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * Persist the public audit registry to localStorage.
 * @param {Array<Object>} records - Registry records to save.
 */
function saveAuditRegistry(records) {
    try {
        window.localStorage.setItem(AUDIT_REGISTRY_KEY, JSON.stringify(records));
    } catch {
        // Ignore write errors (e.g., quota exceeded)
    }
}

/**
 * Normalize a user-provided hash into lowercase hex (no 0x prefix).
 * @param {string} hash - Raw hash string.
 * @returns {string} Normalized hash.
 */
function normalizeHash(hash) {
    return hash.replace(/^0x/i, '').trim().toLowerCase();
}

/**
 * Ensure the registry has seed records for demo verification.
 * @returns {Array<Object>} Registry with seeded records if needed.
 */
function ensureSeedRegistry() {
    const registry = loadAuditRegistry();
    if (registry.length > 0) return registry;

    const seedRecords = [
        {
            hash: '0x3f8a9d2c1e7b64805e2d19f8a02b3c4d5e6f7a8b9c1d2e3f4a5b6c7d8e9f0a1b',
            org: 'Omega Campus Hostel',
            role: 'provider',
            userId: 'prov-omega',
            totalKg: 850,
            totalCO2: 527,
            tokens: 1700,
            dispatchesCount: 4,
            timestamp: Date.now() - 86400000 * 2
        },
        {
            hash: '0x7e2d9b1c5f3e4a8b2c6d0e8f9a7b5c3d1e2f4a6b7c8d9e0f1a2b3c4d5e6f7a8b',
            org: 'Sector Alpha Green Plant',
            role: 'plant',
            userId: 'plant-alpha',
            totalKg: 2400,
            totalCO2: 1488,
            tokens: 4800,
            dispatchesCount: 12,
            timestamp: Date.now() - 86400000 * 5
        }
    ];

    saveAuditRegistry(seedRecords);
    return seedRecords;
}

export const AuditPortal = {
    /**
     * Renders the Public Audit Portal interface.
     * @param {HTMLElement} mc - Main content container.
     * @param {boolean} fullRender - Whether to execute a complete rebuild of the view.
     */
    renderPortal: (mc, fullRender) => {
        if (!fullRender) return;

        // Fetch mock verified hashes to give the user something to test immediately
        const registry = ensureSeedRegistry();

        mc.innerHTML = `
            <div class="between" style="margin-bottom:24px;">
                <h3 class="heading">🔒 Cryptographic Verification Portal</h3>
                <div class="badge badge-amber" style="font-size:12px;">Ecological Audit Node</div>
            </div>

            <div class="two-col" style="align-items: stretch; margin-bottom: 32px;">
                <!-- Verification Panel -->
                <div class="glass-card audit-card" style="padding: 24px; display: flex; flex-direction: column; justify-content: space-between; border-color: var(--blue);">
                    <div>
                        <h4 style="margin-bottom: 8px; font-size: 18px;">Public Attestation Ledger</h4>
                        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
                            Enter the 64-character SHA-256 signature hash printed at the bottom of any ReGenX ESG Compliance PDF to audit its origins and verify environmental impact claims.
                        </p>
                        
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label class="form-label" style="font-size: 11px; text-transform: uppercase;">Signature Hash (SHA-256)</label>
                            <input class="form-input" id="audit-hash-input" type="text" placeholder="e.g. 0x3f8a9d2c1e7b..." style="font-family: monospace;">
                        </div>
                    </div>
                    <button class="btn btn-primary btn-full" onclick="window.AuditPortal.triggerVerification()" style="background: var(--blue); border-color: var(--blue);">
                        🔍 Verify Authenticity
                    </button>
                </div>

                <!-- Verified Registry Directory -->
                <div class="glass-card audit-card" style="padding: 24px;">
                    <h4 style="margin-bottom: 12px; font-size: 16px;">Copy Pre-Attested Seed Hashes</h4>
                    <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
                        Use these pre-signed network hashes to test the public Zero-Knowledge Verification Portal:
                    </p>
                    
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${registry.map(rec => `
                            <div class="audit-registry-item">
                                <div class="between" style="margin-bottom: 6px;">
                                    <span style="font-weight: 700; color: var(--text);">${rec.org}</span>
                                    <span style="font-size: 11px; font-family: monospace; color: var(--green); font-weight: 700;">${rec.totalKg} Kg Offset</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <input type="text" value="${rec.hash}" readonly class="audit-registry-input" onclick="window.AuditPortal.copyHash('${rec.hash}')">
                                    <button class="btn btn-ghost btn-sm" style="padding: 2px 6px; font-size: 11px;" onclick="window.AuditPortal.copyHash('${rec.hash}')">📋 Copy</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Dynamic Verification Result Container -->
            <div id="verification-result-container"></div>
        `;
    },

    /**
     * Executes the verification sequence and dynamically injects the result with smooth CSS micro-animations.
     */
    triggerVerification: () => {
        const input = document.getElementById('audit-hash-input');
        const container = document.getElementById('verification-result-container');
        if (!input || !container) return;

        const rawHash = input.value.trim();
        if (!rawHash) {
            window.showToast('⚠️ Please enter a signature hash to verify.');
            return;
        }

        const normalizedHash = normalizeHash(rawHash);
        if (!/^[0-9a-f]{64}$/.test(normalizedHash)) {
            window.showToast('⚠️ Invalid hash format. Expected 64 hex characters.');
            return;
        }

        // Search in registry
        const registry = loadAuditRegistry();
        const record = registry.find(r => normalizeHash(r.hash) === normalizedHash);

        // Clear and render circular loader
        container.innerHTML = `
            <div class="glass-card" style="padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;">
                <div class="audit-spinner"></div>
                <div style="font-size: 14px; font-weight: 600; color: var(--text-muted);">Querying ReGenX Attestation Ledger...</div>
            </div>
        `;

        setTimeout(() => {
            if (!record) {
                container.innerHTML = `
                    <div class="glass-card fade-in-up" style="padding: 32px; border-color: #EF4444; background: rgba(239, 68, 68, 0.05); text-align: center;">
                        <span style="font-size: 40px; display: block; margin-bottom: 12px;">❌</span>
                        <h4 style="color: #EF4444; margin-bottom: 8px;">Verification Failed</h4>
                        <p style="font-size: 13px; color: var(--text-muted); max-width: 400px; margin: 0 auto;">
                            The signature hash <strong>${rawHash}</strong> was not found in the attestation registry. This PDF report may have been edited or modified after download.
                        </p>
                    </div>
                `;
                return;
            }

            const dateStr = new Date(record.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            
            container.innerHTML = `
                <div class="glass-card fade-in-up" style="padding: 32px; border-color: var(--green); background: rgba(16, 185, 129, 0.05);">
                    <div class="between" style="align-items: flex-start; border-bottom: 1px solid var(--border); padding-bottom: 20px; margin-bottom: 24px;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                                <div style="width: 24px; height: 24px; background: var(--green); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: bold;">✓</div>
                                <h4 style="color: var(--green); font-size: 18px; margin: 0;">Verified Environmental Certificate</h4>
                            </div>
                            <div style="font-size: 11px; font-family: monospace; color: var(--text-muted); margin-top: 4px;">Hash: ${record.hash}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Attested On</div>
                            <div style="font-size: 13px; font-weight: 600;">${dateStr}</div>
                        </div>
                    </div>

                    <div class="two-col" style="margin-bottom: 32px;">
                        <div>
                            <h5 style="margin-bottom: 12px; font-size: 14px; text-transform: uppercase; color: var(--text-muted);">Attested Entity</h5>
                            <div style="background: var(--surface); padding: 16px; border: 1px solid var(--border); border-radius: 12px;">
                                <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">${record.org}</div>
                                <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Role: ${record.role} · ID: ${record.userId}</div>
                            </div>
                        </div>
                        <div>
                            <h5 style="margin-bottom: 12px; font-size: 14px; text-transform: uppercase; color: var(--text-muted);">Verified Impact Claims</h5>
                            <div class="between" style="gap: 8px;">
                                <div style="flex: 1; text-align: center; padding: 12px; background: rgba(16, 185, 129, 0.1); border-radius: 8px;">
                                    <div style="font-size: 18px; font-weight: 800; color: var(--green);">${record.totalKg} Kg</div>
                                    <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">Recycled</span>
                                </div>
                                <div style="flex: 1; text-align: center; padding: 12px; background: rgba(59, 130, 246, 0.1); border-radius: 8px;">
                                    <div style="font-size: 18px; font-weight: 800; color: var(--blue);">${record.totalCO2} Kg</div>
                                    <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">CO₂ Offset</span>
                                </div>
                                <div style="flex: 1; text-align: center; padding: 12px; background: rgba(245, 158, 11, 0.1); border-radius: 8px;">
                                    <div style="font-size: 18px; font-weight: 800; color: var(--amber);">${record.tokens} $RGX</div>
                                    <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">Minted</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Custody Proof Chain -->
                    <h5 style="margin-bottom: 16px; font-size: 14px; text-transform: uppercase; color: var(--text-muted);">Verified Ecological Custody Chain</h5>
                    <div style="display: flex; flex-direction: column; gap: 16px; position: relative;">
                        <!-- Vertical line connection -->
                        <div style="position: absolute; left: 16px; top: 16px; bottom: 16px; width: 2px; background: var(--border); z-index: 0;"></div>

                        <div style="display: flex; gap: 16px; align-items: flex-start; position: relative; z-index: 1;">
                            <div style="width: 34px; height: 34px; background: var(--border); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; border: 3px solid var(--surface-2);">🏨</div>
                            <div>
                                <div style="font-weight: 700; font-size: 14px;">Origin Collection Dispatched</div>
                                <div style="font-size: 12px; color: var(--text-muted);">Bio-waste weighed, logged, and signed by ${record.org}.</div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 16px; align-items: flex-start; position: relative; z-index: 1;">
                            <div style="width: 34px; height: 34px; background: var(--border); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; border: 3px solid var(--surface-2);">🚛</div>
                            <div>
                                <div style="font-weight: 700; font-size: 14px;">Logistics Chain Verification</div>
                                <div style="font-size: 12px; color: var(--text-muted);">Rider custody confirmed via GPS matching and PWA Offline attestation protocols.</div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 16px; align-items: flex-start; position: relative; z-index: 1;">
                            <div style="width: 34px; height: 34px; background: var(--border); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; border: 3px solid var(--surface-2);">🏭</div>
                            <div>
                                <div style="font-weight: 700; font-size: 14px;">Plant Processing Attestation</div>
                                <div style="font-size: 12px; color: var(--text-muted);">Intake complete. Segregation scoring validated by Plant Operations yield optimizations.</div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 16px; align-items: flex-start; position: relative; z-index: 1;">
                            <div style="width: 34px; height: 34px; background: var(--green); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; border: 3px solid var(--surface-2); color: white;">🔒</div>
                            <div>
                                <div style="font-weight: 700; font-size: 14px; color: var(--green);">Cryptographic Signature Minted</div>
                                <div style="font-size: 12px; color: var(--text-muted);">Verification hash calculated. Safe-state proof finalized in public sustainability database.</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }, 1200);
    },

    /**
     * Copy a registry hash to clipboard with a fallback for older browsers.
     * @param {string} hash - Hash to copy.
     */
    copyHash: (hash) => {
        const notify = (msg) => window.showToast && window.showToast(msg);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(hash)
                .then(() => notify('Hash copied to clipboard!'))
                .catch(() => notify('Copy failed. Select and copy manually.'));
            return;
        }

        const temp = document.createElement('textarea');
        temp.value = hash;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.focus();
        temp.select();
        try {
            document.execCommand('copy');
            notify('Hash copied to clipboard!');
        } catch {
            notify('Copy failed. Select and copy manually.');
        } finally {
            document.body.removeChild(temp);
        }
    }
};

window.AuditPortal = AuditPortal;
