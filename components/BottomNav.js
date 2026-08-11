import { useRouter } from 'next/router'

export default function BottomNav({ activeTab }) {
  const router = useRouter()

  const tabs = [
    { id: 'caja', label: 'Caja', icon: '💰', path: '/dashboard' },
    { id: 'reportes', label: 'Reportes', icon: '📊', path: '/reportes' },
    { id: 'locales', label: 'Locales', icon: '🏪', path: '/locales' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
      <div className="max-w-2xl mx-auto flex justify-around">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => router.push(tab.path)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 cursor-pointer border-none bg-transparent transition-colors ${
                isActive 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className={`text-xs ${isActive ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}