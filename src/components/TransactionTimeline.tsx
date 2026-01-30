interface TransactionTimelineProps {
  status: 'pending' | 'completed' | 'failed';
  type: 'deposit' | 'withdrawal';
  createdAt: string;
  completedAt?: string;
}

export function TransactionTimeline({ status, type, createdAt, completedAt }: TransactionTimelineProps) {
  const steps = [
    {
      id: 'initiated',
      label: 'Initiated',
      description: `${type === 'deposit' ? 'Deposit' : 'Withdrawal'} request received`,
      icon: 'ri-file-list-3-line',
      completed: true,
    },
    {
      id: 'processing',
      label: 'Processing',
      description: 'Verifying transaction details',
      icon: 'ri-loader-4-line',
      completed: status !== 'pending',
    },
    {
      id: 'completed',
      label: status === 'failed' ? 'Failed' : 'Completed',
      description: status === 'failed' 
        ? 'Transaction could not be completed' 
        : `${type === 'deposit' ? 'Funds added' : 'Funds sent'} successfully`,
      icon: status === 'failed' ? 'ri-close-circle-line' : 'ri-checkbox-circle-line',
      completed: status === 'completed' || status === 'failed',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Transaction Status</h3>
      
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step.completed
                    ? status === 'failed' && step.id === 'completed'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-green-100 text-green-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                <i className={`${step.icon} text-lg ${step.id === 'processing' && status === 'pending' ? 'animate-spin' : ''}`}></i>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-0.5 h-12 ${
                    step.completed ? 'bg-green-300' : 'bg-gray-200'
                  }`}
                ></div>
              )}
            </div>

            <div className="flex-1 pb-4">
              <div className="flex items-center justify-between mb-1">
                <h4
                  className={`font-medium ${
                    step.completed ? 'text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </h4>
                {step.id === 'initiated' && (
                  <span className="text-xs text-gray-500">
                    {new Date(createdAt).toLocaleString()}
                  </span>
                )}
                {step.id === 'completed' && completedAt && (
                  <span className="text-xs text-gray-500">
                    {new Date(completedAt).toLocaleString()}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <i className="ri-information-line text-blue-600 text-lg flex-shrink-0 mt-0.5"></i>
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Why does this take time?</p>
            <p className="text-blue-700">
              {type === 'deposit'
                ? 'We verify all deposits to ensure security and compliance. Your balance will update automatically once verification is complete.'
                : 'Withdrawals are reviewed for security. We process them as quickly as possible while maintaining the highest safety standards.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
