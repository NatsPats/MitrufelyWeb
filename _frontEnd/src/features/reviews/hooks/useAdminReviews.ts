import { useQuery } from '@tanstack/react-query'
import { reviewsApi } from '../api/reviews.api'

export function useAdminReviewsQuery(limit: number = 50, offset: number = 0) {
  return useQuery({
    queryKey: ['admin-reviews', limit, offset],
    queryFn: () => reviewsApi.listReviews(limit, offset),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useReviewMetricsQuery() {
  return useQuery({
    queryKey: ['admin-reviews-metrics'],
    queryFn: () => reviewsApi.getReviewMetrics(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
