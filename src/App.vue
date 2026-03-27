<template>
    <div class="app">
        <!-- rotating earth as page background -->
        <div class="bg-earth">
            <div class="bg-earth-night" />
            <div class="bg-earth-depth" />
        </div>
        <header class="app-header">
            <div class="header-logo">
                <div class="logo-text">
                    <h1><span class="logo-hex">⬡</span><span>Claude Status</span></h1>
                    <span class="logo-sub">Anthropic API · Real-time dashboard</span>
                </div>
            </div>
            <div class="header-right">
                <div class="overall-badge" :class="'badge-' + overallStatus">
                    <span class="badge-dot" />
                    <span>{{ IMPACT[overallStatus]?.label || 'Loading…' }}</span>
                </div>
                <a href="https://status.anthropic.com" target="_blank" rel="noopener" class="ext-link">
                    ↗ status.anthropic.com
                </a>
            </div>
        </header>

        <div v-if="loading" class="loading-bar"><div class="loading-track" /></div>

        <div v-if="error" class="error-notice">
            ⚠ Could not reach status API — showing offline / estimated data
        </div>

        <!-- <section v-if="components.length" class="components-bar">
            <div v-for="comp in components" :key="comp.id" class="comp-pill">
                <span class="comp-dot" :style="{ background: COMP_STATUS[comp.status]?.color || '#858585' }" />
                <span class="comp-name">{{ comp.name }}</span>
                <span class="comp-status-label" :style="{ color: COMP_STATUS[comp.status]?.color || '#858585' }">
                    {{ COMP_STATUS[comp.status]?.label || comp.status }}
                </span>
            </div>
        </section> -->

        <section class="main-section">
            <Timeline :incidents="incidents" />
        </section>

        <section v-if="activeIncidents.length" class="incidents-section">
            <div class="incidents-title"><span>⚠</span> Active Incidents</div>
            <div v-for="inc in activeIncidents" :key="inc.id" class="incident-card" :class="'inc-' + inc.impact">
                <div class="inc-header">
                    <span class="inc-name">{{ inc.name }}</span>
                    <span class="inc-impact" :style="{ color: IMPACT[inc.impact]?.color }">
                        {{ IMPACT[inc.impact]?.label }}
                    </span>
                </div>
                <div class="inc-update">{{ inc.incident_updates?.[0]?.body || '' }}</div>
                <div class="inc-time">Started {{ formatRelative(inc.created_at) }}</div>
            </div>
        </section>

        <footer class="app-footer">
            <span>Data from
                <a href="https://status.anthropic.com" target="_blank" rel="noopener">status.anthropic.com</a>
                · Refreshes every 5 min
            </span>
            <!-- <span class="footer-legend">
                <span v-for="item in heatLegend" :key="item.label" class="heat-item">
                    <span class="heat-swatch" :style="{ background: item.color }" />{{ item.label }}
                </span>
            </span> -->
        </footer>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import Timeline from './components/Timeline.vue'
import { useStatus, IMPACT, COMP_STATUS } from './composables/useStatus.js'

const { incidents, components, overallStatus, loading, error } = useStatus()

const activeIncidents = computed(() => incidents.value.filter(i => i.status !== 'resolved'))

function formatRelative(iso) {
    if (!iso) return ''
    const diff = Date.now() - new Date(iso).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    return `${Math.floor(hr / 24)}d ago`
}

const heatLegend = [
    { label: 'Operational', color: '#4ec9b0' },
    { label: 'Degraded',    color: '#dcdcaa' },
    { label: 'Partial Outage', color: '#ce9178' },
    { label: 'Major Outage',   color: '#f44747' },
]
</script>

<style scoped>
.app {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-top: 20px;
    position: relative;
    z-index: 0;
}

/* ── background rotating earth ─────────────────────────────────── */
.bg-earth {
    animation: bgEarthSpin 120s linear infinite;
    background-image: url('https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Land_ocean_ice_2048.jpg/2048px-Land_ocean_ice_2048.jpg');
    background-repeat: repeat-x;
    background-size: 200% 100%;
    border-radius: 50%;
    height: 900px;
    left: 50%;
    opacity: 0.18;
    pointer-events: none;
    position: fixed;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 900px;
    z-index: -1;
}

.bg-earth-night {
    background: linear-gradient(
        to left,
        rgba(0,0,20,0.85) 0%,
        rgba(0,0,20,0.85) 44%,
        rgba(0,0,10,0.3)  50%,
        transparent 56%,
        transparent 100%
    );
    border-radius: 50%;
    height: 100%;
    left: 0;
    position: absolute;
    top: 0;
    width: 100%;
}

.bg-earth-depth {
    border-radius: 50%;
    box-shadow: inset -80px 0 160px rgba(0,0,0,0.95), inset 20px 20px 60px rgba(0,0,40,0.4);
    height: 100%;
    left: 0;
    position: absolute;
    top: 0;
    width: 100%;
}

@keyframes bgEarthSpin {
    from { background-position-x: 0%; }
    to   { background-position-x: -200%; }
}

.app-header {
    align-items: center;
    display: flex;
    justify-content: space-between;
    padding: 16px 0 8px;
}

.header-logo { align-items: center; display: flex; gap: 14px; }

.logo-hex { color: var(--accent-blue); font-size: 36px; line-height: 1; padding-right: 10px; }

.logo-text h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }

.logo-sub { color: var(--text-secondary); font-size: 12px; }

.header-right { align-items: flex-end; display: flex; flex-direction: column; gap: 6px; }

.overall-badge {
    align-items: center;
    border: 1px solid transparent;
    border-radius: 20px;
    display: flex;
    font-size: 13px;
    font-weight: 500;
    gap: 7px;
    padding: 5px 12px;
}

.badge-none      { background: rgba(78,201,176,0.12); border-color: rgba(78,201,176,0.3); color: #4ec9b0; }
.badge-minor     { background: rgba(220,220,170,0.12); border-color: rgba(220,220,170,0.3); color: #dcdcaa; }
.badge-major     { background: rgba(206,145,120,0.12); border-color: rgba(206,145,120,0.3); color: #ce9178; }
.badge-critical  { background: rgba(244,71,71,0.12); border-color: rgba(244,71,71,0.3); color: #f44747; }

.badge-dot {
    animation: blink 2s ease-in-out infinite;
    background: currentColor;
    border-radius: 50%;
    display: inline-block;
    height: 7px;
    width: 7px;
}

@keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
}

.ext-link { color: var(--text-secondary); font-size: 11px; text-decoration: none; transition: color 0.15s; }
.ext-link:hover { color: var(--accent-blue); }

.loading-bar { background: var(--bg-tertiary); border-radius: 2px; height: 3px; overflow: hidden; }
.loading-track {
    animation: slide 1.2s ease-in-out infinite;
    background: linear-gradient(90deg, transparent, var(--accent-blue), transparent);
    height: 100%;
    width: 40%;
}
@keyframes slide { from { transform: translateX(-150%); } to { transform: translateX(350%); } }

.error-notice {
    background: rgba(206,145,120,0.1);
    border: 1px solid rgba(206,145,120,0.3);
    border-radius: 6px;
    color: var(--accent-orange);
    font-size: 12px;
    padding: 8px 14px;
}

.components-bar {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 12px 16px;
}

.comp-pill {
    align-items: center;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 20px;
    display: flex;
    font-size: 12px;
    gap: 6px;
    padding: 4px 10px;
}

.comp-dot { border-radius: 50%; display: inline-block; height: 7px; width: 7px; }
.comp-name { color: var(--text-primary); }
.comp-status-label { font-size: 11px; }

.main-section { display: flex; flex-direction: column; }

.incidents-section { display: flex; flex-direction: column; gap: 8px; }

.incidents-title { align-items: center; color: var(--accent-orange); display: flex; font-size: 13px; font-weight: 600; gap: 6px; }

.incident-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-left-width: 3px;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 12px 16px;
}
.inc-minor    { border-left-color: #dcdcaa; }
.inc-major    { border-left-color: #ce9178; }
.inc-critical { border-left-color: #f44747; }
.inc-none     { border-left-color: #4ec9b0; }

.inc-header { align-items: center; display: flex; gap: 10px; justify-content: space-between; }
.inc-name   { font-size: 14px; font-weight: 600; }
.inc-impact { font-size: 12px; }
.inc-update { color: var(--text-secondary); font-size: 12px; line-height: 1.5; }
.inc-time   { color: var(--text-muted); font-size: 11px; }

.app-footer {
    align-items: center;
    border-top: 1px solid var(--border);
    color: var(--text-muted);
    display: flex;
    font-size: 11px;
    gap: 20px;
    justify-content: space-between;
    padding: 14px 0;
}

.footer-legend { align-items: center; display: flex; flex-wrap: wrap; gap: 12px; }
.heat-item { align-items: center; display: flex; gap: 5px; }
.heat-swatch { border-radius: 2px; display: inline-block; height: 8px; width: 16px; }
.app-footer a { color: var(--text-secondary); text-decoration: none; }
.app-footer a:hover { color: var(--accent-blue); }
</style>
