import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { connectDiskWorkspace } from './engine/diskWorkspace'
import { useEntityStore } from './stores/useEntityStore'
import { useGlobalStore } from './stores/useGlobalStore'

const root = createRoot(document.getElementById('root'))
root.render(<p style={{ padding: 24, color: '#888', fontFamily: 'sans-serif' }}>Loading the workspace…</p>)

// ⚠️ The page draws only once the disk's workspace is in the stores: an edit made before that would be made on the browser's cache and then replaced.
connectDiskWorkspace({ store: useEntityStore, globalStore: useGlobalStore })
  .catch((err) => console.error('[CMS] The workspace on disk could not be connected:', err))
  .finally(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
