import { Component, type ReactNode } from 'react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-md p-6 text-center text-sm text-gray-600">
          <p className="mb-3">页面出错了。</p>
          <button
            onClick={() => location.assign(import.meta.env.BASE_URL)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-white"
          >
            返回首页
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
