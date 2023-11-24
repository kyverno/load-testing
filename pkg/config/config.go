package config

import "time"

type LoadTestConfig struct {
	ConcurrentUsers int
	TotalRequests   int
	Timeout         time.Duration
}
