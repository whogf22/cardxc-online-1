import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const data = [
    { name: 'Mon', spend: 400 },
    { name: 'Tue', spend: 300 },
    { name: 'Wed', spend: 600 },
    { name: 'Thu', spend: 800 },
    { name: 'Fri', spend: 500 },
    { name: 'Sat', spend: 900 },
    { name: 'Sun', spend: 750 },
];

export default function SpendingChart() {
    return (
        <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-800/50 rounded-[2.5rem] p-8 mt-8 shadow-3d">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Expenditure Radar</h3>
                    <p className="text-2xl font-black text-white">$4,250.00 <span className="text-[10px] text-emerald-400 font-bold ml-2">+12.5%</span></p>
                </div>
                <div className="flex gap-2">
                    {['1W', '1M', '3M', '6M'].map((range) => (
                        <button
                            key={range}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${range === '1W'
                                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                                    : 'bg-slate-950/50 text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.5} />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#0f172a',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                color: '#fff'
                            }}
                            itemStyle={{ color: '#10b981' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="spend"
                            stroke="#10b981"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorSpend)"
                            animationDuration={2000}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
