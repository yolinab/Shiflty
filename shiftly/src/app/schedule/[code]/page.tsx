'use client'
import { useState, useEffect } from 'react'
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

interface Availability {
  available: boolean
  start: string
  end: string
}

type AvailabilityState = Record<DayOfWeek, Availability>

export default function SchedulePage({ params }: { params: { code: string } }) {
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  
  // Form data
  const [participantName, setParticipantName] = useState('')
  const [availability, setAvailability] = useState<Partial<AvailabilityState>>({})

  // Load schedule data
  useEffect(() => {
    loadSchedule()
  }, [params.code])

  const loadSchedule = async () => {
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('share_code', params.code)
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
  }

  // Toggle day availability
  const toggleDayAvailability = (day: DayOfWeek) => {
    setAvailability(prev => {
      const dayAvailability = prev[day]
      if (!dayAvailability) return prev
      return {
        ...prev,
        [day]: {
          ...dayAvailability,
          available: !dayAvailability.available
        }
      }
    })
  }

  // Update time for specific day
  const updateTime = (day: DayOfWeek, type: 'start' | 'end', value: string) => {
    setAvailability(prev => {
      const dayAvailability = prev[day]
      if (!dayAvailability) return prev
      return {
        ...prev,
        [day]: {
          ...dayAvailability,
          [type]: value
        }
      }
    })
  }

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
      .filter(([_, value]) => value?.available)
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
          <p className="text-gray-600">The schedule link you're looking for doesn't exist or has expired.</p>
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
            href={`/results/${params.code}`}
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
              <p className="text-gray-600">
                {new Date(schedule.start_date).toLocaleDateString()} - {new Date(schedule.end_date).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Please enter your availability for each day
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Select Your Available Days & Times</h2>
              
              {(Object.keys(schedule.daily_schedule) as DayOfWeek[]).map(day => {
                const daySchedule = schedule.daily_schedule[day]
                const dayAvailability = availability[day]
                
                return (
                  <div key={day} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`${day}-available`}
                          checked={dayAvailability?.available || false}
                          onChange={() => toggleDayAvailability(day)}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                        <label htmlFor={`${day}-available`} className="ml-3">
                          <div className="font-medium capitalize">{day}</div>
                          <div className="text-sm text-gray-500">
                            Needed: {daySchedule.start} - {daySchedule.end}
                          </div>
                        </label>
                      </div>

                      {dayAvailability?.available && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">Available:</span>
                          <input
                            type="time"
                            value={dayAvailability.start}
                            onChange={(e) => updateTime(day, 'start', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <span className="text-gray-400">to</span>
                          <input
                            type="time"
                            value={dayAvailability.end}
                            onChange={(e) => updateTime(day, 'end', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex space-x-4 mt-6">
              <a
                href="/"
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 text-center"
              >
                Back to Home
              </a>
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