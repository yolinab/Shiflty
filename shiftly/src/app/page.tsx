'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

type DailyHours = {
  start: string
  end: string
}

type SelectedDays = {
  [key in DayOfWeek]: boolean
}

type DailySchedule = {
  [key in DayOfWeek]: DailyHours
}

type ScheduleData = {
  [key in DayOfWeek]?: DailyHours
}

export default function HomePage() {
  const [step, setStep] = useState(1) // 1: dates, 2: schedule, 3: result
  const [loading, setLoading] = useState(false)
  
  // Form data
  const [scheduleName, setScheduleName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedDays, setSelectedDays] = useState<SelectedDays>({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false
  })
  const [dailyHours, setDailyHours] = useState<DailySchedule>({
    monday: { start: '09:00', end: '17:00' },
    tuesday: { start: '09:00', end: '17:00' },
    wednesday: { start: '09:00', end: '17:00' },
    thursday: { start: '09:00', end: '17:00' },
    friday: { start: '09:00', end: '17:00' },
    saturday: { start: '09:00', end: '17:00' },
    sunday: { start: '09:00', end: '17:00' }
  })
  
  // Result
  const [shareLink, setShareLink] = useState('')

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  // Generate random share code
  const generateShareCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  // Handle day toggle
  const toggleDay = (day: DayOfWeek) => {
    setSelectedDays(prev => ({
      ...prev,
      [day]: !prev[day]
    }))
  }

  // Handle time change
  const updateTime = (day: DayOfWeek, type: 'start' | 'end', value: string) => {
    setDailyHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [type]: value
      }
    }))
  }

  // Create schedule in database
  const createSchedule = async () => {
    setLoading(true)
    
    try {
      const shareCode = generateShareCode()
      
      // Prepare daily schedule data
      const scheduleData: ScheduleData = {}
      Object.keys(selectedDays).forEach((day: string) => {
        const typedDay = day as DayOfWeek
        if (selectedDays[typedDay]) {
          scheduleData[typedDay] = dailyHours[typedDay]
        }
      })

      // Insert into database
      const { data, error } = await supabase
        .from('schedules')
        .insert([
          {
            name: scheduleName || 'Work Schedule',
            start_date: startDate,
            end_date: endDate,
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

  // Step 1: Date Selection
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center mb-6">Create Work Schedule</h1>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Schedule Name (Optional)
              </label>
              <input
                type="text"
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
                placeholder="e.g., Restaurant Week 1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!startDate || !endDate}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Next: Set Schedule
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Schedule Builder
  if (step === 2) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center mb-6">Customize Your Schedule</h1>
          <p className="text-gray-600 text-center mb-6">
            Select which days you need coverage and set the hours for each day
          </p>

          <div className="space-y-4">
            {days.map(day => (
              <div key={day} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={day}
                      checked={selectedDays[day as DayOfWeek]}
                      onChange={() => toggleDay(day as DayOfWeek)}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <label htmlFor={day} className="ml-2 font-medium capitalize">
                      {day}
                    </label>
                  </div>

                  {selectedDays[day as DayOfWeek] && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="time"
                        value={dailyHours[day as DayOfWeek].start}
                        onChange={(e) => updateTime(day as DayOfWeek, 'start', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="time"
                        value={dailyHours[day as DayOfWeek].end}
                        onChange={(e) => updateTime(day as DayOfWeek, 'end', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex space-x-4 mt-6">
            <button
              onClick={() => setStep(1)}
              className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
            >
              Back
            </button>
            <button
              onClick={createSchedule}
              disabled={loading || !Object.values(selectedDays).some(Boolean)}
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
                setStartDate('')
                setEndDate('')
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