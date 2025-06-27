'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { startOfMonth, endOfMonth, startOfWeek, addDays, isSameMonth, isSameWeek, format, getWeek, getYear, isToday, addMonths, subMonths, isBefore, setHours, setMinutes } from 'date-fns'
import React from 'react'

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

type DailyHours = {
  start: string
  end: string
}

type DailySchedule = {
  [key in DayOfWeek]: DailyHours
}

type ScheduleData = {
  [key in DayOfWeek]?: DailyHours
}

// Update default dailyHours
const defaultDailyHours: DailySchedule = {
  monday: { start: '10:00', end: '19:30' },
  tuesday: { start: '10:00', end: '19:30' },
  wednesday: { start: '10:00', end: '19:30' },
  thursday: { start: '10:00', end: '19:30' },
  friday: { start: '10:00', end: '19:00' },
  saturday: { start: '', end: '' }, // closed
  sunday: { start: '', end: '' },   // closed
}

// Add openDays state to track which days are open (for Sat/Sun)
const defaultOpenDays = {
  saturday: false,
  sunday: false,
}

// WeekScheduleGrid component
function WeekScheduleGrid({ week, dailyHours, setDailyHours, openDays, setOpenDays }: {
  week: Date[],
  dailyHours: DailySchedule,
  setDailyHours: React.Dispatch<React.SetStateAction<DailySchedule>>,
  openDays: { [key in 'saturday' | 'sunday']: boolean },
  setOpenDays: React.Dispatch<React.SetStateAction<{ [key in 'saturday' | 'sunday']: boolean }>>,
}) {
  // Time slots: 9:00 to 20:00 in 30-min increments
  const timeSlots: string[] = []
  for (let h = 9; h <= 20; h++) {
    timeSlots.push(`${h.toString().padStart(2, '0')}:00`)
    if (h < 20) timeSlots.push(`${h.toString().padStart(2, '0')}:30`)
  }

  // Drag state
  const [dragging, setDragging] = useState<{ day: DayOfWeek | null, startIdx: number | null, endIdx: number | null, selecting: boolean }>({ day: null, startIdx: null, endIdx: null, selecting: true })

  // Helper: get time index from string
  const getTimeIdx = (time: string) => timeSlots.findIndex(t => t === time)

  // Helper: get time string from index
  const getTimeStr = (idx: number) => timeSlots[idx]

  // Mouse events
  const handleMouseDown = (dayName: DayOfWeek, idx: number, isOpen: boolean) => {
    setDragging({ day: dayName, startIdx: idx, endIdx: idx, selecting: !isOpen })
  }
  const handleMouseEnter = (dayName: DayOfWeek, idx: number) => {
    setDragging(drag => drag.day === dayName && drag.startIdx !== null ? { ...drag, endIdx: idx } : drag)
  }
  const handleMouseUp = () => {
    if (dragging.day && dragging.startIdx !== null && dragging.endIdx !== null) {
      const [from, to] = [dragging.startIdx, dragging.endIdx].sort((a, b) => a - b)
      const dayName = dragging.day
      if (dragging.selecting) {
        // Set open hours for this day
        setDailyHours(prev => ({
          ...prev,
          [dayName]: { start: getTimeStr(from), end: getTimeStr(to + 1) || '20:00' },
        }))
        if (dayName === 'saturday' || dayName === 'sunday') {
          setOpenDays(prev => ({ ...prev, [dayName]: true }))
        }
      } else {
        // Deselect: close the day
        setDailyHours(prev => ({ ...prev, [dayName]: { start: '', end: '' } }))
        if (dayName === 'saturday' || dayName === 'sunday') {
          setOpenDays(prev => ({ ...prev, [dayName]: false }))
        }
      }
    }
    setDragging({ day: null, startIdx: null, endIdx: null, selecting: true })
  }

  // Render
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse select-none" onMouseUp={handleMouseUp}>
        <thead>
          <tr>
            <th className="w-16"></th>
            {week.map(day => {
              const dayName = format(day, 'EEEE').toLowerCase() as DayOfWeek
              return (
                <th key={dayName} className="text-center font-semibold text-gray-900 pb-2">{format(day, 'EEE d')}</th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((slot, rowIdx) => (
            <tr key={slot}>
              <td className="text-right pr-2 text-gray-800 align-middle" style={{ fontSize: '0.95em' }}>{format(setHours(setMinutes(new Date(), 0), parseInt(slot.split(':')[0])), 'h a')}</td>
              {week.map(day => {
                const dayName = format(day, 'EEEE').toLowerCase() as DayOfWeek
                const isWeekend = dayName === 'saturday' || dayName === 'sunday'
                const isOpen = isWeekend ? openDays[dayName] : true
                const start = dailyHours[dayName]?.start
                const end = dailyHours[dayName]?.end
                const startIdx = start ? getTimeIdx(start) : null
                const endIdx = end ? getTimeIdx(end) : null
                const isFilled = isOpen && startIdx !== null && endIdx !== null && rowIdx >= startIdx && rowIdx < endIdx
                const isDragging = dragging.day === dayName && dragging.startIdx !== null && dragging.endIdx !== null && rowIdx >= Math.min(dragging.startIdx, dragging.endIdx) && rowIdx <= Math.max(dragging.startIdx, dragging.endIdx)
                return (
                  <td
                    key={dayName + slot}
                    className={`border border-gray-200 h-8 cursor-pointer ${isFilled ? 'bg-green-200' : ''} ${isDragging ? 'bg-green-400' : ''} ${!isOpen ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    onMouseDown={() => isOpen && handleMouseDown(dayName, rowIdx, isFilled)}
                    onMouseEnter={() => isOpen && dragging.day === dayName && handleMouseEnter(dayName, rowIdx)}
                  ></td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex mt-2 gap-4">
        {['saturday', 'sunday'].map(dayName => (
          <label key={dayName} className="flex items-center">
            <input
              type="checkbox"
              checked={openDays[dayName as 'saturday' | 'sunday']}
              onChange={e => {
                setOpenDays(prev => ({ ...prev, [dayName]: e.target.checked }))
                if (!e.target.checked) {
                  setDailyHours(prev => ({ ...prev, [dayName]: { start: '', end: '' } }))
                } else {
                  setDailyHours(prev => ({ ...prev, [dayName]: { start: '10:00', end: '19:00' } }))
                }
              }}
              className="mr-1"
            />
            <span className="text-sm text-gray-800 capitalize">Open {dayName}</span>
          </label>
        ))}
      </div>
      <div className="text-xs text-gray-500 mt-2">Click and drag to select open hours. Click again to close the day.</div>
    </div>
  )
}

export default function HomePage() {
  const [step, setStep] = useState(1) // 1: dates, 2: schedule, 3: result
  const [loading, setLoading] = useState(false)
  
  // Form data
  const [scheduleName, setScheduleName] = useState('')
  const [selectedWeek, setSelectedWeek] = useState<Date[] | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [dailyHours, setDailyHours] = useState<DailySchedule>(defaultDailyHours)
  const [openDays, setOpenDays] = useState<{ [key in 'saturday' | 'sunday']: boolean }>(defaultOpenDays)
  
  // Result
  const [shareLink, setShareLink] = useState('')

  // Generate random share code
  const generateShareCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  // Calendar logic
  const today = new Date()
  const monthStart = startOfMonth(calendarMonth)
  const monthEnd = endOfMonth(calendarMonth)
  const weeks: Date[][] = []
  let weekStart = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday
  while (weekStart <= monthEnd) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(addDays(weekStart, i))
    }
    weeks.push(week)
    weekStart = addDays(weekStart, 7)
  }

  // Auto-suggest schedule name when week is selected
  const handleWeekSelect = (week: Date[]) => {
    if (isBefore(week[0], startOfMonth(today))) return
    setSelectedWeek(week)
    const weekNumber = getWeek(week[0], { weekStartsOn: 1 })
    const year = getYear(week[0])
    setScheduleName(`Week ${weekNumber}, ${year}`)
    // Initialize dailyHours for all days in the selected week
    setDailyHours(prev => {
      const updated: DailySchedule = { ...prev }
      week.forEach(day => {
        const dayName = format(day, 'EEEE').toLowerCase() as DayOfWeek
        if (!updated[dayName]) {
          if (dayName === 'saturday' || dayName === 'sunday') {
            updated[dayName] = { start: '', end: '' }
          } else if (dayName === 'friday') {
            updated[dayName] = { start: '10:00', end: '19:00' }
          } else {
            updated[dayName] = { start: '10:00', end: '19:30' }
          }
        }
      })
      return updated
    })
    setOpenDays({ saturday: false, sunday: false })
  }

  // Create schedule in database
  const createSchedule = async () => {
    setLoading(true)
    try {
      const shareCode = generateShareCode()
      // Prepare daily schedule data for only the selected week
      const scheduleData: ScheduleData = {}
      if (selectedWeek) {
        selectedWeek.forEach(day => {
          const dayName = format(day, 'EEEE').toLowerCase() as DayOfWeek
          scheduleData[dayName] = dailyHours[dayName]
        })
      }
      // Insert into database
      const { error } = await supabase
        .from('schedules')
        .insert([
          {
            name: scheduleName || 'Work Schedule',
            daily_schedule: scheduleData,
            share_code: shareCode
          }
        ])
        .select()
      if (error) {
        console.error('Error creating schedule:', error)
        alert('Error creating schedule. Please try again.')
        return
      }
      // Create shareable link
      const link = `${window.location.origin}/schedule/${shareCode}`
      setShareLink(link)
      setStep(3)
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Step 1: Week Selection
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center mb-6 text-gray-900">Create Work Schedule</h1>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">
                Schedule Name (Optional)
              </label>
              <input
                type="text"
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
                placeholder="e.g., Restaurant Week 1"
                className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">
                Select a week from the calendar
              </label>
              <div className="mb-2 text-center text-lg font-semibold text-gray-900 flex items-center justify-center gap-2">
                <button
                  className={`px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-40`}
                  onClick={() => setCalendarMonth(prev => subMonths(prev, 1))}
                  disabled={format(calendarMonth, 'yyyy-MM') === format(today, 'yyyy-MM')}
                  aria-label="Previous Month"
                >
                  <span>&lt;</span>
                </button>
                <span>{format(calendarMonth, 'MMMM yyyy')}</span>
                <button
                  className="px-2 py-1 rounded hover:bg-gray-200"
                  onClick={() => setCalendarMonth(prev => addMonths(prev, 1))}
                  aria-label="Next Month"
                >
                  <span>&gt;</span>
                </button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-7 bg-gray-100 text-center text-xs font-semibold text-gray-900">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                    <div key={d} className="py-2">{d}</div>
                  ))}
                </div>
                {weeks.map((week, i) => {
                  const isSelected = selectedWeek && isSameWeek(week[0], selectedWeek[0], { weekStartsOn: 1 })
                  // Only allow selecting weeks in current or future months
                  const isPast = isBefore(week[0], startOfMonth(today))
                  return (
                    <div
                      key={i}
                      className={`grid grid-cols-7 text-center cursor-pointer ${isSelected ? 'bg-blue-100' : ''} ${isPast ? 'opacity-40 pointer-events-none' : ''}`}
                      onClick={() => handleWeekSelect(week)}
                    >
                      {week.map((day, j) => (
                        <div
                          key={j}
                          className={`py-2 border-b border-r last:border-r-0 ${isSameMonth(day, calendarMonth) ? 'text-gray-900' : 'text-gray-300'} ${isToday(day) ? 'bg-yellow-200 font-bold border-yellow-400' : ''} ${selectedWeek && selectedWeek.some(d => format(d, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')) ? 'bg-blue-200' : ''}`}
                        >
                          {format(day, 'd')}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!selectedWeek}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed mt-4"
            >
              Next: Set Schedule
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Schedule Builder (show all days in selected week)
  if (step === 2 && selectedWeek) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center mb-6 text-gray-900">Customize Your Schedule</h1>
          <p className="text-gray-800 text-center mb-6">
            Set the hours for each day in your selected week
          </p>
          <WeekScheduleGrid
            week={selectedWeek}
            dailyHours={dailyHours}
            setDailyHours={setDailyHours}
            openDays={openDays}
            setOpenDays={setOpenDays}
          />
          <div className="flex space-x-4 mt-6">
            <button
              onClick={() => setStep(1)}
              className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
            >
              Back
            </button>
            <button
              onClick={createSchedule}
              disabled={loading}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? 'Creating...' : 'Create Schedule'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 3: Success - Share Link
  if (step === 3) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Schedule Created!</h1>
            <p className="text-gray-600 mb-6">
              Share this link with your team so they can enter their availability
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-2">Shareable Link:</p>
              <p className="font-mono text-sm break-all text-blue-600">
                {shareLink}
              </p>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => navigator.clipboard.writeText(shareLink)}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                Copy Link
              </button>
              <button
                onClick={() => window.open(shareLink, '_blank')}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
              >
                Test Link
              </button>
            </div>

            <button
              onClick={() => {
                setStep(1)
                setScheduleName('')
                setSelectedWeek(null)
                setShareLink('')
              }}
              className="w-full mt-4 text-gray-600 hover:text-gray-800"
            >
              Create Another Schedule
            </button>
          </div>
        </div>
      </div>
    )
  }
}