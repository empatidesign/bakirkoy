import { useEffect, useState } from 'react'

export const useClock = (): Date => {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>

    const msToNextSecond = 1000 - (Date.now() % 1000)
    const timeoutId = setTimeout(() => {
      setNow(new Date())
      intervalId = setInterval(() => setNow(new Date()), 1000)
    }, msToNextSecond)

    return () => {
      clearTimeout(timeoutId)
      clearInterval(intervalId)
    }
  }, [])

  return now
}
