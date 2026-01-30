import { useState } from 'react';

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
      <div className="border-b border-slate-200">
        <div className="flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon && <i className={`${tab.icon} text-lg`}></i>}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs font-semibold bg-sky-100 text-sky-700 rounded-full">
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
    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === tab.id
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {tab.icon && <i className={`${tab.icon} text-lg`}></i>}
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className={`ml-1 px-2 py-0.5 text-xs font-semibold rounded-full ${
              activeTab === tab.id
                ? 'bg-sky-100 text-sky-700'
                : 'bg-slate-200 text-slate-600'
            }`}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
