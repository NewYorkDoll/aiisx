import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Link2, LoaderCircle, Square, Video, X } from 'lucide-react'
import { completeMediaUpload, getMediaConfiguration, prepareMediaUpload } from '../lib/api'
import { trustedEmbedUrl } from '../lib/embed'
import type { MediaAsset } from '../../shared/types'

type MediaMetadata = { width?: number; height?: number; duration?: number; posterUrl?: string }

function basename(filename: string) {
  return filename.replace(/\.[^.]+$/, '').trim() || 'untitled'
}

function imageMetadata(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight }) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unable to read image dimensions')) }
    image.src = url
  })
}

function videoPreview(file: File) {
  return new Promise<{ duration: number; poster: File | null; width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const finish = (result?: { duration: number; poster: File | null; width: number; height: number }, error?: Error) => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
      if (error) reject(error)
      else if (result) resolve(result)
    }
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.onerror = () => finish(undefined, new Error('Unable to read video metadata'))
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      const width = video.videoWidth
      const height = video.videoHeight
      const capture = () => {
        const scale = Math.min(1, 1280 / Math.max(width, 1))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(width * scale))
        canvas.height = Math.max(1, Math.round(height * scale))
        const context = canvas.getContext('2d')
        if (!context) return finish({ duration, poster: null, width, height })
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => finish({ duration, poster: blob ? new File([blob], `${basename(file.name)}-poster.jpg`, { type: 'image/jpeg' }) : null, width, height }), 'image/jpeg', .84)
      }
      if (duration > .1) {
        video.onseeked = capture
        video.currentTime = Math.min(Math.max(duration * .15, .1), 1.5)
      } else {
        video.onloadeddata = capture
      }
    }
    video.src = url
  })
}

export function MediaUploader({ onInsert }: { onInsert: (snippet: string) => void }) {
  const imageInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const request = useRef<XMLHttpRequest | null>(null)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('checking media storage...')
  const [showEmbed, setShowEmbed] = useState(false)
  const [embedUrl, setEmbedUrl] = useState('')

  useEffect(() => {
    getMediaConfiguration().then((config) => {
      setConfigured(config.configured)
      setStatus(config.configured ? 'media ready' : 'media storage offline')
    }).catch(() => { setConfigured(false); setStatus('media storage unavailable') })
    return () => request.current?.abort()
  }, [])

  function put(file: File, uploadUrl: string, start: number, span: number) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      request.current = xhr
      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setProgress(Math.round(start + (event.loaded / event.total) * span))
      }
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`))
      xhr.onerror = () => reject(new Error('Upload connection failed'))
      xhr.onabort = () => reject(new Error('Upload cancelled'))
      xhr.send(file)
    })
  }

  async function uploadObject(file: File, metadata: MediaMetadata, start: number, span: number) {
    const prepared = await prepareMediaUpload(file)
    await put(file, prepared.uploadUrl, start, span)
    return await completeMediaUpload(prepared.asset.id, metadata)
  }

  async function upload(file: File) {
    setBusy(true)
    setProgress(0)
    setStatus(`reading ${file.name}`)
    try {
      let asset: MediaAsset
      if (file.type.startsWith('image/')) {
        const dimensions = await imageMetadata(file)
        setStatus(`uploading ${file.name}`)
        asset = await uploadObject(file, dimensions, 0, 100)
        onInsert(`![${basename(file.name)}](${asset.url})`)
      } else if (file.type.startsWith('video/')) {
        const metadata = await videoPreview(file)
        let posterUrl: string | undefined
        if (metadata.poster) {
          setStatus('uploading video poster')
          const dimensions = await imageMetadata(metadata.poster)
          posterUrl = (await uploadObject(metadata.poster, dimensions, 0, 15)).url
        }
        setStatus(`uploading ${file.name}`)
        asset = await uploadObject(file, { width: metadata.width, height: metadata.height, duration: metadata.duration, posterUrl }, posterUrl ? 15 : 0, posterUrl ? 85 : 100)
        onInsert(`::video${JSON.stringify({ src: asset.url, poster: posterUrl || null, caption: basename(file.name) })}`)
      } else {
        throw new Error('Unsupported file type')
      }
      setProgress(100)
      setStatus(`${file.name} inserted`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Upload failed')
      setProgress(0)
    } finally {
      request.current = null
      setBusy(false)
      if (imageInput.current) imageInput.current.value = ''
      if (videoInput.current) videoInput.current.value = ''
    }
  }

  function insertEmbed() {
    const url = embedUrl.trim()
    if (!trustedEmbedUrl(url)) {
      setStatus('only YouTube and Bilibili links are supported')
      return
    }
    onInsert(`::embed${JSON.stringify({ url })}`)
    setEmbedUrl('')
    setShowEmbed(false)
    setStatus('embed inserted')
  }

  const disabled = configured !== true || busy
  return <div className="media-tools">
    <div className="media-tool-row">
      <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file) }} hidden />
      <input ref={videoInput} type="file" accept="video/mp4,video/webm" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file) }} hidden />
      <button type="button" onClick={() => imageInput.current?.click()} disabled={disabled} title="上传图片"><ImagePlus size={15} /> image</button>
      <button type="button" onClick={() => videoInput.current?.click()} disabled={disabled} title="上传视频"><Video size={15} /> video</button>
      <button type="button" onClick={() => setShowEmbed((value) => !value)} disabled={busy} title="嵌入 YouTube 或 Bilibili"><Link2 size={15} /> embed</button>
      {busy && <button type="button" className="media-cancel" onClick={() => request.current?.abort()} title="取消上传"><Square size={12} /> cancel</button>}
      <span className={status.includes('failed') || status.includes('Unsupported') || status.includes('offline') || status.includes('unavailable') || status.includes('only ') ? 'is-error' : ''}>{busy && <LoaderCircle size={12} className="spin" />} {status}</span>
    </div>
    {busy && <div className="media-progress" aria-label={`上传进度 ${progress}%`}><i style={{ width: `${progress}%` }} /></div>}
    {showEmbed && <div className="embed-entry">
      <Link2 size={14} />
      <input value={embedUrl} onChange={(event) => setEmbedUrl(event.target.value)} placeholder="https://youtube.com/watch?v=..." aria-label="视频链接" autoFocus />
      <button type="button" onClick={insertEmbed}>insert</button>
      <button type="button" onClick={() => setShowEmbed(false)} aria-label="关闭"><X size={14} /></button>
    </div>}
  </div>
}
