'use client'

import { useState } from 'react'
import { login, signup } from './actions'

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData, action: 'login' | 'signup') {
    setError(null)
    const result =
      action === 'login'
        ? await login(formData)
        : await signup(formData)

    if (result?.error) {
      setError(result.error)
    }
    // On success, redirect() throws and navigation happens
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        {/* Logo & Slogan */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-primary">Seo-Ro</h1>
          <p className="mt-2 text-sm text-foreground/70">
            A Station where Books meet People
          </p>
        </div>

        {/* Glassmorphism Card */}
        <div className="rounded-2xl border border-white/40 bg-white/60 p-6 shadow-md backdrop-blur-md">
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIsSignup(false)
                setError(null)
              }}
              className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
                !isSignup
                  ? 'bg-primary text-white'
                  : 'bg-white/50 text-foreground/70 hover:bg-white/70'
              }`}
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignup(true)
                setError(null)
              }}
              className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
                isSignup
                  ? 'bg-primary text-white'
                  : 'bg-white/50 text-foreground/70 hover:bg-white/70'
              }`}
            >
              회원가입
            </button>
          </div>

          <form
            action={(fd) => handleSubmit(fd, isSignup ? 'signup' : 'login')}
            className="flex flex-col gap-4"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="example@email.com"
                className="w-full rounded-lg border border-white/40 bg-white/80 px-4 py-2.5 text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {isSignup && (
              <div>
                <label
                  htmlFor="nickname"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  닉네임
                </label>
                <input
                  id="nickname"
                  name="nickname"
                  type="text"
                  required={isSignup}
                  autoComplete="nickname"
                  placeholder="닉네임을 입력하세요"
                  className="w-full rounded-lg border border-white/40 bg-white/80 px-4 py-2.5 text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                className="w-full rounded-lg border border-white/40 bg-white/80 px-4 py-2.5 text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-accent">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="mt-1 w-full rounded-full bg-primary py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {isSignup ? '회원가입' : '로그인'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
