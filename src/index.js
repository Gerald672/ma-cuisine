import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Reset CSS minimal
const style = document.createElement('style')
style.textContent = `
  :root { --serif: 'Young Serif', Georgia, serif; --ink: #2A2118; --leaf: #2F6B4A; --kernel: #F3E6CC; --caramel: #C98A3A; --paper: #EEF1EA; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--ink); -webkit-font-smoothing: antialiased; }
  h1, h2, h3 { font-family: var(--serif); font-weight: 400; letter-spacing: -0.005em; }
  input, select, button, textarea { font-family: inherit; }
  button { cursor: pointer; }
  :focus-visible { outline: 2px solid var(--caramel); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`
document.head.appendChild(style)

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<React.StrictMode><App /></React.StrictMode>)
