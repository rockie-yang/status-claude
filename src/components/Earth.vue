<template>
    <div class="earth-section">
        <div class="earth-header">
            <span class="section-icon">🌍</span>
            <h2>Global Reach</h2>
            <span class="earth-desc">Claude serves users worldwide — color reflects service health</span>
        </div>

        <div class="earth-scene">
            <div class="earth-container">
                <!-- The rotating globe -->
                <div class="earth" :style="earthStyle">
                    <!-- Specular highlight (static inside spinning globe) -->
                    <div class="earth-glow" :style="glowStyle" />
                </div>

                <!-- Real-time day/night terminator — rotates at 15°/h based on UTC -->
                <!-- Counter-rotates vs globe decoration so it stays fixed relative to solar time -->
                <div class="earth-night-real" :style="nightRealStyle" />

                <!-- 3D sphere depth shadow (always from upper-left) -->
                <div class="earth-depth" />

                <!-- Atmosphere halo -->
                <div class="earth-atmosphere" :style="atmosphereStyle" />

                <!-- Orbit ring -->
                <div class="earth-ring" />

                <!-- Status callout dot on globe -->
                <div class="earth-status-dot" :style="statusDotStyle">
                    <span class="dot-pulse" />
                </div>
            </div>

            <div class="earth-legend">
                <div class="legend-title">Service Health</div>
                <div v-for="item in legend" :key="item.label" class="legend-item">
                    <span class="legend-swatch" :style="{ background: item.color }" />
                    <span>{{ item.label }}</span>
                </div>
                <div class="legend-divider" />
                <div class="legend-time">
                    <span class="legend-time-label">UTC</span>
                    <span class="legend-time-val">{{ utcTime }}</span>
                </div>
                <div class="sun-position">
                    <span class="sun-icon">☀</span>
                    <span class="sun-label">Solar noon at {{ solarNoonCity }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
    status: { type: String, default: 'none' }
})

const IMPACT_GLOW = {
    none:        { color: '#4ec9b0', shadow: 'rgba(78,201,176,0.5)' },
    minor:       { color: '#dcdcaa', shadow: 'rgba(220,220,170,0.5)' },
    major:       { color: '#ce9178', shadow: 'rgba(206,145,120,0.5)' },
    critical:    { color: '#f44747', shadow: 'rgba(244,71,71,0.6)' },
    maintenance: { color: '#569cd6', shadow: 'rgba(86,156,214,0.5)' }
}

const CITIES_BY_LON = [
    { lon: -150, name: 'Hawaii' },
    { lon: -120, name: 'Pacific US' },
    { lon: -90,  name: 'Central US' },
    { lon: -75,  name: 'East Coast' },
    { lon: -45,  name: 'Mid-Atlantic' },
    { lon: 0,    name: 'London/Accra' },
    { lon: 15,   name: 'Central Europe' },
    { lon: 30,   name: 'Eastern Europe' },
    { lon: 45,   name: 'Gulf Region' },
    { lon: 75,   name: 'South Asia' },
    { lon: 105,  name: 'Southeast Asia' },
    { lon: 120,  name: 'East Asia' },
    { lon: 150,  name: 'Eastern Australia' },
]

const now = ref(new Date())
let timer = null

onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 10000) })
onUnmounted(() => clearInterval(timer))

const utcHour = computed(() => {
    const d = now.value
    return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600
})

// Sub-solar longitude: at UTC 12, sun is at 0° lon; moves west 15°/hr
const sunLon = computed(() => (12 - utcHour.value) * 15)

// Rotate the night half-circle so the dark side faces away from the sun
const nightRealStyle = computed(() => ({ transform: `rotate(${sunLon.value}deg)` }))

const glow = computed(() => IMPACT_GLOW[props.status] || IMPACT_GLOW.none)

const earthStyle = computed(() => ({ '--glow-color': glow.value.shadow }))

const glowStyle = computed(() => ({
    background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.04) 0%, transparent 60%)'
}))

const atmosphereStyle = computed(() => ({
    boxShadow: `0 0 30px 10px ${glow.value.shadow}, 0 0 80px 20px ${glow.value.shadow.replace('0.5', '0.15')}`
}))

const statusDotStyle = computed(() => ({
    background: glow.value.color,
    boxShadow: `0 0 10px ${glow.value.color}`
}))

const utcTime = computed(() =>
    new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(now.value)
)

const solarNoonCity = computed(() => {
    const lon = sunLon.value
    return CITIES_BY_LON.reduce((best, c) =>
        Math.abs(c.lon - lon) < Math.abs(best.lon - lon) ? c : best
    ).name
})

const legend = [
    { label: 'Operational',   color: '#4ec9b0' },
    { label: 'Degraded',      color: '#dcdcaa' },
    { label: 'Partial Outage',color: '#ce9178' },
    { label: 'Major Outage',  color: '#f44747' },
    { label: 'Maintenance',   color: '#569cd6' },
]
</script>

<style scoped>
.earth-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
}

.earth-header {
    align-items: center;
    display: flex;
    gap: 10px;
    margin-bottom: 24px;
}

.earth-header h2 {
    color: var(--text-primary);
    font-size: 15px;
    font-weight: 600;
}

.section-icon { font-size: 18px; }

.earth-desc {
    color: var(--text-secondary);
    font-size: 12px;
}

.earth-scene {
    align-items: center;
    display: flex;
    gap: 48px;
    justify-content: center;
    padding: 20px 0 32px;
}

.earth-container {
    flex-shrink: 0;
    height: 280px;
    position: relative;
    width: 280px;
}

/* The globe sphere */
.earth {
    background-image: url('https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Land_ocean_ice_2048.jpg/2048px-Land_ocean_ice_2048.jpg');
    background-repeat: repeat-x;
    background-size: 200% 100%;
    border-radius: 50%;
    height: 280px;
    overflow: hidden;
    position: relative;
    width: 280px;
    animation: earthSpin 60s linear infinite;
}

@keyframes earthSpin {
    from { background-position-x: 0%; }
    to   { background-position-x: -200%; }
}

/* Real-time day/night terminator — sibling of .earth, not a child so it doesn't spin with the globe.
   It's a half-circle dark mask. rotate() is driven by JS from solar time (15°/hr). */
.earth-night-real {
    border-radius: 50%;
    height: 280px;
    left: 0;
    overflow: hidden;
    pointer-events: none;
    position: absolute;
    top: 0;
    width: 280px;
    /* The right half is night (dark), left half is day (transparent) */
    background: linear-gradient(
        to left,
        rgba(0, 0, 20, 0.82) 0%,
        rgba(0, 0, 20, 0.82) 43%,
        rgba(0, 0, 10, 0.25) 50%,
        transparent 57%,
        transparent 100%
    );
    transform-origin: center center;
    transition: transform 60s linear; /* smooth between JS updates */
}

/* Hard depth shadow — makes it look 3D (always from upper-left) */
.earth-depth {
    border-radius: 50%;
    box-shadow:
        inset -50px 0 100px rgba(0,0,0,0.97),
        inset -12px 0 35px rgba(0,0,0,0.7),
        inset 10px 10px 25px rgba(0,0,60,0.35);
    height: 280px;
    left: 0;
    pointer-events: none;
    position: absolute;
    top: 0;
    width: 280px;
}

/* Specular / highlight overlay */
.earth-glow {
    bottom: 0;
    left: 0;
    pointer-events: none;
    position: absolute;
    right: 0;
    top: 0;
}

/* Atmosphere halo (sits outside the globe div) */
.earth-atmosphere {
    border-radius: 50%;
    bottom: -4px;
    left: -4px;
    pointer-events: none;
    position: absolute;
    right: -4px;
    top: -4px;
    transition: box-shadow 1s ease;
}

/* Subtle orbit ring */
.earth-ring {
    border: 1px solid rgba(86,156,214,0.15);
    border-radius: 50%;
    bottom: -20px;
    left: -20px;
    pointer-events: none;
    position: absolute;
    right: -20px;
    top: -20px;
}

/* Status pulse dot */
.earth-status-dot {
    border-radius: 50%;
    bottom: 30px;
    height: 10px;
    position: absolute;
    right: 22px;
    transition: background 0.5s, box-shadow 0.5s;
    width: 10px;
}

.dot-pulse {
    animation: pulse 2s ease-out infinite;
    border-radius: 50%;
    display: block;
    height: 100%;
    width: 100%;
}

@keyframes pulse {
    0%   { box-shadow: 0 0 0 0 rgba(78,201,176,0.6); }
    70%  { box-shadow: 0 0 0 10px rgba(78,201,176,0); }
    100% { box-shadow: 0 0 0 0 rgba(78,201,176,0); }
}

/* Legend */
.earth-legend {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 160px;
}

.legend-title {
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    margin-bottom: 4px;
    text-transform: uppercase;
}

.legend-item {
    align-items: center;
    display: flex;
    font-size: 13px;
    gap: 10px;
}

.legend-swatch {
    border-radius: 3px;
    display: inline-block;
    height: 10px;
    width: 10px;
}

.legend-divider {
    border-top: 1px solid var(--border);
    margin: 8px 0;
}

.legend-time {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.legend-time-label {
    color: var(--text-secondary);
    font-size: 10px;
    text-transform: uppercase;
}

.legend-time-val {
    color: var(--accent-blue);
    font-family: 'Consolas', monospace;
    font-size: 18px;
    font-weight: 600;
}

.sun-position {
    align-items: center;
    color: var(--text-secondary);
    display: flex;
    font-size: 11px;
    gap: 6px;
    margin-top: 4px;
}

.sun-icon { font-size: 14px; }

@media (max-width: 640px) {
    .earth-scene {
        flex-direction: column;
        gap: 24px;
    }
    .earth-container, .earth { height: 200px; width: 200px; }
    .earth-atmosphere { bottom: -4px; left: -4px; right: -4px; top: -4px; }
}
</style>
