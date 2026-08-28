import Modal from './Modal'

/** Reemplaza window.confirm(). */
export default function ConfirmDialog({ isOpen, onClose, onConfirm, title = '¿Confirmás?', message, confirmLabel = 'Confirmar', danger = false, loading = false }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm"
      footer={<>
        <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white cursor-pointer hover:bg-gray-50">Cancelar</button>
        <button onClick={onConfirm} disabled={loading}
          className={`px-4 py-2 rounded-lg text-white font-semibold cursor-pointer disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {loading ? 'Procesando…' : confirmLabel}
        </button>
      </>}>
      <p className="text-sm text-gray-700 m-0">{message}</p>
    </Modal>
  )
}
