import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import bgImage from '../../assets/background-image.JPG';
import nipponLogo from '../../assets/Nippon Logo.png';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

export const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuthContext();
  const [email, setEmail] = useState(() => localStorage.getItem('todo_remembered_email') || 'admin@gmail.com');
  const [password, setPassword] = useState('admin@123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('todo_remember_me') === 'true');
  const [isLoading, setIsLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // Set auth tokens and user for Todo system
      const token = 'todo_jwt_token_sample_2026';
      const defaultUser = {
        id: 1,
        name: 'iyyu',
        email: normalizedEmail,
        role: 'CREATOR',
        department: 'Production Planning'
      };
      login(defaultUser, token);
      localStorage.setItem('todo_token', token);
      localStorage.setItem('4m_todo_token', token);

      if (rememberMe) {
        localStorage.setItem('todo_remembered_email', email);
        localStorage.setItem('todo_remember_me', 'true');
      } else {
        localStorage.removeItem('todo_remembered_email');
        localStorage.removeItem('todo_remember_me');
      }

      setSuccessMsg('Welcome back! Authenticating as Request Creator...');
      setIsLoading(false);

      setTimeout(() => {
        navigate('/system-selection');
      }, 500);

    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Server error. Please make sure the backend is running.';
      setErrorMsg(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] min-h-screen w-full overflow-y-auto lg:overflow-hidden font-sans bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Light overlay backdrop for optimal text readability */}
      <div className="absolute inset-0 bg-transparent z-0 pointer-events-none" />

      {/* Left Panel: Animated Change Pipeline */}
      <div className="relative hidden lg:flex flex-col justify-between p-[48px] overflow-hidden z-10">
        {/* Abstract background gradient orbits */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(124,58,237,0.05)_0%,transparent_50%),radial-gradient(circle_at_80%_70%,rgba(6,182,212,0.05)_0%,transparent_50%)] pointer-events-none z-0" />
        <div className="absolute -inset-[50%] bg-[conic-gradient(from_0deg,transparent_0%,rgba(124,58,237,0.005)_25%,transparent_50%,rgba(6,182,212,0.005)_75%,transparent_100%)] animate-slow-rotate pointer-events-none z-0" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-[12px]">
          <img src={nipponLogo} alt="Nippon Logo" className="h-[40px] w-auto object-contain select-none" />
          <span className="font-heading text-[24px] font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">Todo</span>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-[12px] text-slate-500 font-medium">
          &copy; {new Date().getFullYear()} Todo Management System. All rights reserved.
        </div>
      </div>

      {/* Right Panel: Form Side */}
      <div className="relative flex items-center justify-center lg:justify-end lg:pr-[105px] p-[16px] sm:p-[32px] z-10 min-h-screen lg:min-h-0">
        <div className="w-full max-w-[400px] animate-fade-in-up my-auto lg:my-0">
          {/* Logo on mobile/tablet */}
          <div className="flex lg:hidden items-center gap-[12px] mb-[24px] justify-center">
            <img src={nipponLogo} alt="Nippon Logo" className="h-[36px] w-auto object-contain select-none" />
            <span className="font-heading text-[24px] font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">Todo</span>
          </div>

          <div className="mb-[24px] px-[8px] sm:px-0 text-center lg:text-left">
            <h2 className="font-heading text-[30px] font-bold tracking-tight text-slate-900 mb-[6px]">
              Welcome Back
            </h2>
            <p className="text-blue-800 text-[14px]">
              Enter your credentials to manage your requests
            </p>
          </div>

          <div className="relative bg-white/95 border border-slate-200/90 rounded-[20px] p-[24px] sm:p-[32px] backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* Glowing border effects */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent" />

            {/* Error Message */}
            {errorMsg && (
              <div className="flex items-start gap-[12px] p-[12px] bg-rose-50 border border-rose-200 rounded-[12px] text-rose-700 text-[14px] mb-[20px]">
                <AlertCircle className="shrink-0 mt-0.5" size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="flex items-start gap-[12px] p-[12px] bg-emerald-50 border border-emerald-200 rounded-[12px] text-emerald-700 text-[14px] mb-[20px]">
                <CheckCircle2 className="shrink-0 mt-0.5" size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-[18px]">
              {/* Email */}
              <div className="space-y-[6px]">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider" htmlFor="email">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <input
                    id="email"
                    type="email"
                    className="w-full bg-[#f8fafc] border border-slate-200 focus:border-violet-600 focus:ring-4 focus:ring-violet-600/10 rounded-[12px] py-[12px] pl-[44px] pr-[16px] text-slate-800 placeholder-slate-400 outline-none transition-all text-[14px]"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                  <Mail className="absolute left-[16px] text-slate-400 focus-within:text-violet-600 pointer-events-none" size={18} />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-[8px]">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider" htmlFor="password">
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="w-full bg-[#f8fafc] border border-slate-200 focus:border-violet-600 focus:ring-4 focus:ring-violet-600/10 rounded-[12px] py-[12px] pl-[44px] pr-[44px] text-slate-800 placeholder-slate-400 outline-none transition-all text-[14px]"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <Lock className="absolute left-[16px] text-slate-400 pointer-events-none" size={18} />
                  <button
                    type="button"
                    className="absolute right-[16px] text-slate-400 hover:text-slate-700 transition-colors cursor-pointer p-1"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={isLoading}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-[8px]">
                <input
                  type="checkbox"
                  id="rememberMe"
                  className="w-[16px] h-[16px] text-violet-600 bg-slate-50 border-slate-300 rounded focus:ring-violet-500 cursor-pointer accent-[#6320ee]"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                />
                <label htmlFor="rememberMe" className="text-[14px] text-slate-600 cursor-pointer select-none">
                  Remember me
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-[12px] bg-[#5e2ae2] hover:bg-[#5021c9] text-white font-semibold text-[14px] rounded-[12px] transition-all shadow-md shadow-violet-600/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-[8px] transform active:scale-[0.98] cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Mobile/Tablet Footer */}
          <div className="block lg:hidden text-center text-[12px] text-slate-400 mt-[32px] pb-[16px]">
            &copy; {new Date().getFullYear()} Todo Management System. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
