function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-emerald-800 px-4 py-4 flex items-center gap-2">
        <span className="text-white text-lg font-medium">Pickup Football</span>
      </header>
      <main className="max-w-md mx-auto p-4">
        <p className="text-sm text-gray-500 mb-3">当前预约场次</p>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">周三 6/18 · 19:00</p>
              <p className="text-sm text-gray-500">滨江体育公园 3 号场 · KST</p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              还差 2 人
            </span>
          </div>
          <div className="mt-3 flex gap-4 text-xs text-gray-500">
            <span>8 / 10</span>
            <span>¥25 / 人</span>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-gray-400">
          脚手架就绪 · 等待接入 API
        </p>
      </main>
    </div>
  )
}

export default App
