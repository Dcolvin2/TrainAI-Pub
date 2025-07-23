'use client'

import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface WeightLog {
  id: string
  weight: number
  logged_at: string
}

interface WeightChartProps {
  weightLogs: WeightLog[]
}

export default function WeightChart({ weightLogs }: WeightChartProps) {
  if (weightLogs.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted">
        <p>No weight data to display</p>
      </div>
    )
  }

  const sortedLogs = [...weightLogs].sort((a, b) => 
    new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  )

  const data = {
    labels: sortedLogs.map(log => 
      new Date(log.logged_at).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
    ),
    datasets: [
      {
        label: 'Weight (lbs)',
        data: sortedLogs.map(log => log.weight),
        borderColor: '#22C55E',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#22C55E',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1E293B',
        titleColor: '#E2E8F0',
        bodyColor: '#E2E8F0',
        borderColor: '#334155',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: {
          color: '#334155',
          drawBorder: false,
        },
        ticks: {
          color: '#94A3B8',
          font: {
            size: 12,
          },
        },
      },
      y: {
        grid: {
          color: '#334155',
          drawBorder: false,
        },
        ticks: {
          color: '#94A3B8',
          font: {
            size: 12,
          },
        },
      },
    },
  }

  return (
    <div className="h-48">
      <Line data={data} options={options} />
    </div>
  )
} 