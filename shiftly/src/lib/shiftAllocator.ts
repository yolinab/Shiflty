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

export interface ShiftAssignment {
  day: DayOfWeek
  slot: string // e.g. '10:00'
  participant: string // participant name
}

// Simple first-come-first-serve allocation
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