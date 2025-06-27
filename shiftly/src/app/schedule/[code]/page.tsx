'use client'
import { useState, useEffect, useCallback, use } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import React from 'react'
import { setHours, setMinutes, format as formatDate } from 'date-fns'
import type { DayOfWeek } from '@/lib/types'

interface DailySchedule {
  start: string
  end: string
}

interface Schedule {
  id: number
  name: string
  start_date: string
  end_date: string
  daily_schedule: Record<DayOfWeek, DailySchedule>
  share_code: string
}

interface Availability {
  available: boolean
  start: string
  end: string
}

type AvailabilityState = Record<DayOfWeek, Availability>

// Add WeekAvailabilityGrid component
function WeekAvailabilityGrid({ schedule, availability, setAvailability }: {
  schedule: Schedule,
  availability: Partial<AvailabilityState>,
  setAvailability: React.Dispatch<React.SetStateAction<Partial<AvailabilityState>>>,
}) {
  // Always use correct order for days
  const allDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const days = allDays.filter(day => schedule.daily_schedule[day])
  // Find min/max time across all days for the grid
  let minTime = 24, maxTime = 0
  days.forEach(day => {
    const { start, end } = schedule.daily_schedule[day]
    if (start && end) {
      const [startH, startM] = start.split(':').map(Number)
      const [endH, endM] = end.split(':').map(Number)
      minTime = Math.min(minTime, startH + (startM ? 0.5 : 0))
      maxTime = Math.max(maxTime, endH + (endM ? 0.5 : 0))
    }
  })
  // Build time slots (30-min increments)
  const timeSlots: string[] = []
  for (let h = Math.floor(minTime); h < Math.ceil(maxTime); h++) {
    timeSlots.push(`${h.toString().padStart(2, '0')}:00`)
    timeSlots.push(`${h.toString().padStart(2, '0')}:30`)
  }
  // Remove slots outside boss's range for each day
  const getDaySlotIndices = (day: DayOfWeek) => {
    const { start, end } = schedule.daily_schedule[day]
    const startIdx = timeSlots.findIndex(t => t === start)
    const endIdx = timeSlots.findIndex(t => t === end)
    return { startIdx, endIdx }
  }
  // Drag state
  const [dragging, setDragging] = React.useState<{ day: DayOfWeek | null, startIdx: number | null, endIdx: number | null, selecting: boolean }>({ day: null, startIdx: null, endIdx: null, selecting: true })
  // Get selected indices for a day
  const getSelectedIndices = (day: DayOfWeek) => {
    const a = availability[day]
    if (!a || !a.available || !a.start || !a.end) return []
    const selStart = timeSlots.findIndex(t => t === a.start)
    const selEnd = timeSlots.findIndex(t => t === a.end)
    if (selStart === -1 || selEnd === -1) return []
    return Array.from({ length: selEnd - selStart }, (_, i) => selStart + i).filter(i => i >= selStart && i < selEnd)
  }
  // Toggle a single slot
  const toggleSlot = (day: DayOfWeek, idx: number, isFilled: boolean) => {
    const selected = getSelectedIndices(day)
    if (isFilled) {
      // Remove this slot
      const newSelected = selected.filter(i => i !== idx)
      if (newSelected.length === 0) {
        setAvailability(prev => ({ ...prev, [day]: { ...prev[day], available: false, start: schedule.daily_schedule[day].start, end: schedule.daily_schedule[day].end } }))
      } else {
        setAvailability(prev => ({ ...prev, [day]: { ...prev[day], available: true, start: timeSlots[newSelected[0]], end: timeSlots[newSelected[newSelected.length - 1] + 1] } }))
      }
    } else {
      // Add this slot
      const newSelected = [...selected, idx].sort((a, b) => a - b)
      setAvailability(prev => ({ ...prev, [day]: { ...prev[day], available: true, start: timeSlots[newSelected[0]], end: timeSlots[newSelected[newSelected.length - 1] + 1] } }))
    }
  }
  // Mouse events
  const handleMouseDown = (day: DayOfWeek, idx: number, isFilled: boolean) => {
    toggleSlot(day, idx, isFilled)
    setDragging({ day, startIdx: idx, endIdx: idx, selecting: !isFilled })
  }
  const handleMouseEnter = (day: DayOfWeek, idx: number) => {
    setDragging(drag => drag.day === day ? { ...drag, endIdx: idx } : drag)
  }
  const handleMouseUp = () => {
    if (dragging.day && dragging.startIdx !== null && dragging.endIdx !== null && dragging.startIdx !== dragging.endIdx) {
      const [from, to] = [dragging.startIdx, dragging.endIdx].sort((a, b) => a - b)
      const day = dragging.day
      const selected = getSelectedIndices(day)
      let newSelected: number[]
      if (dragging.selecting) {
        newSelected = Array.from(new Set([...selected, ...Array.from({ length: to - from + 1 }, (_, i) => from + i)])).sort((a, b) => a - b)
      } else {
        newSelected = selected.filter(i => i < from || i > to)
      }
      if (newSelected.length === 0) {
        setAvailability(prev => ({ ...prev, [day]: { ...prev[day], available: false, start: schedule.daily_schedule[day].start, end: schedule.daily_schedule[day].end } }))
      } else {
        setAvailability(prev => ({ ...prev, [day]: { ...prev[day], available: true, start: timeSlots[newSelected[0]], end: timeSlots[newSelected[newSelected.length - 1] + 1] } }))
      }
    }
    setDragging({ day: null, startIdx: null, endIdx: null, selecting: true })
  }
  // Select all for a day
  const selectAll = (day: DayOfWeek, checked: boolean) => {
    const { startIdx, endIdx } = getDaySlotIndices(day)
    if (checked) {
      setAvailability(prev => ({ ...prev, [day]: { ...prev[day], available: true, start: timeSlots[startIdx], end: timeSlots[endIdx] } }))
    } else {
      setAvailability(prev => ({ ...prev, [day]: { ...prev[day], available: false, start: schedule.daily_schedule[day].start, end: schedule.daily_schedule[day].end } }))
    }
  }
  // Render
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse select-none">
        <thead>
          <tr>
            <th className="w-10"></th>
            {days.map(day => (
              <th key={day} className="text-center font-semibold text-gray-900 pb-2 whitespace-nowrap" style={{ height: 28 }}>
                <div className="flex flex-col items-center">
                  <span className="capitalize text-base font-bold text-gray-900">{day}</span>
                  <label className="flex items-center mt-1">
                    <input
                      type="checkbox"
                      checked={!!availability[day]?.available}
                      onChange={e => selectAll(day, e.target.checked)}
                      className="mr-1"
                    />
                    <span className="text-xs text-gray-800">All day</span>
                  </label>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((slot, rowIdx) => (
            <tr key={slot}>
              <td className={`text-right pr-2 text-gray-900 align-middle whitespace-nowrap`} style={{ fontSize: '0.90em', height: '24px', verticalAlign: 'middle' }}>
                {rowIdx % 2 === 0 ? formatDate(setHours(setMinutes(new Date(), 0), parseInt(slot.split(':')[0])), 'h a') : ''}
              </td>
              {days.map(day => {
                const { startIdx, endIdx } = getDaySlotIndices(day)
                if (rowIdx < startIdx || rowIdx >= endIdx) {
                  return <td key={day + slot} className="bg-gray-100" style={{ minWidth: 36, maxWidth: 60, height: '24px', padding: 0 }}></td>
                }
                const selected = getSelectedIndices(day)
                const isFilled = selected.includes(rowIdx)
                const isDragging = dragging.day === day && dragging.startIdx !== null && dragging.endIdx !== null && rowIdx >= Math.min(dragging.startIdx, dragging.endIdx) && rowIdx <= Math.max(dragging.startIdx, dragging.endIdx)
                return (
                  <td
                    key={day + slot}
                    className={`border border-gray-200 cursor-pointer ${isFilled ? 'bg-green-200' : ''} ${isDragging ? 'bg-green-400' : ''}`}
                    style={{ minWidth: 36, maxWidth: 60, height: '24px', padding: 0 }}
                    onMouseDown={() => handleMouseDown(day, rowIdx, isFilled)}
                    onMouseEnter={() => dragging.day === day && handleMouseEnter(day, rowIdx)}
                    onMouseUp={handleMouseUp}
                  ></td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-gray-700 mt-2">Click and drag to select your available hours. Click a cell to add/remove a 30-min slot. Use the checkbox to select all hours for a day.</div>
    </div>
  )
}

export default function SchedulePage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  
  // Form data
  const [participantName, setParticipantName] = useState('')
  const [availability, setAvailability] = useState<Partial<AvailabilityState>>({})

  // Load schedule data
  const loadSchedule = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('share_code', resolvedParams.code)
        .single()

      if (error) {
        console.error('Error loading schedule:', error)
        setError('Schedule not found')
        return
      }

      setSchedule(data)
      
      // Initialize availability state
      const initialAvailability: Partial<AvailabilityState> = {}
      Object.keys(data.daily_schedule).forEach((day) => {
        const typedDay = day as DayOfWeek
        const daySchedule = data.daily_schedule[typedDay]
        if (daySchedule) {
          initialAvailability[typedDay] = {
            available: false,
            start: daySchedule.start,
            end: daySchedule.end
          }
        }
      })
      setAvailability(initialAvailability)

    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Failed to load schedule')
    } finally {
      setLoading(false)
    }
  }, [resolvedParams.code])

  useEffect(() => {
    loadSchedule()
  }, [loadSchedule])

  // Submit availability
  const submitAvailability = async () => {
    if (!participantName.trim()) {
      alert('Please enter your name')
      return
    }

    if (!schedule) {
      alert('Schedule not loaded')
      return
    }

    const availableDays = Object.entries(availability)
      .filter(([day]) => availability[day as DayOfWeek]?.available)
      .map(([day]) => day as DayOfWeek)

    if (availableDays.length === 0) {
      alert('Please select at least one day you are available')
      return
    }

    setSubmitting(true)

    try {
      // Prepare data for insertion
      const availabilityRecords = availableDays.map(day => {
        const dayAvailability = availability[day]
        if (!dayAvailability) throw new Error(`Missing availability for ${day}`)
        
        return {
          schedule_id: schedule.id,
          participant_name: participantName.trim(),
          day_of_week: day,
          available_start: dayAvailability.start,
          available_end: dayAvailability.end
        }
      })

      // Insert availability records
      const { error } = await supabase
        .from('participant_availability')
        .insert(availabilityRecords)

      if (error) {
        console.error('Error submitting availability:', error)
        alert('Failed to submit availability. Please try again.')
        return
      }

      setSubmitted(true)

    } catch (err) {
      console.error('Unexpected error:', err)
      alert('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading schedule...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Schedule Not Found</h1>
          <p className="text-gray-600">The schedule link you&apos;re looking for doesn&apos;t exist or has expired.</p>
        </div>
      </div>
    )
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Availability Submitted!</h1>
          <p className="text-gray-600 mb-4">Thank you, {participantName}! Your availability has been recorded.</p>
          
          <a
            href={`/results/${resolvedParams.code}`}
            className="inline-block bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            View Schedule Results
          </a>
        </div>
      </div>
    )
  }

  // Main form
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        {schedule && (
          <>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {schedule.name || 'Work Schedule'}
              </h1>
              <p className="text-gray-900">
                {(() => {
                  if (schedule.start_date && schedule.end_date && schedule.start_date !== '1970-01-01' && schedule.end_date !== '1970-01-01') {
                    return `${new Date(schedule.start_date).toLocaleDateString()} - ${new Date(schedule.end_date).toLocaleDateString()}`
                  } else {
                    const allDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                    const presentDays = allDays.filter(day => schedule.daily_schedule[day])
                    if (presentDays.length > 0) {
                      // Use this week (assume current year)
                      const firstDay = presentDays[0]
                      const lastDay = presentDays[presentDays.length - 1]
                      // Try to get the next occurrence of each day in this week
                      function getNextDateOfWeek(day: DayOfWeek) {
                        const dayIdx = allDays.indexOf(day)
                        const now = new Date()
                        const nowDay = now.getDay() === 0 ? 6 : now.getDay() - 1 // JS: 0=Sun, 1=Mon...
                        const diff = (dayIdx - nowDay + 7) % 7
                        const d = new Date(now)
                        d.setDate(now.getDate() + diff)
                        return d
                      }
                      const firstDate = getNextDateOfWeek(firstDay)
                      const lastDate = getNextDateOfWeek(lastDay)
                      return `${firstDate.toLocaleDateString()} - ${lastDate.toLocaleDateString()}`
                    } else {
                      return ''
                    }
                  }
                })()}
              </p>
              <p className="text-gray-900 mt-2">
                Please enter your availability for each day
              </p>
              <p className="text-sm text-gray-900 mt-2">
                {`Don't forget to select your preferred time slots!`}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
              />
            </div>

            <WeekAvailabilityGrid
              schedule={schedule}
              availability={availability}
              setAvailability={setAvailability}
            />

            <div className="flex space-x-4 mt-6">
              <Link
                href="/"
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 text-center"
              >
                Back to Home
              </Link>
              <button
                onClick={submitAvailability}
                disabled={submitting || !Object.values(availability).some(v => v?.available)}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400"
              >
                {submitting ? 'Submitting...' : 'Submit Availability'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}