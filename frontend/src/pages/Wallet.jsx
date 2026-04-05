import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Wallet as WalletIcon, TrendingUp, TrendingDown, CreditCard, Clock, Filter, X } from 'lucide-react';
import { Button } from '../components/ui/button';

const Wallet = () => {
  const [wallet, setWallet] = useState(null);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1 });
  const [filters, setFilters] = useState({
    transaction_type: '',
    source: '',
    status: ''
  });
  const [showBuyPoints, setShowBuyPoints] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchWalletData();
    fetchPointPackages();
  }, []);

  useEffect(() => {
    fetchTransactions(1);
  }, [filters]);

  const fetchWalletData = async () => {
    try {
      const [walletRes, summaryRes] = await Promise.all([
        api.get('/wallet'),
        api.get('/wallet/summary')
      ]);
      setWallet(walletRes.data.wallet);
      setSummary(summaryRes.data.summary);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (page = 1) => {
    try {
      setTransactionsLoading(true);
      const params = { page, limit: 20 };
      if (filters.transaction_type) params.transaction_type = filters.transaction_type;
      if (filters.source) params.source = filters.source;
      if (filters.status) params.status = filters.status;

      const response = await api.get('/wallet/transactions', { params });
      setTransactions(response.data.transactions);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const fetchPointPackages = async () => {
    try {
      const response = await api.get('/payments/packages');
      setPackages(response.data.packages || []);
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
  };

  const handleBuyPoints = async (packageId) => {
    try {
      const response = await api.post('/payments/create-order', { package_id: packageId });
      
      const options = {
        key: response.data.razorpay_key,
        amount: response.data.order.amount,
        currency: response.data.order.currency,
        name: 'SkillVerse',
        description: `Purchase ${response.data.order.points} points`,
        order_id: response.data.order.id,
        handler: async (paymentResponse) => {
          try {
            await api.post('/payments/verify', {
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature
            });
            
            setShowBuyPoints(false);
            fetchWalletData();
            fetchTransactions(1);
            alert('Points credited successfully!');
          } catch (error) {
            console.error('Payment verification failed:', error);
            alert('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          name: '',
          email: '',
          contact: ''
        },
        theme: {
          color: '#3B82F6'
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create order. Please try again.');
    }
  };

  const getTransactionIcon = (type) => {
    return type === 'credit' ? <TrendingUp className="h-5 w-5 text-green-500" /> : <TrendingDown className="h-5 w-5 text-red-500" />;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'failed': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">My Wallet</h1>
        <p className="text-muted-foreground">Manage your points and transactions</p>
      </div>

      {/* Wallet Overview */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <WalletIcon className="h-8 w-8" />
            <Button
              onClick={() => setShowBuyPoints(!showBuyPoints)}
              className="bg-white text-blue-600 hover:bg-blue-50"
              size="sm"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Buy Points
            </Button>
          </div>
          <p className="text-blue-100 text-sm mb-1">Current Balance</p>
          <p className="text-4xl font-bold">{wallet?.balance || 0}</p>
          <p className="text-blue-100 text-sm mt-1">points</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Purchased</p>
              <p className="text-2xl font-bold">{summary?.total_credits || 0}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{summary?.total_purchases || 0} transactions</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <TrendingDown className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Spent</p>
              <p className="text-2xl font-bold">{summary?.total_debits || 0}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{summary?.total_enrollments || 0} enrollments</p>
        </div>
      </div>

      {/* Buy Points Section */}
      {showBuyPoints && (
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Buy Point Packages</h2>
            <button onClick={() => setShowBuyPoints(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
            {packages.map((pkg) => (
              <div key={pkg.id} className="border border-border rounded-lg p-4 hover:border-primary transition-colors">
                <h3 className="font-semibold text-lg mb-2">{pkg.name}</h3>
                <div className="mb-4">
                  <p className="text-3xl font-bold text-primary">{pkg.points}</p>
                  {pkg.bonus_points > 0 && (
                    <p className="text-sm text-green-500">+{pkg.bonus_points} bonus</p>
                  )}
                  <p className="text-xs text-muted-foreground">points</p>
                </div>
                <p className="text-xl font-semibold mb-4">₹{pkg.price}</p>
                <Button
                  onClick={() => handleBuyPoints(pkg.id)}
                  className="w-full"
                  size="sm"
                >
                  Buy Now
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Transaction History</h2>
          <div className="flex gap-2">
            <select
              value={filters.transaction_type}
              onChange={(e) => setFilters({ ...filters, transaction_type: e.target.value })}
              className="px-3 py-2 border border-border rounded-lg text-sm"
            >
              <option value="">All Types</option>
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
            </select>
            <select
              value={filters.source}
              onChange={(e) => setFilters({ ...filters, source: e.target.value })}
              className="px-3 py-2 border border-border rounded-lg text-sm"
            >
              <option value="">All Sources</option>
              <option value="purchase">Purchase</option>
              <option value="enrollment">Enrollment</option>
              <option value="refund">Refund</option>
            </select>
          </div>
        </div>

        {transactionsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground">No transactions found</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-4">
                    {getTransactionIcon(tx.transaction_type)}
                    <div>
                      <p className="font-medium">
                        {tx.source === 'purchase' && tx.package_name}
                        {tx.source === 'enrollment' && tx.course_title}
                        {!tx.package_name && !tx.course_title && tx.source}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-semibold ${tx.transaction_type === 'credit' ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.transaction_type === 'credit' ? '+' : '-'}{tx.amount}
                    </p>
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full border ${getStatusColor(tx.status)}`}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  onClick={() => fetchTransactions(pagination.currentPage - 1)}
                  disabled={pagination.currentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>
                <span className="px-4 py-2 text-sm">
                  Page {pagination.currentPage} of {pagination.totalPages}
                </span>
                <Button
                  onClick={() => fetchTransactions(pagination.currentPage + 1)}
                  disabled={pagination.currentPage === pagination.totalPages}
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Wallet;
