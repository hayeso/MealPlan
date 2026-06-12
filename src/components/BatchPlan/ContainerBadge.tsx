const CONTAINER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  B: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  C: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  D: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  E: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
}

export function getContainerColor(label: string) {
  const letter = label.charAt(0).toUpperCase()
  return CONTAINER_COLORS[letter] || { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' }
}

interface Props {
  label: string
  size?: 'sm' | 'md'
}

export default function ContainerBadge({ label, size = 'sm' }: Props) {
  const color = getContainerColor(label)
  const sizeClasses = size === 'md'
    ? 'px-3 py-1 text-sm'
    : 'px-2 py-0.5 text-xs'

  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${color.bg} ${color.text} ${color.border} ${sizeClasses}`}>
      {label}
    </span>
  )
}
