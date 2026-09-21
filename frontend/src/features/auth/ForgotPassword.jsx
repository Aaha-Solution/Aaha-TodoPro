import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { authService } from '../../services/authService';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await authService.forgotPassword(email);
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-slate-900">
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: `url('/images/login-bg.png')` }}
      />
      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-xl rounded-[28px] p-8 shadow-2xl border border-white">
        <button
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Login
        </button>

        <h2 className="text-2xl font-bold text-slate-900">Reset Password</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          Enter your registered enterprise email address and we will send password reset instructions.
        </p>

        {submitted ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <p className="text-sm font-semibold text-emerald-800">Check your inbox</p>
            <p className="text-xs text-emerald-600">
              We've dispatched recovery steps to <b>{email}</b>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold tracking-wider text-slate-700 uppercase mb-1.5">
                ENTERPRISE EMAIL
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="iyyu@gmail.com"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-500/10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm shadow-md transition"
            >
              {loading ? 'Sending link...' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
