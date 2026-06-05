'use client'

import { useEffect, useState } from 'react'
import { FilterTabs } from '@/components/proprietario/relatorios/FilterTabs'
import { ChannelFilters } from '@/components/proprietario/relatorios/ChannelFilters'
import { Chart } from '@/components/proprietario/relatorios/Chart'
import { MetricsTable } from '@/components/proprietario/relatorios/MetricsTable'
import { RankingCard } from '@/components/proprietario/relatorios/RankingCard'
import { PopularSearches } from '@/components/proprietario/relatorios/PopularSearches'
import { getAnalytics } from '@/lib/analyticsQueries'

export default function RelatorioPage() {
  const [period, setPeriod] = useState('mes')
  const [analyticsData, setAnalyticsData] = useState<any[]>([])

  useEffect(() => {
    const fetchAnalytics = async () => {
      const data = await getAnalytics({ period })
      setAnalyticsData(data)
    }

    fetchAnalytics()
  }, [period])

const [data, setData] = useState([])

useEffect(() => {
  async function load() {
    const res = await getAnalytics({
      propertyId: 'ID_DO_USUARIO',
      startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
      endDate: new Date().toISOString(),
    })

    setData(res)
  }

  load()
}, [])



  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Relatório de Desempenho</h1>
          <p className="text-gray-500">Dados dos últimos 30 dias</p>
        </div>
        <FilterTabs value={period} onChange={setPeriod} />
      </div>

      {/* CHANNEL FILTERS */}
      <ChannelFilters />

      {/* CHART */}
      <div className="bg-white rounded-2xl shadow p-4">
        <Chart />
      </div>

      {/* METRICS TABLE */}
      <div className="bg-white rounded-2xl shadow p-4">
        <MetricsTable />
      </div>

      {/* BOTTOM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RankingCard />
        <PopularSearches />
      </div>
    </div>
  )
}