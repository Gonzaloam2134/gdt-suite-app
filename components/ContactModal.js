import React from 'react'

export default function ContactModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-xl font-bold mb-4 text-gray-900">Contacto / Soporte</h2>
        <p className="mb-4 text-gray-600">
          ¿Necesitás ayuda? Escribinos a soporte@gdtsuite.com
        </p>
        <button 
          onClick={onClose}
          className="w-full py-2 bg-blue-500 text-white font-semibold rounded hover:bg-blue-600 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}