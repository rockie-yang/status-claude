<template>
    <div class="timeline-wrap">
        <div class="tl-header">
            <span class="section-icon">⏱</span>
            <h2>24h Timeline</h2>
            <span class="tl-desc">UTC baseline · local labels per city</span>
            <button class="add-tz-btn" @click="showPicker = true">＋ Add timezone</button>
        </div>

        <div class="tl-key">
            <span class="key-item"><span class="key-sw night-sw"></span>Night</span>
            <span class="key-item"><span class="key-sw twilight-sw"></span>Twilight</span>
            <span class="key-item"><span class="key-sw day-sw"></span>Day</span>
            <span class="key-sep">·</span>
            <span class="key-item"><span class="key-sw peak-sw"></span>Peak Claude</span>
            <span class="key-item"><span class="key-sw inc-sw"></span>Incident</span>
            <span class="key-sep">·</span>
            <span class="key-item"><span class="key-border-sw"></span>Work hours (8h)</span>
        </div>

        <!-- CSS var drives the single shared NOW line position in each row -->
        <div class="tz-rows" ref="rowsEl" :style="{ '--now': nowPct }">
            <div v-for="tz in timezones" :key="tz.id" class="tz-row">

                <div class="tz-label">
                    <span class="tz-flag">{{ tz.flag }}</span>
                    <div class="tz-info">
                        <span class="tz-city">{{ tz.city }}</span>
                        <span class="tz-time">{{ localTimes[tz.id] }}</span>
                        <!-- <span class="tz-meta">
                            ☀ {{ fmtH(tzData[tz.id]?.sunrise) }}–{{ fmtH(tzData[tz.id]?.sunset) }}
                            &nbsp;·&nbsp;
                            ⚡ {{ fmtH(cityHoursMap[tz.id]?.peak[0]) }}–{{ fmtH(cityHoursMap[tz.id]?.peak[1]) }}
                        </span> -->
                    </div>
                    <button v-if="timezones.length > 1" class="remove-tz" @click="removeTimezone(tz.id)">✕</button>
                </div>

                <div class="tz-bands-wrap">
                    <!-- shared NOW line via CSS var -->
                    <!-- <div class="now-line">
                        <div v-if="tz === timezones[timezones.length - 1]" class="now-bubble">
                            {{ nowLabel }}
                        </div>
                    </div> -->

                    <!-- work hours border overlay (full height, no fill) -->
                    <div class="work-border" :style="workBorderStyle(tz.id)">working</div>

                    <!-- Band 1: Sun / day / night — absolute rects over dark background -->
                    <div class="band sun-band">
                        <div
                            v-for="(rect, i) in tzData[tz.id]?.sunRects ?? []"
                            :key="i"
                            class="sun-rect"
                            :style="{ left: rect.left, width: rect.width }"
                        >day</div>
                    </div>

                    <!-- Band 2: Peak usage / incidents -->
                    <div class="band usage-band">
                        <div
                            v-for="h in 24" :key="h"
                            class="slot"
                            :style="{ background: tzData[tz.id]?.usage[h - 1] }"
                        />
                    </div>

                    <!-- Hour ruler: local time labels at every 3rd UTC hour -->
                    <div class="ruler">
                        <span v-for="h in 24" :key="h">
                            <!-- {{ (h - 1) % 3 === 0 ? localLabel(h - 1, tz.id) : '' }} -->
							{{localLabel(h - 1, tz.id)}}
                        </span>
                    </div>
                </div>
            </div>

			<div class="now-line">
				<div class="now-bubble">{{ nowLabel }}</div>
			</div>
        </div>

        <!-- add timezone picker -->
        <div v-if="showPicker" class="tz-picker" @click.self="showPicker = false">
            <div class="picker-panel">
                <div class="picker-hdr">
                    <span>Add Timezone</span>
                    <button @click="showPicker = false">✕</button>
                </div>
                <input v-model="search" class="picker-search" placeholder="Search city…" autofocus />
                <div class="picker-list">
                    <button
                        v-for="opt in filteredOptions" :key="opt.id"
                        class="picker-item"
                        :disabled="timezones.some(t => t.id === opt.id)"
                        @click="addTimezone(opt)"
                    >
                        {{ opt.flag }} {{ opt.city }}
                        <span class="picker-tz">{{ opt.id }}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { getSunriseSunset, getCityHours, IMPACT } from '../composables/useStatus.js'

const props = defineProps({
    incidents: { type: Array, default: () => [] }
})

const ALL_TZ = [
    { id: 'Europe/Stockholm',    city: 'Stockholm',    flag: '🇸🇪' },
    { id: 'America/New_York',    city: 'New York',      flag: '🇺🇸' },
    { id: 'America/Los_Angeles', city: 'San Francisco', flag: '🌉' },
    { id: 'Europe/London',       city: 'London',        flag: '🇬🇧' },
    { id: 'Europe/Paris',        city: 'Paris',         flag: '🇫🇷' },
    { id: 'Asia/Tokyo',          city: 'Tokyo',         flag: '🇯🇵' },
    { id: 'Asia/Shanghai',       city: 'Shanghai',      flag: '🇨🇳' },
    { id: 'Asia/Singapore',      city: 'Singapore',     flag: '🇸🇬' },
    { id: 'Asia/Kolkata',        city: 'Mumbai',        flag: '🇮🇳' },
    { id: 'Australia/Sydney',    city: 'Sydney',        flag: '🇦🇺' },
    { id: 'America/Chicago',     city: 'Chicago',       flag: '🏙' },
    { id: 'America/Sao_Paulo',   city: 'São Paulo',     flag: '🇧🇷' },
    { id: 'Africa/Nairobi',      city: 'Nairobi',       flag: '🇰🇪' },
    { id: 'Pacific/Auckland',    city: 'Auckland',      flag: '🇳🇿' },
    { id: 'America/Toronto',     city: 'Toronto',       flag: '🇨🇦' },
    { id: 'Europe/Berlin',       city: 'Berlin',        flag: '🇩🇪' },
]

const timezones  = ref([ALL_TZ[0], ALL_TZ[1], ALL_TZ[2]])
const rowsEl     = ref(null)
const showPicker = ref(false)
const search     = ref('')
const localTimes = ref({})

// Per-tz precomputed band data (updated each minute)
const tzData = ref({})

// ── UTC NOW (0–100%) for the shared line ──────────────────────────
const nowPct = ref(0)
const nowLabel = ref('')

function updateNow() {
    const d = new Date()
    const frac = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600
    nowPct.value = (frac / 24) * 100
    nowLabel.value = `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')} UTC`
}

// ── UTC offset for a tz (fractional hours, DST-aware) ────────────
function getOffset(tzId) {
    const now = new Date()
    const get = tz => {
        const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(now)
        const h = parseInt(p.find(x => x.type === 'hour').value)
        const m = parseInt(p.find(x => x.type === 'minute').value)
        return (h === 24 ? 0 : h) + m / 60
    }
    let off = get(tzId) - get('UTC')
    if (off > 14)  off -= 24
    if (off < -12) off += 24
    return off
}

// ── Slot color helpers ───────────────────────────────────────────

// Build sun day-window as 1 or 2 absolute rects (handles UTC midnight wrap)
function buildSunRects(tzId) {
    const { sunrise, sunset, polarDay, polarNight } = getSunriseSunset(tzId, new Date())
    if (polarNight) return []
    if (polarDay)   return [{ left: '0%', width: '100%', color: '#1b5280' }]
    const off     = getOffset(tzId)
    const riseUtc = ((sunrise - off) % 24 + 24) % 24
    const setUtc  = ((sunset  - off) % 24 + 24) % 24
    if (riseUtc < setUtc) {
        return [{ left: `${(riseUtc / 24 * 100).toFixed(2)}%`, width: `${((setUtc - riseUtc) / 24 * 100).toFixed(2)}%`, color: '#1b5280' }]
    }
    // day window wraps UTC midnight → two rects
    return [
        { left: '0%',                                   width: `${(setUtc  / 24 * 100).toFixed(2)}%`,        color: '#1b5280' },
        { left: `${(riseUtc / 24 * 100).toFixed(2)}%`, width: `${((24 - riseUtc) / 24 * 100).toFixed(2)}%`, color: '#1b5280' },
    ]
}

function usageColor(utcH, tzId, incidentImpact) {
    const off    = getOffset(tzId)
    const localH = ((utcH + off) % 24 + 24) % 24
    const inPeak = localH >= 10 && localH < 16 // fixed peak window 10–16 local

    if (incidentImpact === 'critical') return `rgba(244,71,71,${inPeak ? 0.9 : 0.7})`
    if (incidentImpact === 'major')    return `rgba(206,145,120,${inPeak ? 0.85 : 0.65})`
    if (incidentImpact === 'minor')    return `rgba(220,220,170,${inPeak ? 0.75 : 0.5})`

    if (inPeak) {
        const dist = Math.abs(localH - 13) / 3 // midpoint 13, half-width 3
        return `rgba(78,201,176,${(0.5 + (1 - dist) * 0.5).toFixed(2)})`
    }
    return '#0d1118'
}

// ── Build incident map keyed by UTC hour ─────────────────────────
function buildIncidentMap() {
    const now = new Date()
    const map = Array(24).fill('none')
    for (const inc of props.incidents) {
        const start = new Date(inc.created_at)
        if (now - start > 48 * 3600 * 1000) continue
        const end    = inc.resolved_at ? new Date(inc.resolved_at) : now
        const impact = inc.impact || 'minor'
        const level  = (IMPACT[impact] || IMPACT.minor).level
        const sH = start.getUTCHours() + start.getUTCMinutes() / 60
        const eH = end.getUTCHours()   + end.getUTCMinutes() / 60
        for (let h = 0; h < 24; h++) {
            const overlaps = inc.resolved_at ? (sH <= h + 1 && eH >= h) : sH <= h + 1
            if (overlaps && level > (IMPACT[map[h]]?.level ?? -1)) map[h] = impact
        }
    }
    return { map }
}

// Recompute all band data for all timezones
function rebuildData() {
    const { map } = buildIncidentMap()
    const result = {}
    for (const tz of timezones.value) {
        const usage = []
        for (let h = 0; h < 24; h++) {
            usage.push(usageColor(h, tz.id, map[h]))
        }
        result[tz.id] = { sunRects: buildSunRects(tz.id), usage }
    }
    tzData.value = result
}

// ── Work-hours border style (absolute overlay, no fill) — 9–17 local ────────
function workBorderStyle(tzId) {
    const off      = getOffset(tzId)
    const startUtc = ((9  - off) % 24 + 24) % 24
    const endUtc   = ((17 - off) % 24 + 24) % 24
    const leftPct  = (startUtc / 24) * 100
    const widthPct = endUtc > startUtc
        ? ((endUtc - startUtc) / 24) * 100
        : ((24 - startUtc + endUtc) / 24) * 100
    return { left: `${leftPct.toFixed(2)}%`, width: `${widthPct.toFixed(2)}%` }
}

// ── Local time label for a UTC hour in this tz ───────────────────
function localLabel(utcH, tzId) {
    const off    = getOffset(tzId)
    const localH = Math.floor(((utcH + off) % 24 + 24) % 24)
    return String(localH).padStart(2, '0')
}

// ── Computed maps for template ───────────────────────────────────
const cityHoursMap = computed(() => {
    const m = {}
    for (const tz of timezones.value) m[tz.id] = getCityHours(tz.id)
    return m
})

function fmtH(h) {
    if (h == null) return '–'
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60)
    return mm ? `${hh}:${String(mm).padStart(2,'0')}` : `${String(hh).padStart(2,'0')}:00`
}

// ── Clocks ───────────────────────────────────────────────────────
function updateClocks() {
    const now = new Date()
    for (const tz of timezones.value) {
        localTimes.value[tz.id] = new Intl.DateTimeFormat('en-US', {
            timeZone: tz.id, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).format(now)
    }
}

const filteredOptions = computed(() => {
    const q = search.value.toLowerCase()
    return q ? ALL_TZ.filter(t => t.city.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)) : ALL_TZ
})

function addTimezone(tz) {
    if (!timezones.value.some(t => t.id === tz.id)) timezones.value.push(tz)
    showPicker.value = false; search.value = ''
}

function removeTimezone(id) {
    timezones.value = timezones.value.filter(t => t.id !== id)
}

// ── Lifecycle ────────────────────────────────────────────────────

let secTimer = null
let minTimer = null

onMounted(() => {
    updateNow()
    updateClocks()
    rebuildData()
    secTimer = setInterval(() => { updateNow(); updateClocks() }, 1000)
    minTimer = setInterval(rebuildData, 60 * 1000)
})

onUnmounted(() => { clearInterval(secTimer); clearInterval(minTimer) })

watch(() => props.incidents, rebuildData, { deep: true })
watch(timezones, () => { rebuildData(); nextTick(updateClocks) }, { deep: true })
</script>

<style scoped>
.timeline-wrap {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    user-select: none;
}

.tl-header {
    align-items: center;
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
}
.tl-header h2 { font-size: 15px; font-weight: 600; }
.section-icon  { font-size: 18px; }
.tl-desc       { color: var(--text-secondary); flex: 1; font-size: 12px; }

.add-tz-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--accent-blue);
    cursor: pointer;
    font-size: 12px;
    padding: 4px 10px;
    transition: background 0.15s;
}
.add-tz-btn:hover { background: var(--bg-hover); }

/* legend */
.tl-key {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 16px;
}
.key-item { align-items: center; color: var(--text-secondary); display: flex; font-size: 11px; gap: 5px; }
.key-sep  { color: var(--text-muted); }
.key-sw   { border-radius: 2px; display: inline-block; height: 8px; width: 14px; }
.night-sw    { background: #06061a; border: 1px solid #2a2a3a; }
.twilight-sw { background: #7d3c0a; }
.day-sw      { background: #1b5280; }
.peak-sw     { background: #4ec9b0; }
.inc-sw      { background: #dcdcaa; }
.key-border-sw {
    border: 1px solid rgba(86,156,214,0.6);
    border-radius: 2px;
    display: inline-block;
    height: 12px;
    width: 20px;
}

/* rows */
.tz-rows { display: flex; flex-direction: column; gap: 8px; position: relative;}

.tz-row { align-items: stretch; display: flex; }

.tz-label {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    padding-right: 12px;
    width: 188px;
}

.tz-flag { font-size: 18px; }

.tz-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }

.tz-city {
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tz-time {
    color: var(--accent-blue);
    font-family: 'Consolas', monospace;
    font-size: 11px;
}

.tz-meta {
    color: var(--text-muted);
    font-size: 10px;
    margin-top: 1px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.remove-tz {
    background: none;
    border: none;
    border-radius: 3px;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 10px;
    opacity: 0;
    padding: 2px 4px;
    transition: opacity 0.15s, color 0.15s;
}
.tz-row:hover .remove-tz { opacity: 1; }
.remove-tz:hover { color: var(--accent-red); }

/* bands container */
.tz-bands-wrap {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    position: relative;
}

/* shared NOW line — left driven by CSS var set on .tz-rows */
.now-line {
    bottom: 0;
    left: calc(var(--now, 50) * 1%);
    pointer-events: none;
    position: absolute;
    top: 0;
    width: 2px;
    z-index: 3;
	height: 100%;
    background: rgba(86,156,214,0.8);
    box-shadow: 0 0 6px #569cd6;
}

.now-bubble {
    background: #569cd6;
    border-radius: 3px;
    bottom: -2px;
    color: #1e1e1e;
    font-family: monospace;
    font-size: 9px;
    font-weight: 700;
    left: 50%;
    padding: 1px 4px;
    position: absolute;
    transform: translateX(-50%);
    white-space: nowrap;
}

/* work hours border overlay — no fill, just border */
.work-border {
    /* border: 1px solid rgba(86,156,214,0.45); */
	background: #9c7c4a;
	font-size: 9px;
	padding-left: 5px;;
    border-radius: 3px;
    bottom: 16px; /* above ruler */
    pointer-events: none;
    position: absolute;
    top: 0;
	height: 12px;
    z-index: 2;
}

/* bands */
.band { border-radius: 3px; overflow: hidden; }

.usage-band {
    display: grid;
    gap: 1px;
    grid-template-columns: repeat(24, 1fr);
}

.sun-band   { background: #06061a; height: 12px; position: relative;}
.usage-band { height: 22px; }

.sun-rect { border-radius: 2px; bottom: 0; position: absolute; top: 0; background: #dcdcaa; color: black;font-size: 9px; padding-left: 5px;}

.slot { border-radius: 2px; height: 100%; }

/* hour ruler */
.ruler {
    display: grid;
    grid-template-columns: repeat(24, 1fr);
    height: 14px;
}

.ruler span {
    color: #4a4a5a;
    font-family: 'Consolas', monospace;
    font-size: 9px;
    overflow: visible;
    text-align: center;
    white-space: nowrap;
}

/* picker */
.tz-picker {
    align-items: center;
    background: rgba(0,0,0,0.6);
    bottom: 0; left: 0; right: 0; top: 0;
    display: flex;
    justify-content: center;
    position: fixed;
    z-index: 100;
}

.picker-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    max-height: 60vh;
    min-width: 320px;
    overflow: hidden;
}

.picker-hdr {
    align-items: center;
    border-bottom: 1px solid var(--border);
    display: flex;
    font-size: 14px;
    font-weight: 600;
    justify-content: space-between;
    padding: 12px 16px;
}
.picker-hdr button { background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 14px; }

.picker-search {
    background: var(--bg-tertiary);
    border: none;
    border-bottom: 1px solid var(--border);
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
    padding: 10px 16px;
    width: 100%;
}

.picker-list { display: flex; flex-direction: column; overflow-y: auto; }

.picker-item {
    align-items: center;
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    font-size: 13px;
    gap: 8px;
    padding: 8px 16px;
    text-align: left;
    transition: background 0.1s;
}
.picker-item:hover:not(:disabled) { background: var(--bg-hover); }
.picker-item:disabled { color: var(--text-muted); cursor: default; }
.picker-tz { color: var(--text-secondary); font-size: 11px; margin-left: auto; }
</style>
