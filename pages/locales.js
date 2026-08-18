<header className="bg-white border-b border-gray-200 sticky top-0 z-10">
  <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
    <div>
      <h1 className="m-0 text-lg font-bold text-gray-900"> Mis Locales</h1>
      <p className="mt-0.5 text-xs text-gray-500">{misLocales.length} {misLocales.length === 1 ? 'local asignado' : 'locales asignados'}</p>
    </div>
    <div className="flex gap-2">
      <RoleGate allowedRoles={['owner', 'super_user']}>
        <button onClick={() => router.push('/reportes')} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-emerald-200">
          📊 Reportes
        </button>
      </RoleGate>
      <RoleGate allowedRoles={['owner', 'super_user']}>
        <button onClick={() => router.push('/admin')} className="px-3 py-1.5 bg-purple-100 text-purple-700 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-purple-200">
          ⚙️ Administración
        </button>
      </RoleGate>
      <button onClick={handleSignOut} className="px-3 py-1.5 bg-gray-100 text-gray-500 border-none rounded-md text-xs font-medium cursor-pointer hover:bg-gray-200">Salir</button>
    </div>
  </div>
</header>
