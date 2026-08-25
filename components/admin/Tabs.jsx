export default function Tabs({ tabs, activa, onChange }) {
  return (
    <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto" role="tablist">
      {tabs.map(t => (
        <button key={t.id} role="tab" aria-selected={activa === t.id} onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-sm font-semibold cursor-pointer border-none rounded-t-lg whitespace-nowrap transition-colors ${
            activa === t.id ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          {t.label}
        </button>
      ))}
    </div>
  )
}
