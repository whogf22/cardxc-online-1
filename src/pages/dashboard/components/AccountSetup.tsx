interface AccountSetupProps {
  profile: any;
}

export default function AccountSetup({ profile }: AccountSetupProps) {
  const setupSteps = [
    {
      title: 'Complete Profile',
      description: 'Add your personal information',
      completed: !!profile?.full_name && !!profile?.email,
      icon: 'ri-user-line',
      color: 'emerald',
    },
    {
      title: 'Verify Email',
      description: 'Confirm your email address',
      completed: !!profile?.email,
      icon: 'ri-mail-check-line',
      color: 'blue',
    },
    {
      title: 'Add Payment Method',
      description: 'Link your bank account',
      completed: false,
      icon: 'ri-bank-card-line',
      color: 'purple',
    },
    {
      title: 'Enable 2FA',
      description: 'Secure your account',
      completed: false,
      icon: 'ri-shield-check-line',
      color: 'orange',
    },
  ];

  const completedSteps = setupSteps.filter(step => step.completed).length;
  const progress = (completedSteps / setupSteps.length) * 100;

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-xl p-6 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-white">Account Setup</h3>
            <p className="text-sm text-slate-400 mt-1">{completedSteps} of {setupSteps.length} completed</p>
          </div>
          <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
            <span className="text-white font-bold text-sm">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Setup Steps */}
        <div className="space-y-3">
          {setupSteps.map((step, index) => (
            <div
              key={index}
              className={`flex items-center gap-4 p-4 rounded-xl transition-all cursor-pointer ${
                step.completed
                  ? 'bg-emerald-500/20 border border-emerald-500/30'
                  : 'bg-white/5 border border-white/10 hover:bg-white/10'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                step.completed
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/10 text-white'
              }`}>
                {step.completed ? (
                  <i className="ri-check-line text-lg"></i>
                ) : (
                  <i className={`${step.icon} text-lg`}></i>
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${
                  step.completed ? 'text-white' : 'text-slate-300'
                }`}>
                  {step.title}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{step.description}</p>
              </div>
              {!step.completed && (
                <i className="ri-arrow-right-line text-slate-400"></i>
              )}
            </div>
          ))}
        </div>

        {/* CTA Button */}
        {completedSteps < setupSteps.length && (
          <button className="w-full mt-6 py-3 bg-white hover:bg-slate-50 text-slate-900 font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-lg hover:shadow-xl">
            Complete Setup
          </button>
        )}
      </div>
    </div>
  );
}
