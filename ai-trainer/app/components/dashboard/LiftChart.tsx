'use client'

import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface LiftRecord {
  id: string
  exercise_name: string
  max_weight: number
  recorded_at: string
}

interface LiftChartProps {
  liftRecords: LiftRecord[]
}

export default function LiftChart({ liftRecords }: LiftChartProps) {
  if (liftRecords.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted">
        <p>No lift data to display</p>
      </div>
    )
  }

  // Get the latest record for each exercise
  const latestLifts = liftRecords.reduce((acc, record) => {
    const existing = acc.find(item => item.exercise_name === record.exercise_name)
    if (!existing || new Date(record.recorded_at) > new Date(existing.recorded_at)) {
      return [...acc.filter(item => item.exercise_name !== record.exercise_name), record]
    }
    return acc
  }, [] as LiftRecord[])

  // Sort by max weight descending and take top 5
  const topLifts = latestLifts
    .sort((a, b) => b.max_weight - a.max_weight)
    .slice(0, 5)

  const data = {
    labels: topLifts.map(lift => lift.exercise_name),
    datasets: [
      {
        label: 'Max Weight (lbs)',
        data: topLifts.map(lift => lift.max_weight),
        backgroundColor: [
          '#22C55E',
          '#0EA5E9',
          '#8B5CF6',
          '#F59E0B',
          '#EF4444',
        ],
        borderRadius: 6,
        borderSkipped: false,
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
        callbacks: {
          label: function(context: any) {
            return `${context.parsed.y} lbs`
          }
        }
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#94A3B8',
          font: {
            size: 11,
          },
          maxRotation: 45,
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
      <Bar data={data} options={options} />
    </div>
  )
} 