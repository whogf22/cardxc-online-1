interface Tab {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'pills' | 'underline';
}

export function Tabs({ tabs, activeTab, onChange, variant = 'pills' }: TabsProps) {
  if (variant === 'underline') {
    return (
      <div className="border-b border-dark-border">
        <div className="flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-lime-500 text-lime-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {tab.icon && <i className={`${tab.icon} text-lg`}></i>}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs font-semibold bg-lime-500/20 text-lime-400 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 p-1 bg-dark-elevated rounded-xl overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === tab.id
              ? 'bg-dark-card border border-dark-border text-white shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          {tab.icon && <i className={`${tab.icon} text-lg`}></i>}
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className={`ml-1 px-2 py-0.5 text-xs font-semibold rounded-full ${
              activeTab === tab.id
                ? 'bg-lime-500/20 text-lime-400'
                : 'bg-dark-card text-neutral-500'
            }`}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
