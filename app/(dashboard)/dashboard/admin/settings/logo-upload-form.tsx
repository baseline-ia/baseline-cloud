'use client'

import { useRef, useState } from 'react'
import { Upload, Trash2 } from 'lucide-react'
import { uploadLogoAction, removeLogoAction } from './logo-actions'

interface LogoUploadFormProps {
  currentLogo: { dataUrl: string; filename: string } | null
}

export function LogoUploadForm({ currentLogo }: LogoUploadFormProps) {
  const [preview, setPreview] = useState<string | null>(currentLogo?.dataUrl ?? null)
  const [filename, setFilename] = useState<string>(currentLogo?.filename ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, SVG, JPG)')
      return
    }
    if (file.size > 512 * 1024) {
      setError('Logo must be under 512KB')
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      setPreview(dataUrl)
      setFilename(file.name)
      setSaving(true)
      const result = await uploadLogoAction(dataUrl, file.name)
      setSaving(false)
      if (result?.error) setError(result.error)
    }
    reader.readAsDataURL(file)
  }

  async function handleRemove() {
    setSaving(true)
    await removeLogoAction()
    setPreview(null)
    setFilename('')
    setSaving(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      {preview ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 'var(--cl-radius-sm)',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-subtle)',
            }}
          >
            <img src={preview} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text)' }}>{filename}</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {saving ? 'Saving...' : 'Active'}
            </p>
          </div>
          <button
            onClick={handleRemove}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.375rem 0.75rem',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--cl-radius-sm)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
            }}
          >
            <Trash2 size={14} />
            Remove
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          style={{
            border: '2px dashed var(--border-color)',
            borderRadius: 'var(--cl-radius)',
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease',
          }}
        >
          <Upload size={24} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Drop your logo here or click to upload
          </p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
            PNG, SVG, or JPG — max 512KB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </div>
      )}
      {error && (
        <p style={{ color: 'var(--danger, #ef4444)', fontSize: '0.8125rem', margin: '0.5rem 0 0' }}>{error}</p>
      )}
    </div>
  )
}
