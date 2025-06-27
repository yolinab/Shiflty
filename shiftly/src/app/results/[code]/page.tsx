'use client'
import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import React from 'react'
import { setHours, setMinutes, format as formatDate } from 'date-fns'
import { allocateShifts, ShiftAssignment } from '@/lib/shiftAllocator'

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

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

interface ParticipantAvailability {
  id: number
  schedule_id: number
  participant_name: string
  day_of_week: DayOfWeek
  available_start: string
  available_end: string
}

interface DayCoverage {
  needed: DailySchedule
  participants: Array<{
    name: string
    start: string
    end: string
  }>
}

type ScheduleCoverage = Partial<Record<DayOfWeek, DayCoverage>>

function ResultsScheduleGrid({ schedule, coverage }: { schedule: Schedule, coverage: ScheduleCoverage }) {
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
  // Assign a color to each participant
  const participantNames = Array.from(new Set(
    days.flatMap(day => (coverage[day]?.participants || []).map(p => p.name))
  ))
  const colors = [
    'bg-blue-200', 'bg-green-200', 'bg-yellow-200', 'bg-pink-200', 'bg-purple-200', 'bg-orange-200', 'bg-teal-200',
    'bg-red-200', 'bg-indigo-200', 'bg-cyan-200', 'bg-lime-200', 'bg-amber-200', 'bg-fuchsia-200', 'bg-rose-200'
  ]
  const colorMap: Record<string, string> = {}
  participantNames.forEach((name, i) => {
    colorMap[name] = colors[i % colors.length]
  })
  // For each cell, get all available participants for that slot
  function getCellParticipants(day: DayOfWeek, slot: string) {
    const dayCov = coverage[day]
    if (!dayCov) return []
    return dayCov.participants.filter(p => {
      // Normalize to HH:mm
      const normStart = p.start.length > 5 ? p.start.slice(0, 5) : p.start
      const normEnd = p.end.length > 5 ? p.end.slice(0, 5) : p.end
      return slot >= normStart && slot < normEnd
    })
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
                <span className="capitalize text-base font-bold text-gray-900">{day}</span>
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
                const { start, end } = schedule.daily_schedule[day]
                const startIdx = timeSlots.findIndex(t => t === start)
                const endIdx = timeSlots.findIndex(t => t === end)
                if (rowIdx < startIdx || rowIdx >= endIdx) {
                  return <td key={day + slot} className="bg-gray-100" style={{ minWidth: 36, maxWidth: 60, height: '24px', padding: 0 }}></td>
                }
                const cellParticipants = getCellParticipants(day, slot)
                if (cellParticipants.length === 0) {
                  return <td key={day + slot} className="border border-gray-200" style={{ minWidth: 36, maxWidth: 60, height: '24px', padding: 0 }}></td>
                }
                return (
                  <td key={day + slot} className="border border-gray-200 p-0" style={{ minWidth: 36, maxWidth: 60, height: '24px', padding: 0 }}>
                    <div className="flex h-full w-full" style={{ height: '24px' }}>
                      {cellParticipants.map((p) => (
                        <div
                          key={p.name}
                          className={`flex-1 h-full flex items-center justify-center ${colorMap[p.name]} border-r last:border-r-0 border-white`}
                          style={{ minWidth: 0 }}
                        >
                          <span className="text-[10px] text-gray-900 font-semibold truncate" title={p.name}>{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-2 mt-4">
        {participantNames.map(name => (
          <span key={name} className={`inline-flex items-center px-2 py-1 rounded ${colorMap[name]} text-gray-900 text-xs font-semibold`}>
            {name}
          </span>
        ))}
      </div>
      <div className="text-xs text-gray-700 mt-2">Each color represents a participant&apos;s availability. If multiple people are available, the cell is split.</div>
    </div>
  )
}

function FinalScheduleGrid({ schedule, assignments, timeSlots }: { schedule: Schedule, assignments: ShiftAssignment[], timeSlots: string[] }) {
  const allDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const days = allDays.filter(day => schedule.daily_schedule[day])
  // Assign a color to each participant
  const participantNames = Array.from(new Set(assignments.map(a => a.participant)))
  const colors = [
    'bg-blue-200', 'bg-green-200', 'bg-yellow-200', 'bg-pink-200', 'bg-purple-200', 'bg-orange-200', 'bg-teal-200',
    'bg-red-200', 'bg-indigo-200', 'bg-cyan-200', 'bg-lime-200', 'bg-amber-200', 'bg-fuchsia-200', 'bg-rose-200'
  ]
  const colorMap: Record<string, string> = {}
  participantNames.forEach((name, i) => {
    colorMap[name] = colors[i % colors.length]
  })
  // Render
  return (
    <div className="overflow-x-auto mt-10">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Final Schedule (First Come First Serve)</h2>
      <table className="min-w-full border-collapse select-none">
        <thead>
          <tr>
            <th className="w-10"></th>
            {days.map(day => (
              <th key={day} className="text-center font-semibold text-gray-900 pb-2 whitespace-nowrap" style={{ height: 28 }}>
                <span className="capitalize text-base font-bold text-gray-900">{day}</span>
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
                const { start, end } = schedule.daily_schedule[day]
                const startIdx = timeSlots.findIndex(t => t === start)
                const endIdx = timeSlots.findIndex(t => t === end)
                if (rowIdx < startIdx || rowIdx >= endIdx) {
                  return <td key={day + slot} className="bg-gray-100" style={{ minWidth: 36, maxWidth: 60, height: '24px', padding: 0 }}></td>
                }
                const assignment = assignments.find(a => a.day === day && a.slot === slot)
                if (!assignment) {
                  return <td key={day + slot} className="border border-gray-200" style={{ minWidth: 36, maxWidth: 60, height: '24px', padding: 0 }}></td>
                }
                return (
                  <td key={day + slot} className={`border border-gray-200 ${colorMap[assignment.participant]}`} style={{ minWidth: 36, maxWidth: 60, height: '24px', padding: 0 }}>
                    <span className="text-[10px] text-gray-900 font-semibold truncate" title={assignment.participant}>{assignment.participant}</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-2 mt-4">
        {participantNames.map(name => (
          <span key={name} className={`inline-flex items-center px-2 py-1 rounded ${colorMap[name]} text-gray-900 text-xs font-semibold`}>
            {name}
          </span>
        ))}
      </div>
      <div className="text-xs text-gray-700 mt-2">This is the final assigned schedule using the selected algorithm.</div>
    </div>
  )
}

export default function ResultsPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [coverage, setCoverage] = useState<ScheduleCoverage>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {

    const loadScheduleAndAvailability = async () => {
      try {
        // Load schedule
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('schedules')
          .select('*')
          .eq('share_code', resolvedParams.code)
          .single()
  
        if (scheduleError) {
          console.error('Error loading schedule:', scheduleError)
          setError('Schedule not found')
          return
        }
  
        setSchedule(scheduleData)
  
        // Load participant availability
        const { data: availabilityData, error: availabilityError } = await supabase
          .from('participant_availability')
          .select('*')
          .eq('schedule_id', scheduleData.id)
  
        if (availabilityError) {
          console.error('Error loading availability:', availabilityError)
          setError('Failed to load availability data')
          return
        }
  
        // Process coverage data
        const coverageData: ScheduleCoverage = {}
        
        Object.entries(scheduleData.daily_schedule).forEach(([day, needed]) => {
          const typedDay = day as DayOfWeek
          const typedNeeded = needed as DailySchedule
          const dayAvailability = availabilityData.filter(
            (a: ParticipantAvailability) => a.day_of_week === typedDay
          )
  
          coverageData[typedDay] = {
            needed: typedNeeded,
            participants: dayAvailability.map((a: ParticipantAvailability) => ({
              name: a.participant_name,
              start: a.available_start,
              end: a.available_end
            }))
          }
        })
  
        setCoverage(coverageData)
  
      } catch (err) {
        console.error('Unexpected error:', err)
        setError('Failed to load schedule data')
      } finally {
        setLoading(false)
      }
    }

    loadScheduleAndAvailability()
  }, [resolvedParams.code])

  

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading schedule coverage...</p>
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
          <h1 className="text-xl font-bold text-gray-900 mb-2">Error Loading Schedule</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  // Main content
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {schedule && (
          <>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {schedule.name || 'Work Schedule'} Coverage
                </h1>
                <p className="text-gray-900">
                  {/* Use start_date/end_date if present, otherwise use first/last day in daily_schedule */}
                  {(() => {
                    if (schedule.start_date && schedule.end_date && schedule.start_date !== '1970-01-01' && schedule.end_date !== '1970-01-01') {
                      return `${new Date(schedule.start_date).toLocaleDateString()} - ${new Date(schedule.end_date).toLocaleDateString()}`
                    } else {
                      const allDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                      const presentDays = allDays.filter(day => schedule.daily_schedule[day])
                      if (presentDays.length > 0) {
                        const firstDay = presentDays[0]
                        const lastDay = presentDays[presentDays.length - 1]
                        function getNextDateOfWeek(day: DayOfWeek) {
                          const dayIdx = allDays.indexOf(day)
                          const now = new Date()
                          const nowDay = now.getDay() === 0 ? 6 : now.getDay() - 1
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
              </div>
            </div>

            <ResultsScheduleGrid schedule={schedule} coverage={coverage} />

            {(() => {
              // Build timeSlots
              const allDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
              const days = allDays.filter(day => schedule.daily_schedule[day])
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
              const timeSlots: string[] = []
              for (let h = Math.floor(minTime); h < Math.ceil(maxTime); h++) {
                timeSlots.push(`${h.toString().padStart(2, '0')}:00`)
                timeSlots.push(`${h.toString().padStart(2, '0')}:30`)
              }
              // Build availabilities for the allocator
              const availabilities: import('@/lib/shiftAllocator').ParticipantAvailability[] = []
              Object.entries(coverage).forEach(([day, dayCov]) => {
                if (!dayCov) return
                dayCov.participants.forEach(p => {
                  availabilities.push({
                    participant_name: p.name,
                    day_of_week: day,
                    available_start: p.start,
                    available_end: p.end
                  })
                })
              })
              const assignments = allocateShifts(schedule.daily_schedule, availabilities, timeSlots)
              return <FinalScheduleGrid schedule={schedule} assignments={assignments} timeSlots={timeSlots} />
            })()}

            <div className="mt-8 text-center">
              <Link
                href={`/schedule/${resolvedParams.code}`}
                className="inline-block bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 mr-4"
              >
                Add Availability
              </Link>
              <Link
                href="/"
                className="inline-block bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
              >
                Back to Home
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
