<template>
    <div class="timeline-wrap">
        <div class="tl-header">
            <span class="section-icon">⏱</span>
            <h2>24h Timeline</h2>
            <span class="tl-desc">UTC baseline · local labels per city</span>
            <button class="add-tz-btn" @click="showPicker = true">＋ Add timezone</button>
        </div>

        <!-- <div class="tl-key">
            <span class="key-item"><span class="key-sw night-sw"></span>Night</span>
            <span class="key-item"><span class="key-sw day-sw"></span>Day</span>
            <span class="key-sep">·</span>
            <span class="key-item"><span class="key-sw usage-lo-sw"></span>Low usage</span>
            <span class="key-item"><span class="key-sw usage-hi-sw"></span>High usage</span>
            <span class="key-sep">·</span>
            <span class="key-item"><span class="key-border-sw"></span>Work 9–17</span>
        </div> -->

        <!-- CSS var drives the single shared NOW line position in each row -->
        <div class="tz-rows" ref="rowsEl" :style="{ '--now': nowPct }">
            <!-- UTC row: hour ruler + global usage/incident band -->
            <div class="tz-row utc-header-row">
                <div class="tz-label">
                    <span class="tz-flag">🌐</span>
                    <div class="tz-info">
						<span class="tz-city">UTC</span>
						<span class="tz-time">Global usage</span>
					</div>
                </div>
                <div class="tz-bands-wrap">
                    
                    <div class="band usage-band utc-usage-band">
                        <div v-for="h in 24" :key="h" class="slot" :style="{ background: utcBand[h-1] }" >
							<span>{{ String(h-1).padStart(2,'0') }}</span>
							</div>
                    </div>
                </div>
            </div>

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
                    <div class="work-border" :style="workBorderStyle(tz.id)">working hours</div>

                    <!-- Band 1: Sun / day / night — absolute rects over dark background -->
                    <div class="band sun-band">
                        <div
                            v-for="(rect, i) in tzData[tz.id]?.sunRects ?? []"
                            :key="i"
                            class="sun-rect"
                            :style="{ left: rect.left, width: rect.width }"
                        >day time</div>
                    </div>

                    <!-- Band 2: Peak usage / incidents -->
                    <div class="band usage-band">
                        <div
                            v-for="h in 24" :key="h"
                            class="slot"
                            :style="{ background: tzData[tz.id]?.usage[h - 1] }"
                        ><span>{{localLabel(h - 1, tz.id)}}</span></div>
                    </div>

                    <!-- Hour ruler: local time labels at every 3rd UTC hour -->

                </div>
            </div>

			<div class="now-line">
				<!-- <div class="now-bubble">{{ nowLabel }}</div> -->
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
	{ id: 'Asia/Shanghai',       city: 'Shanghai',      flag: '🇨🇳' },
    
    { id: 'Asia/Tokyo',          city: 'Tokyo',         flag: '🇯🇵' },
    { id: 'Asia/Kolkata',        city: 'Mumbai',        flag: '🇮🇳' },

    { id: 'Asia/Singapore',      city: 'Singapore',     flag: '🇸🇬' },
	{ id: 'Europe/London',       city: 'London',        flag: '🇬🇧' },
    { id: 'Europe/Paris',        city: 'Paris',         flag: '🇫🇷' },
    { id: 'Australia/Sydney',    city: 'Sydney',        flag: '🇦🇺' },
    { id: 'America/Chicago',     city: 'Chicago',       flag: '🏙' },
    { id: 'America/Sao_Paulo',   city: 'São Paulo',     flag: '🇧🇷' },
    { id: 'Africa/Nairobi',      city: 'Nairobi',       flag: '🇰🇪' },
    { id: 'Pacific/Auckland',    city: 'Auckland',      flag: '🇳🇿' },
    { id: 'America/Toronto',     city: 'Toronto',       flag: '🇨🇦' },
    { id: 'Europe/Berlin',       city: 'Berlin',        flag: '🇩🇪' },
	{ id: 'UTC', city: 'UTC', flag: '🌍' },
]

const timezones  = ref([
	ALL_TZ[0], 
	ALL_TZ[1], 
	ALL_TZ[2], 
	ALL_TZ[3],
	ALL_TZ[4],
	ALL_TZ[5],
		ALL_TZ[6],
])
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

// D3 RdYlGn 11-stop palette — index 0 = dark red, index 10 = dark green
const RDYLGN = [
    [165,0,38],[215,48,39],[244,109,67],[253,174,97],[254,224,139],
    [255,255,191],[217,239,139],[166,217,106],[102,189,99],[26,152,80],[0,104,55]
]

// t=0 → red, t=1 → green; intensity dims the result so night slots appear near-black
function rdYlGn(t, intensity) {
    const s   = Math.max(0, Math.min(1, t)) * (RDYLGN.length - 1)
    const lo  = Math.floor(s), hi = Math.min(lo + 1, RDYLGN.length - 1)
    const f   = s - lo
    const dim = Math.max(0, Math.min(1, intensity))
    const r   = Math.round((RDYLGN[lo][0] + f * (RDYLGN[hi][0] - RDYLGN[lo][0])) * dim)
    const g   = Math.round((RDYLGN[lo][1] + f * (RDYLGN[hi][1] - RDYLGN[lo][1])) * dim)
    const b   = Math.round((RDYLGN[lo][2] + f * (RDYLGN[hi][2] - RDYLGN[lo][2])) * dim)
    return `rgb(${r},${g},${b})`
}

// Per-city: pure local-time pattern only, no incidents (incidents go on UTC row)
function usageColor(utcH, tzId) {
    const off    = getOffset(tzId)
    const localH = ((utcH + off) % 24 + 24) % 24

    let intensity = 0
    if (localH >= 10 && localH < 16) {
        const dist = Math.abs(localH - 13) / 3 // 0 at center 13, 1 at edges
        intensity  = 0.6 + (1 - dist) * 0.4    // 0.6–1.0
    } else if (localH >= 7 && localH < 10) {
        intensity = (localH - 7) / 3 * 0.6     // ramp up 0→0.6
    } else if (localH >= 16 && localH < 20) {
        intensity = (1 - (localH - 16) / 4) * 0.6 // ramp down 0.6→0
    }
    return rdYlGn(1 - intensity, intensity)
}

// Global UTC usage baseline (0–23 UTC), peaks during US daytime
const UTC_BASELINE = [
    0.05, 0.04, 0.03, 0.03, 0.04, 0.06,
    0.12, 0.18, 0.26, 0.36, 0.48, 0.60,
    0.70, 0.80, 0.88, 0.92, 0.88, 0.78,
    0.62, 0.46, 0.32, 0.20, 0.12, 0.07
]

// UTC row color: global baseline + incident overlay
function utcBandColor(utcH, incidentImpact) {
    let intensity = UTC_BASELINE[utcH]
    if (incidentImpact === 'critical') intensity = 1.0
    else if (incidentImpact === 'major')  intensity = Math.max(intensity, 0.80)
    else if (incidentImpact === 'minor')  intensity = Math.max(intensity, 0.60)
    return rdYlGn(1 - intensity, intensity)
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

const utcBand = ref([]) // global usage + incidents for UTC row

function rebuildData() {
    const { map } = buildIncidentMap()
    // UTC row: global baseline + incidents
    utcBand.value = Array.from({ length: 24 }, (_, h) => utcBandColor(h, map[h]))
    // Per-city: local time pattern only, no incidents
    const result = {}
    for (const tz of timezones.value) {
        result[tz.id] = {
            sunRects: buildSunRects(tz.id),
            usage: Array.from({ length: 24 }, (_, h) => usageColor(h, tz.id))
        }
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
    /* background: var(--bg-secondary); */
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
.day-sw      { background: #1b5280; }
.usage-lo-sw { background: rgb(0,104,55); }   /* RdYlGn darkest green */
.usage-hi-sw { background: rgb(165,0,38); }   /* RdYlGn darkest red */
.key-border-sw {
    border: 1px solid rgba(86,156,214,0.6);
    border-radius: 2px;
    display: inline-block;
    height: 12px;
    width: 20px;
}

/* rows */
.tz-rows { display: flex; flex-direction: column; gap: 18px; position: relative; }

/* UTC header row */
/* .utc-header-row .tz-city { color: var(--text-muted); font-size: 11px; } */
.utc-ruler span { color: var(--accent-blue); font-size: 9px; opacity: 0.7; }
.utc-usage-band { height: 10px; opacity: 0.75; }

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
    font-size: 10px;
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
    /* gap: 2px; */
    min-width: 0;
    position: relative;
}

/* shared NOW line — left driven by CSS var set on .tz-rows */
.now-line {
    bottom: 0;
    /* offset by 188px label area so 0% aligns with UTC-0 band edge */
    left: calc(188px + var(--now, 0) * (100% - 188px) / 100);
    pointer-events: none;
    position: absolute;
    top: 0;
    width: 2px;
    z-index: 3;
	height: 100%;
    /* background: rgba(86,156,214,0.8); */
	background: #d9ef8c;
    /* box-shadow: 0 0 6px #569cd6; */
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
	background: #988653;
	height: 12px;
    padding-left: 5px;;
	font-size: 9px;
    bottom: 16px; /* above ruler */
    pointer-events: none;
    position: absolute;
    top: 0;
    z-index: 2;
}

/* bands */
.band { 
	/* border-radius: 3px;  */
	overflow: hidden; }

.usage-band {
    display: grid;
    /* gap: 1px; */
    grid-template-columns: repeat(24, 1fr);
}

.sun-band   { background: #06061a; height: 12px; position: relative;}
.usage-band { height: 22px; }

.sun-rect { 
	/* border-radius: 2px;  */
	bottom: 0; position: absolute; top: 0; 
	background: #1a9850;
	height: 12px;
    padding-left: 5px;
	font-size: 9px;
}

.slot { 
	/* border-radius: 2px;  */
	height: 100%; 
	display: flex;
	justify-content: center;
	align-items: center;
}

/* hour ruler */
.ruler {
    display: grid;
    grid-template-columns: repeat(24, 1fr);
    height: 14px;
}

.slot span,
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
