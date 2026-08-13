import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, User, ArrowRight, Loader2, FileText, Sparkles, Database, CheckCircle2 } from 'lucide-react';
import apiClient from '../api/client';

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = isSignup ? '/auth/signup' : '/auth/login';
      const payload = isSignup ? { name, email, password } : { email, password };

      const response = await apiClient.post(endpoint, payload);
      const { token, user } = response.data;

      localStorage.setItem('doctalk_token', token);
      localStorage.setItem('doctalk_user', JSON.stringify(user));

      navigate('/documents');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-[#07090e]">
      {/* Background Glowing Ambient Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-96 bg-purple-600/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        
        {/* Left Side: Product Value Proposition */}
        <div className="lg:col-span-6 space-y-6 text-left hidden lg:block">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold badge-cyan">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Privacy-First Private RAG Intelligence</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Ask your PDFs anything with <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">exact page citations</span>.
          </h1>

          <p className="text-slate-400 text-sm leading-relaxed max-w-md">
            DocTalk parses contracts, papers, and textbooks, vectorizing chunks into isolated collections so you get instant answers anchored directly to source pages.
          </p>

          <div className="space-y-3 pt-2">
            {[
              { icon: ShieldCheck, title: '100% Isolated Data', desc: 'Each document stays in a private, per-user vector index.' },
              { icon: FileText, title: 'Page-Level Citations', desc: 'Every claim links directly to the exact page & paragraph.' },
              { icon: Database, title: 'Zero Third-Party Training', desc: 'Your uploaded files are never used to train public models.' }
            ].map((feat, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/80">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
                  <feat.icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">{feat.title}</h4>
                  <p className="text-xs text-slate-400">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Auth Card Form */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto glass-panel p-8 shadow-2xl relative">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 mb-4 shadow-lg shadow-indigo-500/30">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white">Welcome to DocTalk</h2>
            <p className="text-xs text-slate-400 mt-1">
              {isSignup ? 'Create your account to start querying PDFs' : 'Log in to your private document workspace'}
            </p>
          </div>

          {/* Toggle Tabs */}
          <div className="grid grid-cols-2 bg-slate-950/80 p-1.5 rounded-xl mb-6 border border-slate-800/80">
            <button
              type="button"
              onClick={() => { setIsSignup(false); setError(null); }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                !isSignup ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => { setIsSignup(true); setError(null); }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                isSignup ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs leading-relaxed flex items-start gap-2">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 mt-6"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>{isSignup ? 'Create Free Account' : 'Log In to Dashboard'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center pt-5 border-t border-slate-800/80">
            <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Isolated user collections & strict privacy guarantees
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
