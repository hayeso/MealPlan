import { useState } from 'react'
import { api } from '../api/client'
import type { RecipeDraft, RecipeOut } from '../types/api'
import ReviewDraft from '../components/Import/ReviewDraft'

type Tab = 'url' | 'html' | 'photo'

function detectSocialPlatform(url: string): 'tiktok' | 'instagram' | null {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase().replace(/^www\./, '')
    if (host.includes('tiktok.com')) return 'tiktok'
    if (host.includes('instagram.com')) return 'instagram'
  } catch {
    return null
  }
  return null
}

export default function ImportPage() {
  const [tab, setTab] = useState<Tab>('url')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<RecipeDraft | null>(null)
  const [batchDrafts, setBatchDrafts] = useState<RecipeDraft[]>([])
  const [saved, setSaved] = useState<RecipeOut[]>([])

  const [url, setUrl] = useState('')

  async function handleUrlImport() {
    if (!url.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await api.post<{ draft: RecipeDraft }>('/import/url', { url: url.trim() })
      setDraft(res.draft)
    } catch (e: any) {
      setError(e.message || 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const [htmlFile, setHtmlFile] = useState<File | null>(null)
  const [batchTotal, setBatchTotal] = useState(0)

  async function handleHtmlUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setHtmlFile(file)
    await loadHtmlBatch(file, 0)
  }

  async function loadHtmlBatch(file: File, offset: number) {
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.postForm<{ drafts: RecipeDraft[]; total: number }>(
        `/import/html?limit=10&offset=${offset}`,
        fd
      )
      setBatchTotal(res.total)
      if (offset === 0 && res.drafts.length === 1 && res.total === 1) {
        setDraft(res.drafts[0])
      } else {
        setBatchDrafts(prev => offset === 0 ? res.drafts : [...prev, ...res.drafts])
      }
    } catch (err: any) {
      setError(err.message || 'HTML import failed')
    } finally {
      setLoading(false)
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.postForm<{ draft: RecipeDraft }>('/import/ocr', fd)
      setDraft(res.draft)
    } catch (err: any) {
      setError(err.message || 'OCR import failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm(editedDraft: RecipeDraft) {
    setLoading(true)
    setError('')
    try {
      const recipe = await api.post<RecipeOut>('/import/confirm', editedDraft)
      setSaved(prev => [...prev, recipe])
      setDraft(null)
      // If there are more batch drafts, don't clear them
    } catch (err: any) {
      setError(err.message || 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmAll() {
    setLoading(true)
    setError('')
    let successCount = 0
    for (const d of batchDrafts) {
      try {
        const recipe = await api.post<RecipeOut>('/import/confirm', d)
        setSaved(prev => [...prev, recipe])
        successCount++
      } catch {
        // Continue with the rest
      }
    }
    setBatchDrafts([])
    setLoading(false)
    if (successCount === 0) {
      setError('Failed to save any recipes')
    }
  }

  function resetAll() {
    setSaved([])
    setDraft(null)
    setBatchDrafts([])
    setUrl('')
    setError('')
  }

  function startManualCreate() {
    const blank: RecipeDraft = {
      name: '',
      servings: 4,
      cuisine: null,
      source: 'Manual',
      source_url: null,
      prep_time_mins: null,
      cook_time_mins: null,
      calories: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      make_ahead_type: 'none',
      storage_days: null,
      reheat_instructions: null,
      steps: [
        {
          step_number: 1,
          instruction: '',
          cooking_method: null,
          step_type: 'cook_fresh',
          can_cook_ahead: false,
          ingredients: [],
        },
      ],
    }
    setDraft(blank)
    setError('')
  }

  // Show success screen when we have saved recipes and no more to review
  if (saved.length > 0 && !draft && batchDrafts.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <div className="bg-green-50 border border-green-200 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-green-800 mb-2">
            {saved.length} Recipe{saved.length !== 1 ? 's' : ''} Saved!
          </h2>
          <ul className="text-green-700 mb-4 space-y-1">
            {saved.map(r => (
              <li key={r.id}>{r.name}</li>
            ))}
          </ul>
          <div className="flex gap-3 justify-center">
            <button onClick={resetAll} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
              Import More
            </button>
            <a href="/recipes" className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              View Recipe Box
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Single draft review screen
  if (draft) {
    const isManual = draft.source === 'Manual' && !draft.name
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="font-display text-2xl mb-4 text-text">
          {isManual || draft.source === 'Manual' ? 'Create Recipe' : 'Review Imported Recipe'}
        </h1>
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">{error}</div>}
        <ReviewDraft
          draft={draft}
          onConfirm={handleConfirm}
          onCancel={() => setDraft(null)}
          loading={loading}
        />
      </div>
    )
  }

  // Batch review screen -- list of parsed recipes
  if (batchDrafts.length > 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Imported Recipes</h1>
            <p className="text-sm text-gray-500">
              {batchDrafts.length} of {batchTotal} recipes parsed from HTML file
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmAll}
              disabled={loading}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium"
            >
              {loading ? 'Saving...' : 'Save All'}
            </button>
            <button onClick={resetAll} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
              Cancel
            </button>
          </div>
        </div>
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">{error}</div>}
        {saved.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-sm text-green-700">
            {saved.length} recipe{saved.length !== 1 ? 's' : ''} saved so far
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {batchDrafts.map((d, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-1">{d.name || 'Untitled'}</h3>
              <div className="text-xs text-gray-400 space-x-2 mb-3">
                {d.cuisine && <span>{d.cuisine}</span>}
                {d.prep_time_mins != null && <span>Prep: {d.prep_time_mins}m</span>}
                {d.cook_time_mins != null && <span>Cook: {d.cook_time_mins}m</span>}
                <span>Serves {d.servings}</span>
                <span>{d.steps.length} steps</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setDraft(d); setBatchDrafts(prev => prev.filter((_, idx) => idx !== i)) }}
                  className="text-xs px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100"
                >
                  Review & Edit
                </button>
                <button
                  onClick={async () => {
                    try {
                      const recipe = await api.post<RecipeOut>('/import/confirm', d)
                      setSaved(prev => [...prev, recipe])
                      setBatchDrafts(prev => prev.filter((_, idx) => idx !== i))
                    } catch {}
                  }}
                  className="text-xs px-3 py-1.5 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setBatchDrafts(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-xs px-3 py-1.5 text-red-400 hover:text-red-600"
                >
                  Skip
                </button>
              </div>
            </div>
          ))}
        </div>
        {batchDrafts.length + saved.length < batchTotal && htmlFile && (
          <button
            onClick={() => loadHtmlBatch(htmlFile, batchDrafts.length + saved.length)}
            disabled={loading}
            className="mt-4 w-full py-3 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 disabled:opacity-50 font-medium"
          >
            {loading ? 'Loading...' : `Load More (${batchTotal - batchDrafts.length - saved.length} remaining)`}
          </button>
        )}
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'url', label: 'From URL' },
    { id: 'html', label: 'HTML File' },
    { id: 'photo', label: 'Photo (OCR)' },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-3xl text-text">Import a Recipe</h1>
        <button
          type="button"
          onClick={startManualCreate}
          className="min-h-[44px] px-4 py-2 border border-border rounded-xl hover:border-accent text-sm font-medium text-text"
        >
          Create Manually
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-surface p-1 rounded-xl border border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setError('') }}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition min-h-[44px] ${
              tab === t.id ? 'bg-surface-elevated shadow text-accent' : 'text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-danger/10 text-danger p-3 rounded-xl mb-4">{error}</div>}

      {tab === 'url' && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Paste a recipe URL, TikTok link, or Instagram reel. Video recipes may need edits after import — check ingredients and steps.
          </p>
          {detectSocialPlatform(url) && (
            <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
              {detectSocialPlatform(url) === 'tiktok' ? 'TikTok' : 'Instagram'}
            </span>
          )}
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://www.tiktok.com/... or https://www.instagram.com/reel/..."
            className="w-full px-4 py-3 min-h-[44px] border border-border rounded-xl bg-surface-elevated text-text focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
          <button
            onClick={handleUrlImport}
            disabled={loading || !url.trim()}
            className="w-full min-h-[48px] py-3 bg-accent text-white rounded-xl font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? detectSocialPlatform(url)
                ? 'Extracting recipe from video… this can take up to a minute'
                : 'Importing...'
              : 'Import Recipe'}
          </button>
        </div>
      )}

      {tab === 'html' && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Upload a RecipeKeeper HTML export file. All recipes in the file will be parsed.</p>
          <label className="block border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-accent transition min-h-[120px] flex items-center justify-center">
            <input type="file" accept=".html,.htm" onChange={handleHtmlUpload} className="hidden" disabled={loading} />
            <div className="text-muted">
              {loading ? 'Processing recipes...' : 'Click to select HTML file'}
            </div>
          </label>
        </div>
      )}

      {tab === 'photo' && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Upload a photo of a recipe page from a cookbook.</p>
          <label className="block border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-accent transition min-h-[120px] flex items-center justify-center">
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={loading} />
            <div className="text-muted">
              {loading ? 'Processing image...' : 'Click to select or take a photo'}
            </div>
          </label>
        </div>
      )}
    </div>
  )
}
