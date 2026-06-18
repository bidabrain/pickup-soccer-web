import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import CreateMatchPage from './pages/CreateMatchPage'
import MatchDetailPage from './pages/MatchDetailPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/create" element={<CreateMatchPage />} />
      <Route path="/match/:id" element={<MatchDetailPage />} />
    </Routes>
  )
}
