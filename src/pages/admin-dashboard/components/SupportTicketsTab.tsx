import { useState } from 'react';
import { SUPPORT_EMAIL } from '../../../lib/contactPlaceholders';

export default function SupportTicketsTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Support Tickets</h2>
          <p className="text-slate-400 mt-1">Manage customer support inquiries</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20 rounded-2xl p-8 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <i className="ri-customer-service-2-line text-4xl text-blue-400"></i>
        </div>
        <h3 className="text-xl font-bold text-white mb-3">Support System Coming Soon</h3>
        <p className="text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
          The integrated support ticket system is currently under development. 
          For now, customer inquiries can be handled through email or external support channels.
        </p>
        <a 
          href={`mailto:${SUPPORT_EMAIL}`}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-blue-500/25"
        >
          <i className="ri-mail-line"></i>
          Email Support
        </a>
      </div>

      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
        <h3 className="text-lg font-bold text-white mb-4">Planned Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 rounded-xl p-5 border border-slate-700/30 group hover:border-blue-500/30 transition-colors">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <i className="ri-ticket-2-line text-2xl text-blue-400"></i>
            </div>
            <h4 className="text-white font-semibold mb-2">Ticket Management</h4>
            <p className="text-sm text-slate-400">Create, assign, and track support tickets</p>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-5 border border-slate-700/30 group hover:border-emerald-500/30 transition-colors">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <i className="ri-chat-1-line text-2xl text-emerald-400"></i>
            </div>
            <h4 className="text-white font-semibold mb-2">Live Chat</h4>
            <p className="text-sm text-slate-400">Real-time customer support chat</p>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-5 border border-slate-700/30 group hover:border-purple-500/30 transition-colors">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <i className="ri-file-list-3-line text-2xl text-purple-400"></i>
            </div>
            <h4 className="text-white font-semibold mb-2">Knowledge Base</h4>
            <p className="text-sm text-slate-400">Self-service FAQ and documentation</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 opacity-50">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none cursor-not-allowed"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                disabled
                className={`px-4 py-2.5 rounded-xl font-medium cursor-not-allowed whitespace-nowrap ${
                  filterStatus === status
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-900/50 text-slate-400 border border-slate-700'
                }`}
              >
                {status === 'all' ? 'All' : status.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden opacity-50">
        <div className="px-6 py-16 text-center">
          <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-ticket-2-line text-3xl text-slate-500"></i>
          </div>
          <p className="text-slate-400 font-medium">No tickets available yet</p>
        </div>
      </div>
    </div>
  );
}
