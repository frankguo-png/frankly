import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-[#0a1628]">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 h-[500px] w-[500px] rounded-full bg-blue-600/[0.05] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-purple-600/[0.04] blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-blue-500/[0.03] blur-[100px]" />
        {/* Dot pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm animate-fade-in">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/70 backdrop-blur-2xl p-8 shadow-2xl shadow-black/20 focus-within:border-blue-500/20 focus-within:shadow-[0_0_20px_-5px_rgba(59,130,246,0.15)] transition-all duration-200">
          <div className="mb-8 space-y-2 text-center">
            {/* Logo */}
            <div className="mb-5 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25">
                <span className="text-xl font-bold text-white">A</span>
              </div>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              Ampliwork
            </h1>
            <p className="text-sm text-[#5a6d82]">Sign in to Ampliwork</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
