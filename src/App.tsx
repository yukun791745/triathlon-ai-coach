import { BrowserRouter, Routes, Route } from 'react-router-dom'

function HomePage() {
  return <div className="p-4 text-2xl font-bold text-blue-600">ホームページ（仮）</div>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
