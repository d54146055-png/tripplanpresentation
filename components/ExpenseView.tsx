

import React, { useState, useMemo, useEffect } from 'react';
import { Expense, User, TripSettings } from '../types';
import { Plus, DollarSign, Wallet, ArrowRight, Trash2, RefreshCw, UserCog, Check, X, ClipboardList, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { addExpenseItem, addUser, deleteExpenseItem, updateUser, deleteUser } from '../services/firebaseService';

interface Props {
  expenses: Expense[];
  users: User[];
  settings: TripSettings;
}

const ExpenseView: React.FC<Props> = ({ expenses, users, settings }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({ amount: 0, payer: '' });
  const [selectedInvolved, setSelectedInvolved] = useState<string[]>([]);
  const [newUser, setNewUser] = useState('');
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingName, setEditingName] = useState('');
  
  const [converterAmount, setConverterAmount] = useState<string>('');
  
  const convertedValue = converterAmount ? (parseFloat(converterAmount) * settings.currencyRate).toFixed(2) : '0';

  useEffect(() => {
     if (users.length > 0) {
         if (!newExpense.payer) setNewExpense(prev => ({ ...prev, payer: users[0].name }));
         if (selectedInvolved.length === 0) setSelectedInvolved(users.map(u => u.name));
     }
  }, [users.length, isModalOpen]);

  // Robust Calculations
  const calculations = useMemo(() => {
    if (!users || users.length === 0) {
        return { debts: [], balances: {}, totalPaid: {}, totalShare: {} };
    }
    
    const balances: Record<string, number> = {};
    const totalPaid: Record<string, number> = {};
    const totalShare: Record<string, number> = {};

    users.forEach(u => {
        balances[u.name] = 0;
        totalPaid[u.name] = 0;
        totalShare[u.name] = 0;
    });

    expenses.forEach(exp => {
      const paidBy = exp.payer;
      const amount = Number(exp.amount) || 0;
      
      const validInvolved = (exp.involved || []).filter(name => users.some(u => u.name === name));
      const splitAmong = validInvolved.length > 0 ? validInvolved : users.map(u => u.name);
      
      const share = amount / splitAmong.length;

      if (totalPaid[paidBy] !== undefined) totalPaid[paidBy] += amount;
      if (balances[paidBy] !== undefined) balances[paidBy] += amount;
      
      splitAmong.forEach(person => {
        if (balances[person] !== undefined) {
             balances[person] -= share;
             totalShare[person] += share;
        }
      });
    });

    // Debt Simplification Engine
    const debts: Array<{from: string, to: string, amount: number}> = [];
    let debtors = Object.entries(balances).filter(([_, val]) => val < -0.01).sort((a, b) => a[1] - b[1]);
    let creditors = Object.entries(balances).filter(([_, val]) => val > 0.01).sort((a, b) => b[1] - a[1]);

    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i];
      const c = creditors[j];
      const amount = Math.min(Math.abs(d[1]), c[1]);
      
      if (amount > 0.01) {
          debts.push({ from: d[0], to: c[0], amount: Math.round(amount) });
      }

      debtors[i] = [d[0], d[1] + amount];
      creditors[j] = [c[0], c[1] - amount];

      if (Math.abs(debtors[i][1]) < 0.01) i++;
      if (creditors[j][1] < 0.01) j++;
    }

    return { debts, balances, totalPaid, totalShare };
  }, [expenses, users]);

  const totalSpent = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const handleAddUser = async () => {
    if (newUser.trim() && !users.find(u => u.name === newUser.trim())) {
      await addUser(newUser.trim());
      setNewUser('');
    }
  };

  const toggleInvolved = (name: string) => {
      setSelectedInvolved(prev => 
        prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
      );
  };

  const handleAddExpense = async () => {
    if (newExpense.amount && newExpense.description && newExpense.payer && selectedInvolved.length > 0) {
      await addExpenseItem({
        amount: Number(newExpense.amount),
        description: newExpense.description!,
        payer: newExpense.payer!,
        date: new Date().toISOString(),
        involved: selectedInvolved
      });
      setIsModalOpen(false);
      setNewExpense({ amount: 0, payer: users[0]?.name });
    } else if (selectedInvolved.length === 0) {
        alert("Select at least one person.");
    }
  };

  return (
    <div className="h-full overflow-y-auto p-5 pb-24 space-y-6 no-scrollbar">
      
      {/* Currency Converter */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-sand">
        <div className="flex items-center justify-between mb-3 text-latte text-xs font-bold uppercase">
           <span>Quick Convert</span>
           <span className="flex items-center"><RefreshCw size={10} className="mr-1"/> 1 {settings.currencyCode} ≈ {settings.currencyRate}</span>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex-1">
             <div className="text-xs text-gray-400 mb-1">{settings.currencyCode}</div>
             <input 
                type="number" 
                value={converterAmount}
                onChange={(e) => setConverterAmount(e.target.value)}
                placeholder="1000"
                className="w-full bg-cream p-2 rounded-xl font-bold text-cocoa text-lg focus:outline-none"
             />
           </div>
           <ArrowRight className="text-sand" />
           <div className="flex-1">
             <div className="text-xs text-gray-400 mb-1">Home (Approx)</div>
             <div className="w-full bg-cocoa p-2 rounded-xl font-bold text-white text-lg flex items-center h-[44px]">
                {Number(convertedValue).toLocaleString()}
             </div>
           </div>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-br from-cocoa to-[#4E342E] rounded-[2rem] p-6 text-white shadow-xl relative">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sand text-sm font-medium mb-1 opacity-80">Total Spent</p>
                <h2 className="text-4xl font-serif font-bold tracking-tight">{settings.currencyCode} {totalSpent.toLocaleString()}</h2>
            </div>
            <button onClick={() => setIsSettlementOpen(true)} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                <ClipboardList size={20} className="text-sand" />
            </button>
        </div>

        <div className="mt-6 flex items-center justify-between overflow-hidden">
            <div className="flex -space-x-2 overflow-x-auto no-scrollbar flex-1 mr-4">
            {users.map((u) => (
                <button key={u.id} onClick={() => { setSelectedUser(u); setEditingName(u.name); }} className="w-8 h-8 rounded-full bg-latte border-2 border-cocoa flex items-center justify-center text-xs font-bold uppercase text-white shadow-md flex-shrink-0">
                  {u.name.charAt(0)}
                </button>
            ))}
            </div>
            
            <div className="flex bg-white/10 rounded-full p-1 pl-3 items-center backdrop-blur-sm">
                <input className="bg-transparent text-white text-xs w-16 focus:outline-none placeholder-white/50" placeholder="New Name..." value={newUser} onChange={e => setNewUser(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddUser()} />
                <button onClick={handleAddUser} className="bg-white text-cocoa rounded-full p-1"><Plus size={12} /></button>
            </div>
        </div>
      </div>

      {/* Settlement Section */}
      {users.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-sand">
              <AlertCircle className="mx-auto mb-3 text-latte" size={32} />
              <p className="text-sm text-gray-400">Add travelers above<br/>to start tracking!</p>
          </div>
      ) : calculations.debts.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-sand">
           <h3 className="text-cocoa font-bold mb-4 flex items-center text-xs uppercase">
             <Wallet className="mr-2 text-latte" size={16}/> Settlement
           </h3>
           <div className="space-y-3">
             {calculations.debts.map((d, i) => (
               <div key={i} className="flex items-center justify-between p-3 bg-cream rounded-xl border border-sand/50">
                 <div className="flex items-center gap-2 text-sm">
                   <span className="font-bold text-cocoa">{d.from}</span>
                   <ArrowRight size={14} className="text-latte" />
                   <span className="font-bold text-cocoa">{d.to}</span>
                 </div>
                 <span className="font-bold text-accent">{settings.currencyCode} {d.amount.toLocaleString()}</span>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* Recent Expenses */}
      <div className="space-y-4">
        <h3 className="text-cocoa font-bold ml-1 text-sm uppercase">Recent Expenses</h3>
        {expenses.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bg-white rounded-3xl border border-dashed border-sand text-sm">No expenses yet</div>
        ) : (
            expenses.map(expense => (
                <div key={expense.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-transparent hover:border-sand transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-cream flex items-center justify-center text-cocoa">
                            <DollarSign size={18} />
                        </div>
                        <div>
                            <p className="font-bold text-cocoa text-sm">{expense.description}</p>
                            <div className="flex items-center text-[10px] text-latte gap-2 font-bold">
                                <span>{expense.payer} paid</span>
                                {expense.involved && expense.involved.length < users.length && (
                                    <span className="bg-sand/30 px-1.5 rounded">
                                        Split: {expense.involved.length}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="font-bold text-cocoa">{settings.currencyCode} {Number(expense.amount).toLocaleString()}</span>
                        <button onClick={() => deleteExpenseItem(expense.id)} className="text-sand hover:text-red-400">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ))
        )}
      </div>

       {/* Add Button */}
       <button onClick={() => setIsModalOpen(true)} className="fixed bottom-24 right-6 w-14 h-14 bg-cocoa text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-latte transition-transform z-20">
        <Plus size={28} />
      </button>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-cocoa/30 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl animate-[float_0.3s_ease-out] max-h-[85vh] overflow-y-auto no-scrollbar">
            <h2 className="text-xl font-serif font-bold text-cocoa mb-6 text-center">New Expense</h2>
            <div className="space-y-6">
               <div className="text-center">
                  <label className="text-[10px] font-bold text-latte uppercase tracking-widest">Amount ({settings.currencyCode})</label>
                  <input type="number" className="w-full text-4xl font-serif font-bold p-2 border-b border-sand focus:outline-none bg-transparent text-center text-cocoa placeholder-sand" placeholder="0" value={newExpense.amount || ''} onChange={e => setNewExpense({...newExpense, amount: Number(e.target.value)})} />
               </div>
               <div>
                 <label className="text-xs font-bold text-latte uppercase">Item</label>
                 <input type="text" className="w-full p-3 bg-cream rounded-xl mt-2 text-cocoa focus:outline-none" placeholder="e.g. Dinner, Taxi..." value={newExpense.description || ''} onChange={e => setNewExpense({...newExpense, description: e.target.value})} />
               </div>
               
               <div>
                 <label className="text-xs font-bold text-latte uppercase">Who paid?</label>
                 <div className="flex flex-wrap gap-2 mt-2">
                    {users.map(u => (
                        <button key={u.id} onClick={() => setNewExpense({...newExpense, payer: u.name})} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${newExpense.payer === u.name ? 'bg-cocoa text-white' : 'bg-cream text-gray-500'}`}>
                            {u.name}
                        </button>
                    ))}
                 </div>
               </div>

               <div>
                 <div className="flex justify-between items-center">
                     <label className="text-xs font-bold text-latte uppercase">Split amongst</label>
                     <button onClick={() => setSelectedInvolved(selectedInvolved.length === users.length ? [] : users.map(u => u.name))} className="text-[10px] text-accent font-bold">
                        {selectedInvolved.length === users.length ? 'Deselect All' : 'Select All'}
                     </button>
                 </div>
                 <div className="grid grid-cols-2 gap-2 mt-2">
                    {users.map(u => (
                        <button key={`inv-${u.id}`} onClick={() => toggleInvolved(u.name)} className={`flex items-center p-2 rounded-xl text-sm font-bold transition-all border ${selectedInvolved.includes(u.name) ? 'bg-cream border-cocoa text-cocoa' : 'bg-white border-sand text-gray-300'}`}>
                            {selectedInvolved.includes(u.name) ? <CheckSquare size={16} className="mr-2 text-cocoa"/> : <Square size={16} className="mr-2"/>}
                            {u.name}
                        </button>
                    ))}
                 </div>
               </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-latte font-bold">Cancel</button>
              <button onClick={handleAddExpense} className="flex-1 py-3 bg-accent text-white rounded-xl font-bold shadow-lg">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      {isSettlementOpen && (
        <div className="fixed inset-0 bg-cocoa/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
                <button onClick={() => setIsSettlementOpen(false)} className="absolute top-4 right-4 text-gray-400"><X size={24} /></button>
                <h2 className="text-2xl font-serif font-bold text-cocoa mb-1 text-center">Settlement</h2>
                <div className="space-y-4 mb-8">
                    {users.map(u => {
                        const balance = calculations.balances[u.name] || 0;
                        const isPositive = balance >= 0;
                        return (
                            <div key={u.id} className="bg-cream rounded-xl p-3 border border-sand/50">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-cocoa">{u.name}</span>
                                    <span className={`text-sm font-bold ${isPositive ? 'text-green-600' : 'text-accent'}`}>
                                        {isPositive ? 'Receives' : 'Owes'} {settings.currencyCode} {Math.abs(Math.round(balance)).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
      )}

      {/* User Edit Modal */}
      {selectedUser && (
          <div className="fixed inset-0 bg-cocoa/30 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white rounded-[2rem] w-full max-w-xs p-6 shadow-2xl">
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-cocoa flex items-center"><UserCog size={18} className="mr-2"/> Edit User</h2>
                    <button onClick={() => setSelectedUser(null)}><X size={18} className="text-gray-400"/></button>
                 </div>
                 <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} className="w-full p-3 bg-cream rounded-xl font-bold text-center focus:outline-none" />
                 <div className="flex flex-col gap-2 mt-6">
                    <button onClick={async () => { if (selectedUser && editingName.trim()) { await updateUser(selectedUser.id, editingName.trim()); setSelectedUser(null); } }} className="w-full py-3 bg-cocoa text-white rounded-xl font-bold flex items-center justify-center"><Check size={16} className="mr-2" /> Save</button>
                    <button onClick={async () => { if (selectedUser && confirm(`Remove ${selectedUser.name}?`)) { await deleteUser(selectedUser.id); setSelectedUser(null); } }} className="w-full py-3 bg-white border border-red-100 text-red-400 rounded-xl font-bold flex items-center justify-center"><Trash2 size={16} className="mr-2" /> Remove</button>
                 </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default ExpenseView;
