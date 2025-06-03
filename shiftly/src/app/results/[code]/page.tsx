'use client'
import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'

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

export default function ResultsPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [coverage, setCoverage] = useState<ScheduleCoverage>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadScheduleAndAvailability()
  }, [resolvedParams.code])

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

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getCoverageStatus = (day: DayCoverage) => {
    if (day.participants.length === 0) return 'uncovered'
    
    const neededStart = new Date(`2000-01-01T${day.needed.start}`)
    const neededEnd = new Date(`2000-01-01T${day.needed.end}`)
    
    // Check if any time slot is not covered
    const hasGaps = day.participants.every(p => {
      const availStart = new Date(`2000-01-01T${p.start}`)
      const availEnd = new Date(`2000-01-01T${p.end}`)
      
      return availStart > neededStart || availEnd < neededEnd
    })
    
    return hasGaps ? 'partial' : 'covered'
  }

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
          <a href="/" className="text-blue-600 hover:text-blue-800">
            Return to Home
          </a>
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
                <p className="text-gray-600">
                  {new Date(schedule.start_date).toLocaleDateString()} - {new Date(schedule.end_date).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {Object.entries(coverage).map(([day, dayCoverage]) => {
                if (!dayCoverage) return null
                const status = getCoverageStatus(dayCoverage)
                
                return (
                  <div key={day} className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-semibold capitalize">{day}</h2>
                        <p className="text-sm text-gray-500">
                          Needed: {formatTime(dayCoverage.needed.start)} - {formatTime(dayCoverage.needed.end)}
                        </p>
                      </div>
                      <div className={`
                        px-3 py-1 rounded-full text-sm font-medium
                        ${status === 'covered' ? 'bg-green-100 text-green-800' : ''}
                        ${status === 'partial' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${status === 'uncovered' ? 'bg-red-100 text-red-800' : ''}
                      `}>
                        {status === 'covered' && 'Fully Covered'}
                        {status === 'partial' && 'Partially Covered'}
                        {status === 'uncovered' && 'Not Covered'}
                      </div>
                    </div>

                    {dayCoverage.participants.length > 0 ? (
                      <div className="space-y-3">
                        {dayCoverage.participants.map((participant, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                            <span className="font-medium">{participant.name}</span>
                            <span className="text-gray-600">
                              {formatTime(participant.start)} - {formatTime(participant.end)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-3">
                        No availability submitted for this day
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-8 text-center">
              <a
                href={`/schedule/${resolvedParams.code}`}
                className="inline-block bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 mr-4"
              >
                Add Availability
              </a>
              <a
                href="/"
                className="inline-block bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
              >
                Back to Home
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
