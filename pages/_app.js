import '../styles/globals.css'
import { Toaster } from 'react-hot-toast'
import { UserRoleProvider } from '../lib/UserRoleContext'

export default function App({ Component, pageProps }) {
  return (
    <UserRoleProvider>
      <Component {...pageProps} />
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
            borderRadius: '8px',
            fontSize: '14px',
          },
        }}
      />
    </UserRoleProvider>
  )
}