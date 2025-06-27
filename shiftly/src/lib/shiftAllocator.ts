import type { DayOfWeek } from '@/lib/types'

export interface DailySchedule {
  start: string
  end: string
}

export interface ParticipantAvailability {
  participant_name: string
  day_of_week: DayOfWeek
  available_start: string
  available_end: string
}

// Add a flag property for assignment status
export interface ShiftAssignment {
  day: DayOfWeek
  slot: string // e.g. '10:00-13:00'
  participant: string // participant name, or '' if uncovered
  flag?: 'multi-shift' | 'uncovered' | 'partial' | ''
}

// Shift blocks per day (Friday has a different closing shift)
export const SHIFT_BLOCKS: Record<DayOfWeek, { label: string, start: string, end: string, shiftType: 'opening' | 'middle' | 'closing' }[]> = {
  monday: [
    { label: '10:00-13:00', start: '10:00', end: '13:00', shiftType: 'opening' },
    { label: '12:00-18:30', start: '12:00', end: '18:30', shiftType: 'middle' },
    { label: '17:00-19:30', start: '17:00', end: '19:30', shiftType: 'closing' },
  ],
  tuesday: [
    { label: '10:00-13:00', start: '10:00', end: '13:00', shiftType: 'opening' },
    { label: '12:00-18:30', start: '12:00', end: '18:30', shiftType: 'middle' },
    { label: '17:00-19:30', start: '17:00', end: '19:30', shiftType: 'closing' },
  ],
  wednesday: [
    { label: '10:00-13:00', start: '10:00', end: '13:00', shiftType: 'opening' },
    { label: '12:00-18:30', start: '12:00', end: '18:30', shiftType: 'middle' },
    { label: '17:00-19:30', start: '17:00', end: '19:30', shiftType: 'closing' },
  ],
  thursday: [
    { label: '10:00-13:00', start: '10:00', end: '13:00', shiftType: 'opening' },
    { label: '12:00-18:30', start: '12:00', end: '18:30', shiftType: 'middle' },
    { label: '17:00-19:30', start: '17:00', end: '19:30', shiftType: 'closing' },
  ],
  friday: [
    { label: '10:00-13:00', start: '10:00', end: '13:00', shiftType: 'opening' },
    { label: '12:00-18:30', start: '12:00', end: '18:30', shiftType: 'middle' },
    { label: '17:00-19:00', start: '17:00', end: '19:00', shiftType: 'closing' },
  ],
  saturday: [
    { label: '10:00-13:00', start: '10:00', end: '13:00', shiftType: 'opening' },
    { label: '12:00-18:30', start: '12:00', end: '18:30', shiftType: 'middle' },
    { label: '17:00-19:30', start: '17:00', end: '19:30', shiftType: 'closing' },
  ],
  sunday: [
    { label: '10:00-13:00', start: '10:00', end: '13:00', shiftType: 'opening' },
    { label: '12:00-18:30', start: '12:00', end: '18:30', shiftType: 'middle' },
    { label: '17:00-19:30', start: '17:00', end: '19:30', shiftType: 'closing' },
  ],
}

function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh + em / 60) - (sh + sm / 60)
}

// Calculate overlap in hours between two intervals
function overlapHours(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const start = Math.max(
    parseInt(aStart.replace(':', ''), 10),
    parseInt(bStart.replace(':', ''), 10)
  )
  const end = Math.min(
    parseInt(aEnd.replace(':', ''), 10),
    parseInt(bEnd.replace(':', ''), 10)
  )
  if (end <= start) return 0
  // Convert back to hours
  const startH = Math.floor(start / 100), startM = start % 100
  const endH = Math.floor(end / 100), endM = end % 100
  return (endH + endM / 60) - (startH + startM / 60)
}

// Main proportional allocation function with shift type fairness
export function allocateProportionalShifts(
  schedule: Record<DayOfWeek, DailySchedule>,
  availabilities: ParticipantAvailability[]
): ShiftAssignment[] {
  // 1. Calculate total available hours per participant
  const participantHours: Record<string, number> = {}
  availabilities.forEach(a => {
    const hours = hoursBetween(a.available_start, a.available_end)
    participantHours[a.participant_name] = (participantHours[a.participant_name] || 0) + hours
  })
  const totalHours = Object.values(participantHours).reduce((a, b) => a + b, 0)
  if (totalHours === 0) return []

  // 2. Calculate total number of shift blocks
  const days = Object.keys(schedule) as DayOfWeek[]
  let totalBlocks = 0
  days.forEach(day => {
    totalBlocks += SHIFT_BLOCKS[day].filter(block => {
      const sched = schedule[day]
      return sched && sched.start <= block.start && sched.end >= block.end
    }).length
  })

  // 3. Calculate target number of shifts per participant
  const participantTargets: Record<string, number> = {}
  Object.entries(participantHours).forEach(([name, hours]) => {
    participantTargets[name] = (hours / totalHours) * totalBlocks
  })

  // 4. Build all shift blocks for the week
  type Block = { day: DayOfWeek, label: string, start: string, end: string, shiftType: 'opening' | 'middle' | 'closing' }
  const allBlocks: Block[] = []
  days.forEach(day => {
    SHIFT_BLOCKS[day].forEach(block => {
      // Only include block if within boss's required hours
      const sched = schedule[day]
      if (sched && sched.start <= block.start && sched.end >= block.end) {
        allBlocks.push({ day, ...block })
      }
    })
  })

  // 5. Assign shifts
  const assignments: ShiftAssignment[] = []
  const participantAssigned: Record<string, number> = {}
  Object.keys(participantTargets).forEach(name => participantAssigned[name] = 0)
  // Track per-person, per-day assignments
  const dailyAssigned: Record<string, Set<DayOfWeek>> = {}
  Object.keys(participantTargets).forEach(name => dailyAssigned[name] = new Set())
  // Track per-person, per-shift-type assignments
  const shiftTypeAssigned: Record<string, { opening: number, middle: number, closing: number }> = {}
  Object.keys(participantTargets).forEach(name => shiftTypeAssigned[name] = { opening: 0, middle: 0, closing: 0 })

  for (const block of allBlocks) {
    // Find all available participants for this block who have NOT been assigned a shift this day
    let eligible = availabilities.filter(a =>
      a.day_of_week === block.day &&
      !dailyAssigned[a.participant_name].has(block.day)
    )
    // For each eligible, calculate overlap with block
    const blockHours = hoursBetween(block.start, block.end)
    const eligibleWithOverlap = eligible.map(a => {
      const overlap = overlapHours(a.available_start, a.available_end, block.start, block.end)
      return { ...a, overlap }
    }).filter(a => a.overlap > 0)
    // Prefer those who cover at least 80% of the block
    let fullCover = eligibleWithOverlap.filter(a => a.overlap >= 0.8 * blockHours)
    let flag: ShiftAssignment['flag'] = ''
    if (fullCover.length === 0 && eligibleWithOverlap.length > 0) {
      // No one covers 80%, but someone covers partially
      fullCover = [eligibleWithOverlap.reduce((a, b) => (a.overlap > b.overlap ? a : b))]
      flag = 'partial'
    }
    // If still none, allow assigning someone already assigned that day (but flag it)
    if (fullCover.length === 0) {
      eligible = availabilities.filter(a => a.day_of_week === block.day)
      const eligibleWithOverlap2 = eligible.map(a => {
        const overlap = overlapHours(a.available_start, a.available_end, block.start, block.end)
        return { ...a, overlap }
      }).filter(a => a.overlap > 0)
      let fullCover2 = eligibleWithOverlap2.filter(a => a.overlap >= 0.8 * blockHours)
      if (fullCover2.length === 0 && eligibleWithOverlap2.length > 0) {
        fullCover2 = [eligibleWithOverlap2.reduce((a, b) => (a.overlap > b.overlap ? a : b))]
        flag = 'partial'
      } else if (fullCover2.length > 0) {
        flag = 'multi-shift'
      }
      if (fullCover2.length === 0) {
        assignments.push({ day: block.day, slot: block.label, participant: '', flag: 'uncovered' })
        continue
      }
      // Assign the top candidate with fewest of this shift type, then lowest assigned/target ratio, then random
      const sorted2 = fullCover2
        .map(a => ({
          name: a.participant_name,
          shiftTypeCount: shiftTypeAssigned[a.participant_name][block.shiftType],
          ratio: participantAssigned[a.participant_name] / (participantTargets[a.participant_name] || 1),
          assigned: participantAssigned[a.participant_name],
          overlap: a.overlap
        }))
        .sort((a, b) => a.shiftTypeCount - b.shiftTypeCount || a.ratio - b.ratio || a.assigned - b.assigned || Math.random() - 0.5)
      const chosen2 = sorted2[0].name
      assignments.push({
        day: block.day,
        slot: block.label,
        participant: chosen2,
        flag: flag || 'multi-shift'
      })
      participantAssigned[chosen2]++
      dailyAssigned[chosen2].add(block.day)
      shiftTypeAssigned[chosen2][block.shiftType]++
      continue
    }
    // Sort by fewest of this shift type, then assigned/target ratio, then random
    const sorted = fullCover
      .map(a => ({
        name: a.participant_name,
        shiftTypeCount: shiftTypeAssigned[a.participant_name][block.shiftType],
        ratio: participantAssigned[a.participant_name] / (participantTargets[a.participant_name] || 1),
        assigned: participantAssigned[a.participant_name],
        overlap: a.overlap
      }))
      .sort((a, b) => a.shiftTypeCount - b.shiftTypeCount || a.ratio - b.ratio || a.assigned - b.assigned || Math.random() - 0.5)
    const chosen = sorted[0].name
    assignments.push({
      day: block.day,
      slot: block.label,
      participant: chosen,
      flag: flag || ''
    })
    participantAssigned[chosen]++
    dailyAssigned[chosen].add(block.day)
    shiftTypeAssigned[chosen][block.shiftType]++
  }
  return assignments
}

// --- Old: Simple first-come-first-serve allocation ---
export function allocateShifts(
  schedule: Record<DayOfWeek, DailySchedule>,
  availabilities: ParticipantAvailability[],
  timeSlots: string[]
): ShiftAssignment[] {
  const assignments: ShiftAssignment[] = []
  for (const day of Object.keys(schedule) as DayOfWeek[]) {
    const { start, end } = schedule[day]
    const startIdx = timeSlots.findIndex(t => t === start)
    const endIdx = timeSlots.findIndex(t => t === end)
    for (let i = startIdx; i < endIdx; i++) {
      // Find the first participant (by order in availabilities) who is available for this slot
      const slot = timeSlots[i]
      const found = availabilities.find(a =>
        a.day_of_week === day &&
        slot >= a.available_start.slice(0, 5) &&
        slot < a.available_end.slice(0, 5)
      )
      if (found) {
        assignments.push({ day, slot, participant: found.participant_name })
      }
    }
  }
  return assignments
}

// Usage example (in your page):
// import { allocateShifts } from '@/lib/shiftAllocator'
// const assignments = allocateShifts(schedule.daily_schedule, allAvailabilities, timeSlots) 