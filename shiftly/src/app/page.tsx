'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [testData, setTestData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    testDatabaseConnection()
  }, [])

  async function testDatabaseConnection() {
    try {
      console.log('Testing connection to Supabase...')
      
      // Simple query to your test table
      const { data, error } = await supabase
        .from('connection_test')
        .select('*')
      
      if (error) {
        console.error('Database error:', error)
        setError(`Database error: ${error.message}`)
      } else {
        console.log('✅ Connection successful! Data:', data)
        setTestData(data || [])
      }
    } catch (err) {
      console.error('Connection error:', err)
      setError(`Connection error: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Testing Database Connection...</h1>
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Supabase Connection Test</h1>
      
      {error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>❌ Connection failed:</strong> {error}
        </div>
      ) : (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <strong>✅ Connection successful!</strong>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-2">Data from your 'test' table:</h2>
        {testData.length > 0 ? (
          <div className="bg-gray-50 p-4 rounded">
            <pre className="text-sm">{JSON.stringify(testData, null, 2)}</pre>
          </div>
        ) : (
          <p className="text-gray-600">
            Table exists but no data found. 
            <br />
            <span className="text-sm">Go to Supabase → Table Editor → test table → Insert some test data!</span>
          </p>
        )}
      </div>

      <div className="mt-6 text-sm text-gray-500">
        <p>Check your browser console (F12) for detailed logs.</p>
      </div>
    </div>
  )
}