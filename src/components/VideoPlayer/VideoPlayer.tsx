// ✅ FEATURE 9: Video Integration
// Product videos, demos, reviews

import { useState, useRef } from 'react'

export interface VideoProps {
  url: string
  title: string
  thumbnail?: string
  duration?: number
  description?: string
  transcript?: string
}

export function ProductVideoPlayer({ video }: { video: VideoProps }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  const handlePause = () => {
    if (videoRef.current) {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen()
      }
      setIsFullscreen(!isFullscreen)
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className='w-full bg-black rounded-lg overflow-hidden'>
      <div className='relative aspect-video'>
        <video
          ref={videoRef}
          className='w-full h-full'
          poster={video.thumbnail}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          src={video.url}
        />

        {!isPlaying && (
          <div className='absolute inset-0 flex items-center justify-center bg-black/50'>
            <button
              onClick={handlePlay}
              className='w-16 h-16 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition'
            >
              <span className='text-white text-2xl'>▶</span>
            </button>
          </div>
        )}

        {/* Controls */}
        <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4'>
          {/* Progress bar */}
          <div className='mb-3'>
            <input
              type='range'
              min='0'
              max={duration}
              value={currentTime}
              onChange={(e) => {
                if (videoRef.current) {
                  videoRef.current.currentTime = parseFloat(e.target.value)
                }
              }}
              className='w-full h-1 bg-gray-600 rounded cursor-pointer'
            />
          </div>

          {/* Control buttons */}
          <div className='flex items-center justify-between text-white'>
            <div className='flex gap-2'>
              <button
                onClick={isPlaying ? handlePause : handlePlay}
                className='hover:opacity-75'
              >
                {isPlaying ? '⏸' : '▶'}
              </button>

              <div className='flex items-center gap-2'>
                <span className='text-sm'>{formatTime(currentTime)}</span>
                <span className='text-gray-400'>/</span>
                <span className='text-sm'>{formatTime(duration)}</span>
              </div>
            </div>

            <div className='flex items-center gap-3'>
              {/* Volume */}
              <div className='flex items-center gap-1'>
                <span>🔊</span>
                <input
                  type='range'
                  min='0'
                  max='1'
                  step='0.1'
                  value={volume}
                  onChange={(e) => {
                    const vol = parseFloat(e.target.value)
                    setVolume(vol)
                    if (videoRef.current) {
                      videoRef.current.volume = vol
                    }
                  }}
                  className='w-20 h-1 bg-gray-600 rounded cursor-pointer'
                />
              </div>

              {/* Fullscreen */}
              <button onClick={handleFullscreen} className='hover:opacity-75'>
                ⛶
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Video info */}
      <div className='p-4 bg-gray-900 text-white'>
        <h3 className='font-bold text-lg mb-2'>{video.title}</h3>
        {video.description && (
          <p className='text-gray-400 text-sm mb-3'>{video.description}</p>
        )}

        {/* Transcript */}
        {video.transcript && (
          <details className='cursor-pointer'>
            <summary className='text-blue-400 hover:underline'>
              Show Transcript
            </summary>
            <p className='mt-3 text-sm text-gray-300 leading-relaxed'>
              {video.transcript}
            </p>
          </details>
        )}
      </div>
    </div>
  )
}

export default ProductVideoPlayer

