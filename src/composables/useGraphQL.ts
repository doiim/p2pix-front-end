import { ref, computed } from 'vue';
import { NetworkEnum } from '@/model/NetworkEnum';

export interface Transaction {
  id: string;
  type: 'deposit' | 'lock' | 'release' | 'return';
  timestamp: string;
  blockTimestamp: string;
  seller?: string;
  buyer?: string | null;
  amount: string;
  token: string;
  blockNumber: string;
  transactionHash: string;
}

export interface AnalyticsData {
  totalVolume: string;
  totalTransactions: string;
  totalLocks: string;
  totalDeposits: string;
  totalReleases: string;
}

export function useGraphQL(networkName: NetworkEnum) {
  const searchAddress = ref('');
  const selectedType = ref('all');
  const loading = ref(false);
  const error = ref<string | null>(null);
  const analyticsLoading = ref(false);
  
  const transactionsData = ref<Transaction[]>([]);
  const analyticsData = ref<AnalyticsData>({
    totalVolume: '0',
    totalTransactions: '0',
    totalLocks: '0',
    totalDeposits: '0',
    totalReleases: '0'
  });

  const getGraphQLUrl = (networkName: string) => {
    switch (networkName) {
      case 'sepolia':
        return import.meta.env.VITE_SEPOLIA_SUBGRAPH_URL || 'https://api.studio.thegraph.com/query/113713/p-2-pix/sepolia';
      case 'rootstockTestnet':
        return import.meta.env.VITE_RSK_SUBGRAPH_URL || 'https://api.studio.thegraph.com/query/113713/p-2-pix/1';
      default:
        return 'https://api.studio.thegraph.com/query/113713/p-2-pix/sepolia';
    }
  };

  const executeQuery = async (query: string, variables: any = {}) => {
    const url = getGraphQLUrl(networkName.toString());
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        throw new Error(data.errors[0]?.message || 'GraphQL error');
      }

      return data.data;
    } catch (err) {
      console.error('GraphQL query error:', err);
      throw err;
    }
  };

  const fetchAllActivity = async () => {
    loading.value = true;
    error.value = null;

    const query = `
      query GetAllActivity($first: Int = 50) {
        depositAddeds(first: $first, orderBy: "blockTimestamp", orderDirection: "desc") {
          id
          seller
          token
          amount
          blockNumber
          blockTimestamp
          transactionHash
        }
        depositWithdrawns(first: $first, orderBy: "blockTimestamp", orderDirection: "desc") {
          id
          seller
          token
          amount
          blockNumber
          blockTimestamp
          transactionHash
        }
        lockAddeds(first: $first, orderBy: "blockTimestamp", orderDirection: "desc") {
          id
          buyer
          lockID
          seller
          amount
          blockNumber
          blockTimestamp
          transactionHash
        }
        lockReleaseds(first: $first, orderBy: "blockTimestamp", orderDirection: "desc") {
          id
          buyer
          lockId
          amount
          blockNumber
          blockTimestamp
          transactionHash
        }
        lockReturneds(first: $first, orderBy: "blockTimestamp", orderDirection: "desc") {
          id
          buyer
          lockId
          blockNumber
          blockTimestamp
          transactionHash
        }
      }
    `;

    try {
      const data = await executeQuery(query, { first: 50 });
      transactionsData.value = processActivityData(data);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch transactions';
    } finally {
      loading.value = false;
    }
  };

  const fetchUserActivity = async (userAddress: string) => {
    loading.value = true;
    error.value = null;

    const query = `
      query GetUserActivity($userAddress: String!, $first: Int = 50) {
        depositAddeds(first: $first, where: { seller: $userAddress }, orderBy: "blockTimestamp", orderDirection: "desc") {
          id
          seller
          token
          amount
          blockNumber
          blockTimestamp
          transactionHash
        }
        depositWithdrawns(first: $first, where: { seller: $userAddress }, orderBy: "blockTimestamp", orderDirection: "desc") {
          id
          seller
          token
          amount
          blockNumber
          blockTimestamp
          transactionHash
        }
        lockAddeds(first: $first, where: { buyer: $userAddress }, orderBy: "blockTimestamp", orderDirection: "desc") {
          id
          buyer
          lockID
          seller
          amount
          blockNumber
          blockTimestamp
          transactionHash
        }
        lockReleaseds(first: $first, where: { buyer: $userAddress }, orderBy: "blockTimestamp", orderDirection: "desc") {
          id
          buyer
          lockId
          amount
          blockNumber
          blockTimestamp
          transactionHash
        }
        lockReturneds(first: $first, where: { buyer: $userAddress }, orderBy: "blockTimestamp", orderDirection: "desc") {
          id
          buyer
          lockId
          blockNumber
          blockTimestamp
          transactionHash
        }
      }
    `;

    try {
      const data = await executeQuery(query, { userAddress, first: 50 });
      transactionsData.value = processActivityData(data);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch user transactions';
    } finally {
      loading.value = false;
    }
  };

  const clearData = () => {
    transactionsData.value = [];
    analyticsData.value = {
      totalVolume: '0',
      totalTransactions: '0',
      totalLocks: '0',
      totalDeposits: '0',
      totalReleases: '0'
    };
  };

  const fetchAnalytics = async () => {
    analyticsLoading.value = true;

    const query = `
      query GetAnalytics {
        depositAddeds(first: 1000) {
          amount
          blockTimestamp
        }
        depositWithdrawns(first: 1000) {
          amount
          blockTimestamp
        }
        lockAddeds(first: 1000) {
          amount
          blockTimestamp
        }
        lockReleaseds(first: 1000) {
          amount
          blockTimestamp
        }
        lockReturneds(first: 1000) {
          blockTimestamp
        }
      }
    `;

    try {
      const data = await executeQuery(query);
      analyticsData.value = processAnalyticsData(data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      analyticsLoading.value = false;
    }
  };

  const processActivityData = (data: any): Transaction[] => {
    if (!data) return [];
    
    const activities: Transaction[] = [];
    
    if (data.depositAddeds) {
      data.depositAddeds.forEach((deposit: any) => {
        activities.push({
          id: deposit.id,
          blockNumber: deposit.blockNumber,
          blockTimestamp: deposit.blockTimestamp,
          transactionHash: deposit.transactionHash,
          type: 'deposit',
          seller: deposit.seller,
          buyer: undefined,
          amount: deposit.amount,
          token: deposit.token,
          timestamp: formatTimestamp(deposit.blockTimestamp)
        });
      });
    }
    
    if (data.depositWithdrawns) {
      data.depositWithdrawns.forEach((withdrawal: any) => {
        activities.push({
          id: withdrawal.id,
          blockNumber: withdrawal.blockNumber,
          blockTimestamp: withdrawal.blockTimestamp,
          transactionHash: withdrawal.transactionHash,
          type: 'deposit', // Treat as deposit withdrawal
          seller: withdrawal.seller,
          buyer: undefined,
          amount: withdrawal.amount,
          token: withdrawal.token,
          timestamp: formatTimestamp(withdrawal.blockTimestamp)
        });
      });
    }
    
    if (data.lockAddeds) {
      data.lockAddeds.forEach((lock: any) => {
        activities.push({
          id: lock.id,
          blockNumber: lock.blockNumber,
          blockTimestamp: lock.blockTimestamp,
          transactionHash: lock.transactionHash,
          type: 'lock',
          seller: lock.seller,
          buyer: lock.buyer,
          amount: lock.amount,
          token: lock.token,
          timestamp: formatTimestamp(lock.blockTimestamp)
        });
      });
    }
    
    if (data.lockReleaseds) {
      data.lockReleaseds.forEach((release: any) => {
        activities.push({
          id: release.id,
          blockNumber: release.blockNumber,
          blockTimestamp: release.blockTimestamp,
          transactionHash: release.transactionHash,
          type: 'release',
          seller: undefined, // Release doesn't have seller info
          buyer: release.buyer,
          amount: release.amount,
          token: 'BRZ', // Default token
          timestamp: formatTimestamp(release.blockTimestamp)
        });
      });
    }
    
    if (data.lockReturneds) {
      data.lockReturneds.forEach((returnTx: any) => {
        activities.push({
          id: returnTx.id,
          blockNumber: returnTx.blockNumber,
          blockTimestamp: returnTx.blockTimestamp,
          transactionHash: returnTx.transactionHash,
          type: 'return',
          seller: undefined, // Return doesn't have seller info
          buyer: returnTx.buyer,
          amount: '0', // Return doesn't have amount
          token: 'BRZ', // Default token
          timestamp: formatTimestamp(returnTx.blockTimestamp)
        });
      });
    }
    
    return activities.sort((a, b) => parseInt(b.blockTimestamp) - parseInt(a.blockTimestamp));
  };

  const formatTimestamp = (timestamp: string): string => {
    const now = Date.now() / 1000;
    const diff = now - parseInt(timestamp);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  const formatAmount = (amount: string): string => {
    const num = parseFloat(amount);
    if (num >= 1000000000000000) return `${(num / 1000000000000000).toFixed(1)}Q`;
    if (num >= 1000000000000) return `${(num / 1000000000000).toFixed(1)}T`;
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    if (num < 1) return num.toFixed(4);
    return num.toFixed(2);
  };

  const processAnalyticsData = (data: any): AnalyticsData => {
    if (!data) {
      return {
        totalVolume: '0',
        totalTransactions: '0',
        totalLocks: '0',
        totalDeposits: '0',
        totalReleases: '0'
      };
    }

    let totalVolume = 0;
    let totalTransactions = 0;
    let totalLocks = 0;
    let totalDeposits = 0;
    let totalReleases = 0;

    if (data.depositAddeds) {
      data.depositAddeds.forEach((deposit: any) => {
        totalVolume += parseFloat(deposit.amount || '0');
        totalTransactions++;
        totalDeposits++;
      });
    }

    if (data.depositWithdrawns) {
      data.depositWithdrawns.forEach((withdrawal: any) => {
        totalVolume += parseFloat(withdrawal.amount || '0');
        totalTransactions++;
      });
    }

    if (data.lockAddeds) {
      data.lockAddeds.forEach((lock: any) => {
        totalVolume += parseFloat(lock.amount || '0');
        totalTransactions++;
        totalLocks++;
      });
    }

    if (data.lockReleaseds) {
      data.lockReleaseds.forEach((release: any) => {
        totalVolume += parseFloat(release.amount || '0');
        totalTransactions++;
        totalReleases++;
      });
    }


    if (data.lockReturneds) {
      data.lockReturneds.forEach((returnTx: any) => {
        totalTransactions++;
      });
    }

    const result = {
      totalVolume: formatAmount(totalVolume.toString()),
      totalTransactions: totalTransactions.toString(),
      totalLocks: totalLocks.toString(),
      totalDeposits: totalDeposits.toString(),
      totalReleases: totalReleases.toString()
    };
    
    return result;
  };

  const filteredTransactions = computed(() => {
    let filtered = transactionsData.value;
    
    if (selectedType.value !== 'all') {
      filtered = filtered.filter(tx => tx.type === selectedType.value);
    }
    
    if (searchAddress.value) {
      const searchLower = searchAddress.value.toLowerCase();
      filtered = filtered.filter(tx => 
        tx.seller?.toLowerCase().includes(searchLower) ||
        tx.buyer?.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  });

  return {
    searchAddress,
    selectedType,
    transactions: filteredTransactions,
    analytics: analyticsData,
    loading,
    error,
    analyticsLoading,
    fetchAllActivity,
    fetchUserActivity,
    fetchAnalytics,
    clearData
  };
}
