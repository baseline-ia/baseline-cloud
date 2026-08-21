'use client'

import { useRef, useState } from 'react'
import { Upload, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-md overflow-hidden border flex items-center justify-center bg-muted/50">
            <img src={preview} alt="Logo" className="max-w-full max-h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{filename}</p>
            <p className="text-xs text-muted-foreground">
              {saving ? 'Saving...' : 'Active'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemove}
            disabled={saving}
          >
            <Trash2 size={14} />
            Remove
          </Button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent/50"
        >
          <Upload size={24} className="mx-auto text-muted-foreground mb-2" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Drop your logo here or click to upload
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            PNG, SVG, or JPG — max 512KB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </div>
      )}
      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive text-sm font-medium px-3 py-2 mt-3">
          {error}
        </div>
      )}
    </div>
  )
}
