import { ref, onMounted, onUnmounted } from 'vue'

const API_BASE = 'https://status.anthropic.com/api/v2'
const PROXY = 'https://corsproxy.io/?url='

async function apiFetch(path) {
	const url = `${API_BASE}${path}`
	// try {
	// 	const r = await fetch(url, { signal: AbortSignal.timeout(4000) })
	// 	if (r.ok) return r.json()
	// 	throw new Error(r.status)
	// } catch {
	const r = await fetch(PROXY + encodeURIComponent(url))
	if (!r.ok) throw new Error(r.status)
	return r.json()
	// }
}

export const IMPACT = {
	none: { label: 'Operational', color: '#4ec9b0', level: 0 },
	minor: { label: 'Degraded Performance', color: '#dcdcaa', level: 1 },
	major: { label: 'Partial Outage', color: '#ce9178', level: 2 },
	critical: { label: 'Major Outage', color: '#f44747', level: 3 },
	maintenance: { label: 'Under Maintenance', color: '#569cd6', level: 1 }
}

export const COMP_STATUS = {
	operational: { label: 'Operational', color: '#4ec9b0' },
	degraded_performance: { label: 'Degraded', color: '#dcdcaa' },
	partial_outage: { label: 'Partial Outage', color: '#ce9178' },
	major_outage: { label: 'Major Outage', color: '#f44747' },
	under_maintenance: { label: 'Maintenance', color: '#569cd6' }
}

// Per-timezone local work/peak config (local hours)
export const CITY_HOURS = {
	'Europe/Stockholm': { work: [8, 17], peak: [9, 15] },
	'America/New_York': { work: [9, 18], peak: [10, 17] },
	'America/Los_Angeles': { work: [9, 19], peak: [10, 18] },
	'America/Chicago': { work: [9, 17], peak: [10, 16] },
	'America/Toronto': { work: [9, 18], peak: [10, 17] },
	'America/Sao_Paulo': { work: [9, 18], peak: [10, 16] },
	'Europe/London': { work: [8, 17], peak: [9, 15] },
	'Europe/Paris': { work: [8, 17], peak: [9, 15] },
	'Europe/Berlin': { work: [8, 17], peak: [9, 15] },
	'Asia/Tokyo': { work: [9, 18], peak: [10, 16] },
	'Asia/Shanghai': { work: [9, 18], peak: [10, 16] },
	'Asia/Singapore': { work: [9, 18], peak: [10, 16] },
	'Asia/Kolkata': { work: [9, 18], peak: [10, 16] },
	'Australia/Sydney': { work: [9, 18], peak: [10, 16] },
	'Africa/Nairobi': { work: [8, 17], peak: [9, 15] },
	'Pacific/Auckland': { work: [9, 17], peak: [10, 15] },
}
const DEFAULT_HOURS = { work: [9, 17], peak: [10, 16] }

export function getCityHours(tzId) {
	return CITY_HOURS[tzId] || DEFAULT_HOURS
}

// Approximate latitude per timezone for sunrise/sunset
const TZ_LAT = {
	'Europe/Stockholm': 59.3,
	'America/New_York': 40.7,
	'America/Los_Angeles': 37.8,
	'America/Chicago': 41.9,
	'America/Toronto': 43.7,
	'America/Sao_Paulo': -23.5,
	'Europe/London': 51.5,
	'Europe/Paris': 48.9,
	'Europe/Berlin': 52.5,
	'Asia/Tokyo': 35.7,
	'Asia/Shanghai': 31.2,
	'Asia/Singapore': 1.3,
	'Asia/Kolkata': 19.1,
	'Australia/Sydney': -33.9,
	'Africa/Nairobi': -1.3,
	'Pacific/Auckland': -36.9,
}

// Returns { sunrise, sunset } as fractional local hours
export function getSunriseSunset(tzId, date) {
	const lat = TZ_LAT[tzId] ?? 40
	const latRad = lat * Math.PI / 180
	const start = new Date(date.getFullYear(), 0, 0)
	const dayOfYear = Math.floor((date - start) / 86400000)
	const decl = -23.45 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10))
	const declRad = decl * Math.PI / 180
	const cosH = -Math.tan(latRad) * Math.tan(declRad)
	if (cosH > 1) return { sunrise: 12, sunset: 12, polarNight: true }
	if (cosH < -1) return { sunrise: 0, sunset: 24, polarDay: true }
	const hAngle = Math.acos(cosH) * 180 / Math.PI
	return { sunrise: 12 - hAngle / 15, sunset: 12 + hAngle / 15 }
}

// Returns fractional local hour (0–24) for the current moment in the given tz
export function getCurrentFractionalHour(tzId) {
	const now = new Date()
	const fmt = new Intl.DateTimeFormat('en-US', {
		timeZone: tzId,
		hour: 'numeric', minute: 'numeric', hour12: false
	})
	const parts = fmt.formatToParts(now)
	const h = parseInt(parts.find(p => p.type === 'hour').value)
	const m = parseInt(parts.find(p => p.type === 'minute').value)
	return (h === 24 ? 0 : h) + m / 60
}

function getHourInTz(date, tz) {
	const fmt = new Intl.DateTimeFormat('en-US', {
		timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false
	})
	const parts = fmt.formatToParts(date)
	const h = parseInt(parts.find(p => p.type === 'hour').value)
	const m = parseInt(parts.find(p => p.type === 'minute').value)
	return (h === 24 ? 0 : h) + m / 60
}

// UTC-based baseline usage intensity by hour (0–23 UTC)
const BASELINE = [
	0.10, 0.08, 0.07, 0.06, 0.07, 0.09,
	0.15, 0.22, 0.32, 0.48, 0.62, 0.75,
	0.85, 0.92, 0.95, 0.93, 0.88, 0.82,
	0.72, 0.60, 0.50, 0.40, 0.28, 0.18
]

// Builds a 24-slot hour map (LOCAL hours) for a timezone, with incident overlays
export function buildHourMap(incidents, tzId) {
	const now = new Date()
	const currentH = getCurrentFractionalHour(tzId)

	return Array.from({ length: 24 }, (_, h) => {
		let worstImpact = 'none'
		let worstLevel = -1

		for (const inc of incidents) {
			const start = new Date(inc.created_at)
			const end = inc.resolved_at ? new Date(inc.resolved_at) : now
			const impact = inc.impact || 'minor'
			const level = (IMPACT[impact] || IMPACT.minor).level
			if (level <= worstLevel) continue
			if ((now - start) > 48 * 3600 * 1000) continue  // older than 48h, skip
			const startH = getHourInTz(start, tzId)
			const endH = getHourInTz(end, tzId)
			if (!inc.resolved_at && startH <= h + 1) {
				worstLevel = level; worstImpact = impact
			} else if (startH <= h + 1 && endH >= h) {
				worstLevel = level; worstImpact = impact
			}
		}

		// Map local hour to approximate UTC for baseline lookup
		const utcH = Math.floor(((h - (getHourInTz(now, tzId) - now.getUTCHours())) % 24 + 24) % 24)
		const baseline = BASELINE[utcH] || 0.2

		return {
			hour: h,
			intensity: baseline,
			incidentImpact: worstImpact,
			isFuture: h > currentH
		}
	})
}

export function useStatus() {
	const summary = ref(null)
	const incidents = ref([])
	const components = ref([])
	const overallStatus = ref('none')
	const loading = ref(true)
	const error = ref(null)
	let timer = null

	async function fetchStatus() {
		try {
			const [sData, iData] = await Promise.all([
				apiFetch('/summary.json'),
				apiFetch('/incidents.json')
			])
			summary.value = sData
			components.value = (sData.components || []).filter(c => !c.group_id)
			incidents.value = iData.incidents || []
			overallStatus.value = sData.status?.indicator || 'none'
		} catch (e) {
			error.value = e.message
			console.warn('Status API unavailable, using offline mode')
		} finally {
			loading.value = false
		}
	}

	onMounted(() => {
		fetchStatus()
		timer = setInterval(fetchStatus, 5 * 60 * 1000)
	})
	onUnmounted(() => clearInterval(timer))

	return { summary, incidents, components, overallStatus, loading, error }
}
